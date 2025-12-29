/**
 * Simple Face Comparison - Pixel-based fallback
 * More reliable than deep learning when models fail
 */

export interface SimpleComparisonResult {
    similarity: number;
    isMatch: boolean;
    method: 'histogram' | 'pixel-difference';
    details: {
        histogramSimilarity?: number;
        pixelDifference?: number;
    };
}

export class SimpleFaceComparison {
    private readonly HISTOGRAM_THRESHOLD = 0.70; // 70% histogram match
    private readonly PIXEL_DIFF_THRESHOLD = 0.75; // 75% pixel similarity

    /**
     * Compare two face images using simple pixel-based methods
     * More reliable than deep learning embeddings
     */
    compareFaces(image1: ImageData, image2: ImageData): SimpleComparisonResult {
        console.log('[SimpleFaceComparison] Comparing faces using pixel-based method...');

        // Resize both images to same size for comparison
        const size = 128; // Standard comparison size
        const resized1 = this.resizeImage(image1, size, size);
        const resized2 = this.resizeImage(image2, size, size);

        // Method 1: Histogram comparison (color distribution)
        const histogramSim = this.compareHistograms(resized1, resized2);

        // Method 2: Pixel difference (structural similarity)
        const pixelSim = this.comparePixels(resized1, resized2);

        // Combined score (average of both methods)
        const similarity = (histogramSim + pixelSim) / 2;
        const isMatch = similarity >= this.HISTOGRAM_THRESHOLD;

        console.log(`[SimpleFaceComparison] Histogram: ${(histogramSim * 100).toFixed(1)}%, Pixel: ${(pixelSim * 100).toFixed(1)}%, Combined: ${(similarity * 100).toFixed(1)}%, Match: ${isMatch}`);

        return {
            similarity,
            isMatch,
            method: 'histogram',
            details: {
                histogramSimilarity: histogramSim,
                pixelDifference: pixelSim
            }
        };
    }

    /**
     * Compare color histograms
     */
    private compareHistograms(img1: ImageData, img2: ImageData): number {
        const hist1 = this.calculateHistogram(img1);
        const hist2 = this.calculateHistogram(img2);

        // Calculate histogram intersection
        let intersection = 0;
        let sum1 = 0;
        let sum2 = 0;

        for (let i = 0; i < hist1.length; i++) {
            intersection += Math.min(hist1[i], hist2[i]);
            sum1 += hist1[i];
            sum2 += hist2[i];
        }

        return intersection / Math.max(sum1, sum2);
    }

    /**
     * Calculate color histogram
     */
    private calculateHistogram(imageData: ImageData): number[] {
        const bins = 64; // Reduce to 64 bins for faster comparison
        const histogram = new Array(bins * 3).fill(0);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = Math.floor((data[i] / 255) * (bins - 1));
            const g = Math.floor((data[i + 1] / 255) * (bins - 1));
            const b = Math.floor((data[i + 2] / 255) * (bins - 1));

            histogram[r]++;
            histogram[bins + g]++;
            histogram[bins * 2 + b]++;
        }

        return histogram;
    }

    /**
     * Compare pixels directly
     */
    private comparePixels(img1: ImageData, img2: ImageData): number {
        const data1 = img1.data;
        const data2 = img2.data;

        let totalDiff = 0;
        const numPixels = data1.length / 4;

        for (let i = 0; i < data1.length; i += 4) {
            const dr = Math.abs(data1[i] - data2[i]);
            const dg = Math.abs(data1[i + 1] - data2[i + 1]);
            const db = Math.abs(data1[i + 2] - data2[i + 2]);

            totalDiff += (dr + dg + db) / 3;
        }

        const avgDiff = totalDiff / numPixels;
        const similarity = 1 - (avgDiff / 255);

        return Math.max(0, similarity);
    }

    /**
     * Resize image to target size
     */
    private resizeImage(imageData: ImageData, targetWidth: number, targetHeight: number): ImageData {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        // Create source canvas
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = imageData.width;
        srcCanvas.height = imageData.height;
        const srcCtx = srcCanvas.getContext('2d')!;
        srcCtx.putImageData(imageData, 0, 0);

        // Resize
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);

        return ctx.getImageData(0, 0, targetWidth, targetHeight);
    }

    /**
     * Convert grayscale for better face comparison
     */
    private toGrayscale(imageData: ImageData): ImageData {
        const data = new Uint8ClampedArray(imageData.data);

        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = data[i + 1] = data[i + 2] = gray;
        }

        return new ImageData(data, imageData.width, imageData.height);
    }
}

export const simpleFaceComparison = new SimpleFaceComparison();
