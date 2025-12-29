/**
 * Aadhaar Photo Extractor
 * Extracts the ID photo from Aadhaar card for face comparison
 */

import { faceDetector } from '../biometric/face-detector';
import type { FaceDetection } from '../biometric/face-detector';
import { documentProcessor } from './document-processor';

export interface PhotoExtractionResult {
    success: boolean;
    photoImage?: ImageData;
    face?: FaceDetection;
    error?: string;
    isFallback?: boolean;
    debugData?: {
        rectified?: ImageData;
        candidates: {
            name: string;
            raw: ImageData;
            enhanced: ImageData;
            faces: FaceDetection[];
        }[];
        logs: string[];
    };
}

/**
 * Aadhaar Photo Extractor
 * PRODUCTION-GRADE User-Confirmed Pipeline
 * NO AUTO-DETECTION - User confirms the layout-based crop
 */
class AadhaarPhotoExtractor {
    // Standard Aadhaar photo location (Normalized to Upright Portrait)
    private readonly LAYOUT = {
        x: 0.03, // 3% from left
        y: 0.55, // 55% from top
        w: 0.32, // 32% of width
        h: 0.35, // 35% of height
    };

    /**
     * Extract Aadhaar Photo Crop for User Confirmation
     * Returns layout-based crop WITHOUT auto-detection
     */
    async extractPhotoForConfirmation(aadhaarImage: ImageData): Promise<PhotoExtractionResult> {
        console.log('[AadhaarExtractor] Extracting photo region for user confirmation...');

        try {
            // STEP 1: DOCUMENT RECTIFICATION
            const rectification = await documentProcessor.rectifyAadhaar(aadhaarImage, 'portrait');
            if (!rectification.success) {
                return {
                    success: false,
                    error: 'Could not detect Aadhaar document edges. Please ensure the card is clearly visible on a contrasting background.'
                };
            }
            const rectified = rectification.image;

            // STEP 2: BLIND LAYOUT CROP (No Detection)
            const photoCrop = this.cropToLayout(rectified, this.LAYOUT);

            // STEP 3: ENHANCEMENT for better display quality
            const enhanced = await documentProcessor.enhanceImageForDetection(photoCrop);

            // Return for user confirmation - NO auto-detection
            console.log('[AadhaarExtractor] ✓ Photo region extracted. Awaiting user confirmation.');
            return {
                success: true,
                photoImage: enhanced,
                // No face detection data - user will confirm this is their photo
                face: {
                    box: { x: 0, y: 0, width: enhanced.width, height: enhanced.height, confidence: 1.0 },
                    keypoints: [],
                    confidence: 1.0
                }
            };

        } catch (e) {
            console.error('[AadhaarExtractor] Photo extraction failed:', e);
            return {
                success: false,
                error: e instanceof Error ? e.message : 'Failed to extract Aadhaar photo region'
            };
        }
    }

    /**
     * Legacy method for backward compatibility
     */
    async extractAadhaarFace(aadhaarImage: ImageData): Promise<PhotoExtractionResult> {
        return this.extractPhotoForConfirmation(aadhaarImage);
    }

    private cropToLayout(image: ImageData, layout: { x: number; y: number; w: number; h: number }): ImageData {
        const x = Math.floor(image.width * layout.x);
        const y = Math.floor(image.height * layout.y);
        const w = Math.floor(image.width * layout.w);
        const h = Math.floor(image.height * layout.h);
        return this.cropImage(image, x, y, w, h);
    }

    private cropImage(source: ImageData, x: number, y: number, w: number, h: number): ImageData {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;

        const temp = document.createElement('canvas');
        temp.width = source.width;
        temp.height = source.height;
        temp.getContext('2d')!.putImageData(source, 0, 0);

        ctx.drawImage(temp, x, y, w, h, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h);
    }
}

export const aadhaarPhotoExtractor = new AadhaarPhotoExtractor();
