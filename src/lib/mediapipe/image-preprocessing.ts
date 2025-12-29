/**
 * Image Preprocessing for Face Recognition
 * Enhances image quality before embedding extraction
 */

export interface ImageQuality {
    isBlurry: boolean;
    blurScore: number;
    brightness: number;
    faceSize: number;
    isGoodQuality: boolean;
    issues: string[];
}

export class ImagePreprocessor {

    /**
     * Detect blur using Laplacian variance
     */
    detectBlur(imageData: ImageData): number {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;

        // Convert to grayscale
        const gray = new Float32Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
            const idx = i / 4;
            gray[idx] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        // Calculate Laplacian
        let variance = 0;
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const laplacian =
                    -gray[idx - width - 1] - gray[idx - width] - gray[idx - width + 1] -
                    gray[idx - 1] + 8 * gray[idx] - gray[idx + 1] -
                    gray[idx + width - 1] - gray[idx + width] - gray[idx + width + 1];
                variance += laplacian * laplacian;
            }
        }

        variance /= (width - 2) * (height - 2);
        return variance;
    }

    /**
     * Calculate average brightness
     */
    calculateBrightness(imageData: ImageData): number {
        const data = imageData.data;
        let sum = 0;

        for (let i = 0; i < data.length; i += 4) {
            // Use perceived brightness formula
            sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        return sum / (data.length / 4);
    }

    /**
     * Normalize brightness and contrast
     */
    normalizeBrightness(imageData: ImageData, targetBrightness: number = 128): ImageData {
        const currentBrightness = this.calculateBrightness(imageData);
        const delta = targetBrightness - currentBrightness;

        const normalized = new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );

        for (let i = 0; i < normalized.data.length; i += 4) {
            normalized.data[i] = Math.max(0, Math.min(255, normalized.data[i] + delta));
            normalized.data[i + 1] = Math.max(0, Math.min(255, normalized.data[i + 1] + delta));
            normalized.data[i + 2] = Math.max(0, Math.min(255, normalized.data[i + 2] + delta));
        }

        return normalized;
    }

    /**
     * Check overall image quality
     */
    checkQuality(imageData: ImageData): ImageQuality {
        const blurScore = this.detectBlur(imageData);
        const brightness = this.calculateBrightness(imageData);
        const faceSize = Math.min(imageData.width, imageData.height);

        const issues: string[] = [];
        let isGoodQuality = true;

        // Blur check (LOWERED threshold: 50 instead of 100)
        const isBlurry = blurScore < 50;
        if (isBlurry) {
            issues.push('Image is too blurry');
            // Don't fail on blur alone
            // isGoodQuality = false;
        }

        // Brightness check (WIDENED range: 30-220 instead of 50-200)
        if (brightness < 30) {
            issues.push('Image is too dark');
            // isGoodQuality = false;
        } else if (brightness > 220) {
            issues.push('Image is too bright');
            // isGoodQuality = false;
        }

        // Size check (LOWERED minimum: 50x50 instead of 100x100)
        if (faceSize < 50) {
            issues.push('Face is too small');
            isGoodQuality = false; // Only fail on very small faces
        }

        console.log(`[ImagePreprocessor] Quality check: blur=${blurScore.toFixed(1)}, brightness=${brightness.toFixed(1)}, size=${faceSize}, issues=${issues.length}`);

        return {
            isBlurry,
            blurScore,
            brightness,
            faceSize,
            isGoodQuality,
            issues
        };
    }

    /**
     * Align face using eye landmarks
     */
    alignFace(
        image: HTMLImageElement | HTMLCanvasElement,
        leftEye: { x: number; y: number },
        rightEye: { x: number; y: number },
        targetSize: number = 150
    ): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d')!;

        // Calculate angle between eyes
        const dx = rightEye.x - leftEye.x;
        const dy = rightEye.y - leftEye.y;
        const angle = Math.atan2(dy, dx);

        // Calculate center point between eyes
        const centerX = (leftEye.x + rightEye.x) / 2;
        const centerY = (leftEye.y + rightEye.y) / 2;

        // Draw aligned face
        ctx.translate(targetSize / 2, targetSize / 2);
        ctx.rotate(-angle);

        const scale = targetSize / Math.max(image.width, image.height);
        const scaledWidth = image.width * scale;
        const scaledHeight = image.height * scale;

        ctx.drawImage(
            image,
            -centerX * scale,
            -centerY * scale,
            scaledWidth,
            scaledHeight
        );

        return canvas;
    }

    /**
     * Enhance image for better recognition
     */
    enhanceForRecognition(imageData: ImageData): ImageData {
        // Normalize brightness
        const normalized = this.normalizeBrightness(imageData, 128);

        // Increase contrast slightly
        const enhanced = new ImageData(
            new Uint8ClampedArray(normalized.data),
            normalized.width,
            normalized.height
        );

        const factor = 1.2; // Contrast factor
        for (let i = 0; i < enhanced.data.length; i += 4) {
            enhanced.data[i] = Math.max(0, Math.min(255, ((enhanced.data[i] - 128) * factor) + 128));
            enhanced.data[i + 1] = Math.max(0, Math.min(255, ((enhanced.data[i + 1] - 128) * factor) + 128));
            enhanced.data[i + 2] = Math.max(0, Math.min(255, ((enhanced.data[i + 2] - 128) * factor) + 128));
        }

        return enhanced;
    }
}

export const imagePreprocessor = new ImagePreprocessor();
