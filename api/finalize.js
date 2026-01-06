const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');

const allowCors = (fn) => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

const handler = async (req, res) => {
    let tempFilePath = null;
    try {
        const { batchNumber, scans } = req.body;
        if (!batchNumber || !scans || !Array.isArray(scans)) {
            console.error('Invalid input');
            return res.status(400).json({ error: 'INVALID_INPUT', batchCompleted: false });
        }

        console.log(`Processing batch ${batchNumber}`);

        // EXCEL GENERATION
        try {
            const excelData = scans.map((qrValue, index) => ({
                "Batch Number": index === 0 ? batchNumber : "",
                "QR Value": qrValue
            }));
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);
            ws["!cols"] = [{ wch: 20 }, { wch: 40 }];
            XLSX.utils.book_append_sheet(wb, ws, "Batch Data");

            const fileName = `batch_${batchNumber}_${Date.now()}.xlsx`;
            tempFilePath = path.join(os.tmpdir(), fileName);

            XLSX.writeFile(wb, tempFilePath);

            await new Promise(resolve => setTimeout(resolve, 500));

            if (!fs.existsSync(tempFilePath)) {
                console.error("Excel file not found after generation");
                return res.status(500).json({ error: "EXCEL_GENERATION_FAILED", details: "File not found on disk", batchCompleted: false });
            }

        } catch (excelErr) {
            console.error('Excel generation failed', excelErr);
            return res.status(500).json({ error: "EXCEL_GENERATION_FAILED", details: excelErr.message, batchCompleted: false });
        }

        // EMAIL SENDING
        try {
            // DEBUG: Check if env vars are loaded (Don't reveal full password)
            const user = process.env.GMAIL_USER;
            const pass = process.env.GMAIL_APP_PASSWORD;

            if (!user || !pass) {
                console.error('Missing Gmail credentials in Env');
                return res.status(500).json({
                    error: "CONFIG_ERROR",
                    details: "GMAIL_USER or GMAIL_APP_PASSWORD is missing in Vercel Settings",
                    batchCompleted: false
                });
            }

            console.log(`Attempting to send mail from: ${user}`);

            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: { user, pass },
            });

            // Verify connection configuration
            try {
                await transporter.verify();
                console.log("SMTP Connection verified");
            } catch (verifyErr) {
                console.error("SMTP Verify Failed:", verifyErr);
                throw new Error(`SMTP Connect Failed: ${verifyErr.message}`);
            }

            const mailOptions = {
                from: user,
                to: "hemk3672@gmail.com",
                subject: `Batch Completed: ${batchNumber}`,
                text: `Batch scanning completed.\nBatch: ${batchNumber}\nScans: ${scans.length}`,
                attachments: [{ filename: `${batchNumber}.xlsx`, path: tempFilePath }]
            };

            await transporter.sendMail(mailOptions);
            console.log("MAIL_SENT_SUCCESS");

        } catch (mailErr) {
            console.error("MAIL_SEND_FAILED_LOG:", mailErr);

            // Return FULL error details to frontend for debugging
            return res.status(500).json({
                error: "MAIL_SEND_FAILED",
                details: mailErr.message || JSON.stringify(mailErr),
                batchCompleted: false
            });
        }

        return res.status(200).json({ message: "MAIL_SENT_AND_BATCH_RESET", batchCompleted: true });

    } catch (err) {
        console.error('Internal server error', err);
        return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", details: err.message, batchCompleted: false });
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch (e) { console.error('Cleanup failed', e); }
        }
    }
};

module.exports = allowCors(handler);
