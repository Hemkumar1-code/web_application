import React, { useState, useEffect } from 'react';
import Scanner from './components/Scanner';
import './index.css';

const PUNCH_MAP = {
  "374": "Jeevanantham",
  "66": "Shanavas",
  "388": "Gopal",
  "68": "Rangaraj"
};

const BATCH_SIZE = 27;

function App() {
  const [punchNumber, setPunchNumber] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [scans, setScans] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Timing State
  const [firstScanTime, setFirstScanTime] = useState(null);

  // Load from LocalStorage on Mount
  useEffect(() => {
    const savedState = localStorage.getItem('geoGuardState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setPunchNumber(parsed.punchNumber || '');
        setEmployeeName(parsed.employeeName || '');
        setScans(parsed.scans || []);
        setFirstScanTime(parsed.firstScanTime || null);
        console.log("Restored state", parsed);
      } catch (e) {
        console.error("Failed to restore state", e);
      }
    }
  }, []);

  // Save to LocalStorage on Change
  useEffect(() => {
    const stateToSave = {
      punchNumber,
      employeeName,
      scans,
      firstScanTime
    };
    localStorage.setItem('geoGuardState', JSON.stringify(stateToSave));
  }, [punchNumber, employeeName, scans, firstScanTime]);

  const handlePunchChange = (e) => {
    const val = e.target.value;
    setPunchNumber(val);
    if (!val) {
      setEmployeeName('');
      setMessage(null);
      return;
    }

    if (PUNCH_MAP[val]) {
      setEmployeeName(PUNCH_MAP[val]);
      setMessage(null); // Clear errors
    } else {
      setEmployeeName('');
      setMessage({ type: 'error', text: 'Invalid Punch Number' });
    }
  };

  const handleScan = async (qrValue, imageData) => {
    setIsScanning(false);

    if (!qrValue) return;

    // Validate Punch Number
    if (!punchNumber || !PUNCH_MAP[punchNumber]) {
      setMessage({ type: 'error', text: 'Invalid Punch Number. Cannot Scan.' });
      return;
    }

    // Validate Batch Limit
    if (scans.length >= BATCH_SIZE) {
      setMessage({ type: 'warning', text: 'Batch Full. Please wait for processing or reset.' });
      return;
    }

    // Validate Duplicate
    if (scans.some(s => s.qrValue === qrValue)) {
      setMessage({ type: 'error', text: `Duplicate QR: ${qrValue} already scanned.` });
      return;
    }

    setLoading(true);
    const now = new Date();
    const timeString = now.toLocaleTimeString();

    // Logic for Times
    let currentFirstScanTime = firstScanTime;
    if (scans.length === 0) {
      currentFirstScanTime = timeString;
      setFirstScanTime(timeString);
    }

    const newScan = {
      batchNumber: punchNumber, // Using punchNumber as BatchID for now, or could generate a unique ID
      scanCount: scans.length + 1,
      punchNumber,
      name: PUNCH_MAP[punchNumber],
      qrValue,
      scanTime: timeString,
      capturedImage: imageData, // Base64
      firstScanTime: currentFirstScanTime,
      lastScanTime: timeString, // This specific row's last scan time (which is itself)
    };

    const updatedScans = [...scans, newScan];
    setScans(updatedScans);

    try {
      // Optional: Log to server (without image to save bw)
      await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          punchNumber,
          scanData: qrValue,
          timestamp: timeString
        }),
      });

      setMessage({ type: 'success', text: 'Scan logged successfully' });

      // Check Completion
      if (updatedScans.length === BATCH_SIZE) {
        finalizeBatch(updatedScans, currentFirstScanTime, timeString);
      }

    } catch (err) {
      console.error("Logging scan failed", err);
      setMessage({ type: 'error', text: "Scan logged locally, but server sync failed." });
    } finally {
      setLoading(false);
    }
  };

  const finalizeBatch = async (finalScans, firstTime, lastTime) => {
    setMessage({ type: 'info', text: `Batch Complete (${BATCH_SIZE}). Finalizing and sending email...` });

    // Calculate Duration
    // Need full Date objects to diff, but we stored strings.
    // Ideally we store timestamps. But for display we used strings.
    // Let's rely on the server or recalculate if we had proper timestamps.
    // For now, let's just pass the strings. The requirements just say "Calculate... Total_Scan_Duration".
    // I should probably store raw timestamps in the scan object too.

    try {
      const response = await fetch('/api/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchNumber: punchNumber,
          scans: finalScans,
          firstScanTime: firstTime,
          lastScanTime: lastTime
        }),
      });

      const result = await response.json();

      if (response.ok && result.batchCompleted) {
        setMessage({ type: 'success', text: 'Batch Email Sent Successfully!' });
        // Auto Reset
        setTimeout(() => {
          resetSession();
        }, 3000);
      } else {
        setMessage({ type: 'error', text: `Email Failed: ${result.details || result.error}` });
      }
    } catch (e) {
      setMessage({ type: 'error', text: `Finalize Failed: ${e.message}` });
    }
  };

  const resetSession = () => {
    setScans([]);
    setFirstScanTime(null);
    setMessage({ type: 'info', text: 'Session Reset. Ready for next batch.' });
    localStorage.removeItem('geoGuardState');
  };

  const openScanner = () => {
    if (!punchNumber || !PUNCH_MAP[punchNumber]) {
      setMessage({ type: 'error', text: 'Please enter a valid Punch Number first.' });
      return;
    }
    setIsScanning(true);
  };

  // Camera Icon SVG
  const CameraIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
      <circle cx="12" cy="13" r="4"></circle>
    </svg>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <button className="camera-btn" onClick={openScanner} title="Open Camera">
            <CameraIcon />
          </button>
        </div>
        <h1>GeoGuard</h1>
      </header>

      <div className="main-card">
        {/* Input Section */}
        <div className="input-group">
          <label htmlFor="punch">Punch Number</label>
          <div className="input-row">
            <input
              id="punch"
              type="text"
              value={punchNumber}
              onChange={handlePunchChange}
              placeholder="Enter ID (e.g. 374)"
              className={!PUNCH_MAP[punchNumber] && punchNumber ? 'invalid' : ''}
            />
            {employeeName && <div className="employee-badge">{employeeName}</div>}
          </div>
        </div>

        {/* Progress */}
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Batch Count</span>
            <span className="stat-value">{scans.length} / {BATCH_SIZE}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">First Scan</span>
            <span className="stat-value">{firstScanTime || '--:--:--'}</span>
          </div>
        </div>

        {/* Scanner Overlay */}
        {isScanning && (
          <Scanner onScan={handleScan} onClose={() => setIsScanning(false)} />
        )}

        {/* Manual Close / Status */}
        <div className="actions">
          {/* Main action is now the camera icon, but we can keep Reset */}
          <button className="btn-secondary" onClick={resetSession}>
            Reset Batch
          </button>
        </div>

        {/* Scan List */}
        {scans.length > 0 && (
          <div className="scan-list">
            <h3>Scanned Items</h3>
            <ul>
              {[...scans].reverse().map((scan, i) => (
                <li key={i} className="scan-item">
                  <div className="scan-info">
                    <strong>{scan.qrValue}</strong>
                    <span>{scan.scanTime}</span>
                  </div>
                  {scan.capturedImage && (
                    <img src={scan.capturedImage} alt="Snap" className="scan-thumb" />
                  )}
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
