/**
 * Face Alignment Module
 * CRITICAL for production accuracy - normalizes face orientation using landmarks
 * 
 * This module performs affine transformation to:
 * 1. Rotate face to horizontal eye alignment
 * 2. Scale to standard inter-eye distance
 * 3. Center face around nose/mouth region
 * 4. Output standard 112x112 aligned face for ArcFace
 */

export interface FaceLandmarks {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    nose: { x: number; y: number };
    leftMouth: { x: number; y: number };
    rightMouth: { x: number; y: number };
}

export interface AlignmentResult {
    alignedImage: ImageData;
    transformMatrix: number[][]; // 2x3 affine matrix
    quality: number; // Alignment quality score (0-1)
}

// Standard reference points for 112x112 ArcFace input
// These are empirically determined optimal positions
const REFERENCE_LANDMARKS_112 = {
    leftEye: { x: 38.2946, y: 51.6963 },
    rightEye: { x: 73.5318, y: 51.5014 },
    nose: { x: 56.0252, y: 71.7366 },
    leftMouth: { x: 41.5493, y: 92.3655 },
    rightMouth: { x: 70.7299, y: 92.2041 }
};

class FaceAligner {
    /**
     * Align face using 5-point landmarks
     */
    alignFace(
        imageData: ImageData,
        landmarks: FaceLandmarks,
        outputSize: number = 112
    ): AlignmentResult {
        // Calculate scale factor for different output sizes
        const scale = outputSize / 112;
        const refLandmarks = this.scaleReferenceLandmarks(REFERENCE_LANDMARKS_112, scale);

        // Calculate affine transformation matrix
        const transformMatrix = this.calculateAffineTransform(landmarks, refLandmarks);

        // Apply transformation
        const alignedImage = this.applyAffineTransform(imageData, transformMatrix, outputSize);

        // Calculate alignment quality
        const quality = this.assessAlignmentQuality(landmarks);

        return {
            alignedImage,
            transformMatrix,
            quality
        };
    }

    /**
     * Simplified 2-point alignment using only eyes (faster, less accurate)
     */
    alignFaceSimple(
        imageData: ImageData,
        leftEye: { x: number; y: number },
        rightEye: { x: number; y: number },
        outputSize: number = 112
    ): ImageData {
        // Calculate eye center and angle
        const eyeCenter = {
            x: (leftEye.x + rightEye.x) / 2,
            y: (leftEye.y + rightEye.y) / 2
        };

        const dx = rightEye.x - leftEye.x;
        const dy = rightEye.y - leftEye.y;
        const angle = Math.atan2(dy, dx);

        // Calculate scale based on inter-eye distance
        const eyeDistance = Math.sqrt(dx * dx + dy * dy);
        const desiredEyeDistance = outputSize * 0.35; // ~35% of image width
        const scale = desiredEyeDistance / eyeDistance;

        // Create transformation matrix
        const cos = Math.cos(-angle) * scale;
        const sin = Math.sin(-angle) * scale;

        const transformMatrix = [
            [cos, -sin, outputSize / 2 - eyeCenter.x * cos + eyeCenter.y * sin],
            [sin, cos, outputSize / 2 - eyeCenter.x * sin - eyeCenter.y * cos]
        ];

        return this.applyAffineTransform(imageData, transformMatrix, outputSize);
    }

    /**
     * Calculate affine transformation matrix from source to reference landmarks
     * Uses least squares to find best-fit transformation
     */
    private calculateAffineTransform(
        srcLandmarks: FaceLandmarks,
        dstLandmarks: FaceLandmarks
    ): number[][] {
        // Convert landmarks to arrays
        const src = this.landmarksToArray(srcLandmarks);
        const dst = this.landmarksToArray(dstLandmarks);

        // Solve for affine transform using least squares
        // [a b c]   [x']
        // [d e f] * [y'] = [x, y]
        //           [1 ]

        const n = src.length;
        let sumX = 0, sumY = 0, sumXp = 0, sumYp = 0;
        let sumX2 = 0, sumY2 = 0, sumXY = 0;
        let sumXXp = 0, sumYXp = 0, sumXYp = 0, sumYYp = 0;

        for (let i = 0; i < n; i++) {
            const x = src[i].x;
            const y = src[i].y;
            const xp = dst[i].x;
            const yp = dst[i].y;

            sumX += x;
            sumY += y;
            sumXp += xp;
            sumYp += yp;
            sumX2 += x * x;
            sumY2 += y * y;
            sumXY += x * y;
            sumXXp += x * xp;
            sumYXp += y * xp;
            sumXYp += x * yp;
            sumYYp += y * yp;
        }

        // Solve least squares (simplified for 2D affine)
        const denom = n * (sumX2 + sumY2) - sumX * sumX - sumY * sumY;

        if (Math.abs(denom) < 1e-10) {
            // Degenerate case, return identity
            return [[1, 0, 0], [0, 1, 0]];
        }

        const a = (n * sumXXp - sumX * sumXp + n * sumYXp - sumY * sumXp) / denom;
        const b = (n * sumXYp - sumX * sumYp + n * sumYYp - sumY * sumYp) / denom;
        const c = (sumXp - a * sumX - b * sumY) / n;
        const d = (n * sumXXp - sumX * sumXp - n * sumYXp + sumY * sumXp) / denom;
        const e = (n * sumXYp - sumX * sumYp - n * sumYYp + sumY * sumYp) / denom;
        const f = (sumYp - d * sumX - e * sumY) / n;

        return [
            [a, b, c],
            [d, e, f]
        ];
    }

    /**
     * Apply affine transformation to image
     */
    private applyAffineTransform(
        imageData: ImageData,
        matrix: number[][],
        outputSize: number
    ): ImageData {
        const { width: srcWidth, height: srcHeight, data: srcData } = imageData;

        // Create output canvas
        const canvas = document.createElement('canvas');
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext('2d')!;

        // Create output image data
        const outputData = ctx.createImageData(outputSize, outputSize);
        const dst = outputData.data;

        // Inverse transformation for backward mapping (to avoid holes)
        const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
        const invMatrix = [
            [matrix[1][1] / det, -matrix[0][1] / det, (matrix[0][1] * matrix[1][2] - matrix[0][2] * matrix[1][1]) / det],
            [-matrix[1][0] / det, matrix[0][0] / det, (matrix[0][2] * matrix[1][0] - matrix[0][0] * matrix[1][2]) / det]
        ];

        // Apply transformation with bilinear interpolation
        for (let y = 0; y < outputSize; y++) {
            for (let x = 0; x < outputSize; x++) {
                // Map destination pixel to source using inverse transform
                const srcX = invMatrix[0][0] * x + invMatrix[0][1] * y + invMatrix[0][2];
                const srcY = invMatrix[1][0] * x + invMatrix[1][1] * y + invMatrix[1][2];

                // Bilinear interpolation
                const x0 = Math.floor(srcX);
                const y0 = Math.floor(srcY);
                const x1 = x0 + 1;
                const y1 = y0 + 1;

                // Check bounds
                if (x0 >= 0 && x1 < srcWidth && y0 >= 0 && y1 < srcHeight) {
                    const fx = srcX - x0;
                    const fy = srcY - y0;

                    const dstIdx = (y * outputSize + x) * 4;

                    for (let c = 0; c < 3; c++) {
                        const v00 = srcData[(y0 * srcWidth + x0) * 4 + c];
                        const v10 = srcData[(y0 * srcWidth + x1) * 4 + c];
                        const v01 = srcData[(y1 * srcWidth + x0) * 4 + c];
                        const v11 = srcData[(y1 * srcWidth + x1) * 4 + c];

                        const value =
                            v00 * (1 - fx) * (1 - fy) +
                            v10 * fx * (1 - fy) +
                            v01 * (1 - fx) * fy +
                            v11 * fx * fy;

                        dst[dstIdx + c] = Math.round(value);
                    }
                    dst[dstIdx + 3] = 255; // Alpha
                }
            }
        }

        return outputData;
    }

    /**
     * Assess alignment quality based on landmark geometry
     */
    private assessAlignmentQuality(landmarks: FaceLandmarks): number {
        // Calculate inter-eye distance
        const eyeDx = landmarks.rightEye.x - landmarks.leftEye.x;
        const eyeDy = landmarks.rightEye.y - landmarks.leftEye.y;
        const eyeDistance = Math.sqrt(eyeDx * eyeDx + eyeDy * eyeDy);

        // Check if eyes are roughly horizontal (good alignment)
        const eyeAngle = Math.abs(Math.atan2(eyeDy, eyeDx));
        const horizontalScore = Math.max(0, 1 - eyeAngle / (Math.PI / 6)); // Penalize > 30° tilt

        // Check face symmetry (left-right)
        const noseMidX = landmarks.nose.x;
        const eyeMidX = (landmarks.leftEye.x + landmarks.rightEye.x) / 2;
        const mouthMidX = (landmarks.leftMouth.x + landmarks.rightMouth.x) / 2;
        const symmetryError = Math.abs(noseMidX - eyeMidX) + Math.abs(noseMidX - mouthMidX);
        const symmetryScore = Math.max(0, 1 - symmetryError / eyeDistance);

        // Check if landmarks are well-spaced (not occluded)
        const minDistance = eyeDistance * 0.2;
        const spacingScore = eyeDistance > minDistance ? 1 : eyeDistance / minDistance;

        // Combined quality score
        return (horizontalScore * 0.4 + symmetryScore * 0.4 + spacingScore * 0.2);
    }

    /**
     * Convert landmarks object to array
     */
    private landmarksToArray(landmarks: FaceLandmarks): Array<{ x: number; y: number }> {
        return [
            landmarks.leftEye,
            landmarks.rightEye,
            landmarks.nose,
            landmarks.leftMouth,
            landmarks.rightMouth
        ];
    }

    /**
     * Scale reference landmarks for different output sizes
     */
    private scaleReferenceLandmarks(ref: FaceLandmarks, scale: number): FaceLandmarks {
        return {
            leftEye: { x: ref.leftEye.x * scale, y: ref.leftEye.y * scale },
            rightEye: { x: ref.rightEye.x * scale, y: ref.rightEye.y * scale },
            nose: { x: ref.nose.x * scale, y: ref.nose.y * scale },
            leftMouth: { x: ref.leftMouth.x * scale, y: ref.leftMouth.y * scale },
            rightMouth: { x: ref.rightMouth.x * scale, y: ref.rightMouth.y * scale }
        };
    }

    /**
     * Unified preprocessing for both Aadhaar and Live faces
     * Ensures identical alignment and sizing for the embedding model
     */
    preprocessFace(
        imageData: ImageData,
        landmarks?: FaceLandmarks | Array<{ x: number; y: number }>,
        box?: { x: number; y: number; width: number; height: number }
    ): ImageData {
        // 1. Convert landmarks to standard format if needed
        let standardLandmarks: FaceLandmarks | null = null;
        if (landmarks) {
            if (Array.isArray(landmarks)) {
                standardLandmarks = this.extractLandmarks(landmarks);
            } else {
                standardLandmarks = landmarks as FaceLandmarks;
            }
        }

        // 2. Perform Alignment if landmarks exist
        if (standardLandmarks) {
            const alignment = this.alignFace(imageData, standardLandmarks, 112);
            return alignment.alignedImage;
        }

        // 3. Fallback to crop if only box is provided
        if (box) {
            // Import cropImageData locally or assume it's available (better to consolidate)
            const canvas = document.createElement('canvas');
            canvas.width = 112;
            canvas.height = 112;
            const ctx = canvas.getContext('2d')!;

            // Draw cropped and resized
            const srcCanvas = document.createElement('canvas');
            srcCanvas.width = imageData.width;
            srcCanvas.height = imageData.height;
            srcCanvas.getContext('2d')!.putImageData(imageData, 0, 0);

            ctx.drawImage(
                srcCanvas,
                Math.max(0, box.x), Math.max(0, box.y),
                Math.min(box.width, imageData.width - box.x),
                Math.min(box.height, imageData.height - box.y),
                0, 0, 112, 112
            );

            return ctx.getImageData(0, 0, 112, 112);
        }

        throw new Error('Preprocess failed: Neither landmarks nor bounding box provided');
    }

    /**
     * Extract landmarks from face detection keypoints
     * Adapts various detector formats to standard 5-point format
     */
    extractLandmarks(keypoints: Array<{ x: number; y: number }>): FaceLandmarks | null {
        if (keypoints.length < 5) {
            console.warn('[FaceAligner] Not enough keypoints for alignment:', keypoints.length);
            return null;
        }

        // Standard order: left_eye, right_eye, nose, left_mouth, right_mouth
        return {
            leftEye: keypoints[0],
            rightEye: keypoints[1],
            nose: keypoints[2],
            leftMouth: keypoints[3],
            rightMouth: keypoints[4]
        };
    }
}

// Export singleton
export const faceAligner = new FaceAligner();
