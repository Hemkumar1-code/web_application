const express = require("express");
require("dotenv").config();
const XLSX = require("xlsx");
const nodemailer = require("nodemailer");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// In-memory storage for batches: { punchNumber: [ { ...scanData } ] }
const scanBatches = {};

app.post("/submit", async (req, res) => {
  try {
    const { punchNumber, scanData, startScan, endScan, timestamp } = req.body;

    if (!punchNumber || !scanData) {
      return res
        .status(400)
        .json({ message: "Missing punch number or scan data" });
    }

    // Initialize batch for this punch number if not exists
    if (!scanBatches[punchNumber]) {
      scanBatches[punchNumber] = [];
    }

    const currentBatch = scanBatches[punchNumber];

    // Prevent more than 20 scans
    if (currentBatch.length >= 20) {
      return res.json({
        message: "Batch full. Please submit the current batch.",
        count: 20,
        readyToSubmit: true
      });
    }

    // Add current scan to batch
    currentBatch.push({
      "Punch Number": punchNumber,
      Scanned: 20,
      "Start Scan Number": startScan || scanData,
      "End Scan Number": endScan || scanData,
      "Scan Data": scanData,
      Timestamp: timestamp
    });

    const currentCount = currentBatch.length;
    console.log(`Punch: ${punchNumber}, Count: ${currentCount}/20`);

    if (currentCount >= 20) {
      return res.json({
        message: "Batch complete. Ready to submit.",
        count: 20,
        readyToSubmit: true
      });
    } else {
      return res.json({
        message: `Scan logged. ${20 - currentCount} remaining.`,
        count: currentCount,
        readyToSubmit: false
      });
    }

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/finalize", async (req, res) => {
  try {
    const { punchNumber } = req.body;

    if (!punchNumber || !scanBatches[punchNumber] || scanBatches[punchNumber].length < 20) {
      return res.status(400).json({ message: "Batch not ready or invalid." });
    }

    const currentBatch = scanBatches[punchNumber];
    console.log(`Finalizing batch for ${punchNumber}. Generating email...`);

    // 1. Generate Excel with ALL 20 scans
    const excelData = currentBatch.map(item => ({
      "Punch Number": item["Punch Number"],
      "Scanned": item["Scanned"],
      "Start Scan Number": item["Start Scan Number"],
      "End Scan Number": item["End Scan Number"],
      "Scan Value": item["Scan Data"]
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Formatting col widths
    ws["!cols"] = [
      { wch: 15 },
      { wch: 10 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Scan Batch");
    const excelBuffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "buffer",
    });

    // 2. Email setup
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
      subject: `Scan Batch Complete (20 items) - ${punchNumber}`,
      text: `A batch of 20 scans has been completed for Punch Number: ${punchNumber}.\nSee attached Excel file.`,
      attachments: [
        {
          filename: `batch_20_${punchNumber}_${Date.now()}.xlsx`,
          content: excelBuffer,
        },
      ],
    };

    // 3. Send Email
    let emailStatus = "Sent";
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("Mail sent:", info.response);
    } catch (mailErr) {
      console.warn("Mail failed:", mailErr.message);
      emailStatus = "Failed: " + mailErr.message;
    }

    // 4. Reset Counter / Batch
    scanBatches[punchNumber] = [];

    return res.json({
      message: "20 scans completed successfully. Email sent.",
      count: 0,
      batchCompleted: true
    });

  } catch (err) {
    console.error("Finalize Error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = app;
