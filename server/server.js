const express = require("express");
const XLSX = require("xlsx");
const nodemailer = require("nodemailer");

const app = express();
app.use(express.json());

app.post("/submit", async (req, res) => {
  try {
    const { punchNumber, scanData, startScan, endScan, timestamp } =
      req.body;

    if (!punchNumber || !scanData) {
      return res
        .status(400)
        .json({ message: "Missing punch number or scan data" });
    }

    // Excel creation
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
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("Mail sent:", info.response);
    } catch (mailErr) {
      console.warn("Mail failed (but proceeding):", mailErr.message);
    }

    return res.json({ message: "Success" });
  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// No app.listen() — Vercel will handle this
module.exports = app;
