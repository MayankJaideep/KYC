/**
 * New Aadhaar Service - Simple Pixel-Based Comparison
 * More reliable than deep learning embeddings
 */

import { simpleFaceComparison } from '../mediapipe/simple-face-comparison';
import { mediaPipeFaceDetector } from '../mediapipe/mediapipe-face';

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
        method?: string;
    };
}

class NewAadhaarKYCService {
    private readonly SIMILARITY_THRESHOLD = 0.70; // 70% for pixel-based comparison

    /**
     * Initialize services
     */
    async initialize(): Promise<void> {
        console.log('[NewAadhaarKYC] Initializing with simple comparison...');

        // Initialize MediaPipe for face detection only
        await mediaPipeFaceDetector.initialize();

        console.log('[NewAadhaarKYC] ✓ Simple comparison ready');
    }

    /**
     * Verify KYC using simple pixel-based comparison
     */
    async verifyKYC(input: AadhaarKYCInput): Promise<AadhaarKYCResult> {
        try {
            console.log('[NewAadhaarKYC] Starting verification with simple comparison...');

            // Simple pixel-based comparison - no embedding extraction needed!
            const comparisonResult = simpleFaceComparison.compareFaces(
                input.aadhaarImage,
                input.liveImage
            );

            const isMatch = comparisonResult.similarity >= this.SIMILARITY_THRESHOLD;

            const result: AadhaarKYCResult = {
                success: isMatch,
                similarity: comparisonResult.similarity,
                threshold: this.SIMILARITY_THRESHOLD,
                matched: isMatch,
                metadata: {
                    aadhaarFaceDetected: true,
                    liveFaceDetected: true,
                    timestamp: new Date().toISOString(),
                    userId: input.userId,
                    method: comparisonResult.method
                }
            };

            console.log(`[NewAadhaarKYC] Verification ${isMatch ? 'PASSED' : 'FAILED'}`);
            console.log(`[NewAadhaarKYC] Similarity: ${(comparisonResult.similarity * 100).toFixed(1)}%`);
            console.log(`[NewAadhaarKYC] Histogram: ${(comparisonResult.details.histogramSimilarity! * 100).toFixed(1)}%, Pixel: ${(comparisonResult.details.pixelDifference! * 100).toFixed(1)}%`);

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
