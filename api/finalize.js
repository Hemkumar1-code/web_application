const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os'); // To get /tmp safely across OS

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
    // Variable to track temporary file for cleanup
    let tempFilePath = null;

    try {
        const { batchNumber, scans } = req.body;

        if (!batchNumber || !scans || !Array.isArray(scans)) {
            return res.status(400).json({ error: 'INVALID_INPUT', message: 'Missing Batch Number or Scans List' });
        }

        console.log(`Processing batch ${batchNumber}. Total scans: ${scans.length}`);

        // --- STEP 1: EXCEL GENERATION ---
        try {
            // Excel Formatting Logic:
            // Requirement: "Batch Number" column should only show the value in the first row.
            // Requirement: "QR Value" column lists all 20 scans.
            const excelData = scans.map((qrValue, index) => {
                // For the very first row (index 0), we include the Batch Number.
                // For all subsequent rows (index > 0), we leave the "Batch Number" cell empty strings ("").
                // This creates a visual grouping effect in the Excel file.
                return {
                    "Batch Number": index === 0 ? batchNumber : "",
                    "QR Value": qrValue
                };
            });

            // Create a new Workbook
            const wb = XLSX.utils.book_new();

            // Create a Worksheet from the JSON data
            const ws = XLSX.utils.json_to_sheet(excelData);

            // Set Column Widths for better visibility
            // Col 1 (Batch Number): Width 20
            // Col 2 (QR Value): Width 40
            ws["!cols"] = [{ wch: 20 }, { wch: 40 }];

            // Append the worksheet to the workbook
            XLSX.utils.book_append_sheet(wb, ws, "Batch Data");

            // Write to /tmp directory (REQUIRED for Vercel/AWS Lambda serverless environments)
            // We use os.tmpdir() to ensure this path is valid on any OS (Linux/Windows).
            const fileName = `batch_${batchNumber}_${Date.now()}.xlsx`;
            tempFilePath = path.join(os.tmpdir(), fileName);

            // Generate the file physically on the ephemeral disk
            XLSX.writeFile(wb, tempFilePath);
            console.log("Excel file generated successfully at:", tempFilePath);

        } catch (excelErr) {
            console.error("Excel Gen Failed:", excelErr);
            // FAIL: Return specific error code if Excel creation dies
            return res.status(500).json({
                error: "EXCEL_GENERATION_FAILED",
                details: excelErr.message,
                batchCompleted: false
            });
        }

        // --- STEP 2: EMAIL SENDING ---
        try {
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: process.env.GMAIL_USER,
                    pass: process.env.GMAIL_APP_PASSWORD,
                },
            });

            // Verify auth configuration exists
            if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
                throw new Error("Missing Gmail Credentials in Environment");
            }

            const timestamp = new Date().toISOString();
            const mailOptions = {
                from: process.env.GMAIL_USER,
                to: "hemk3672@gmail.com",
                subject: `Scan Batch Report - ${batchNumber}`,
                text: `Batch scanning completed.\nBatch: ${batchNumber}\nScans: ${scans.length}\nTime: ${timestamp}`,
                attachments: [
                    {
                        filename: `${batchNumber}.xlsx`,
                        path: tempFilePath
                    },
                ],
            };

            await transporter.sendMail(mailOptions);
            console.log(`Email sent successfully for batch ${batchNumber}`);

        } catch (emailErr) {
            console.error("Mail Send Failed:", emailErr);

            return res.status(500).json({
                error: "MAIL_SEND_FAILED",
                details: emailErr.message,
                batchCompleted: false
            });
        } finally {
            // Cleanup: Delete temp file to keep /tmp clean
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (cleanupErr) {
                    console.warn("Failed to cleanup temp file:", cleanupErr);
                }
            }
        }

        // --- STEP 3: SUCCESS (Both succeeded) ---
        return res.status(200).json({
            message: "MAIL_SENT_AND_BATCH_RESET",
            batchCompleted: true
        });

    } catch (err) {
        console.error("Finalize Critical Server Error:", err);
        return res.status(500).json({
            error: "INTERNAL_SERVER_ERROR",
            details: err.message,
            batchCompleted: false
        });
    }
};

module.exports = allowCors(handler);
