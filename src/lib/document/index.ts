/**
 * Document Intelligence Module Exports
 */

export { ocrEngine, type OCRResult } from './ocr-engine';
export { aadhaarParser, verhoeffValidate, sanitizeAadhaarString, type AadhaarData, type ParseResult } from './aadhaar-parser';
export { documentFaceDetector, type DocumentFace, type DocumentFaceResult } from './document-face-detector';
export {
    documentMatcher,
    type DocumentMatchResult,
    type DocumentMatchOptions
} from './document-matcher';
export { aadhaarPhotoExtractor, type PhotoExtractionResult } from './photo-extractor';
export { aadhaarKYCService, type AadhaarVerificationResult, type AadhaarVerificationRequest } from './aadhaar-service';
