const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
    connectLambda(event);
    const archiveStore = getStore("archives");

    try {
        if (event.httpMethod === "POST") {
            const entry = JSON.parse(event.body);
            const { userId } = entry;
            const recordId = Date.now().toString();
            // Key format: userId_recordId
            await archiveStore.set(`${userId}_${recordId}`, JSON.stringify({ ...entry, id: recordId, timestamp: Date.now() }));
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        if (event.httpMethod === "GET") {
            const userId = event.queryStringParameters.id;
            if (!userId) return { statusCode: 400, body: "Missing id" };

            const result = await archiveStore.list({ prefix: `${userId}_` });
            const rows = [];
            for (const blob of result.blobs) {
                const item = await archiveStore.get(blob.key, { type: "json" });
                if (!item) continue; // skip missing/corrupt blobs
                rows.push({ ...item, blobKey: blob.key });
            }
            // Sort by timestamp descending
            rows.sort((a, b) => b.timestamp - a.timestamp);
            return { statusCode: 200, body: JSON.stringify(rows) };
        }

        if (event.httpMethod === "DELETE") {
            const rawId = event.queryStringParameters.id;
            if (!rawId) return { statusCode: 400, body: JSON.stringify({ success: false, error: "Missing id" }) };
            // Decode in case the key was URL-encoded by the frontend
            const blobKey = decodeURIComponent(rawId);
            await archiveStore.delete(blobKey);
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, body: "Method Not Allowed" };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
    }
};
