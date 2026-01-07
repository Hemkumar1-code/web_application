import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from "html5-qrcode";

const Scanner = ({ onScan, onClose }) => {
    const [error, setError] = useState(null);
    const [isTorchSupported, setIsTorchSupported] = useState(false);
    const [isTorchOn, setIsTorchOn] = useState(false);

    const scannerRef = useRef(null);

    // Helper to get track
    const getVideoTrack = () => {
        const video = document.querySelector("#reader video");
        if (video && video.srcObject) {
            const tracks = video.srcObject.getVideoTracks();
            if (tracks && tracks.length > 0) {
                return tracks[0];
            }
        }
        return null;
    };

    const toggleTorch = async () => {
        const track = getVideoTrack();
        if (!track) return;

        const newStatus = !isTorchOn;
        try {
            await track.applyConstraints({
                advanced: [{ torch: newStatus }]
            });
            setIsTorchOn(newStatus);
        } catch (err) {
            console.error("Failed to toggle torch", err);
        }
    };

    useEffect(() => {
        const scannerId = "reader";
        let html5QrCode;

        const startScanner = async () => {
            try {
                html5QrCode = new Html5Qrcode(scannerId);
                const config = {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                };

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
                        // ignore
                    }
                );
                scannerRef.current = html5QrCode;

                // Aggressively check for Torch Capability
                let attempts = 0;
                const checkInterval = setInterval(() => {
                    attempts++;
                    const track = getVideoTrack();
                    if (track && track.getCapabilities) {
                        const capabilities = track.getCapabilities();
                        if (capabilities.torch) {
                            setIsTorchSupported(true);
                            clearInterval(checkInterval);
                        }
                    }
                    if (attempts > 30) { // Try for 3 seconds (100ms * 30)
                        clearInterval(checkInterval);
                    }
                }, 100);

            } catch (err) {
                console.error("Error starting scanner:", err);
                setError("Could not start camera. Please ensure permissions are granted.");
            }
        };

        startScanner();

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(err => console.error("Failed to stop scanner on unmount", err));
            }
        };
    }, [onScan]);

    const handleClose = () => {
        if (scannerRef.current) {
            try {
                // Ensure torch is off implicitly by stopping track, but can allow explicit if needed
                scannerRef.current.stop().then(onClose).catch(() => onClose());
            } catch (e) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    return (
        <div className="scanner-overlay">
            <div className="scanner-box">

                {isTorchSupported && (
                    <button
                        className={`flash-btn ${isTorchOn ? 'active' : ''}`}
                        onClick={toggleTorch}
                        title="Toggle Flash"
                    >
                        {isTorchOn ? '⚡' : '⛈'}
                    </button>
                )}

                <button className="close-btn" onClick={handleClose}>&times;</button>

                <h3>Scan QR Code</h3>
                <div id="reader" style={{ width: "100%", minHeight: "300px" }}></div>
                {error && <p className="error-msg">{error}</p>}
                <p className="hint">Point camera at QR code</p>
            </div>
        </div>
    );
};

export default Scanner;
