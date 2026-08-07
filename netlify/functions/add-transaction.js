const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
    connectLambda(event);
    
    try {
        const txStore = getStore("transactions");

        if (event.httpMethod === "DELETE") {
            const blobKey = event.queryStringParameters.id;
            const userId = event.queryStringParameters.userId; // For clearing all

            if (userId && !blobKey) {
                // Clear ALL transactions for this user
                const result = await txStore.list({ prefix: `${userId}_` });
                for (const blob of result.blobs) {
                    await txStore.delete(blob.key);
                }
                return { statusCode: 200, body: JSON.stringify({ success: true, message: "History cleared" }) };
            }

            if (!blobKey) return { statusCode: 400, body: "Missing id" };
            await txStore.delete(blobKey);
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        if (event.httpMethod !== "POST") {
            return { statusCode: 405, body: "Method Not Allowed" };
        }

        const transaction = JSON.parse(event.body);
        const { userId } = transaction;
        const txId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
        
        // Key format: userId_txId
        const blobKey = `${userId}_${txId}`;
        await txStore.set(blobKey, JSON.stringify({ ...transaction, id: txId, blobKey }));

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
    }
};
