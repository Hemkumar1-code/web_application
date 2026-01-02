const express = require('express');
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('QR Scanner Server is running');
});

app.post('/submit', async (req, res) => {
  try {
    const { scans } = req.body;

    if (!scans || !Array.isArray(scans) || scans.length === 0) {
      return res.status(400).json({ message: 'No scan data provided' });
    }

    console.log(`Received ${scans.length} scans. Generating Excel...`);

    // 1. Generate Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(scans);
    XLSX.utils.book_append_sheet(wb, ws, 'Scans');
    
    // Write to buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // 2. Setup Email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.RECIPIENT_EMAIL, // Can be same as sender or different
      subject: 'New QR Scan Submission of ' + scans.length + ' items',
      text: `Attached is the Excel sheet containing ${scans.length} scanned QR codes from mobile number: ${scans[0].mobile || 'N/A'}.`,
      attachments: [
        {
          filename: `scans_${Date.now()}.xlsx`,
          content: excelBuffer,
        },
      ],
    };

    // 3. Send Email
    if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN !== 'YOUR_REFRESH_TOKEN_HERE') {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        res.status(200).json({ message: 'Data submitted and email sent successfully', info: info.response });
    } else {
        console.warn('Refresh Token not configured. Skipping email sending.');
        // For testing purposes, we save the file locally if email fails?
        // Let's just return success but mention email wasn't sent.
        res.status(200).json({ message: 'Data received. Email skipped (no Refresh Token configured).', excelGenerated: true });
    }

  } catch (error) {
    console.error('Error processing submission:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
