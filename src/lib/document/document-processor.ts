/**
 * Document Processor Utility
 * Uses OpenCV.js for document edge detection and perspective rectification
 */

export interface RectifiedDocument {
    image: ImageData;
    corners: { x: number; y: number }[];
    success: boolean;
    error?: string;
}

declare const cv: any;

class DocumentProcessor {
    /**
     * Wait for OpenCV to be ready
     */
    async waitForCV(): Promise<void> {
        if (typeof cv !== 'undefined' && cv.Mat) return;

        return new Promise((resolve, reject) => {
            const maxAttempts = 50;
            let attempts = 0;
            const check = () => {
                attempts++;
                if (typeof cv !== 'undefined' && cv.Mat) {
                    resolve();
                } else if (attempts > maxAttempts) {
                    reject(new Error('OpenCV.js failed to load within timeout'));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    /**
     * Rectify document image (Perspective Warp)
     * Aadhaar is normalized to a standard size.
     * @param orientation 'landscape' (856x540) or 'portrait' (540x856)
     */
    async rectifyAadhaar(imageData: ImageData, orientation: 'landscape' | 'portrait' = 'portrait'): Promise<RectifiedDocument> {
        try {
            await this.waitForCV();

            const src = cv.matFromImageData(imageData);
            const dst = new cv.Mat();
            const gray = new cv.Mat();
            const blurred = new cv.Mat();
            const edged = new cv.Mat();

            // 1. Preprocessing for edge detection
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
            cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
            cv.Canny(blurred, edged, 75, 200);

            // 2. Find Contours
            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();
            cv.findContours(edged, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            // 3. Find largest 4-point contour
            let largestContour = null;
            let maxArea = 0;
            for (let i = 0; i < contours.size(); i++) {
                let cnt = contours.get(i);
                let area = cv.contourArea(cnt);
                if (area > 1000) {
                    let peri = cv.arcLength(cnt, true);
                    let approx = new cv.Mat();
                    cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

                    if (approx.rows === 4 && area > maxArea) {
                        largestContour = approx;
                        maxArea = area;
                    } else {
                        approx.delete();
                    }
                }
            }

            if (!largestContour) {
                // Cleanup
                src.delete(); gray.delete(); blurred.delete(); edged.delete(); contours.delete(); hierarchy.delete();
                return { success: false, image: imageData, corners: [], error: 'Could not detect document edges' };
            }

            // 4. Order corners
            const corners = this.orderPoints(largestContour);

            // 5. Build Warp Matrix
            // Standard ID-1 card size: 85.6mm x 53.98mm
            const width = orientation === 'landscape' ? 856 : 540;
            const height = orientation === 'landscape' ? 540 : 856;

            let srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
                corners[0].x, corners[0].y,
                corners[1].x, corners[1].y,
                corners[2].x, corners[2].y,
                corners[3].x, corners[3].y
            ]);

            let dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
                0, 0,
                width, 0,
                width, height,
                0, height
            ]);

            let M = cv.getPerspectiveTransform(srcCoords, dstCoords);
            cv.warpPerspective(src, dst, M, new cv.Size(width, height));

            // Convert back to ImageData
            const resultData = new ImageData(
                new Uint8ClampedArray(dst.data),
                dst.cols,
                dst.rows
            );

            // Cleanup
            src.delete(); gray.delete(); blurred.delete(); edged.delete();
            contours.delete(); hierarchy.delete(); largestContour.delete();
            srcCoords.delete(); dstCoords.delete(); M.delete(); dst.delete();

            return {
                success: true,
                image: resultData,
                corners: corners
            };

        } catch (e) {
            console.error('[DocumentProcessor] Rectification failed:', e);
            return {
                success: false,
                image: imageData,
                corners: [],
                error: e instanceof Error ? e.message : 'Rectification failed'
            };
        }
    }

    /**
     * Calculate image blurriness using Variance of Laplacian
     * Higher value = sharper image. Typical threshold is ~100.
     */
    async calculateBlur(imageData: ImageData): Promise<number> {
        try {
            await this.waitForCV();
            const src = cv.matFromImageData(imageData);
            const gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

            const laplacian = new cv.Mat();
            cv.Laplacian(gray, laplacian, cv.CV_64F);

            const mean = new cv.Mat();
            const stddev = new cv.Mat();
            cv.meanStdDev(laplacian, mean, stddev);

            const variance = stddev.data64F[0] * stddev.data64F[0];

            src.delete(); gray.delete(); laplacian.delete(); mean.delete(); stddev.delete();
            return variance;
        } catch (e) {
            console.error('[DocumentProcessor] Blur detection failed:', e);
            return 1000; // Assume sharp if check fails to avoid blocking
        }
    }

    private orderPoints(approx: any): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i < 4; i++) {
            points.push({
                x: approx.data32S[i * 2],
                y: approx.data32S[i * 2 + 1]
            });
        }

        // Standard 4-corner sort
        points.sort((a, b) => a.y - b.y);
        const top = points.slice(0, 2).sort((a, b) => a.x - b.x);
        const bottom = points.slice(2, 2).sort((a, b) => a.x - b.x);

        // Re-ordering for specific TL, TR, BR, BL
        const sum = points.map(p => p.x + p.y);
        const tl = points[sum.indexOf(Math.min(...sum))];
        const br = points[sum.indexOf(Math.max(...sum))];

        const diff = points.map(p => p.y - p.x);
        const tr = points[diff.indexOf(Math.min(...diff))];
        const bl = points[diff.indexOf(Math.max(...diff))];

        return [tl, tr, br, bl];
    }

    /**
     * Mandatory Image Enhancement (CLAHE + Denoise + Upscale)
     */
    async enhanceImageForDetection(imageData: ImageData): Promise<ImageData> {
        try {
            await this.waitForCV();
            const src = cv.matFromImageData(imageData);
            const gray = new cv.Mat();
            const enhanced = new cv.Mat();
            const denoised = new cv.Mat();
            const upscaled = new cv.Mat();

            // 1. Convert to Grayscale
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

            // 2. CLAHE (Contrast Limited Adaptive Histogram Equalization)
            const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
            clahe.apply(gray, enhanced);

            // 3. Light Gaussian Blur (Denoise halftone patterns common in IDs)
            cv.GaussianBlur(enhanced, denoised, new cv.Size(3, 3), 0);

            // 4. Upscale if too small (Bicubic Interpolation)
            let resultMat = denoised;
            if (imageData.width < 120 || imageData.height < 120) {
                const targetSize = new cv.Size(Math.max(imageData.width * 2, 160), Math.max(imageData.height * 2, 160));
                cv.resize(denoised, upscaled, targetSize, 0, 0, cv.INTER_CUBIC);
                resultMat = upscaled;
            }

            // Convert back to RGBA for consistency with ImageData
            const finalRGBA = new cv.Mat();
            cv.cvtColor(resultMat, finalRGBA, cv.COLOR_GRAY2RGBA);

            const resultData = new ImageData(
                new Uint8ClampedArray(finalRGBA.data),
                finalRGBA.cols,
                finalRGBA.rows
            );

            // Cleanup
            src.delete(); gray.delete(); enhanced.delete(); denoised.delete();
            upscaled.delete(); finalRGBA.delete(); clahe.delete();

            return resultData;
        } catch (e) {
            console.error('[DocumentProcessor] Enhancement failed:', e);
            return imageData;
        }
    }

    /**
     * Calculate image luminance (0-255)
     */
    async calculateLuminance(imageData: ImageData): Promise<number> {
        try {
            await this.waitForCV();
            const src = cv.matFromImageData(imageData);
            const gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

            const mean = cv.mean(gray);
            const luminance = mean[0];

            src.delete(); gray.delete();
            return luminance;
        } catch (e) {
            return 127;
        }
    }
}

export const documentProcessor = new DocumentProcessor();
