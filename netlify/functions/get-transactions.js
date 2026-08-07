const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
    connectLambda(event);
    try {
        const userId = event.queryStringParameters.id;
        if (!userId) {
            return { statusCode: 400, body: JSON.stringify({ success: false, error: "Missing userId" }) };
        }

        const txStore = getStore("transactions");
        const result = await txStore.list({ prefix: `${userId}_` });
        
        const transactions = [];
        for (const blob of result.blobs) {
            const tx = await txStore.get(blob.key, { type: "json" });
            transactions.push({ ...tx, blobKey: blob.key });
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, transactions })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
    }
};
