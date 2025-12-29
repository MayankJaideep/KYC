
/**
 * Tensor Utilities
 * Helper functions for image preprocessing and tensor operations
 */

import { Tensor } from './ort-global';

/**
 * Convert ImageData to tensor with explicit data type and normalization
 */
export function imageDataToTensor(
    imageData: ImageData,
    options: {
        mean?: [number, number, number];
        std?: [number, number, number];
        targetSize?: [number, number];
        channelsFirst?: boolean;
        dataType?: 'float32' | 'int32' | 'int64';
    } = {}
): any {
    const {
        mean = [127.5, 127.5, 127.5],
        std = [127.5, 127.5, 127.5],
        targetSize,
        channelsFirst = true,
        dataType = 'float32'
    } = options;

    let { data, width, height } = imageData;

    // Resize if needed
    if (targetSize && (width !== targetSize[0] || height !== targetSize[1])) {
        const resized = resizeImageData(imageData, targetSize[0], targetSize[1]);
        data = resized.data;
        width = targetSize[0];
        height = targetSize[1];
    }

    const size = width * height;

    // Create correct typed array
    let tensorData: any;
    if (dataType === 'float32') {
        tensorData = new Float32Array(size * 3);
    } else if (dataType === 'int32') {
        tensorData = new Int32Array(size * 3);
    } else if (dataType === 'int64') {
        tensorData = new BigInt64Array(size * 3);
    } else {
        throw new Error(`Unsupported dataType: ${dataType}`);
    }

    if (channelsFirst) {
        // CHW format (3, H, W)
        for (let i = 0; i < size; i++) {
            const pixelIndex = i * 4;
            const r = (data[pixelIndex] - mean[0]) / std[0];
            const g = (data[pixelIndex + 1] - mean[1]) / std[1];
            const b = (data[pixelIndex + 2] - mean[2]) / std[2];

            if (dataType === 'float32') {
                tensorData[i] = r;
                tensorData[size + i] = g;
                tensorData[size * 2 + i] = b;
            } else {
                tensorData[i] = BigInt(Math.round(r));
                tensorData[size + i] = BigInt(Math.round(g));
                tensorData[size * 2 + i] = BigInt(Math.round(b));
            }
        }
        return new Tensor(dataType, tensorData, [1, 3, height, width]);
    } else {
        // HWC format (H, W, 3)
        for (let i = 0; i < size; i++) {
            const pixelIndex = i * 4;
            const tensorIndex = i * 3;
            const r = (data[pixelIndex] - mean[0]) / std[0];
            const g = (data[pixelIndex + 1] - mean[1]) / std[1];
            const b = (data[pixelIndex + 2] - mean[2]) / std[2];

            if (dataType === 'float32') {
                tensorData[tensorIndex] = r;
                tensorData[tensorIndex + 1] = g;
                tensorData[tensorIndex + 2] = b;
            } else {
                tensorData[tensorIndex] = BigInt(Math.round(r));
                tensorData[tensorIndex + 1] = BigInt(Math.round(g));
                tensorData[tensorIndex + 2] = BigInt(Math.round(b));
            }
        }
        return new Tensor(dataType, tensorData, [1, height, width, 3]);
    }
}

/**
 * Resize ImageData (simple bilinear interpolation)
 */
export function resizeImageData(imageData: ImageData, targetWidth: number, targetHeight: number): ImageData {
    const { width: srcWidth, height: srcHeight, data: srcData } = imageData;

    const canvas = document.createElement('canvas');
    canvas.width = srcWidth;
    canvas.height = srcHeight;
    const ctx = canvas.getContext('2d')!;

    const tempImageData = ctx.createImageData(srcWidth, srcHeight);
    tempImageData.data.set(srcData);
    ctx.putImageData(tempImageData, 0, 0);

    // Create a temporary canvas for resizing
    const resizeCanvas = document.createElement('canvas');
    resizeCanvas.width = targetWidth;
    resizeCanvas.height = targetHeight;
    const resizeCtx = resizeCanvas.getContext('2d')!;

    // Draw original image onto resized canvas
    resizeCtx.drawImage(canvas, 0, 0, srcWidth, srcHeight, 0, 0, targetWidth, targetHeight);

    return resizeCtx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Crop ImageData based on bounding box
 */
export function cropImageData(
    imageData: ImageData,
    box: { x: number; y: number; width: number; height: number }
): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;

    ctx.putImageData(imageData, 0, 0);

    // Crop
    const cropped = ctx.getImageData(
        Math.max(0, Math.floor(box.x)),
        Math.max(0, Math.floor(box.y)),
        Math.max(1, Math.min(Math.floor(box.width), imageData.width - Math.floor(box.x))),
        Math.max(1, Math.min(Math.floor(box.height), imageData.height - Math.floor(box.y)))
    );

    return cropped;
}

/**
 * Normalize embedding vector (L2 normalization)
 */
export function normalizeEmbedding(embedding: Float32Array): Float32Array {
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (norm || 1e-10)) as any as Float32Array;
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
        throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) || 1e-10);
    return Math.max(0, Math.min(1, similarity)); // Clamp to [0, 1]
}

/**
 * Softmax function for probability distributions
 */
export function softmax(logits: Float32Array): Float32Array {
    const maxLogit = Math.max(...logits);
    const exps = logits.map(x => Math.exp(x - maxLogit));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    return exps.map(x => x / (sumExps || 1e-10)) as any as Float32Array;
}
