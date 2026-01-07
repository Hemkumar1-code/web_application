const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

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

const parseTime = (timeStr) => {
    if (!timeStr) return null;
    const d = new Date();
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes, seconds] = time.split(':');

    if (hours === '12') {
        hours = '00';
    }

    if (modifier === 'PM') {
        hours = parseInt(hours, 10) + 12;
    }

    d.setHours(hours, minutes, seconds);
    return d;
};

const calculateDuration = (startStr, endStr) => {
    try {
        const start = parseTime(startStr);
        const end = parseTime(endStr);
        if (!start || !end) return "00:00:00";

        let diffMs = end - start;
        // Handle midnight crossover if needed (assume < 24h)
        if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;

        const diffSeconds = Math.floor(diffMs / 1000);
        const h = Math.floor(diffSeconds / 3600);
        const m = Math.floor((diffSeconds % 3600) / 60);
        const s = diffSeconds % 60;

        const pad = (num) => num.toString().padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    } catch (e) {
        console.error("Time calc error", e);
        return "Error";
    }
};

const handler = async (req, res) => {
    let tempFilePath = null;
    try {
        const { batchNumber, scans, firstScanTime, lastScanTime } = req.body;

        if (!batchNumber || !scans || !Array.isArray(scans)) {
            console.error('Invalid input');
            return res.status(400).json({ error: 'INVALID_INPUT', batchCompleted: false });
        }

        console.log(`Processing batch ${batchNumber} with ${scans.length} scans`);

        // Calculate Total Duration
        const totalDuration = calculateDuration(firstScanTime, lastScanTime);

        // EXCEL GENERATION
        try {
            const excelData = scans.map((scan) => ({
                "Batch Number": batchNumber,
                "Scan Count": scan.scanCount,
                "Punch Number": scan.punchNumber,
                "Name": scan.name,
                "QR Code Value": scan.qrValue,
                "Scan Time": scan.scanTime,
                "First Scan Time": firstScanTime,
                "Last Scan Time": lastScanTime,
                "Total Scan Duration": totalDuration,
                "Captured Image": scan.capturedImage || "No Image"
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            // Set column widths
            ws["!cols"] = [
                { wch: 15 }, // Batch
                { wch: 10 }, // Count
                { wch: 15 }, // Punch
                { wch: 20 }, // Name
                { wch: 30 }, // QR
                { wch: 15 }, // Scan Time
                { wch: 15 }, // First
                { wch: 15 }, // Last
                { wch: 15 }, // Duration
                { wch: 50 }, // Image (Base64 is long, but cell width caps visual)
            ];

            XLSX.utils.book_append_sheet(wb, ws, "Batch Data");

            const fileName = `Batch_${batchNumber}_${Date.now()}.xlsx`;
            tempFilePath = path.join(os.tmpdir(), fileName);

            XLSX.writeFile(wb, tempFilePath);

            // Wait for file write
            await new Promise(resolve => setTimeout(resolve, 500));

            if (!fs.existsSync(tempFilePath)) {
                return res.status(500).json({ error: "EXCEL_GENERATION_FAILED", details: "File not found on disk", batchCompleted: false });
            }

        } catch (excelErr) {
            console.error('Excel generation failed', excelErr);
            return res.status(500).json({ error: "EXCEL_GENERATION_FAILED", details: excelErr.message, batchCompleted: false });
        }

        // EMAIL SENDING
        try {
            const user = process.env.GMAIL_USER;
            const pass = process.env.GMAIL_APP_PASSWORD;

            if (!user || !pass) {
                return res.status(500).json({
                    error: "CONFIG_ERROR",
                    details: "GMAIL CREDENTIALS MISSING",
                    batchCompleted: false
                });
            }

            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: { user, pass },
            });

            await transporter.verify();

            const mailOptions = {
                from: user,
                to: "hemk3672@gmail.com",
                subject: `Batch Completed: ${batchNumber} - ${scans.length} Scans`,
                text: `Batch scanning completed.\n\nBatch Number: ${batchNumber}\nScans: ${scans.length}\nDuration: ${totalDuration}\n\nSee attached Excel file for details.`,
                attachments: [{ filename: `${batchNumber}_Report.xlsx`, path: tempFilePath }]
            };

            await transporter.sendMail(mailOptions);
            console.log("MAIL_SENT_SUCCESS");

        } catch (mailErr) {
            console.error("MAIL_SEND_FAILED:", mailErr);
            return res.status(500).json({
                error: "MAIL_SEND_FAILED",
                details: mailErr.message,
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
