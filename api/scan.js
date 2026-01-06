const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// In-Memory Store (Note: Volatile on Vercel Serverless)
// For production persistence, use a database like MongoDB, PostgreSQL, or Redis.
const batchStore = new Map();

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
        const { punchNumber, scanData } = req.body;

        // Use punchNumber as batchId
        const batchId = punchNumber;

        if (!batchId || !scanData) {
            return res.status(400).json({ message: 'Missing Batch ID (punchNumber) or Scan Data' });
        }

        // Initialize batch if not exists
        if (!batchStore.has(batchId)) {
            batchStore.set(batchId, { count: 0, mailSent: false });
        }

        const batch = batchStore.get(batchId);

        // Increment scan count
        // Note: Logic assumes strictly sequential requests or single instance.
        if (batch.count < 20) {
            batch.count += 1;
        }

        const isComplete = batch.count === 20;
        let emailStatus = 'Not Required';

        // Check for 20th scan and Email Trigger
        if (isComplete && !batch.mailSent) {
            console.log(`Batch ${batchId} hit 20/20. Sending email...`);

            try {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.GMAIL_USER,
                        pass: process.env.GMAIL_APP_PASSWORD
                    }
                });

                const mailOptions = {
                    from: process.env.GMAIL_USER,
                    to: 'hemk3672@gmail.com',
                    subject: 'Batch Scan Completed – 20/20',
                    text: 'Your batch scanning has been successfully completed (20/20).'
                };

                await transporter.sendMail(mailOptions);

                // Mark as sent to prevent duplicates
                batch.mailSent = true;
                emailStatus = 'Sent';
                console.log(`Email sent for batch ${batchId}`);

            } catch (emailError) {
                console.error('Email sending failed:', emailError);
                emailStatus = 'Failed';
                // Do not set mailSent = true so we can retry? 
                // Creating a simplified retry logic: if it failed, next scan won't trigger it because count is already 20.
                // Re-trigger logic would require complex state management.
            }
        } else if (isComplete && batch.mailSent) {
            emailStatus = 'Already Sent';
        }

        return res.status(200).json({
            message: "Scan logged successfully",
            batchId,
            count: batch.count,
            total: 20,
            emailStatus
        });

    } catch (err) {
        console.error("Server Error:", err);
        return res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
};

module.exports = allowCors(handler);
