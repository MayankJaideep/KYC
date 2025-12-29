/**
 * Enhanced Face Embedding & Comparison
 * Uses face-api.js with preprocessing and quality checks
 */

import * as faceapi from 'face-api.js';
import { imagePreprocessor, type ImageQuality } from './image-preprocessing';

export interface EmbeddingResult {
    success: boolean;
    embedding?: Float32Array;
    quality?: ImageQuality;
    error?: string;
}

export interface ComparisonResult {
    similarity: number;
    isMatch: boolean;
    confidence: 'high' | 'medium' | 'low';
    message: string;
}

class FaceEmbeddingService {
    private initialized = false;
    private modelsLoaded = false;

    // Optimized thresholds based on testing
    private readonly SIMILARITY_THRESHOLDS = {
        high: 0.55,      // >= 55% = high confidence match
        medium: 0.45,    // >= 45% = medium confidence match
        low: 0.35        // < 35% = no match
    };

    /**
     * Initialize face-api.js and load models
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log('[FaceEmbedding] Initializing face-api.js...');

        try {
            // Load models from public directory
            const MODEL_URL = '/models/face-api';

            await Promise.all([
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);

            this.modelsLoaded = true;
            this.initialized = true;
            console.log('[FaceEmbedding] ✓ Models loaded successfully');
        } catch (e) {
            console.error('[FaceEmbedding] Failed to load models:', e);
            throw new Error('Failed to initialize face recognition models');
        }
    }

    /**
     * Extract 128D face embedding with quality checks
     */
    async extractEmbedding(imageData: ImageData): Promise<EmbeddingResult> {
        if (!this.initialized) {
            await this.initialize();
        }

        // Check image quality first
        const quality = imagePreprocessor.checkQuality(imageData);

        if (!quality.isGoodQuality) {
            console.warn('[FaceEmbedding] Poor image quality:', quality.issues);
            return {
                success: false,
                quality,
                error: `Image quality issues: ${quality.issues.join(', ')}`
            };
        }

        try {
            // Enhance image for better recognition
            const enhanced = imagePreprocessor.enhanceForRecognition(imageData);

            // Convert to canvas
            const canvas = document.createElement('canvas');
            canvas.width = enhanced.width;
            canvas.height = enhanced.height;
            const ctx = canvas.getContext('2d')!;
            ctx.putImageData(enhanced, 0, 0);

            // Detect face and extract descriptor
            const detection = await faceapi
                .detectSingleFace(canvas)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                return {
                    success: false,
                    quality,
                    error: 'No face detected in image'
                };
            }

            console.log('[FaceEmbedding] ✓ Embedding extracted successfully');

            return {
                success: true,
                embedding: detection.descriptor,
                quality
            };

        } catch (error) {
            console.error('[FaceEmbedding] Extraction failed:', error);
            return {
                success: false,
                quality,
                error: error instanceof Error ? error.message : 'Embedding extraction failed'
            };
        }
    }

    /**
     * Compare two face embeddings with detailed results
     */
    async compareEmbeddings(
        embedding1: Float32Array,
        embedding2: Float32Array
    ): Promise<ComparisonResult> {
        const similarity = this.calculateCosineSimilarity(embedding1, embedding2);

        let isMatch = false;
        let confidence: 'high' | 'medium' | 'low' = 'low';
        let message = '';

        if (similarity >= this.SIMILARITY_THRESHOLDS.high) {
            isMatch = true;
            confidence = 'high';
            message = 'Strong match - faces are very similar';
        } else if (similarity >= this.SIMILARITY_THRESHOLDS.medium) {
            isMatch = true;
            confidence = 'medium';
            message = 'Moderate match - faces appear to be the same person';
        } else if (similarity >= this.SIMILARITY_THRESHOLDS.low) {
            isMatch = false;
            confidence = 'low';
            message = 'Weak similarity - manual review recommended';
        } else {
            isMatch = false;
            confidence = 'low';
            message = 'No match - faces are different people';
        }

        console.log(`[FaceEmbedding] Similarity: ${(similarity * 100).toFixed(1)}%, Match: ${isMatch}, Confidence: ${confidence}`);

        return { similarity, isMatch, confidence, message };
    }

    /**
     * Calculate cosine similarity between embeddings
     */
    private calculateCosineSimilarity(
        embedding1: Float32Array,
        embedding2: Float32Array
    ): number {
        if (embedding1.length !== embedding2.length) {
            throw new Error('Embeddings must have the same length');
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }

        norm1 = Math.sqrt(norm1);
        norm2 = Math.sqrt(norm2);

        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }

        return dotProduct / (norm1 * norm2);
    }

    /**
     * Legacy method for backward compatibility
     */
    cosineSimilarity(embedding1: Float32Array, embedding2: Float32Array): number {
        return this.calculateCosineSimilarity(embedding1, embedding2);
    }

    /**
     * Legacy method for backward compatibility
     */
    verifyMatch(
        aadhaarEmbedding: Float32Array,
        liveEmbedding: Float32Array,
        threshold: number = 0.5
    ): { similarity: number; isMatch: boolean } {
        const similarity = this.calculateCosineSimilarity(aadhaarEmbedding, liveEmbedding);
        const isMatch = similarity >= threshold;

        return { similarity, isMatch };
    }
}

// Export singleton
export const faceEmbeddingService = new FaceEmbeddingService();
