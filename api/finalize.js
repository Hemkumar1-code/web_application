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

const nodemailer = require('nodemailer');
const XLSX = require('xlsx');

const handler = async (req, res) => {
    try {
        const { punchNumber, startScan, endScan } = req.body;

        if (!punchNumber) {
            return res.status(400).json({ message: 'Missing punch number' });
        }

        console.log(`Finalizing batch for ${punchNumber}. Start: ${startScan}, End: ${endScan}`);

        // Excel creation logic
        const excelData = [
            {
                "Punch Number": punchNumber,
                Scanned: 20,
                "Start Scan Number": startScan || "N/A",
                "End Scan Number": endScan || "N/A",
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
            subject: `Batch Complete - ${punchNumber}`,
            text: `Batch scanning completed for Punch Number: ${punchNumber}.\nTotal Scans: 20.\nStart: ${startScan}\nEnd: ${endScan}`,
            attachments: [
                {
                    filename: `batch_scan_${punchNumber}.xlsx`,
                    content: excelBuffer,
                },
            ],
        };

        // Try sending email
        if (process.env.GOOGLE_REFRESH_TOKEN) {
            await transporter.sendMail(mailOptions);
            console.log("Mail sent successfully");
        } else {
            console.warn("No Refresh Token provided, skipping email.");
        }

        return res.status(200).json({
            batchCompleted: true,
            message: "Batch finalized and email sent successfully."
        });

    } catch (err) {
        console.error("Finalize Error:", err);
        return res.status(500).json({
            message: "Failed to finalize batch",
            error: err.message
        });
    }
};

module.exports = allowCors(handler);
