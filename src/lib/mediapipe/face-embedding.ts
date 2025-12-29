/**
 * Face Embedding & Comparison
 * Uses face-api.js (TensorFlow.js) instead of ONNX
 */

import * as faceapi from 'face-api.js';

class FaceEmbeddingService {
    private initialized = false;
    private modelsLoaded = false;

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
            console.log('[FaceEmbedding] Models loaded successfully');
        } catch (e) {
            console.error('[FaceEmbedding] Failed to load models:', e);
            throw e;
        }
    }

    /**
     * Extract 128D face embedding from image
     */
    async extractEmbedding(imageData: ImageData): Promise<Float32Array> {
        if (!this.initialized) {
            await this.initialize();
        }

        // Convert ImageData to canvas for face-api.js
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(imageData, 0, 0);

        // Detect face and get descriptor
        const detection = await faceapi
            .detectSingleFace(canvas)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            throw new Error('No face detected in image');
        }

        // face-api.js returns a 128D Float32Array
        return detection.descriptor;
    }

    /**
     * Extract embedding from confirmed Aadhaar photo crop
     * (The crop is already user-confirmed, no detection needed)
     */
    async extractEmbeddingFromCrop(imageData: ImageData): Promise<Float32Array> {
        // For Aadhaar, we can skip detection and just extract the embedding
        // because the user already confirmed the crop is their face
        return this.extractEmbedding(imageData);
    }

    /**
     * Compare two face embeddings using cosine similarity
     */
    cosineSimilarity(embedding1: Float32Array, embedding2: Float32Array): number {
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
     * Verify if two faces match
     * Returns similarity score and boolean match result
     */
    verifyMatch(
        aadhaarEmbedding: Float32Array,
        liveEmbedding: Float32Array,
        threshold: number = 0.5
    ): { similarity: number; isMatch: boolean } {
        const similarity = this.cosineSimilarity(aadhaarEmbedding, liveEmbedding);
        const isMatch = similarity >= threshold;

        console.log(`[FaceEmbedding] Similarity: ${similarity.toFixed(3)}, Threshold: ${threshold}, Match: ${isMatch}`);

        return { similarity, isMatch };
    }
}

// Export singleton
export const faceEmbeddingService = new FaceEmbeddingService();
