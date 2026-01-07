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

            // Reduce to max 200px width for Excel 32k char limit safety
            // 200px should keep it well under 20KB base64string.
            const scale = Math.min(1, 200 / video.videoWidth);

            canvas.width = video.videoWidth * scale;
            canvas.height = video.videoHeight * scale;

            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Start with medium compression
            let quality = 0.6;
            let dataUrl = canvas.toDataURL('image/jpeg', quality);

            // Recursive reduction if still too large for Excel cell (32767 chars)
            while (dataUrl.length > 30000 && quality > 0.1) {
                quality -= 0.1;
                dataUrl = canvas.toDataURL('image/jpeg', quality);
            }

            if (dataUrl.length > 32700) {
                console.warn("Image still too large for Excel, sending placeholder");
                dataUrl = "Image too large";
            }

            onCapture(dataUrl);
            onClose();
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
