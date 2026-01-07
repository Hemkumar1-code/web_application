import React, { useEffect, useRef, useState } from 'react';

const PhotoCapture = ({ onCapture, onClose }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [error, setError] = useState(null);
    const [stream, setStream] = useState(null);

    useEffect(() => {
        const startCamera = async () => {
            try {
                const constraints = {
                    video: {
                        facingMode: "environment",
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };
                const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } catch (err) {
                console.error("Camera access error:", err);
                setError("Could not access camera. Please allow permissions.");
            }
        };

        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            // Calculate scaling to max 800px width (or 320 to match previous optimization)
            // User requirement: "Store the image reference... Clean Excel logging"
            // Let's stick to the optimized size (320px) to keep Excel happy unless user wants full res.
            // keeping it decent quality but small size.
            const scale = Math.min(1, 480 / video.videoWidth);

            canvas.width = video.videoWidth * scale;
            canvas.height = video.videoHeight * scale;

            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // compressed jpeg
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            onCapture(dataUrl);
            onClose(); // Close automatically after capture? Or let user close? 
            // "Capture image -> Save -> Show message" 
            // Usually better to close after successful capture.
        }
    };

    return (
        <div className="scanner-overlay">
            <div className="scanner-box" style={{ maxWidth: '500px' }}>
                <button className="close-btn" onClick={onClose}>&times;</button>
                <h3>Take Photo</h3>

                <div className="video-container" style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px', background: '#000' }}>
                    {error ? (
                        <div style={{ padding: '20px', color: 'red' }}>{error}</div>
                    ) : (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            style={{ width: '100%', height: 'auto', display: 'block' }}
                        />
                    )}
                </div>

                <canvas ref={canvasRef} style={{ display: 'none' }} />

                <div className="actions" style={{ marginTop: '20px' }}>
                    <button className="btn-primary" onClick={handleCapture} disabled={!!error}>
                        Capture Image
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PhotoCapture;
