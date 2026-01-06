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
            return res.status(400).json({ error: 'INVALID_INPUT', batchCompleted: false });
        }

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
        } catch (excelErr) {
            return res.status(500).json({ error: "EXCEL_GENERATION_FAILED", batchCompleted: false });
        }

        try {
            if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
                throw new Error("Missing Credentials");
            }
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: process.env.GMAIL_USER,
                    pass: process.env.GMAIL_APP_PASSWORD,
                },
            });
            const mailOptions = {
                from: process.env.GMAIL_USER,
                to: "hemk3672@gmail.com",
                subject: `Batch completed`,
                text: `Batch scanning completed.\nBatch: ${batchNumber}`,
                attachments: [{ filename: `${batchNumber}.xlsx`, path: tempFilePath }]
            };
            await transporter.sendMail(mailOptions);
        } catch (mailErr) {
            return res.status(500).json({ error: "MAIL_SEND_FAILED", batchCompleted: false });
        }

        return res.status(200).json({ message: "MAIL_SENT_AND_BATCH_RESET", batchCompleted: true });

    } catch (err) {
        return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", batchCompleted: false });
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch (e) { }
        }
    }
};

module.exports = allowCors(handler);
