import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aadhaarPhotoExtractor } from './photo-extractor';
import { documentProcessor } from './document-processor';
import { faceDetector } from '../biometric/face-detector';

// Manual mocks for DOM APIs
if (typeof (global as any).document === 'undefined') {
    (global as any).document = {
        createElement: vi.fn().mockReturnValue({
            getContext: vi.fn().mockReturnValue({
                drawImage: vi.fn(),
                getImageData: vi.fn().mockImplementation((x, y, w, h) => ({
                    width: w,
                    height: h,
                    data: new Uint8ClampedArray(w * h * 4)
                })),
                putImageData: vi.fn(),
                createImageData: vi.fn().mockImplementation((w, h) => ({
                    width: w,
                    height: h,
                    data: new Uint8ClampedArray(w * h * 4)
                }))
            }),
            width: 0,
            height: 0
        })
    };
}

if (typeof (global as any).ImageData === 'undefined') {
    (global as any).ImageData = class {
        width: number;
        height: number;
        data: Uint8ClampedArray;
        constructor(data: Uint8ClampedArray, width: number, height: number) {
            this.width = width;
            this.height = height;
            this.data = data;
        }
    } as any;
}

// Mock dependencies
vi.mock('./document-processor', () => ({
    documentProcessor: {
        rectifyAadhaar: vi.fn(),
        calculateBlur: vi.fn()
    }
}));

vi.mock('../biometric/face-detector', () => ({
    faceDetector: {
        detectFaces: vi.fn()
    }
}));

describe('AadhaarPhotoExtractor Layout-First Strategy', () => {
    const mockImageData = {
        width: 1000,
        height: 1000,
        data: new Uint8ClampedArray(1000 * 1000 * 4)
    } as unknown as ImageData;

    beforeEach(() => {
        vi.clearAllMocks();

        // Default Mock: Rectification success with portrait orientation
        (documentProcessor.rectifyAadhaar as any).mockResolvedValue({
            success: true,
            image: { width: 540, height: 856, data: new Uint8ClampedArray(540 * 856 * 4) }
        });

        // Default Mock: Sharp image
        (documentProcessor.calculateBlur as any).mockResolvedValue(150);
    });

    it('should follow the mandatory layout-first pipeline', async () => {
        // Mock successful detection inside the layout region
        (faceDetector.detectFaces as any).mockResolvedValue([
            {
                box: { x: 10, y: 10, width: 50, height: 50, confidence: 0.8 },
                keypoints: [],
                confidence: 0.8
            }
        ]);

        const result = await aadhaarPhotoExtractor.extractAadhaarFace(mockImageData);

        // Verify Rectification was called with 'portrait'
        expect(documentProcessor.rectifyAadhaar).toHaveBeenCalledWith(expect.anything(), 'portrait');

        // Verify Detection was called with relaxed confidence <= 0.25
        expect(faceDetector.detectFaces).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ minConfidence: 0.20 })
        );

        expect(result.success).toBe(true);
        expect(result.isFallback).toBeUndefined();
    });

    it('should fall back to the entire layout region if face detection fails', async () => {
        // Mock detection failure
        (faceDetector.detectFaces as any).mockResolvedValue([]);

        const result = await aadhaarPhotoExtractor.extractAadhaarFace(mockImageData);

        expect(result.success).toBe(true);
        expect(result.isFallback).toBe(true);
        expect(result.face?.box.width).toBeGreaterThan(0);
        expect(result.face?.confidence).toBe(0.1);
    });

    it('should reject if the photo is too blurry', async () => {
        // Mock blurry image
        (documentProcessor.calculateBlur as any).mockResolvedValue(20);

        const result = await aadhaarPhotoExtractor.extractAadhaarFace(mockImageData);

        expect(result.success).toBe(false);
        expect(result.error).toContain('too blurry');
    });

    it('should reject if the photo region is too small', async () => {
        // Mock rectification to a very small image
        (documentProcessor.rectifyAadhaar as any).mockResolvedValue({
            success: true,
            image: { width: 100, height: 100, data: new Uint8ClampedArray(100 * 100 * 4) }
        });

        const result = await aadhaarPhotoExtractor.extractAadhaarFace(mockImageData);

        expect(result.success).toBe(false);
        expect(result.error).toContain('too small');
    });
});
