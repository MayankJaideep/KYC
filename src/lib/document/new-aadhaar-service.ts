/**
 * New Aadhaar Service - MediaPipe Stack
 * Replaces ONNX-based verification with stable browser-native components
 */

import { faceEmbeddingService } from '../mediapipe/face-embedding';
import { mediaPipeFaceDetector } from '../mediapipe/mediapipe-face';
import { aadhaarPhotoExtractor } from './photo-extractor';

export interface AadhaarKYCInput {
    aadhaarImage: ImageData;
    liveImage: ImageData;
    userId: string;
    userData?: {
        fullName: string;
        dob: string;
        gender: 'M' | 'F' | 'O';
        aadhaarLast4: string;
    };
}

export interface AadhaarKYCResult {
    success: boolean;
    similarity: number;
    threshold: number;
    matched: boolean;
    error?: string;
    metadata?: {
        aadhaarFaceDetected: boolean;
        liveFaceDetected: boolean;
        timestamp: string;
        userId: string;
    };
}

class NewAadhaarKYCService {
    private readonly SIMILARITY_THRESHOLD = 0.5;

    /**
     * Initialize all services
     */
    async initialize(): Promise<void> {
        console.log('[NewAadhaarKYC] Initializing...');

        await Promise.all([
            faceEmbeddingService.initialize(),
            mediaPipeFaceDetector.initialize()
        ]);

        console.log('[NewAadhaarKYC] All services initialized');
    }

    /**
     * Extract embedding from user-confirmed Aadhaar photo
     * The aadhaarImage is already the user-confirmed crop
     */
    async extractAadhaarEmbedding(aadhaarImage: ImageData): Promise<Float32Array> {
        console.log('[NewAadhaarKYC] Extracting Aadhaar embedding...');

        // The aadhaarImage is the user-confirmed photo crop
        // No need for additional detection, just embed it
        const embedding = await faceEmbeddingService.extractEmbeddingFromCrop(aadhaarImage);

        console.log('[NewAadhaarKYC] ✓ Aadhaar embedding extracted (128D)');
        return embedding;
    }

    /**
     * Extract embedding from live image
     */
    async extractLiveEmbedding(liveImage: ImageData): Promise<Float32Array> {
        console.log('[NewAadhaarKYC] Extracting live embedding...');

        // Use MediaPipe to detect face first
        const detection = await mediaPipeFaceDetector.detectFace(liveImage);

        if (!detection) {
            throw new Error('No face detected in live image');
        }

        // Extract embedding from detected face
        const embedding = await faceEmbeddingService.extractEmbedding(liveImage);

        console.log('[NewAadhaarKYC] ✓ Live embedding extracted (128D)');
        return embedding;
    }

    /**
     * Verify KYC by comparing Aadhaar and live embeddings
     */
    async verifyKYC(input: AadhaarKYCInput): Promise<AadhaarKYCResult> {
        try {
            console.log('[NewAadhaarKYC] Starting verification...');

            // Extract embeddings
            const [aadhaarEmbedding, liveEmbedding] = await Promise.all([
                this.extractAadhaarEmbedding(input.aadhaarImage),
                this.extractLiveEmbedding(input.liveImage)
            ]);

            // Compare embeddings
            const { similarity, isMatch } = faceEmbeddingService.verifyMatch(
                aadhaarEmbedding,
                liveEmbedding,
                this.SIMILARITY_THRESHOLD
            );

            const result: AadhaarKYCResult = {
                success: isMatch,
                similarity,
                threshold: this.SIMILARITY_THRESHOLD,
                matched: isMatch,
                metadata: {
                    aadhaarFaceDetected: true,
                    liveFaceDetected: true,
                    timestamp: new Date().toISOString(),
                    userId: input.userId
                }
            };

            console.log(`[NewAadhaarKYC] Verification ${isMatch ? 'PASSED' : 'FAILED'} (similarity: ${similarity.toFixed(3)})`);

            return result;

        } catch (error) {
            console.error('[NewAadhaarKYC] Verification failed:', error);

            return {
                success: false,
                similarity: 0,
                threshold: this.SIMILARITY_THRESHOLD,
                matched: false,
                error: error instanceof Error ? error.message : 'KYC verification failed',
                metadata: {
                    aadhaarFaceDetected: false,
                    liveFaceDetected: false,
                    timestamp: new Date().toISOString(),
                    userId: input.userId
                }
            };
        }
    }
}

// Export singleton
export const newAadhaarKYCService = new NewAadhaarKYCService();
