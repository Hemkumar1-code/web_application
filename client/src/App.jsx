import React, { useState } from 'react';
import Scanner from './components/Scanner';
import axios from 'axios';
import './index.css';

function App() {
  const [punchNumber, setPunchNumber] = useState('');
  const [scans, setScans] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [startScan, setStartScan] = useState(null);
  const [endScan, setEndScan] = useState(null);

  const handleScan = async (data) => {
    // Close scanner if open
    setIsScanning(false);

    if (!data || !punchNumber) {
      setMessage({ type: 'error', text: 'Please enter a Punch Number before scanning.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const timestamp = new Date().toLocaleString();

    // Determine Start and End scan usage
    let currentStartScan = startScan;
    if (!currentStartScan) {
      currentStartScan = data;
      setStartScan(data);
    }
    setEndScan(data);
    const currentEndScan = data;

    // Add to local history for display
    const newScan = {
      punchNumber,
      scanData: data,
      timestamp,
      status: 'Sending...',
      startScan: currentStartScan,
      endScan: currentEndScan
    };


    const newScans = [newScan, ...scans];
    setScans(newScans);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || '';
      console.log(`Sending scan to ${apiBaseUrl}/api/submit`);

      const response = await fetch(`${apiBaseUrl}/api/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          punchNumber,
          scanData: data,
          startScan: currentStartScan,
          endScan: currentEndScan,
          timestamp
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      console.log('Server response:', result);

      // Update status
      newScans[0].status = 'Sent';
      setScans([...newScans]);
      setMessage({ type: 'success', text: 'Scan sent successfully!' });

    } catch (error) {
      console.error('Scan Error:', error);
      newScans[0].status = 'Failed';
      setScans([...newScans]);
      // Show generic error unless specific handled
      setMessage({ type: 'error', text: `Failed: ${error.message || 'Check server/network'}` });
    } finally {
      setLoading(false);
    }
  };

  const deleteScan = (index) => {
    const newScans = [...scans];
    newScans.splice(index, 1);
    setScans(newScans);
  };

  const resetSession = () => {
    setScans([]);
    setStartScan(null);
    setEndScan(null);
    setMessage(null);
  };

  return (
    <div className="app-container">
      <header>
        <h1>Scan & Dispatch</h1>
        <p>Premium Inventory Tracking</p>
      </header>

      <div className="main-card">
        {/* Punch Number Field */}
        <div className="input-group">
          <label htmlFor="punch-number">Punch Number</label>
          <input
            id="punch-number"
            type="text"
            placeholder="Enter Punch ID"
            value={punchNumber}
            onChange={(e) => setPunchNumber(e.target.value)}
          />
        </div>

        {/* Stats Bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Scanned Col</span>
            <span className="stat-value">20</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Start Scan</span>
            <span className="stat-value">{startScan || '-'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">End Scan</span>
            <span className="stat-value">{endScan || '-'}</span>
          </div>
        </div>

        {/* Scanner Component */}
        {isScanning && (
          <Scanner
            onScan={handleScan}
            onClose={() => setIsScanning(false)}
          />
        )}

        <div className="actions">
          <button
            className="btn-primary"
            onClick={() => setIsScanning(true)}
            disabled={!punchNumber || loading}
          >
            {loading ? 'Processing...' : 'Start QR Scanner'}
          </button>

          <button
            className="btn-secondary"
            onClick={resetSession}
            disabled={loading}
          >
            Reset Session
          </button>
        </div>

        {/* Recent Activity */}
        {scans.length > 0 && (
          <div className="scan-list">
            <h3>Recent Activity</h3>
            <ul>
              {scans.map((scan, idx) => (
                <li key={idx} className="scan-item">
                  <div className="scan-info">
                    <strong>{scan.scanData}</strong>
                    <span>Punch: {scan.punchNumber} | Status: {scan.status}</span>
                    <small>Start: {scan.startScan} | End: {scan.endScan}</small>
                  </div>
                  <button className="btn-delete" onClick={() => deleteScan(idx)} title="Clear from history">×</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {message && <div className={`message ${message.type}`}>{message.text}</div>}
      </div>
    </div>
  );
}

export default App;

