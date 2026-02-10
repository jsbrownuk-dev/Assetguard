import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, RefreshCw } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError('Unable to access camera. Please ensure permissions are granted.');
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleCapture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(base64);
        stopCamera();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <div className="absolute top-4 right-4 z-10">
        <button onClick={onClose} className="text-white p-2 bg-gray-800 rounded-full hover:bg-gray-700">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      {error ? (
        <div className="text-white text-center p-4">
          <p className="mb-4">{error}</p>
          <button onClick={onClose} className="px-4 py-2 bg-blue-600 rounded-md">Close</button>
        </div>
      ) : (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-8 w-full flex justify-center items-center space-x-8">
            <button 
              onClick={handleCapture}
              className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center shadow-lg active:scale-95 transition-transform hover:bg-gray-100"
            >
              <Camera className="w-10 h-10 text-gray-800" />
            </button>
          </div>
          <div className="absolute top-8 left-0 right-0 text-center pointer-events-none">
            <span className="bg-black/50 text-white px-4 py-2 rounded-full text-sm">
              Point at equipment to scan
            </span>
          </div>
        </div>
      )}
    </div>
  );
};