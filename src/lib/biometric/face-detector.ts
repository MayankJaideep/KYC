/**
 * Face Detector Module
 * Uses BlazeFace ONNX model for fast face detection
 */

import {
    loadONNXModel,
    safeRun,
    ensureModelLoaded,
    imageDataToTensor,
    Tensor,
    ort,
    type InferenceSession
} from '../onnx';

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
}

export interface FaceKeypoint {
    x: number;
    y: number;
}

export interface FaceDetection {
    box: BoundingBox;
    keypoints: FaceKeypoint[];
    confidence: number;
}

class FaceDetector {
    private session: InferenceSession | null = null;
    private modelPath = '/models/onnx/blazeface.onnx';
    private modelName = 'blazeface';

    /**
     * Initialize face detector
     */
    async initialize(): Promise<void> {
        if (this.session) return;

        console.log('[FaceDetector] Initializing...');

        try {
            const loaded = await ensureModelLoaded(this.modelPath, this.modelName);
            this.session = loaded.session;
            console.log('[FaceDetector] Initialized');
        } catch (e) {
            console.error('[FaceDetector] Failed to initialize:', e);
            throw e;
        }
    }

    /**
     * Detect faces in an image
     */
    async detectFaces(imageData: ImageData, options: { maxFaces?: number; minConfidence?: number } = {}): Promise<FaceDetection[]> {
        if (!this.session) {
            await this.initialize();
        }

        const { maxFaces = 10, minConfidence = 0.7 } = options;

        // Preprocess (BlazeFace expects 128x128 RGB input)
        const inputTensor = imageDataToTensor(imageData, {
            targetSize: [128, 128],
            mean: [127.5, 127.5, 127.5],
            std: [127.5, 127.5, 127.5],
            channelsFirst: true
        });

        // Run inference safely with dynamic multi-input fulfillment
        const feeds: Record<string, any> = {};
        const inputNames = this.session!.inputNames;

        // The first input is always assumed to be the image (float32)
        feeds[inputNames[0]] = inputTensor;

        // Fulfill additional required inputs with safe defaults
        for (let i = 1; i < inputNames.length; i++) {
            const name = inputNames[i];

            // Provide reasonable defaults for common input names
            if (name.includes('conf')) {
                feeds[name] = new ort.Tensor('float32', new Float32Array([minConfidence]), [1]);
            } else if (name.includes('iou') || name.includes('overlap')) {
                feeds[name] = new ort.Tensor('float32', new Float32Array([0.45]), [1]);
            } else {
                feeds[name] = new ort.Tensor('float32', new Float32Array([0.5]), [1]);
            }
        }

        const outputs = await safeRun(this.session!, feeds, this.modelName);

        // Parse outputs (BlazeFace returns boxes and scores)
        const detections = this.parseOutputs(
            outputs,
            imageData.width,
            imageData.height,
            minConfidence,
            maxFaces
        );

        return detections;
    }

    /**
     * Detect single face (returns highest confidence face)
     */
    async detectSingleFace(imageData: ImageData, minConfidence: number = 0.7): Promise<FaceDetection | null> {
        const faces = await this.detectFaces(imageData, { maxFaces: 1, minConfidence });
        return faces.length > 0 ? faces[0] : null;
    }

    /**
     * Parse model outputs into face detections
     */
    private parseOutputs(
        outputs: any,
        imageWidth: number,
        imageHeight: number,
        minConfidence: number,
        maxFaces: number
    ): FaceDetection[] {
        const detections: FaceDetection[] = [];

        try {
            // Flexible output name handling for BlazeFace models
            const boxes = outputs.boxes || outputs.output0;
            const scores = outputs.scores || outputs.output1;

            if (!boxes || !scores) {
                console.warn('[FaceDetector] Unexpected output format:', Object.keys(outputs));
                return [];
            }

            const boxesData = boxes.data;
            const scoresData = scores.data;

            // Simple parsing assuming flattened arrays
            const numDetections = Math.min(Math.floor(scoresData.length), maxFaces);

            for (let i = 0; i < numDetections; i++) {
                const confidence = scoresData[i];

                if (confidence < minConfidence) continue;

                // Typical BlazeFace box: ymin, xmin, ymax, xmax (relative 0-1)
                const ymin = boxesData[i * 4];
                const xmin = boxesData[i * 4 + 1];
                const ymax = boxesData[i * 4 + 2];
                const xmax = boxesData[i * 4 + 3];

                const x = xmin * imageWidth;
                const y = ymin * imageHeight;
                const w = (xmax - xmin) * imageWidth;
                const h = (ymax - ymin) * imageHeight;

                // Allow smaller face sizes (≥40px)
                if (w < 40 || h < 40) continue;

                detections.push({
                    box: { x, y, width: w, height: h, confidence },
                    keypoints: [],
                    confidence
                });
            }
        } catch (e) {
            console.error('[FaceDetector] Failed to parse outputs:', e);
        }

        // Sort by confidence
        detections.sort((a, b) => b.confidence - a.confidence);

        return detections;
    }

    /**
     * Release resources
     */
    async release(): Promise<void> {
        this.session = null;
    }
}

// Export singleton
export const faceDetector = new FaceDetector();
