/**
 * Biometric Module Exports
 * Central export point for all biometric modules
 */

export { faceDetector, type BoundingBox, type FaceKeypoint, type FaceDetection } from './face-detector';
export { faceAligner, type FaceLandmarks, type AlignmentResult } from './face-aligner';
export { livenessDetector, type LivenessResult, type LivenessThreshold } from './liveness-detector';
export { faceEmbedder, type EmbeddingResult, type EmbeddingModel } from './face-embedder';
export {
    faceMatcher,
    cosineSimilarity,
    type VerificationResult,
    type IdentificationResult,
    type FaceGallery,
    type SecurityLevel
} from './face-matcher';
export { biometricStorage, type EnrollmentData } from './storage';
export {
    enrollFace,
    verifyFace,
    identifyFace,
    deleteEnrollment,
    deleteUserEnrollments,
    exportEnrollment,
    importEnrollment,
    getSystemStats,
    type EnrollmentOptions,
    type EnrollmentResult as APIEnrollmentResult,
    type VerificationOptions,
    type VerificationResult as APIVerificationResult,
    type IdentificationOptions,
    type IdentificationResult as APIIdentificationResult
} from './api';
