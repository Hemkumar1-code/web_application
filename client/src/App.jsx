import React, { useState } from 'react';
import Scanner from './components/Scanner';
import axios from 'axios';
import './index.css';

function App() {
  const [mobileNumber, setMobileNumber] = useState('');
  const [scans, setScans] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const MAX_SCANS = 13;

  const handleScan = (data) => {
    setIsScanning(false);

    // Parse data
    let quantity = 'N/A';
    let location = 'N/A';

    // Attempt parse JSON
    try {
      const parsed = JSON.parse(data);
      if (parsed.quantity || parsed.qty) quantity = parsed.quantity || parsed.qty;
      if (parsed.location || parsed.loc) location = parsed.location || parsed.loc;
    } catch (e) {
      // Fallback: try comma separation
      const parts = data.split(',');
      if (parts.length >= 2) {
        quantity = parts[0].trim();
        location = parts[1].trim();
      } else {
        location = data; // Assume raw data is location if single string?
      }
    }

    const newScan = {
      mobile: mobileNumber,
      quantity,
      location, // or raw data
      timestamp: new Date().toLocaleString(),
      raw: data
    };

    setScans([...scans, newScan]);
  };

  const deleteScan = (index) => {
    const newScans = [...scans];
    newScans.splice(index, 1);
    setScans(newScans);
  };

  const handleSubmit = async () => {
    if (scans.length === 0) return;
    setLoading(true);
    setMessage(null);

    try {
      // Send to backend
      // Assuming backend is on localhost:5000
      const response = await axios.post('http://localhost:5000/submit', { scans });
      setMessage({ type: 'success', text: 'Submitted successfully! Check your email.' });
      setScans([]);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Submission failed. Ensure server is running.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>QR Dispatch Scanner</h1>
        <p>Scan and track inventory dispatch.</p>
      </header>

      <div className="main-card">
        <div className="input-group">
          <label>Mobile Number</label>
          <input
            type="tel"
            placeholder="Enter your mobile number"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
          />
        </div>

        <div className="stats-bar">
          <span>Scanned: {scans.length} / {MAX_SCANS}</span>
        </div>

        {isScanning && (
          <Scanner
            onScan={handleScan}
            onClose={() => setIsScanning(false)}
          />
        )}

        <div className="actions">
          <button
            className="btn-primary scan-btn"
            onClick={() => setIsScanning(true)}
            disabled={scans.length >= MAX_SCANS || !mobileNumber}
          >
            {scans.length >= MAX_SCANS ? 'Limit Reached' : 'Scan QR Code'}
          </button>
        </div>

        {scans.length > 0 && (
          <div className="scan-list">
            <h3>Scanned Items</h3>
            <ul>
              {scans.map((scan, idx) => (
                <li key={idx} className="scan-item">
                  <div className="scan-info">
                    <strong>Qty: {scan.quantity}</strong>
                    <span>Loc: {scan.location}</span>
                    <small>{scan.timestamp}</small>
                  </div>
                  <button className="btn-delete" onClick={() => deleteScan(idx)}>🗑️</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="submit-section">
          <button
            className="btn-success"
            onClick={handleSubmit}
            disabled={scans.length === 0 || loading}
          >
            {loading ? 'Sending...' : 'Generate & Send Excel'}
          </button>
        </div>

        {message && <div className={`message ${message.type}`}>{message.text}</div>}
      </div>
    </div>
  );
}

export default App;
