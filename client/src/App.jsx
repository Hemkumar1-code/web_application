import React, { useState } from 'react';
import Scanner from './components/Scanner';
import './index.css';

function App() {
  const [punchNumber, setPunchNumber] = useState('');
  const [scans, setScans] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [startScan, setStartScan] = useState(null);
  const [endScan, setEndScan] = useState(null);
  const [batchCount, setBatchCount] = useState(0);

  const handleScan = async (data) => {
    setIsScanning(false); // Close scanner after scan

    if (!data || !punchNumber) {
      setMessage({ type: 'error', text: 'Please enter a Punch Number before scanning.' });
      return;
    }

    if (batchCount >= 20) {
      setMessage({ type: 'warning', text: 'Batch is full (20/20). Please reset to start a new batch.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const timestamp = new Date().toLocaleString();

    // Determine start/end for this batch
    // If this is the first scan (batchCount === 0), it's the start.
    const isFirstScan = batchCount === 0;
    const currentStartScan = isFirstScan ? data : startScan;
    const currentEndScan = data;

    if (isFirstScan) setStartScan(data);
    setEndScan(data);

    // Add to local history
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
      // Log the scan
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          punchNumber,
          scanData: data,
          timestamp
        }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const result = await response.json();

      // Update local state on success
      newScans[0].status = 'Logged';
      setScans([...newScans]);

      const newCount = batchCount + 1;
      setBatchCount(newCount);
      setMessage({ type: 'success', text: `Scan logged! (${newCount} / 20)` });

      // Check for Batch Completion
      if (newCount === 20) {
        // Pass the list of scan data strings
        const allScanData = newScans.map(s => s.scanData);
        await handleFinalize(allScanData);
      }

    } catch (error) {
      console.error('Scan Error:', error);
      newScans[0].status = 'Failed';
      setScans([...newScans]);
      setMessage({ type: 'error', text: `Failed: ${error.message || 'Check server/network'}` });
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async (scanList) => {
    // Automatically called when batch reaches 20
    try {
      console.log(`Finalizing batch for ${punchNumber}`);
      setMessage({ type: 'info', text: 'Batch Complete (20/20). Finalizing and sending email...' });

      const response = await fetch('/api/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchNumber: punchNumber,
          scans: scanList
        }),
      });

      // Handle non-200 HTTP errors
      if (!response.ok) {
        const errorData = await response.json();
        // If server says "false" on batchCompleted, it means mail failed.
        setMessage({
          type: 'error',
          text: `Email Failed: ${errorData.details || errorData.error || 'Server Error'}. Please check internet/server.`
        });
        return; // DO NOT RESET
      }

      const result = await response.json();

      if (result.batchCompleted) {
        setMessage({ type: 'success', text: result.message || 'Batch completed and email sent!' });
        // Auto Reset Logic ONLY on Success
        setTimeout(() => {
          resetSession();
          setMessage({ type: 'info', text: 'Session reset. Ready for next batch.' });
        }, 2000);
      } else {
        // Fallback for logic error
        setMessage({ type: 'error', text: result.error || 'Batch could not be finalized.' });
      }

    } catch (error) {
      console.error("Finalize Error:", error);
      setMessage({ type: 'error', text: `Failed to finalize: ${error.message}` });
    }
  };

  const deleteScan = (index) => {
    // Optional: If deleting a scan affects the count, logic usually handles it. 
    // But requirement says "Total batch size is fixed". 
    // We'll allow deletion but it might mess up the "20th" logic if not careful.
    // For now, assuming "delete from history" doesn't decrement the official "Batch Count" 
    // unless we want it to. The user requirement "Prevent batch count from exceeding 20" 
    // implies strictly counting successes.
    // If I delete, should I decrement?
    // Let's assume yes, to allow correction of mistakes.
    const newScans = [...scans];
    newScans.splice(index, 1);
    setScans(newScans);
    if (batchCount > 0) setBatchCount(batchCount - 1);
  };

  const resetSession = () => {
    setScans([]);
    setStartScan(null);
    setEndScan(null);
    setBatchCount(0);
    setMessage(null);
  };

  return (
    <div className="app-container">
      <header>
        <h1>GeoGuard</h1>
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
            <span className="stat-label">Batch Progress</span>
            <span className="stat-value">{batchCount} / 20</span>
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
          {batchCount < 20 ? (
            <button
              className="btn-primary"
              onClick={() => setIsScanning(true)}
              disabled={!punchNumber || loading || batchCount >= 20}
            >
              {loading ? 'Processing...' : 'Open Scanner'}
            </button>
          ) : (
            <div className="batch-complete-msg">Batch Complete (20/20)</div>
          )}

          <button
            className="btn-secondary"
            onClick={resetSession}
            disabled={loading}
            style={{ marginLeft: '10px' }}
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
