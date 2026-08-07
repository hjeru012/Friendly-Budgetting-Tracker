const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
    connectLambda(event);
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { username, password } = JSON.parse(event.body);
        if (!username || !password) {
            return { statusCode: 400, body: JSON.stringify({ success: false, error: "Username and password required" }) };
        }

        const usersStore = getStore("users");
        
        // Check if user exists
        const existingUser = await usersStore.get(username, { type: "json" });
        if (existingUser) {
            return { statusCode: 400, body: JSON.stringify({ success: false, error: "Username is already taken" }) };
        }

        // Create user (Note: In a production app, password should be hashed!)
        const userId = Date.now().toString();
        await usersStore.set(username, JSON.stringify({ username, password, userId }));

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, userId })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
    }
};
