/**
 * Face Matcher Module
 * Performs 1:1 verification and 1:N identification using cosine similarity
 */

import { cosineSimilarity as computeCosineSimilarity } from '../onnx';

export interface VerificationResult {
    match: boolean;
    similarity: number;
    threshold: number;
    confidence: number;
}

export interface IdentificationResult {
    matched: boolean;
    userId: string | null;
    similarity: number;
    threshold: number;
    allCandidates: Array<{ userId: string; similarity: number }>;
}

export interface FaceGallery {
    entries: Array<{
        userId: string;
        embedding: Float32Array;
        metadata?: Record<string, any>;
    }>;
}

export type SecurityLevel = 'low' | 'medium' | 'high';

// ArcFace-based similarity thresholds (cosine similarity)
const SIMILARITY_THRESHOLDS: Record<SecurityLevel, number> = {
    low: 0.45,    // Lenient (higher false accept rate)
    medium: 0.55, // Balanced
    high: 0.65    // Strict (lower false accept rate)
};

class FaceMatcher {
    /**
     * Verify if two face embeddings belong to the same person (1:1 verification)
     */
    verifyFace(
        embedding1: Float32Array,
        embedding2: Float32Array,
        options: { securityLevel?: SecurityLevel; customThreshold?: number } = {}
    ): VerificationResult {
        const { securityLevel = 'medium', customThreshold } = options;

        // Calculate similarity
        const similarity = computeCosineSimilarity(embedding1, embedding2);

        // Determine threshold
        const threshold = customThreshold ?? SIMILARITY_THRESHOLDS[securityLevel];

        // Make decision
        const match = similarity >= threshold;

        // Calculate confidence (how far from threshold)
        const confidence = match
            ? Math.min(1, (similarity - threshold) / (1 - threshold))
            : Math.min(1, (threshold - similarity) / threshold);

        return {
            match,
            similarity,
            threshold,
            confidence
        };
    }

    /**
     * Identify a face against a gallery of known faces (1:N identification)
     */
    identifyFace(
        queryEmbedding: Float32Array,
        gallery: FaceGallery,
        options: { securityLevel?: SecurityLevel; customThreshold?: number; topK?: number } = {}
    ): IdentificationResult {
        const { securityLevel = 'medium', customThreshold, topK = 5 } = options;

        if (gallery.entries.length === 0) {
            return {
                matched: false,
                userId: null,
                similarity: 0,
                threshold: customThreshold ?? SIMILARITY_THRESHOLDS[securityLevel],
                allCandidates: []
            };
        }

        // Calculate similarities for all gallery entries
        const candidates = gallery.entries.map(entry => ({
            userId: entry.userId,
            similarity: computeCosineSimilarity(queryEmbedding, entry.embedding),
            metadata: entry.metadata
        }));

        // Sort by similarity (descending)
        candidates.sort((a, b) => b.similarity - a.similarity);

        // Get top match
        const topMatch = candidates[0];

        // Determine threshold
        const threshold = customThreshold ?? SIMILARITY_THRESHOLDS[securityLevel];

        // Make decision
        const matched = topMatch.similarity >= threshold;

        return {
            matched,
            userId: matched ? topMatch.userId : null,
            similarity: topMatch.similarity,
            threshold,
            allCandidates: candidates.slice(0, topK).map(c => ({
                userId: c.userId,
                similarity: c.similarity
            }))
        };
    }

    /**
     * Calculate pairwise similarity matrix for a set of embeddings
     */
    calculateSimilarityMatrix(embeddings: Float32Array[]): number[][] {
        const n = embeddings.length;
        const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

        for (let i = 0; i < n; i++) {
            for (let j = i; j < n; j++) {
                if (i === j) {
                    matrix[i][j] = 1.0; // Self-similarity
                } else {
                    const similarity = computeCosineSimilarity(embeddings[i], embeddings[j]);
                    matrix[i][j] = similarity;
                    matrix[j][i] = similarity; // Symmetric
                }
            }
        }

        return matrix;
    }

    /**
     * Deduplicate faces in a gallery based on similarity
     */
    deduplicateGallery(
        gallery: FaceGallery,
        similarityThreshold: number = 0.9
    ): FaceGallery {
        const uniqueEntries = [];
        const seen = new Set<number>();

        for (let i = 0; i < gallery.entries.length; i++) {
            if (seen.has(i)) continue;

            uniqueEntries.push(gallery.entries[i]);

            // Mark similar faces as duplicates
            for (let j = i + 1; j < gallery.entries.length; j++) {
                if (seen.has(j)) continue;

                const similarity = computeCosineSimilarity(
                    gallery.entries[i].embedding,
                    gallery.entries[j].embedding
                );

                if (similarity >= similarityThreshold) {
                    seen.add(j);
                }
            }
        }

        return { entries: uniqueEntries };
    }

    /**
     * Get recommended threshold for a target False Accept Rate (FAR)
     */
    getThresholdForFAR(targetFAR: number): number {
        // These are approximate thresholds based on ArcFace benchmarks
        // In production, these should be calibrated on your specific dataset
        if (targetFAR <= 0.0001) return 0.70; // FAR ~0.01%
        if (targetFAR <= 0.001) return 0.65;  // FAR ~0.1%
        if (targetFAR <= 0.01) return 0.55;   // FAR ~1%
        return 0.45; // FAR ~10%
    }
}

// Export singleton
export const faceMatcher = new FaceMatcher();

// Re-export for convenience
export { cosineSimilarity } from '../onnx';
