const express = require('express');
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get(['/', '/api'], (req, res) => {
  res.send('QR Scanner Server is running');
});

app.post(['/submit', '/api/submit'], async (req, res) => {
  try {
    const { punchNumber, scanData, startScan, endScan, timestamp } = req.body;

    if (!punchNumber || !scanData) {
      return res.status(400).json({ message: 'Missing punch number or scan data' });
    }

    console.log(`Received scan for Punch Number: ${punchNumber}. Start: ${startScan}, End: ${endScan}`);

    // Prepare data for Excel
    // Requirements: "Generate an Excel sheet with these columns: Punch Number, Scanned, Start Scan Number, End Scan Number."
    const excelData = [{
      'Punch Number': punchNumber,
      'Scanned': 20, // "The Scanned column should always display 20"
      'Start Scan Number': startScan || scanData,
      'End Scan Number': endScan || scanData
    }];

    // 1. Generate Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Adjust column widths for better readability
    const wscols = [
      { wch: 15 }, // Punch Number
      { wch: 10 }, // Scanned
      { wch: 20 }, // Start Scan Number
      { wch: 20 }  // End Scan Number
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, 'Scan Data');

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
      to: 'hemk3672@gmail.com',
      subject: `Scan Update - Punch: ${punchNumber} (End: ${endScan})`,
      text: `Update for Punch Number: ${punchNumber}\n\nLatest Scan: ${scanData}\nStart Scan #: ${startScan}\nEnd Scan #: ${endScan}\nScanned Value: 20\nTime: ${timestamp}`,
      attachments: [
        {
          filename: `scan_update_${punchNumber}.xlsx`,
          content: excelBuffer,
        },
      ],
    };

    // 3. Send Email
    // Check if credentials exist to avoid crashing if env not set
    if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN !== 'YOUR_REFRESH_TOKEN_HERE') {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent: ' + info.response);
      res.status(200).json({ message: 'Scan processed and email sent successfully', info: info.response });
    } else {
      console.warn('Refresh Token not configured. Skipping email sending.');
      res.status(200).json({ message: 'Data processed. Email skipped (no Refresh Token).', excelGenerated: true });
    }

  } catch (error) {
    console.error('Error processing submission:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
  }
});


if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

