/**
 * Simple Liveness Detection
 * Uses heuristics instead of ML models for stability
 */

import { FaceDetectionResult } from './mediapipe-face';

/**
 * Calculate Eye Aspect Ratio (EAR) for blink detection
 */
export function calculateEAR(landmarks: Array<{ x: number; y: number }>): number {
    // MediaPipe Face Mesh eye landmark indices
    // Left eye: 33, 160, 158, 133, 153, 144
    // Right eye: 362, 385, 387, 263, 373, 380

    const leftEye = {
        top: landmarks[159],
        bottom: landmarks[145],
        left: landmarks[133],
        right: landmarks[33]
    };

    const rightEye = {
        top: landmarks[386],
        bottom: landmarks[374],
        left: landmarks[362],
        right: landmarks[263]
    };

    // Calculate vertical distances
    const leftVertical = Math.abs(leftEye.top.y - leftEye.bottom.y);
    const rightVertical = Math.abs(rightEye.top.y - rightEye.bottom.y);

    // Calculate horizontal distances
    const leftHorizontal = Math.abs(leftEye.left.x - leftEye.right.x);
    const rightHorizontal = Math.abs(rightEye.left.x - rightEye.right.x);

    // EAR formula: (vertical / horizontal)
    const leftEAR = leftVertical / leftHorizontal;
    const rightEAR = rightVertical / rightHorizontal;

    return (leftEAR + rightEAR) / 2;
}

/**
 * Detect blink from EAR sequence
 */
export class BlinkDetector {
    private earHistory: number[] = [];
    private blinkCount = 0;
    private readonly EAR_THRESHOLD = 0.2; // Eyes closed if EAR < 0.2
    private readonly HISTORY_SIZE = 10;
    private wasBlinking = false;

    addFrame(landmarks: Array<{ x: number; y: number }>): { isBlinking: boolean; blinkCount: number } {
        const ear = calculateEAR(landmarks);

        this.earHistory.push(ear);
        if (this.earHistory.length > this.HISTORY_SIZE) {
            this.earHistory.shift();
        }

        const isBlinking = ear < this.EAR_THRESHOLD;

        // Detect blink transition (open → closed → open)
        if (!this.wasBlinking && isBlinking) {
            this.blinkCount++;
        }

        this.wasBlinking = isBlinking;

        return { isBlinking, blinkCount: this.blinkCount };
    }

    reset(): void {
        this.earHistory = [];
        this.blinkCount = 0;
        this.wasBlinking = false;
    }
}

/**
 * Calculate head pose (yaw, pitch, roll) from landmarks
 */
export function calculateHeadPose(landmarks: Array<{ x: number; y: number; z?: number }>): {
    yaw: number;
    pitch: number;
    roll: number;
} {
    // Simplified head pose using key facial points
    const noseTip = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const leftMouth = landmarks[61];
    const rightMouth = landmarks[291];

    // Yaw (left/right turn)
    const eyeCenter = {
        x: (leftEye.x + rightEye.x) / 2,
        y: (leftEye.y + rightEye.y) / 2
    };

    const yaw = (noseTip.x - eyeCenter.x) / (rightEye.x - leftEye.x) * 90;

    // Pitch (up/down nod)
    const mouthCenter = {
        x: (leftMouth.x + rightMouth.x) / 2,
        y: (leftMouth.y + rightMouth.y) / 2
    };

    const pitch = (noseTip.y - eyeCenter.y) / (mouthCenter.y - eyeCenter.y) * 30;

    // Roll (tilt)
    const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI;

    return { yaw, pitch, roll };
}

/**
 * Detect depth change (screen vs real face)
 */
export class DepthDetector {
    private interOcularDistances: number[] = [];
    private readonly HISTORY_SIZE = 30;

    addFrame(landmarks: Array<{ x: number; y: number }>): { variance: number; isRealFace: boolean } {
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];

        const distance = Math.sqrt(
            Math.pow(rightEye.x - leftEye.x, 2) +
            Math.pow(rightEye.y - leftEye.y, 2)
        );

        this.interOcularDistances.push(distance);
        if (this.interOcularDistances.length > this.HISTORY_SIZE) {
            this.interOcularDistances.shift();
        }

        // Calculate variance (real faces have more depth variance)
        const mean = this.interOcularDistances.reduce((a, b) => a + b, 0) / this.interOcularDistances.length;
        const variance = this.interOcularDistances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / this.interOcularDistances.length;

        // Real faces have variance > 10 (threshold may need tuning)
        const isRealFace = variance > 10;

        return { variance, isRealFace };
    }

    reset(): void {
        this.interOcularDistances = [];
    }
}

/**
 * Complete liveness check orchestrator
 */
export class LivenessChecker {
    private blinkDetector = new BlinkDetector();
    private depthDetector = new DepthDetector();

    private requiredBlinks = 2;
    private requiredHeadTurns = { left: false, right: false };

    checkFrame(detection: FaceDetectionResult): {
        blinks: number;
        headPose: { yaw: number; pitch: number; roll: number };
        depth: { variance: number; isRealFace: boolean };
        isPassed: boolean;
    } {
        const { isBlinking, blinkCount } = this.blinkDetector.addFrame(detection.landmarks);
        const headPose = calculateHeadPose(detection.landmarks);
        const depth = this.depthDetector.addFrame(detection.landmarks);

        // Check head turns
        if (headPose.yaw < -15) this.requiredHeadTurns.left = true;
        if (headPose.yaw > 15) this.requiredHeadTurns.right = true;

        // Pass criteria: 2+ blinks, both head turns, real depth
        const isPassed =
            blinkCount >= this.requiredBlinks &&
            this.requiredHeadTurns.left &&
            this.requiredHeadTurns.right &&
            depth.isRealFace;

        return { blinks: blinkCount, headPose, depth, isPassed };
    }

    reset(): void {
        this.blinkDetector.reset();
        this.depthDetector.reset();
        this.requiredHeadTurns = { left: false, right: false };
    }
}
