import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FaceMesh as FaceMeshType, Results } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Camera as CameraIcon, AlertCircle } from 'lucide-react';

// Import FaceMesh constructor properly for production
const FaceMesh = (window as any).FaceMesh || FaceMeshType;

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface CameraFeedProps {
  onFaceDetected: (landmarks: Point3D[], confidence: number) => void;
  isActive: boolean;
  showMesh?: boolean;
}

export function CameraFeed({ onFaceDetected, isActive, showMesh = true }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<typeof FaceMesh | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);

  const drawFaceMesh = useCallback((landmarks: Point3D[], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showMesh) return;

    // Draw mesh points
    ctx.fillStyle = 'hsla(173, 80%, 50%, 0.6)';

    // Draw only key landmarks for performance
    const keyPoints = [
      // Face contour
      10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
      // Eyes
      33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
      263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466,
      // Nose
      1, 2, 98, 327, 4, 5, 6, 168, 195, 197,
      // Mouth
      61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
    ];

    for (const idx of keyPoints) {
      if (landmarks[idx]) {
        const x = landmarks[idx].x * canvas.width;
        const y = landmarks[idx].y * canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Draw connecting lines for face outline
    ctx.strokeStyle = 'hsla(173, 80%, 50%, 0.3)';
    ctx.lineWidth = 1;

    const faceOutline = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10];

    ctx.beginPath();
    for (let i = 0; i < faceOutline.length; i++) {
      const point = landmarks[faceOutline[i]];
      if (point) {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();
  }, [showMesh]);

  const onResults = useCallback((results: Results) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0].map(l => ({
        x: l.x,
        y: l.y,
        z: l.z,
      }));

      setFaceDetected(true);
      drawFaceMesh(landmarks, canvas);
      onFaceDetected(landmarks, 1);
    } else {
      setFaceDetected(false);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      onFaceDetected([], 0);
    }
  }, [onFaceDetected, drawFaceMesh]);

  useEffect(() => {
    if (!isActive) return;

    const initCamera = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setCameraPermissionDenied(false);

        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Camera not supported in this browser');
          setIsLoading(false);
          return;
        }

        // Wait for MediaPipe to load from CDN
        let attempts = 0;
        while (!(window as any).FaceMesh && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!(window as any).FaceMesh) {
          setError('Failed to load face detection library. Please refresh the page.');
          setIsLoading(false);
          return;
        }

        // Use the global FaceMesh constructor
        const FaceMeshConstructor = (window as any).FaceMesh;
        const faceMesh = new FaceMeshConstructor({
          locateFile: (file: string) => {
            // Use specific version for better reliability in production
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
          },
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });

        faceMesh.onResults(onResults);
        faceMeshRef.current = faceMesh;

        // Request camera permission explicitly first
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user'
            }
          });

          // Stop the test stream
          stream.getTracks().forEach(track => track.stop());
        } catch (permErr: any) {
          console.error('Camera permission error:', permErr);
          if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
            setCameraPermissionDenied(true);
            setError('Camera permission denied');
          } else if (permErr.name === 'NotFoundError') {
            setError('No camera found on this device');
          } else {
            setError('Failed to access camera: ' + permErr.message);
          }
          setIsLoading(false);
          return;
        }

        // Initialize camera with MediaPipe
        if (videoRef.current) {
          const CameraConstructor = (window as any).Camera;
          const camera = new CameraConstructor(videoRef.current, {
            onFrame: async () => {
              if (faceMeshRef.current && videoRef.current) {
                await faceMeshRef.current.send({ image: videoRef.current });
              }
            },
            width: 640,
            height: 480,
          });

          await camera.start();
          cameraRef.current = camera;
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error initializing camera:', err);

        // Check if it's a permission error
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setCameraPermissionDenied(true);
            setError('Camera permission denied');
          } else if (err.name === 'NotFoundError') {
            setError('No camera found');
          } else if (err.message.includes('WASM') || err.message.includes('fetch')) {
            setError('Failed to load face detection models. Please check your internet connection.');
          } else {
            setError('Failed to initialize camera: ' + err.message);
          }
        } else {
          setError('Failed to initialize camera');
        }
        setIsLoading(false);
      }
    };

    initCamera();

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
    };
  }, [isActive, onResults]);

  return (
    <div className="relative w-full aspect-[4/3] max-w-lg mx-auto overflow-hidden rounded-2xl bg-secondary">
      {/* Video feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        playsInline
        muted
      />

      {/* Face mesh overlay */}
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none"
      />

      {/* Face detection indicator */}
      <AnimatePresence>
        {!isLoading && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            {/* Corner brackets */}
            <div className={`absolute top-4 left-4 w-12 h-12 border-l-2 border-t-2 rounded-tl-lg transition-colors duration-300 ${faceDetected ? 'border-primary' : 'border-muted-foreground/30'}`} />
            <div className={`absolute top-4 right-4 w-12 h-12 border-r-2 border-t-2 rounded-tr-lg transition-colors duration-300 ${faceDetected ? 'border-primary' : 'border-muted-foreground/30'}`} />
            <div className={`absolute bottom-4 left-4 w-12 h-12 border-l-2 border-b-2 rounded-bl-lg transition-colors duration-300 ${faceDetected ? 'border-primary' : 'border-muted-foreground/30'}`} />
            <div className={`absolute bottom-4 right-4 w-12 h-12 border-r-2 border-b-2 rounded-br-lg transition-colors duration-300 ${faceDetected ? 'border-primary' : 'border-muted-foreground/30'}`} />

            {/* Scanning line */}
            {!faceDetected && (
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent scan-line" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80 backdrop-blur-sm"
          >
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">Initializing camera...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80 backdrop-blur-sm p-6"
          >
            <AlertCircle className="w-8 h-8 text-destructive mb-3" />
            <p className="text-sm text-center text-muted-foreground">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Face detection status badge */}
      <AnimatePresence>
        {!isLoading && !error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-1/2 -translate-x-1/2"
          >
            <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors duration-300 ${faceDetected
              ? 'bg-success/20 text-success border border-success/30'
              : 'bg-warning/20 text-warning border border-warning/30'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${faceDetected ? 'bg-success' : 'bg-warning'}`} />
              {faceDetected ? 'Face Detected' : 'Position Your Face'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
