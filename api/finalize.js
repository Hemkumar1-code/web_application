// Allow CORS helper
const allowCors = (fn) => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

const handler = async (req, res) => {
    // Mock finalize - or implement logic if known.
    // Since original server.js didn't have it, we return success to allow UI flow.
    const { punchNumber } = req.body;
    console.log(`Finalizing batch for ${punchNumber}`);

    return res.status(200).json({
        batchCompleted: true,
        message: "Batch finalized successfully (Processed by Serverless Function)"
    });
};

module.exports = allowCors(handler);
