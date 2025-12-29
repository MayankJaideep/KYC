/**
 * Liveness Detector Module
 * Uses MiniFASNetV2 ONNX model for anti-spoofing (photo/video/mask detection)
 */

import {
    loadONNXModel,
    safeRun,
    ensureModelLoaded,
    imageDataToTensor,
    cropImageData,
    softmax,
    ort,
    type InferenceSession
} from '../onnx';
import type { BoundingBox } from './face-detector';

export interface LivenessResult {
    isLive: boolean;
    confidence: number;
    spoofProbability: number;
    spoofType?: 'photo' | 'video' | 'mask' | 'unknown';
}

export type LivenessThreshold = 'low' | 'medium' | 'high';

const THRESHOLDS: Record<LivenessThreshold, number> = {
    low: 0.5,
    medium: 0.7,
    high: 0.9
};

class LivenessDetector {
    private session: InferenceSession | null = null;
    private modelPath = '/models/onnx/minifasnet_v2.onnx';
    private modelName = 'minifasnet_v2';

    /**
     * Initialize liveness detector
     */
    async initialize(): Promise<void> {
        if (this.session) return;

        console.log('[LivenessDetector] Initializing...');

        try {
            const loaded = await ensureModelLoaded(this.modelPath, this.modelName);
            this.session = loaded.session;
            console.log('[LivenessDetector] Initialized');
        } catch (e) {
            console.error('[LivenessDetector] Failed to initialize:', e);
            throw e;
        }
    }

    /**
     * Check if face is live or spoofed
     */
    async checkLiveness(
        imageData: ImageData,
        faceBox: BoundingBox,
        threshold: LivenessThreshold = 'medium'
    ): Promise<LivenessResult> {
        if (!this.session) {
            await this.initialize();
        }

        // Crop face region with some padding
        const padding = 0.2; // 20% padding around face
        const paddedBox = {
            x: Math.max(0, faceBox.x - faceBox.width * padding),
            y: Math.max(0, faceBox.y - faceBox.height * padding),
            width: faceBox.width * (1 + 2 * padding),
            height: faceBox.height * (1 + 2 * padding)
        };

        const croppedFace = cropImageData(imageData, paddedBox);

        // Preprocess (MiniFASNet expects 80x80 or 224x224 input)
        // MiniFASNetV2 typically uses 80x80
        const inputTensor = imageDataToTensor(croppedFace, {
            targetSize: [80, 80],
            mean: [127.5, 127.5, 127.5],
            std: [128, 128, 128], // Note: verify std for specific model version
            channelsFirst: true
        });

        // Run inference safely with dynamic multi-input fulfillment
        const feeds: Record<string, any> = {};
        const inputNames = this.session!.inputNames;

        feeds[inputNames[0]] = inputTensor;

        // Fulfill additional required inputs
        for (let i = 1; i < inputNames.length; i++) {
            const name = inputNames[i];
            feeds[name] = new ort.Tensor('float32', new Float32Array([0.5]), [1]);
        }

        const outputs = await safeRun(this.session!, feeds, this.modelName);

        // Parse outputs
        const result = this.parseOutputs(outputs, THRESHOLDS[threshold]);

        return result;
    }

    /**
     * Parse model outputs into liveness result
     */
    private parseOutputs(outputs: any, threshold: number): LivenessResult {
        try {
            // MiniFASNet typically outputs logits for [live, spoof] or [spoof, live]
            // We assume output named 'output', 'output0', or just the first output
            const firstOutputName = Object.keys(outputs)[0];
            const logits = outputs.output || outputs.output0 || outputs[firstOutputName];

            if (!logits) {
                throw new Error('Unexpected output format');
            }

            const logitsData = logits.data as Float32Array;

            // Apply softmax to get probabilities
            const probs = softmax(logitsData);

            // Assuming [live_prob, spoof_prob] format (typical for FasNet)
            // But sometimes it's [spoof, live, ...]
            // For this implementation we assume index 0 is live, 1 is spoof
            const liveProb = probs[0];
            const spoofProb = probs[1];

            const isLive = liveProb >= threshold;

            // Attempt to classify spoof type (if confidence is high)
            let spoofType: 'photo' | 'video' | 'mask' | 'unknown' | undefined;
            if (!isLive && spoofProb > 0.8) {
                // This would require a more sophisticated model or additional outputs
                // For now, default to 'photo' as most common spoof
                spoofType = 'photo';
            }

            return {
                isLive,
                confidence: liveProb,
                spoofProbability: spoofProb,
                spoofType
            };
        } catch (e) {
            console.error('[LivenessDetector] Failed to parse outputs:', e);
            // Conservative: assume not live if parsing fails
            return {
                isLive: false,
                confidence: 0,
                spoofProbability: 1,
                spoofType: 'unknown'
            };
        }
    }

    /**
     * Release resources
     */
    async release(): Promise<void> {
        this.session = null;
    }
}

// Export singleton
export const livenessDetector = new LivenessDetector();
