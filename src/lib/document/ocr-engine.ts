/**
 * Offline OC R Engine using Tesseract.js
 * Extracts text from Aadhaar cards for number validation
 * Enhanced with preprocessing and intelligent fallbacks
 */

import Tesseract from 'tesseract.js';

export interface OCRResult {
    text: string;
    confidence: number;
}

class OCREngine {
    private initialized = false;
    private worker: Tesseract.Worker | null = null;

    /**
     * Initialize Tesseract worker
     */
    async initialize(): Promise<void> {
        if (this.initialized && this.worker) return;

        console.log('[OCREngine] Initializing Tesseract.js...');

        this.worker = await Tesseract.createWorker('eng', 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    console.log(`[OCREngine] Progress: ${Math.round(m.progress * 100)}%`);
                }
            },
        });

        this.initialized = true;
        console.log('[OCREngine] Tesseract initialized and ready');
    }

    /**
     * Extract text from image with intelligent fallback
     */
    async extractText(imageData: ImageData): Promise<OCRResult> {
        await this.initialize();

        if (!this.worker) {
            throw new Error('OCR worker not initialized');
        }

        try {
            // Preprocess for better OCR
            const preprocessed = this.preprocessImage(imageData);
            console.log('[OCREngine] Running OCR on preprocessed image...');

            // Configure for general text
            await this.worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.AUTO,
            });

            const canvas = this.imageDataToCanvas(preprocessed);
            const result = await this.worker.recognize(canvas);

            console.log(`[OCREngine] OCR complete. Confidence: ${result.data.confidence.toFixed(1)}%`);
            console.log(`[OCREngine] Text preview: "${result.data.text.substring(0, 80)}..."`);

            return {
                text: result.data.text,
                confidence: result.data.confidence / 100
            };
        } catch (e) {
            console.error('[OCREngine] OCR failed:', e);
            throw new Error(`OCR failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    }

    /**
     * Extract Aadhaar number with multiple strategies
     */
    async extractNumberRegion(imageData: ImageData): Promise<OCRResult> {
        await this.initialize();

        if (!this.worker) {
            throw new Error('OCR worker not initialized');
        }

        try {
            console.log('[OCREngine] Strategy 1: Trying number region extraction...');
            const regionResult = await this.tryNumberRegion(imageData);

            // Check if we found an Aadhaar-like number
            if (regionResult.text && /\d{4}\s*\d{4}\s*\d{4}/.test(regionResult.text)) {
                console.log('[OCREngine] ✓ Found Aadhaar pattern in region!');
                return regionResult;
            }

            console.log('[OCREngine] Strategy 2: Trying full image extraction...');
            const fullResult = await this.extractText(imageData);

            if (fullResult.text && /\d{4}\s*\d{4}\s*\d{4}/.test(fullResult.text)) {
                console.log('[OCREngine] ✓ Found Aadhaar pattern in full image!');
                return fullResult;
            }

            console.warn('[OCREngine] No Aadhaar number pattern found. Returning extracted text.');
            return fullResult;

        } catch (e) {
            console.error('[OCREngine] All extraction strategies failed:', e);
            return await this.extractText(imageData);
        }
    }

    /**
     * Try extracting from likely number region (center-bottom of Aadhaar)
     */
    private async tryNumberRegion(imageData: ImageData): Promise<OCRResult> {
        if (!this.worker) throw new Error('Worker not initialized');

        // Aadhaar number location: typically center-bottom
        const cropX = Math.floor(imageData.width * 0.15);
        const cropY = Math.floor(imageData.height * 0.45);
        const cropWidth = Math.floor(imageData.width * 0.7);
        const cropHeight = Math.floor(imageData.height * 0.25);

        const cropped = this.cropImage(imageData, cropX, cropY, cropWidth, cropHeight);
        const preprocessed = this.preprocessImage(cropped);

        // Configure for digits only
        await this.worker.setParameters({
            tessedit_char_whitelist: '0123456789 ',
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
        });

        const canvas = this.imageDataToCanvas(preprocessed);
        const result = await this.worker.recognize(canvas);

        console.log(`[OCREngine] Region OCR: "${result.data.text}"`);

        return {
            text: result.data.text,
            confidence: result.data.confidence / 100
        };
    }

    /**
     * Preprocess image: grayscale + high contrast for better OCR
     */
    private preprocessImage(imageData: ImageData): ImageData {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return imageData;

        ctx.putImageData(imageData, 0, 0);

        const processed = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = processed.data;

        // Grayscale + binary threshold
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const binary = gray > 128 ? 255 : 0;

            data[i] = binary;
            data[i + 1] = binary;
            data[i + 2] = binary;
        }

        return processed;
    }

    /**
     * Crop image to specified region
     */
    private cropImage(
        source: ImageData,
        x: number,
        y: number,
        width: number,
        height: number
    ): ImageData {
        const temp = document.createElement('canvas');
        temp.width = source.width;
        temp.height = source.height;
        const tempCtx = temp.getContext('2d');
        if (!tempCtx) throw new Error('Canvas context failed');

        tempCtx.putImageData(source, 0, 0);

        const result = document.createElement('canvas');
        result.width = width;
        result.height = height;
        const ctx = result.getContext('2d');
        if (!ctx) throw new Error('Canvas context failed');

        ctx.drawImage(temp, x, y, width, height, 0, 0, width, height);
        return ctx.getImageData(0, 0, width, height);
    }

    /**
     * Convert ImageData to Canvas
     */
    private imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context failed');

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    /**
     * Cleanup
     */
    async terminate(): Promise<void> {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.initialized = false;
            console.log('[OCREngine] Terminated');
        }
    }
}

// Export singleton
export const ocrEngine = new OCREngine();
