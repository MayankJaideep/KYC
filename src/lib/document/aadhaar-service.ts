/**
 * Aadhaar KYC Service
 * Orchestrates the complete KYC verification pipeline
 * 1. OCR → Extract Aadhaar number
 * 2. Validate with Verhoeff
 * 3. Extract ID photo
 * 4. Generate ID embedding
 * 5. Compare with live embedding
 */

import { ocrEngine } from './ocr-engine';
import { aadhaarParser, verhoeffValidate } from './aadhaar-parser';
import { aadhaarPhotoExtractor } from './photo-extractor';
import { faceDetector } from '../biometric/face-detector';
import { faceEmbedder } from '../biometric/face-embedder';
import { cosineSimilarity } from '../biometric/face-matcher';

export interface AadhaarVerificationRequest {
    aadhaarImage: ImageData;
    liveImage: ImageData;
    userId: string;
    threshold?: number;
    userData?: {
        fullName: string;
        dob: string;
        gender: string;
        aadhaarLast4: string;
    };
}

export interface AadhaarVerificationResult {
    success: boolean;
    match: boolean;
    aadhaarNumber?: string;
    aadhaarName?: string;
    similarity: number;
    threshold: number;
    confidence: number;
    details: {
        ocrConfidence: number;
        aadhaarValid: boolean;
        idPhotoFound: boolean;
        liveFaceFound: boolean;
        idEmbeddingQuality: number;
        liveEmbeddingQuality: number;
    };
    error?: string;
}

class AadhaarKYCService {
    private readonly DEFAULT_THRESHOLD = 0.60; // Banking-grade threshold

    /**
     * Complete KYC verification pipeline
     */
    /**
     * Complete KYC verification pipeline
     */
    async verifyKYC(request: AadhaarVerificationRequest): Promise<AadhaarVerificationResult> {
        const { aadhaarImage, liveImage, threshold = this.DEFAULT_THRESHOLD, userData } = request;

        try {
            // Step 1: OCR & Parse (Existing logic)
            console.log('[AadhaarKYC] Parsing document data...');
            const ocrResult = await ocrEngine.extractNumberRegion(aadhaarImage);
            const parseResult = aadhaarParser.parseFromText(ocrResult.text, ocrResult.confidence);

            if (!parseResult.success || !parseResult.data) {
                throw new Error(parseResult.error || 'Failed to extract Aadhaar number');
            }

            const { numberRaw, name, dob, gender, isValid } = parseResult.data;
            if (!isValid) throw new Error('Invalid Aadhaar checksum (Verhoeff failed)');

            // Step 2: Identity Cross-Verification
            if (userData) {
                this.validateUserDetails(parseResult.data, userData);
            }

            // Step 3: Extract Embeddings (THE REBUILT PIPELINE)
            console.log('[AadhaarKYC] Step 3: Extracting embeddings...');

            // Mandatory FAIL CLOSED: extraction must throw if it fails
            const idEmbedding = await this.extractAadhaarFaceEmbedding(aadhaarImage);
            const liveEmbedding = await this.extractLiveFaceEmbedding(liveImage);

            // Step 4: Robust Comparison
            console.log('[AadhaarKYC] Step 4: Comparing embeddings...');
            const similarity = this.compareEmbeddings(idEmbedding, liveEmbedding);
            const match = similarity >= threshold;

            console.log(`[AadhaarKYC] Result: ${match ? 'MATCH' : 'NO MATCH'} (similarity: ${(similarity * 100).toFixed(1)}%)`);

            return {
                success: true,
                match,
                aadhaarNumber: numberRaw,
                aadhaarName: name,
                similarity,
                threshold,
                confidence: 1.0, // High-level logic handled embedding extraction
                details: {
                    ocrConfidence: ocrResult.confidence,
                    aadhaarValid: true,
                    idPhotoFound: true,
                    liveFaceFound: true,
                    idEmbeddingQuality: 1.0,
                    liveEmbeddingQuality: 1.0
                }
            };
        } catch (e) {
            console.error('[AadhaarKYC] Verification failed:', e);
            throw e; // Fail CLOSED
        }
    }

    /**
     * MANDATORY: extractEmbedding from Aadhaar (USER-CONFIRMED)
     * @param aadhaarImage - This is the user-confirmed photo crop, NOT the full Aadhaar card
     */
    async extractAadhaarFaceEmbedding(aadhaarImage: ImageData): Promise<Float32Array> {
        console.log('[AadhaarKYC] Generating embedding from user-confirmed Aadhaar photo...');

        // The aadhaarImage is already the user-confirmed crop
        // Just resize to 112x112 and embed directly
        const { embedding } = await faceEmbedder.extractEmbedding(
            aadhaarImage,
            { x: 0, y: 0, width: aadhaarImage.width, height: aadhaarImage.height, confidence: 1.0 },
            {
                landmarks: undefined, // No landmarks for user-confirmed crop
                useAlignment: false,  // Skip alignment, just resize
                normalize: true
            }
        );

        console.log('[AadhaarKYC] ✓ Aadhaar embedding generated successfully');
        return embedding;
    }

    /**
     * MANDATORY: extractEmbedding from Live Camera
     */
    async extractLiveFaceEmbedding(liveImage: ImageData): Promise<Float32Array> {
        console.log('[AadhaarKYC] Extracting face from live camera...');

        // 1. Detect face
        const face = await faceDetector.detectSingleFace(liveImage, 0.75);
        if (!face) {
            throw new Error('No face detected in live camera image.');
        }

        // 2. Align face using SAME code
        const { embedding } = await faceEmbedder.extractEmbedding(
            liveImage,
            face.box,
            {
                landmarks: face.keypoints,
                useAlignment: true,
                normalize: true
            }
        );

        return embedding;
    }

    /**
     * Safe cosine comparison logic with guards
     */
    private compareEmbeddings(a: Float32Array, b: Float32Array): number {
        if (!a || !b || a.length === 0 || b.length === 0) {
            throw new Error('Comparison failed: One or more embeddings are empty.');
        }

        const similarity = cosineSimilarity(a, b);

        // Guard against zero similarity due to bad inference (all 0s)
        if (similarity < 0.0001) {
            console.warn('[AadhaarKYC] Extremely low/zero similarity detected. Validating vectors...');
            const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
            if (normA < 1e-6) throw new Error('Aadhaar embedding is invalid (zero vector)');
        }

        return similarity;
    }

    private validateUserDetails(extracted: any, provided: any) {
        const issues: string[] = [];
        if (provided.aadhaarLast4 && !extracted.numberRaw.endsWith(provided.aadhaarLast4)) {
            issues.push('Aadhaar number mismatch');
        }
        if (provided.fullName && extracted.name && !extracted.name.toUpperCase().includes(provided.fullName.toUpperCase())) {
            issues.push('Name mismatch');
        }
        if (issues.length > 0) {
            throw new Error(`Identity mismatch: ${issues.join(', ')}`);
        }
    }

    /**
     * Get dynamic threshold based on risk level
     */
    getThreshold(riskLevel: 'low' | 'medium' | 'high' | 'critical'): number {
        const thresholds = {
            low: 0.50,      // Convenience stores
            medium: 0.60,   // Regular banking (DEFAULT)
            high: 0.70,     // Large transfers
            critical: 0.75  // PEP, sanctions
        };
        return thresholds[riskLevel];
    }
}

// Export singleton
export const aadhaarKYCService = new AadhaarKYCService();
