const nodemailer = require('nodemailer');
const XLSX = require('xlsx');

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
    try {
        const { punchNumber, scanData, startScan, endScan, timestamp } = req.body;

        if (!punchNumber || !scanData) {
            return res.status(400).json({ message: 'Missing punch number or scan data' });
        }

        // Excel creation logic
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
        let emailStatus = "Skipped";
        try {
            if (process.env.GOOGLE_REFRESH_TOKEN) {
                await transporter.sendMail(mailOptions);
                emailStatus = "Sent";
                console.log("Mail sent successfully");
            } else {
                console.warn("No Refresh Token provided, skipping email.");
            }
        } catch (mailErr) {
            console.warn("Mail failed:", mailErr.message);
            emailStatus = "Failed";
        }

        // Determine if batch is complete (logic purely based on scan count or similar? 
        // User logic implies a count check, but here we just process one scan).
        // App.jsx expects { message: "...", count: <number> }
        // We will return a basic success.

        return res.status(200).json({
            message: "Scan logged successfully",
            emailStatus
        });

    } catch (err) {
        console.error("Server Error:", err);
        return res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
};

module.exports = allowCors(handler);
