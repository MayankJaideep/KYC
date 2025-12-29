/**
 * MediaPipe Face Mesh Integration
 * Replaces ONNX BlazeFace with stable, CDN-loaded MediaPipe
 */

import { FaceMesh, Results } from '@mediapipe/face_mesh';

export interface FaceDetectionResult {
    box: {
        x: number;
        y: number;
        width: number;
        height: number;
        confidence: number;
    };
    landmarks: Array<{ x: number; y: number; z?: number }>;
    confidence: number;
}

class MediaPipeFaceDetector {
    private faceMesh: FaceMesh | null = null;
    private initialized = false;

    /**
     * Initialize MediaPipe Face Mesh
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log('[MediaPipe] Initializing Face Mesh...');

        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.initialized = true;
        console.log('[MediaPipe] Face Mesh initialized');
    }

    /**
     * Detect face in image
     */
    async detectFace(imageData: ImageData): Promise<FaceDetectionResult | null> {
        if (!this.faceMesh) {
            await this.initialize();
        }

        return new Promise((resolve) => {
            this.faceMesh!.onResults((results: Results) => {
                if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
                    resolve(null);
                    return;
                }

                const landmarks = results.multiFaceLandmarks[0];

                // Calculate bounding box from landmarks
                const xs = landmarks.map(l => l.x);
                const ys = landmarks.map(l => l.y);

                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);

                const width = maxX - minX;
                const height = maxY - minY;

                resolve({
                    box: {
                        x: minX * imageData.width,
                        y: minY * imageData.height,
                        width: width * imageData.width,
                        height: height * imageData.height,
                        confidence: 0.99 // MediaPipe doesn't provide confidence per face
                    },
                    landmarks: landmarks.map(l => ({
                        x: l.x * imageData.width,
                        y: l.y * imageData.height,
                        z: l.z
                    })),
                    confidence: 0.99
                });
            });

            // Send image to MediaPipe
            const canvas = document.createElement('canvas');
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            const ctx = canvas.getContext('2d')!;
            ctx.putImageData(imageData, 0, 0);

            this.faceMesh!.send({ image: canvas });
        });
    }

    /**
     * Detect face from video element (for camera feed)
     */
    async detectFromVideo(videoElement: HTMLVideoElement): Promise<FaceDetectionResult | null> {
        if (!this.faceMesh) {
            await this.initialize();
        }

        return new Promise((resolve) => {
            this.faceMesh!.onResults((results: Results) => {
                if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
                    resolve(null);
                    return;
                }

                const landmarks = results.multiFaceLandmarks[0];

                const xs = landmarks.map(l => l.x);
                const ys = landmarks.map(l => l.y);

                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);

                const width = maxX - minX;
                const height = maxY - minY;

                resolve({
                    box: {
                        x: minX * videoElement.videoWidth,
                        y: minY * videoElement.videoHeight,
                        width: width * videoElement.videoWidth,
                        height: height * videoElement.videoHeight,
                        confidence: 0.99
                    },
                    landmarks: landmarks.map(l => ({
                        x: l.x * videoElement.videoWidth,
                        y: l.y * videoElement.videoHeight,
                        z: l.z
                    })),
                    confidence: 0.99
                });
            });

            this.faceMesh!.send({ image: videoElement });
        });
    }

    /**
     * Release resources
     */
    async release(): Promise<void> {
        if (this.faceMesh) {
            this.faceMesh.close();
            this.faceMesh = null;
            this.initialized = false;
        }
    }
}

// Export singleton
export const mediaPipeFaceDetector = new MediaPipeFaceDetector();
