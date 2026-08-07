let currentUser = JSON.parse(localStorage.getItem('walletUser')) || null;
let currentData = { savings: 0, expenses: 0, date: "" };
let selectedCategories = [];
let myChart = null;
let isSaving = false;

window.onload = async () => {
    if (currentUser) {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        await refreshData();
    }
};

async function refreshData() {
    await fetchTransactions();
    updateDashboard();
}

function formatPHP(amount) {
    const val = parseFloat(amount) || 0;
    return "₱" + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toggleAuth(showSignUp) {
    document.getElementById('login-card').style.display = showSignUp ? 'none' : 'block';
    document.getElementById('signup-card').style.display = showSignUp ? 'block' : 'none';
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function renderReport() {
    openModal('modal-report');
    const chartContainer = document.querySelector('.chart-container');
    if (currentData.savings === 0 && currentData.expenses === 0) {
        chartContainer.style.display = 'none';
        return;
    }
    chartContainer.style.display = 'block';
    const ctx = document.getElementById('savingsChart').getContext('2d');
    if (myChart) myChart.destroy();
    
    myChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Savings', 'Expenses'],
            datasets: [{
                data: [Math.abs(currentData.savings), Math.abs(currentData.expenses)],
                backgroundColor: ['#2a9d8f', '#e63946'],
                borderWidth: 1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

async function handleSignUp() {
    const user = document.getElementById('reg-user').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();
    const confirm = document.getElementById('reg-confirm').value.trim();
    if (!user || !pass) return alert("Please fill fields");
    if (pass !== confirm) return alert("Passwords do not match");

    try {
        const res = await fetch("/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (data.success) alert("Account created! Please log in.");
        else alert(data.error);
    } catch (err) { alert("Server error during signup."); }
}

async function handleLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    if (!user || !pass) return alert("Please enter credentials");

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = { username: user, id: data.userId };
            localStorage.setItem('walletUser', JSON.stringify(currentUser));
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('app-container').style.display = 'flex';
            await refreshData();
        } else alert(data.error || "Login failed");
    } catch (err) { alert("Check your internet connection."); }
}

function showPage(pageId) {
    document.getElementById('page-dashboard').style.display = pageId === 'dashboard' ? 'block' : 'none';
    document.getElementById('page-archive').style.display = pageId === 'archive' ? 'block' : 'none';
    if (pageId === 'archive') renderArchive();
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('walletUser');
    currentData = { savings: 0, expenses: 0, date: "" };
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
}

async function fetchTransactions() {
    if (!currentUser || !currentUser.id) return;
    try {
        const res = await fetch(`/.netlify/functions/get-transactions?id=${currentUser.id}`);
        const data = await res.json();
        if (data.success) {
            let savings = 0;
            let expenses = 0;
            let latestDate = "";
            (data.transactions || []).forEach(t => {
                const amount = parseFloat(t.amount) || 0;
                if (t.type === 'savings') savings += amount;
                if (t.type === 'expense') expenses += amount;
                if (!latestDate || t.date > latestDate) latestDate = t.date;
            });
            currentData.savings = savings;
            currentData.expenses = expenses;
            currentData.date = latestDate || currentData.date;
        }
    } catch (err) { console.error("Fetch error:", err); }
}

async function saveSavings() {
    if (!currentUser || isSaving) return;
    const amtInput = document.getElementById('savings-amount');
    const amt = parseFloat(amtInput.value) || 0;
    const dateInput = document.getElementById('savings-date');
    const date = dateInput.value;
    if (amt <= 0) return alert("Enter valid amount");
    if (!date) return alert("Please select a date");

    const btn = document.querySelector("#modal-savings .btn-confirm");
    const originalText = btn.innerText;
    
    try {
        isSaving = true;
        btn.innerText = "Saving...";
        btn.disabled = true;

        const res = await fetch("/transaction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: currentUser.id, type: 'savings', amount: amt, date: date, category: '' })
        });
        const data = await res.json();
        if (data.success) {
            amtInput.value = "";
            currentData.savings += amt;
            currentData.date = date;
            updateDashboard();
            closeModal('modal-savings');
        } else alert(data.error);
    } catch (err) { alert("Network error"); }
    finally {
        isSaving = false;
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function toggleCategory(btn, cat) {
    btn.classList.toggle('active');
    if (btn.classList.contains('active')) selectedCategories.push(cat);
    else selectedCategories = selectedCategories.filter(c => c !== cat);
}

async function saveExpense() {
    if (!currentUser || isSaving) return;
    const amtInput = document.getElementById('expense-amount');
    const amt = parseFloat(amtInput.value) || 0;
    const dateInput = document.getElementById('expense-date');
    const date = dateInput.value;
    if (amt <= 0) return alert("Enter valid amount");
    if (!date) return alert("Please select a date");

    const btn = document.querySelector("#modal-expense .btn-confirm");
    const originalText = btn.innerText;

    let cats = selectedCategories.join(", ");
    let otherInput = document.getElementById('expense-other');
    if (otherInput.value) cats += (cats ? ", " : "") + otherInput.value;

    try {
        isSaving = true;
        btn.innerText = "Saving...";
        btn.disabled = true;

        const res = await fetch("/transaction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: currentUser.id, type: 'expense', amount: amt, date: date, category: cats })
        });
        const data = await res.json();
        if (data.success) {
            amtInput.value = "";
            otherInput.value = "";
            selectedCategories = [];
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            currentData.expenses += amt;
            currentData.date = date;
            updateDashboard();
            closeModal('modal-expense');
        } else alert(data.error);
    } catch (err) { alert("Network error"); }
    finally {
        isSaving = false;
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function updateDashboard() {
    document.getElementById('stat-savings').innerText = formatPHP(currentData.savings);
    document.getElementById('stat-expenses').innerText = formatPHP(currentData.expenses);
    const bal = currentData.savings - currentData.expenses;
    const balEl = document.getElementById('stat-balance');
    balEl.innerText = formatPHP(bal);
    balEl.style.color = bal < 0 ? "#e63946" : "#20c997";
    document.getElementById('display-date').innerText = currentData.date || "Select date in entries";

    document.getElementById('rep-savings').innerText = formatPHP(currentData.savings);
    document.getElementById('rep-expenses').innerText = formatPHP(currentData.expenses);
    document.getElementById('rep-balance').innerText = formatPHP(bal);
}

async function resetCurrentPeriod() {
    if (!confirm("Are you sure? This will delete all your CURRENT transactions (not archives).")) return;
    try {
        const res = await fetch(`/.netlify/functions/add-transaction?userId=${currentUser.id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            // Re-fetch from DB to confirm real cleared state
            currentData = { savings: 0, expenses: 0, date: "" };
            await fetchTransactions();
            updateDashboard();
            alert("Current period history cleared!");
        } else alert(data.error || "Reset failed");
    } catch (err) { console.error(err); alert("Reset failed. Please try again."); }
}

async function archiveCurrentData(isManual = true) {
    if (!currentUser || isSaving) return;
    if (currentData.savings === 0 && currentData.expenses === 0) {
        if (isManual) alert("Nothing to archive!");
        return;
    }

    isSaving = true;
    try {
        const entry = {
            userId: currentUser.id,
            savings: currentData.savings,
            expenses: currentData.expenses,
            balance: currentData.savings - currentData.expenses,
            date: currentData.date
        };

        const archiveRes = await fetch("/archive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry)
        });
        const archiveData = await archiveRes.json();

        if (archiveData.success) {
            // Delete all current transactions after successful archive
            const delRes = await fetch(`/.netlify/functions/add-transaction?userId=${currentUser.id}`, { method: "DELETE" });
            const delData = await delRes.json();
            if (!delData.success) {
                alert("Archive saved but failed to clear transactions. Please use Reset.");
            }
            // Re-fetch real state from DB to ensure consistency
            currentData = { savings: 0, expenses: 0, date: "" };
            await fetchTransactions();
            updateDashboard();
            await renderArchive();
            if (isManual) alert("Summarized and history archived successfully!");
        } else alert(archiveData.error || "Archive failed");
    } catch (err) { console.error(err); alert("Error archiving. Please try again."); }
    finally { isSaving = false; }
}

async function renderArchive() {
    if (!currentUser) return;
    const container = document.getElementById('archive-list');
    if (!container) return;
    container.innerHTML = "Loading...";

    try {
        const res = await fetch(`/.netlify/functions/archive?id=${currentUser.id}`);
        const rows = await res.json();
        container.innerHTML = "";

        if (Array.isArray(rows)) {
            rows.forEach(item => {
                const div = document.createElement('div');
                div.className = 'archive-item';
                div.innerHTML = `
                    <div style="flex:1">
                        <strong>Period: ${item.date || 'N/A'}</strong><br>
                        <span style="font-size:0.85rem; color:#666;">Archived on ${new Date(item.timestamp).toLocaleDateString()}</span><br>
                        <div style="margin-top:5px; font-weight:bold;">
                            Sav: <span style="color:#20c997">${formatPHP(item.savings)}</span> | 
                            Exp: <span style="color:#e63946">${formatPHP(item.expenses)}</span> | 
                            Bal: ${formatPHP(item.balance)}
                        </div>
                    </div>
                    <button onclick="deleteArchive('${item.blobKey}')" style="background:#e63946; color:white; border:none; padding:8px 12px; cursor:pointer; border-radius:5px; font-weight:bold;">Delete</button>
                `;
                container.appendChild(div);
            });
            if (rows.length === 0) container.innerHTML = "<p style='text-align:center;'>No archived summaries.</p>";
        }
    } catch (err) { container.innerHTML = "Error loading archives."; }
}

async function deleteArchive(id) {
    if (!confirm("Are you sure?")) return;
    try {
        const res = await fetch(`/.netlify/functions/archive?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            await renderArchive(); // await so the list is refreshed before control returns
        } else alert(data.error || "Delete failed");
    } catch (err) { console.error(err); alert("Delete failed. Please try again."); }
}