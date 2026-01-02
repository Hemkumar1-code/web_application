import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from "html5-qrcode";

const Scanner = ({ onScan, onClose }) => {
    const [error, setError] = useState(null);
    const scannerRef = useRef(null);

    useEffect(() => {
        const scannerId = "reader";
        let html5QrCode;

        const startScanner = async () => {
            try {
                html5QrCode = new Html5Qrcode(scannerId);
                const config = { fps: 10, qrbox: { width: 250, height: 250 } };

                // Prefer back camera
                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText) => {
                        // Success callback
                        html5QrCode.stop().then(() => {
                            onScan(decodedText);
                        }).catch(err => console.error("Failed to stop scanner", err));
                    },
                    (errorMessage) => {
                        // Error callback (scanning in progress, no code found yet)
                        // we ignore distinct errors for UI cleanliness
                    }
                );
                scannerRef.current = html5QrCode;
            } catch (err) {
                console.error("Error starting scanner:", err);
                setError("Could not start camera. Please ensure permissions are granted.");
            }
        };

        startScanner();

        // Cleanup on unmount
        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(err => console.error("Failed to stop scanner on unmount", err));
            }
        };
    }, [onScan]);

    return (
        <div className="scanner-overlay">
            <div className="scanner-box">
                <button className="close-btn" onClick={() => {
                    if (scannerRef.current) {
                        try {
                            scannerRef.current.stop().then(onClose).catch(() => onClose());
                        } catch (e) {
                            onClose();
                        }
                    } else {
                        onClose();
                    }
                }}>&times;</button>
                <h3>Scan QR Code</h3>
                <div id="reader" style={{ width: "100%", minHeight: "300px" }}></div>
                {error && <p className="error-msg">{error}</p>}
                <p className="hint">Point camera at QR code</p>
            </div>
        </div>
    );
};

export default Scanner;
