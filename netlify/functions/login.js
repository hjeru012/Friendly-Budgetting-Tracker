const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
    connectLambda(event);
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { username, password } = JSON.parse(event.body);
        const usersStore = getStore("users");
        
        const userData = await usersStore.get(username, { type: "json" });

        if (userData && userData.password === password) {
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, userId: userData.userId })
            };
        } else {
            return {
                statusCode: 401,
                body: JSON.stringify({ success: false, error: "Invalid username or password" })
            };
        }
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
    }
};
