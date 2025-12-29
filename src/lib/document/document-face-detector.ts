/**
 * Document Face Detector
 * Detects and extracts faces from ID documents (Aadhaar, PAN, etc.)
 */

import { faceDetector } from '../biometric/face-detector';
import type { FaceDetection } from '../biometric/face-detector';

export interface DocumentFace {
    face: FaceDetection;
    region: 'photo' | 'unknown';
    quality: number;
}

export interface DocumentFaceResult {
    found: boolean;
    faces: DocumentFace[];
    primaryFace?: DocumentFace;
}

class DocumentFaceDetector {
    /**
     * Detect face on document
     * Typically Aadhaar has photo in top-left corner
     */
    async detectFaceOnDocument(
        documentImage: ImageData,
        options: { minConfidence?: number; expectSingleFace?: boolean } = {}
    ): Promise<DocumentFaceResult> {
        const { minConfidence = 0.7, expectSingleFace = true } = options;

        // Detect all faces on document
        const detections = await faceDetector.detectFaces(documentImage, { minConfidence });

        if (detections.length === 0) {
            return {
                found: false,
                faces: []
            };
        }

        // Create document faces with quality scoring
        const documentFaces: DocumentFace[] = detections.map(face => ({
            face,
            region: this.identifyFaceRegion(face, documentImage),
            quality: this.assessFaceQuality(face, documentImage)
        }));

        // Sort by quality
        documentFaces.sort((a, b) => b.quality - a.quality);

        // For Aadhaar, we expect exactly one face
        if (expectSingleFace && documentFaces.length > 1) {
            console.warn('[DocumentFaceDetector] Multiple faces found on document, using best quality');
        }

        return {
            found: true,
            faces: documentFaces,
            primaryFace: documentFaces[0]
        };
    }

    /**
     * Identify which region of document the face is in
     * Aadhaar: Photo typically in top-left quadrant
     */
    private identifyFaceRegion(face: FaceDetection, image: ImageData): 'photo' | 'unknown' {
        const { x, y, width, height } = face.box;
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        // Check if in top-left quadrant (typical Aadhaar photo position)
        if (centerX < image.width / 2 && centerY < image.height / 2) {
            return 'photo';
        }

        return 'unknown';
    }

    /**
     * Assess face quality on document
     * Considers: size, position, clarity
     */
    private assessFaceQuality(face: FaceDetection, image: ImageData): number {
        let score = face.confidence; // Start with detection confidence

        // Size score: Prefer larger faces (but not too large)
        const faceArea = face.box.width * face.box.height;
        const imageArea = image.width * image.height;
        const areaRatio = faceArea / imageArea;

        if (areaRatio > 0.05 && areaRatio < 0.3) {
            score += 0.1; // Good size range for document photo
        } else if (areaRatio < 0.02) {
            score -= 0.2; // Too small
        }

        // Position score: Prefer top-left (Aadhaar standard)
        if (this.identifyFaceRegion(face, image) === 'photo') {
            score += 0.1;
        }

        return Math.min(1.0, Math.max(0, score));
    }

    /**
     * Check if detected face is suitable for enrollment
     */
    async validateDocumentFace(face: DocumentFace): Promise<{ valid: boolean; issues: string[] }> {
        const issues: string[] = [];

        // Check confidence
        if (face.face.confidence < 0.7) {
            issues.push('Low detection confidence');
        }

        // Check quality
        if (face.quality < 0.6) {
            issues.push('Low face quality on document');
        }

        // Check size
        const faceSize = face.face.box.width * face.face.box.height;
        if (faceSize < 2500) {
            // Less than 50x50 pixels
            issues.push('Face too small on document');
        }

        return {
            valid: issues.length === 0,
            issues
        };
    }
}

// Export singleton
export const documentFaceDetector = new DocumentFaceDetector();
