const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Basic CORS
app.use(cors());
app.use(express.json());

// Import handlers to ensure consistency with Vercel deployment
const scanHandler = require('./scan');
const finalizeHandler = require('./finalize');

// Mount routes
// Note: scanHandler and finalizeHandler wrap logic in allowCors(), 
// which is fine as it just sets headers and calls the internal function.
app.post('/api/scan', scanHandler);
app.post('/api/finalize', finalizeHandler);

// Fallback old route support if needed (can remove later)
app.post('/api/submit', scanHandler);

app.get('/', (req, res) => {
    res.send('API is running. Use /api/scan or /api/finalize.');
});

// Start server if run directly (node api/index.js)
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running locally on http://localhost:${PORT}`);
    });
}

module.exports = app;
