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
        const { batchNumber, scans } = req.body;

        if (!batchNumber || !scans || !Array.isArray(scans)) {
            return res.status(400).json({ message: 'Missing Batch Number or Scans List' });
        }

        console.log(`Finalizing batch ${batchNumber}. Total scans: ${scans.length}`);

        // Excel Generation Logic
        // Rule: Batch Number only on the first row.
        const excelData = scans.map((qrValue, index) => ({
            "Batch Number": index === 0 ? batchNumber : "",
            "QR Value": qrValue
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Set column widths for better readability
        ws["!cols"] = [
            { wch: 20 }, // Batch Number width
            { wch: 40 }, // QR Value width
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Batch Data");

        const excelBuffer = XLSX.write(wb, {
            bookType: "xlsx",
            type: "buffer",
        });

        // Email setup
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: "hemk3672@gmail.com",
            subject: `Batch Scan Completed - ${batchNumber} [${timestamp}]`, // Prevent threading
            text: `Batch scanning completed successfully.\n\nBatch Number: ${batchNumber}\nTotal Scans: ${scans.length}\n\nPlease find the attached Excel report.`,
            attachments: [
                {
                    filename: `${batchNumber}.xlsx`,
                    content: excelBuffer,
                },
            ],
        };

        // Send Email with robust error handling
        try {
            await transporter.sendMail(mailOptions);
            console.log(`Email sent successfully for batch ${batchNumber}`);
        } catch (emailError) {
            console.error("Nodemailer Error:", emailError);
            return res.status(200).json({
                batchCompleted: true, // Mark as complete even if email failed, to allow reset
                message: "Batch completed, but Email Failed (Check Server Logs).",
                error: emailError.message
            });
        }

        return res.status(200).json({
            batchCompleted: true,
            message: "Batch completed. Email sent successfully."
        });

    } catch (err) {
        console.error("Finalize Critical Error:", err);
        return res.status(500).json({
            message: "Failed to finalize batch (Server Error)",
            error: err.message
        });
    }
};

module.exports = allowCors(handler);
