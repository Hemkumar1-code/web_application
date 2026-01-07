import React, { useState, useEffect } from 'react';
import Scanner from './components/Scanner';
import PhotoCapture from './components/PhotoCapture';
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
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Timing State
  const [firstScanTime, setFirstScanTime] = useState(null);
  const [firstScanTimestamp, setFirstScanTimestamp] = useState(null);
  const [lastScanTimestamp, setLastScanTimestamp] = useState(null);

  // New Image Handling
  const [pendingImage, setPendingImage] = useState(null);

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
        setFirstScanTimestamp(parsed.firstScanTimestamp || null);
        setLastScanTimestamp(parsed.lastScanTimestamp || null);
        setPendingImage(parsed.pendingImage || null);
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
      firstScanTime,
      firstScanTimestamp,
      lastScanTimestamp,
      pendingImage
    };
    localStorage.setItem('geoGuardState', JSON.stringify(stateToSave));
  }, [punchNumber, employeeName, scans, firstScanTime, pendingImage, firstScanTimestamp, lastScanTimestamp]);

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

  const handlePhotoCaptured = (imageData) => {
    setPendingImage(imageData);
    setMessage({ type: 'success', text: 'Image captured successfully! Scan QR to link it.' });
    setIsTakingPhoto(false);
  };

  const handleScan = async (qrValue) => {
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
    const timestamp = now.getTime();

    // Logic for Times
    let currentFirstScanTime = firstScanTime;
    let currentFirstTimestamp = firstScanTimestamp;

    if (scans.length === 0) {
      currentFirstScanTime = timeString;
      currentFirstTimestamp = timestamp;
      setFirstScanTime(timeString);
      setFirstScanTimestamp(timestamp);
    }

    setLastScanTimestamp(timestamp);

    // Use Pending Image if available, otherwise "No Image"
    // Requirement said: "Store the image reference... Captured_Image column can start empty"
    // Linking Rule: "Most recent scan OR next scan". We chose Next Scan (Pending Image).
    const imageToLink = pendingImage || null;

    const newScan = {
      batchNumber: punchNumber,
      scanCount: scans.length + 1,
      punchNumber,
      name: PUNCH_MAP[punchNumber],
      qrValue,
      scanTime: timeString,
      capturedImage: imageToLink, // Link the pending image
      firstScanTime: currentFirstScanTime,
      lastScanTime: timeString,
    };

    const updatedScans = [...scans, newScan];
    setScans(updatedScans);

    // Clear pending image after linking
    if (pendingImage) {
      setPendingImage(null);
    }

    try {
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

    try {
      const response = await fetch('/api/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchNumber: punchNumber,
          operatorName: employeeName,
          scans: finalScans,
          firstScanTime: firstTime,
          lastScanTime: lastTime
        }),
      });

      const result = await response.json();

      if (response.ok && result.batchCompleted) {
        setMessage({ type: 'success', text: 'Batch Email Sent Successfully!' });
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
    setPendingImage(null);
    setMessage({ type: 'info', text: 'Session Reset. Ready for next batch.' });
    setFirstScanTimestamp(null);
    setLastScanTimestamp(null);
    localStorage.removeItem('geoGuardState');
  };

  const calculateDuration = () => {
    if (!firstScanTimestamp || !lastScanTimestamp) return "00:00:00";
    const diff = lastScanTimestamp - firstScanTimestamp;
    const totalSeconds = Math.floor(diff / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const openScanner = () => {
    if (!punchNumber || !PUNCH_MAP[punchNumber]) {
      setMessage({ type: 'error', text: 'Please enter a valid Punch Number first.' });
      return;
    }
    setIsScanning(true);
  };

  // Fixed Camera Icon
  const CameraIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
      <circle cx="12" cy="13" r="4"></circle>
    </svg>
  );

  return (
    <div className="app-container">

      {/* Fixed Camera Icon (Top Left) */}
      <button
        className="fixed-camera-btn"
        onClick={() => setIsTakingPhoto(true)}
        title="Snap Photo"
      >
        <CameraIcon />
      </button>

      <header className="app-header">
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
              disabled={scans.length > 0}
            />
            {/* Employee name is now in the Batch Card, removed badge here for cleaner look if batch active, 
                but let's keep it if no batch started so user knows who it is. 
            */}
            {employeeName && scans.length === 0 && <div className="employee-badge">{employeeName}</div>}
          </div>
        </div>

        {/* Batch Summary Card - REPLACES OLD STATS BAR */}
        {punchNumber && PUNCH_MAP[punchNumber] && (
          <div className="batch-summary-card">
            <div className="batch-row">
              <div className="batch-item highlight">
                <span className="label">Batch No.</span>
                <span className="value">{punchNumber}</span>
              </div>
              <div className="batch-item">
                <span className="label">Name</span>
                <span className="value">{employeeName}</span>
              </div>
            </div>
            <div className="batch-divider"></div>
            <div className="batch-row">
              <div className="batch-item">
                <span className="label">Scans</span>
                <span className="value">{scans.length} / {BATCH_SIZE}</span>
              </div>
              <div className="batch-item highlight">
                <span className="label">Total Duration</span>
                <span className="value">{calculateDuration()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Action: Open QR Scanner */}
        <div className="actions">
          {batchCountCheck(scans.length) ? (
            <button className="btn-primary" onClick={openScanner} disabled={!punchNumber || !PUNCH_MAP[punchNumber]}>
              {scans.length > 0 ? "Continue Scanning" : "Start Batch Scan"}
            </button>
          ) : (
            <div className="batch-complete-msg">Batch Complete ({BATCH_SIZE})</div>
          )}

          <button className="btn-secondary" onClick={resetSession} style={{ marginLeft: '10px' }}>
            Reset
          </button>
        </div>

        {/* Scan List - Simplified */}
        {scans.length > 0 && (
          <div className="scan-list-container">
            <div className="scan-list-header">
              <span>#</span>
              <span>QR Value</span>
              <span>Time</span>
              <span>Img</span>
            </div>
            <div className="scan-list-body">
              {[...scans].reverse().map((scan, i) => (
                <div key={i} className="scan-table-row">
                  <span className="col-idx">{scan.scanCount}</span>
                  <span className="col-qr">{scan.qrValue}</span>
                  <span className="col-time">{scan.scanTime}</span>
                  <span className="col-img">
                    {scan.capturedImage ? "📷" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Image Indicator */}
        {pendingImage && (
          <div className="pending-image-indicator">
            <img src={pendingImage} alt="Pending" />
            <span>Image Ready. Scan QR to Link.</span>
            <button onClick={() => setPendingImage(null)} title="Clear Image">×</button>
          </div>
        )}

        {message && <div className={`message ${message.type}`}>{message.text}</div>}

      </div>

      {/* Modals */}
      {isScanning && (
        <Scanner onScan={handleScan} onClose={() => setIsScanning(false)} />
      )}

      {isTakingPhoto && (
        <PhotoCapture onCapture={handlePhotoCaptured} onClose={() => setIsTakingPhoto(false)} />
      )}

    </div>
  );
}

// Helper to clean up JSX
function batchCountCheck(count) {
  return count < BATCH_SIZE;
}

export default App;
