import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from "html5-qrcode";

const Scanner = ({ onScan, onClose }) => {
    const scannerRef = useRef(null);

    useEffect(() => {
        // Initialize Scanner
        // Use a small timeout to ensure DOM is ready
        const timer = setTimeout(() => {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                false
            );

            scanner.render(
                (decodedText) => {
                    // Success callback
                    scanner.clear(); // Stop scanning after success
                    onScan(decodedText);
                },
                (error) => {
                    // Error callback (scanning in progress)
                    // console.warn(error);
                }
            );
            scannerRef.current = scanner;
        }, 100);

        return () => {
            clearTimeout(timer);
            if (scannerRef.current) {
                try {
                    scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
                } catch (e) {
                    // ignore
                }
            }
        };
    }, [onScan]);

    return (
        <div className="scanner-overlay">
            <div className="scanner-box">
                <button className="close-btn" onClick={onClose}>&times;</button>
                <h3>Scan QR Code</h3>
                <div id="reader"></div>
            </div>
        </div>
    );
};

export default Scanner;
