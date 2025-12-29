/**
 * High-Level Biometric API
 * Production-ready offline face recognition and liveness detection system
 */

import { faceDetector, livenessDetector, faceEmbedder, faceMatcher } from './index';
import { biometricStorage, type EnrollmentData } from './storage';
import type { BoundingBox } from './face-detector';
import type { SecurityLevel } from './face-matcher';
import type { EmbeddingModel } from './face-embedder';
import type { LivenessThreshold } from './liveness-detector';

export interface EnrollmentOptions {
    checkLiveness?: boolean;
    livenessThreshold?: LivenessThreshold;
    embeddingModel?: EmbeddingModel;
    metadata?: Record<string, any>;
    // KYC Document Verification (NEW)
    checkDocument?: boolean;
    documentImage?: ImageData;
    documentType?: 'aadhaar' | 'pan' | 'passport';
}

export interface EnrollmentResult {
    success: boolean;
    enrollmentId?: string;
    error?: string;
    details?: {
        faceDetected: boolean;
        livenessCheck?: {
            passed: boolean;
            confidence: number;
        };
        quality: number;
        // KYC Document Verification (NEW)
        documentCheck?: {
            passed: boolean;
            aadhaarNumber?: string;
            aadhaarValid?: boolean;
            documentMatch?: {
                similarity: number;
                decision: string;
            };
        };
    };
}

export interface VerificationOptions {
    checkLiveness?: boolean;
    livenessThreshold?: LivenessThreshold;
    securityLevel?: SecurityLevel;
    embeddingModel?: EmbeddingModel;
}

export interface VerificationResult {
    success: boolean;
    match: boolean;
    similarity: number;
    confidence: number;
    error?: string;
    details?: {
        faceDetected: boolean;
        livenessCheck?: {
            passed: boolean;
            confidence: number;
        };
        threshold: number;
    };
}

export interface IdentificationOptions {
    checkLiveness?: boolean;
    livenessThreshold?: LivenessThreshold;
    securityLevel?: SecurityLevel;
    embeddingModel?: EmbeddingModel;
    topK?: number;
}

export interface IdentificationResult {
    success: boolean;
    matched: boolean;
    userId: string | null;
    similarity: number;
    error?: string;
    candidates?: Array<{ userId: string; similarity: number }>;
    details?: {
        faceDetected: boolean;
        livenessCheck?: {
            passed: boolean;
            confidence: number;
        };
    };
}

export async function enrollFace(
    imageData: ImageData,
    userId: string,
    options: EnrollmentOptions = {}
): Promise<EnrollmentResult> {
    const {
        checkLiveness = true,
        livenessThreshold = 'medium',
        embeddingModel = 'mobile',
        metadata = {},
        // KYC Document Verification
        checkDocument = false,
        documentImage,
        documentType = 'aadhaar'
    } = options;

    try {
        // Step 1: Detect face
        const face = await faceDetector.detectSingleFace(imageData, 0.8);

        if (!face) {
            return {
                success: false,
                error: 'No face detected. Ensure face is clearly visible.',
                details: { faceDetected: false, quality: 0 }
            };
        }

        // Step 2: Check liveness (if enabled)
        if (checkLiveness) {
            const livenessResult = await livenessDetector.checkLiveness(imageData, face.box, livenessThreshold);

            if (!livenessResult.isLive) {
                return {
                    success: false,
                    error: 'Liveness check failed. Photo/video spoofing detected.',
                    details: {
                        faceDetected: true,
                        livenessCheck: {
                            passed: false,
                            confidence: livenessResult.confidence
                        },
                        quality: face.confidence
                    }
                };
            }
        }

        // Step 3: KYC Document Verification (NEW for banking)
        let documentCheckResult: any = undefined;
        if (checkDocument && documentImage) {
            const { ocrEngine, aadhaarParser, documentFaceDetector, documentMatcher } = await import('../document');

            // Extract text from document
            const ocrResult = await ocrEngine.extractText(documentImage);

            // Parse Aadhaar data
            let aadhaarData = undefined;
            if (documentType === 'aadhaar') {
                const parseResult = aadhaarParser.parseFromText(ocrResult.text, ocrResult.confidence);
                if (!parseResult.success) {
                    return {
                        success: false,
                        error: `Document parsing failed: ${parseResult.error}`,
                        details: { faceDetected: true, quality: face.confidence }
                    };
                }
                aadhaarData = parseResult.data;
            }

            // Detect face on document
            const documentFaceResult = await documentFaceDetector.detectFaceOnDocument(documentImage);
            if (!documentFaceResult.found || !documentFaceResult.primaryFace) {
                return {
                    success: false,
                    error: 'No face found on document',
                    details: { faceDetected: true, quality: face.confidence }
                };
            }

            // Match live face vs document face
            const matchResult = await documentMatcher.matchFaces(
                imageData,
                face.box,
                documentImage,
                documentFaceResult.primaryFace.face.box,
                { threshold: 0.60, embeddingModel }
            );

            if (!matchResult.match) {
                return {
                    success: false,
                    error: 'Face does not match document photo',
                    details: {
                        faceDetected: true,
                        quality: face.confidence,
                        documentCheck: {
                            passed: false,
                            aadhaarNumber: aadhaarData?.numberRaw,
                            aadhaarValid: aadhaarData?.isValid,
                            documentMatch: {
                                similarity: matchResult.similarity,
                                decision: matchResult.decision
                            }
                        }
                    }
                };
            }

            documentCheckResult = {
                passed: true,
                aadhaarNumber: aadhaarData?.numberRaw,
                aadhaarValid: aadhaarData?.isValid,
                documentMatch: {
                    similarity: matchResult.similarity,
                    decision: matchResult.decision
                }
            };
        }

        // Step 4: Extract embedding WITH ALIGNMENT
        const { embedding } = await faceEmbedder.extractEmbedding(imageData, face.box, {
            model: embeddingModel,
            landmarks: face.keypoints,  // CRITICAL: Pass landmarks for alignment
            useAlignment: true           // Enable production-grade alignment
        });

        // Step 5: Store enrollment
        const enrollmentId = `enroll-${userId}-${Date.now()}`;

        const enrollment: EnrollmentData = {
            id: enrollmentId,
            userId,
            embedding,
            metadata: {
                ...metadata,
                enrolledAt: new Date(),
                deviceInfo: navigator.userAgent,
                version: '1.0.0',
                model: embeddingModel,
                documentVerified: checkDocument,  // Track if KYC was done
                aadhaar: documentCheckResult?.aadhaarNumber  // Store Aadhaar (encrypted)
            }
        };

        await biometricStorage.storeEnrollment(enrollment);

        return {
            success: true,
            enrollmentId,
            details: {
                faceDetected: true,
                livenessCheck: checkLiveness ? { passed: true, confidence: 1.0 } : undefined,
                quality: face.confidence,
                documentCheck: documentCheckResult
            }
        };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : 'Enrollment failed'
        };
    }
}

/**
 * Verify a face against a reference embedding (1:1 verification)
 */
export async function verifyFace(
    liveImage: ImageData,
    referenceEmbedding: Float32Array,
    options: VerificationOptions = {}
): Promise<VerificationResult> {
    const {
        checkLiveness = true,
        livenessThreshold = 'medium',
        securityLevel = 'medium',
        embeddingModel = 'mobile'
    } = options;

    try {
        // Step 1: Detect face
        const face = await faceDetector.detectSingleFace(liveImage, 0.8);

        if (!face) {
            return {
                success: false,
                match: false,
                similarity: 0,
                confidence: 0,
                error: 'No face detected',
                details: { faceDetected: false, threshold: 0 }
            };
        }

        // Step 2: Check liveness (if enabled)
        if (checkLiveness) {
            const livenessResult = await livenessDetector.checkLiveness(liveImage, face.box, livenessThreshold);

            if (!livenessResult.isLive) {
                return {
                    success: false,
                    match: false,
                    similarity: 0,
                    confidence: 0,
                    error: 'Liveness check failed',
                    details: {
                        faceDetected: true,
                        livenessCheck: {
                            passed: false,
                            confidence: livenessResult.confidence
                        },
                        threshold: 0
                    }
                };
            }
        }

        // Step 3: Extract embedding WITH ALIGNMENT
        const { embedding: liveEmbedding } = await faceEmbedder.extractEmbedding(liveImage, face.box, {
            model: embeddingModel,
            landmarks: face.keypoints,  // CRITICAL: Pass landmarks for alignment
            useAlignment: true           // Enable production-grade alignment
        });

        // Step 4: Compare embeddings
        const result = faceMatcher.verifyFace(liveEmbedding, referenceEmbedding, { securityLevel });

        return {
            success: true,
            match: result.match,
            similarity: result.similarity,
            confidence: result.confidence,
            details: {
                faceDetected: true,
                livenessCheck: checkLiveness ? { passed: true, confidence: 1.0 } : undefined,
                threshold: result.threshold
            }
        };
    } catch (e) {
        return {
            success: false,
            match: false,
            similarity: 0,
            confidence: 0,
            error: e instanceof Error ? e.message : 'Verification failed'
        };
    }
}

/**
 * Identify a face against a gallery of enrolled faces (1:N identification)
 */
export async function identifyFace(
    liveImage: ImageData,
    options: IdentificationOptions = {}
): Promise<IdentificationResult> {
    const {
        checkLiveness = true,
        livenessThreshold = 'medium',
        securityLevel = 'medium',
        embeddingModel = 'mobile',
        topK = 5
    } = options;

    try {
        // Step 1: Detect face
        const face = await faceDetector.detectSingleFace(liveImage, 0.8);

        if (!face) {
            return {
                success: false,
                matched: false,
                userId: null,
                similarity: 0,
                error: 'No face detected',
                details: { faceDetected: false }
            };
        }

        // Step 2: Check liveness (if enabled)
        if (checkLiveness) {
            const livenessResult = await livenessDetector.checkLiveness(liveImage, face.box, livenessThreshold);

            if (!livenessResult.isLive) {
                return {
                    success: false,
                    matched: false,
                    userId: null,
                    similarity: 0,
                    error: 'Liveness check failed',
                    details: {
                        faceDetected: true,
                        livenessCheck: {
                            passed: false,
                            confidence: livenessResult.confidence
                        }
                    }
                };
            }
        }

        // Step 3: Extract embedding WITH ALIGNMENT
        const { embedding: queryEmbedding } = await faceEmbedder.extractEmbedding(liveImage, face.box, {
            model: embeddingModel,
            landmarks: face.keypoints,  // CRITICAL: Pass landmarks for alignment
            useAlignment: true           // Enable production-grade alignment
        });

        // Step 4: Load all enrollments
        const allEnrollments = await biometricStorage.getAllEnrollments();

        if (allEnrollments.length === 0) {
            return {
                success: false,
                matched: false,
                userId: null,
                similarity: 0,
                error: 'No enrolled faces in gallery'
            };
        }

        // Create gallery
        const gallery = {
            entries: allEnrollments.map(e => ({
                userId: e.userId,
                embedding: e.embedding,
                metadata: e.metadata
            }))
        };

        // Step 5: Identify
        const result = faceMatcher.identifyFace(queryEmbedding, gallery, { securityLevel, topK });

        return {
            success: true,
            matched: result.matched,
            userId: result.userId,
            similarity: result.similarity,
            candidates: result.allCandidates,
            details: {
                faceDetected: true,
                livenessCheck: checkLiveness ? { passed: true, confidence: 1.0 } : undefined
            }
        };
    } catch (e) {
        return {
            success: false,
            matched: false,
            userId: null,
            similarity: 0,
            error: e instanceof Error ? e.message : 'Identification failed'
        };
    }
}

/**
 * Delete an enrollment (GDPR right-to-forget)
 */
export async function deleteEnrollment(enrollmentId: string): Promise<void> {
    await biometricStorage.deleteEnrollment(enrollmentId);
}

/**
 * Delete all enrollments for a user
 */
export async function deleteUserEnrollments(userId: string): Promise<void> {
    await biometricStorage.deleteUserEnrollments(userId);
}

/**
 * Export enrollment data (for data portability)
 */
export async function exportEnrollment(enrollmentId: string): Promise<string> {
    return await biometricStorage.exportEnrollment(enrollmentId);
}

/**
 * Import enrollment data
 */
export async function importEnrollment(data: string): Promise<void> {
    await biometricStorage.importEnrollment(data);
}

/**
 * Get system statistics
 */
export async function getSystemStats(): Promise<{
    enrollments: number;
    users: string[];
    modelsLoaded: string[];
    backend: string;
}> {
    const storageStats = await biometricStorage.getStats();

    return {
        enrollments: storageStats.count,
        users: storageStats.users,
        modelsLoaded: [], // TODO: Track loaded models
        backend: 'wasm' // TODO: Get from onnxRuntime
    };
}
