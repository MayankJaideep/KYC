/**
 * Document Face Matcher
 * Compares live face embedding with document photo embedding
 * Critical for KYC: Ensures person presenting ID is the person on the ID
 */

import { faceEmbedder } from '../biometric/face-embedder';
import { faceMatcher, cosineSimilarity } from '../biometric/face-matcher';
import type { BoundingBox } from '../biometric/face-detector';

export interface DocumentMatchResult {
    match: boolean;
    similarity: number;
    confidence: number;
    threshold: number;
    decision: 'MATCH' | 'NO_MATCH' | 'UNCERTAIN';
    details: {
        liveEmbeddingQuality: number;
        documentEmbeddingQuality: number;
        alignmentUsed: boolean;
    };
}

export interface DocumentMatchOptions {
    threshold?: number;
    useAlignment?: boolean;
    embeddingModel?: 'mobile' | 'accurate';
}

class DocumentMatcher {
    // Default threshold for document matching (stricter than general verification)
    private readonly DEFAULT_THRESHOLD = 0.60; // 60% for banking KYC

    /**
     * Match live face against document photo
     */
    async matchFaces(
        liveImage: ImageData,
        liveFaceBox: BoundingBox,
        documentImage: ImageData,
        documentFaceBox: BoundingBox,
        options: DocumentMatchOptions = {}
    ): Promise<DocumentMatchResult> {
        const {
            threshold = this.DEFAULT_THRESHOLD,
            useAlignment = true,
            embeddingModel = 'mobile'
        } = options;

        try {
            // Extract live embedding
            const liveResult = await faceEmbedder.extractEmbedding(liveImage, liveFaceBox, {
                model: embeddingModel,
                useAlignment,
                landmarks: undefined // Will be detected if needed
            });

            // Extract document embedding
            const documentResult = await faceEmbedder.extractEmbedding(documentImage, documentFaceBox, {
                model: embeddingModel,
                useAlignment,
                landmarks: undefined
            });

            // Calculate similarity
            const similarity = cosineSimilarity(liveResult.embedding, documentResult.embedding);

            // Make decision
            let decision: 'MATCH' | 'NO_MATCH' | 'UNCERTAIN';
            if (similarity >= threshold) {
                decision = 'MATCH';
            } else if (similarity >= threshold - 0.05) {
                // Within 5% of threshold → uncertain
                decision = 'UNCERTAIN';
            } else {
                decision = 'NO_MATCH';
            }

            // Combined confidence (lower of the two)
            const confidence = Math.min(liveResult.confidence, documentResult.confidence);

            return {
                match: decision === 'MATCH',
                similarity,
                confidence,
                threshold,
                decision,
                details: {
                    liveEmbeddingQuality: liveResult.confidence,
                    documentEmbeddingQuality: documentResult.confidence,
                    alignmentUsed: useAlignment
                }
            };
        } catch (e) {
            throw new Error(`Document matching failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    }

    /**
     * Batch match: Compare one live face against multiple document faces
     * Useful when document has multiple photos or unclear which is primary
     */
    async matchMultiple(
        liveImage: ImageData,
        liveFaceBox: BoundingBox,
        documentImages: Array<{ image: ImageData; faceBox: BoundingBox }>,
        options: DocumentMatchOptions = {}
    ): Promise<Array<DocumentMatchResult & { index: number }>> {
        const results: Array<DocumentMatchResult & { index: number }> = [];

        for (let i = 0; i < documentImages.length; i++) {
            const { image, faceBox } = documentImages[i];
            const result = await this.matchFaces(liveImage, liveFaceBox, image, faceBox, options);
            results.push({ ...result, index: i });
        }

        // Sort by similarity (highest first)
        results.sort((a, b) => b.similarity - a.similarity);

        return results;
    }

    /**
     * Assess match quality and generate recommendations
     */
    assessMatchQuality(result: DocumentMatchResult): {
        quality: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR';
        recommendations: string[];
        requiresManualReview: boolean;
    } {
        const recommendations: string[] = [];
        let requiresManualReview = false;

        // Calculate quality tier
        let quality: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR';
        if (result.similarity >= 0.75 && result.confidence >= 0.9) {
            quality = 'EXCELLENT';
        } else if (result.similarity >= 0.65 && result.confidence >= 0.8) {
            quality = 'GOOD';
        } else if (result.similarity >= 0.55 && result.confidence >= 0.7) {
            quality = 'ACCEPTABLE';
            recommendations.push('Consider re-capturing with better lighting');
        } else {
            quality = 'POOR';
            requiresManualReview = true;
            recommendations.push('MANUAL REVIEW REQUIRED');
        }

        // Check for specific issues
        if (result.decision === 'UNCERTAIN') {
            requiresManualReview = true;
            recommendations.push('Similarity close to threshold - manual review recommended');
        }

        if (result.details.liveEmbeddingQuality < 0.8) {
            recommendations.push('Live photo quality low - re-capture recommended');
        }

        if (result.details.documentEmbeddingQuality < 0.7) {
            recommendations.push('Document photo quality low - verify document authenticity');
        }

        if (!result.details.alignmentUsed) {
            recommendations.push('Face alignment not used - accuracy may be reduced');
        }

        return {
            quality,
            recommendations,
            requiresManualReview
        };
    }

    /**
     * Generate fraud risk assessment
     */
    assessFraudRisk(result: DocumentMatchResult): {
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        riskScore: number; // 0-100
        flags: string[];
    } {
        const flags: string[] = [];
        let riskScore = 0;

        // Low similarity = high risk
        if (result.similarity < 0.50) {
            riskScore += 50;
            flags.push('Very low similarity to document photo');
        } else if (result.similarity < 0.60) {
            riskScore += 30;
            flags.push('Low similarity to document photo');
        }

        // Low confidence = moderate risk
        if (result.confidence < 0.7) {
            riskScore += 20;
            flags.push('Low quality images');
        }

        // Decision uncertainty = moderate risk
        if (result.decision === 'UNCERTAIN') {
            riskScore += 15;
            flags.push('Borderline match decision');
        }

        // No match = critical risk
        if (result.decision === 'NO_MATCH') {
            riskScore += 40;
            flags.push('FACE MISMATCH - Different person suspected');
        }

        // Determine risk level
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        if (riskScore >= 70) {
            riskLevel = 'CRITICAL';
        } else if (riskScore >= 50) {
            riskLevel = 'HIGH';
        } else if (riskScore >= 25) {
            riskLevel = 'MEDIUM';
        } else {
            riskLevel = 'LOW';
        }

        return {
            riskLevel,
            riskScore: Math.min(100, riskScore),
            flags
        };
    }
}

// Export singleton
export const documentMatcher = new DocumentMatcher();
