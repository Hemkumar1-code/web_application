const express = require('express');
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS Configuration
const corsOptions = {
    origin: '*', // Allow all origins (or specify your Vercel frontend URL)
    methods: 'GET,POST,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization'
};

app.use(cors(corsOptions));
app.use(express.json());

// Handle Preflight Requests
app.options('*', cors(corsOptions));

const handler = async (req, res) => {
    try {
        const { punchNumber, scanData, startScan, endScan, timestamp } = req.body;

        if (!punchNumber || !scanData) {
            return res.status(400).json({ message: 'Missing punch number or scan data' });
        }

        // Excel creation matching server.js logic
        const excelData = [
            {
                "Punch Number": punchNumber,
                Scanned: 20,
                "Start Scan Number": startScan || scanData,
                "End Scan Number": endScan || scanData,
            },
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws["!cols"] = [
            { wch: 15 },
            { wch: 10 },
            { wch: 20 },
            { wch: 20 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Scan Data");
        const excelBuffer = XLSX.write(wb, {
            bookType: "xlsx",
            type: "buffer",
        });

        // Email setup
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: process.env.EMAIL_USER,
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: "hemk3672@gmail.com",
            subject: `Scan Update - ${punchNumber}`,
            text: `Scan: ${scanData}`,
            attachments: [
                {
                    filename: `scan_${punchNumber}.xlsx`,
                    content: excelBuffer,
                },
            ],
        };

        // Try sending email
        try {
            if (process.env.GOOGLE_REFRESH_TOKEN) {
                const info = await transporter.sendMail(mailOptions);
                console.log("Mail sent:", info.response);
            } else {
                console.warn("No Refresh Token provided, skipping email.");
            }
        } catch (mailErr) {
            console.warn("Mail failed (but proceeding):", mailErr.message);
        }

        return res.json({ message: "Success" });
    } catch (err) {
        console.error("Server Error:", err);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'Ok', timestamp: new Date() }));
app.post('/api/submit', handler);
app.post('/submit', handler); // Fallback

app.get('/', (req, res) => {
    res.send('API is running');
});

// Start server if run locally
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running locally on http://localhost:${PORT}`);
    });
}

module.exports = app;
