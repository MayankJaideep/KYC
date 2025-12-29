/**
 * Face Embedder Module
 * Uses ArcFace (MobileFaceNet) ONNX model for 512-dimensional face embeddings
 */

import {
    loadONNXModel,
    safeRun,
    ensureModelLoaded,
    imageDataToTensor,
    cropImageData,
    normalizeEmbedding,
    ort,
    type InferenceSession
} from '../onnx';
import type { BoundingBox } from './face-detector';

export interface EmbeddingResult {
    embedding: Float32Array;
    confidence: number;
}

export type EmbeddingModel = 'mobile' | 'accurate';

class FaceEmbedder {
    private mobileSession: InferenceSession | null = null;
    private accurateSession: InferenceSession | null = null;
    private mobileModelPath = '/models/onnx/mobilefacenet_arcface.onnx';
    private accurateModelPath = '/models/onnx/resnet50_arcface.onnx';

    /**
     * Initialize face embedder
     */
    async initialize(model: EmbeddingModel = 'mobile'): Promise<void> {
        if (model === 'mobile' && this.mobileSession) return;
        if (model === 'accurate' && this.accurateSession) return;

        console.log(`[FaceEmbedder] Initializing ${model} model...`);

        const modelName = model === 'mobile' ? 'mobilefacenet_arcface' : 'resnet50_arcface';
        const modelPath = model === 'mobile' ? this.mobileModelPath : this.accurateModelPath;

        try {
            const loaded = await ensureModelLoaded(modelPath, modelName);

            if (model === 'mobile') {
                this.mobileSession = loaded.session;
            } else {
                this.accurateSession = loaded.session;
            }

            console.log(`[FaceEmbedder] ${model} model initialized`);
        } catch (e) {
            console.error(`[FaceEmbedder] Failed to initialize ${model} model:`, e);
            throw e;
        }
    }

    /**
     * Extract face embedding
     */
    async extractEmbedding(
        imageData: ImageData,
        faceBox: BoundingBox,
        options: { model?: EmbeddingModel; normalize?: boolean; landmarks?: any; useAlignment?: boolean } = {}
    ): Promise<EmbeddingResult> {
        const { model = 'mobile', normalize = true, landmarks, useAlignment = true } = options;

        // Initialize if needed
        if (model === 'mobile' && !this.mobileSession) {
            await this.initialize('mobile');
        } else if (model === 'accurate' && !this.accurateSession) {
            await this.initialize('accurate');
        }

        const session = model === 'mobile' ? this.mobileSession! : this.accurateSession!;
        const modelName = model === 'mobile' ? 'mobilefacenet_arcface' : 'resnet50_arcface';

        // 1. Unified Preprocessing (SHARED CODE)
        const { faceAligner } = await import('./face-aligner');
        const processedFace = faceAligner.preprocessFace(imageData, landmarks, faceBox);

        // 2. Explicit Preprocessing (ArcFace typically expects 112x112 RGB float32)
        const inputTensor = imageDataToTensor(processedFace, {
            targetSize: [112, 112],
            mean: [127.5, 127.5, 127.5],
            std: [127.5, 127.5, 127.5],
            channelsFirst: true,
            dataType: 'float32' // Explicitly float32
        });

        // 3. Inference with explicit input fulfillment
        const feeds: Record<string, any> = {};
        const inputNames = session.inputNames;
        feeds[inputNames[0]] = inputTensor;

        // For MobileFaceNet, there's usually only one input
        // If there are extra inputs, fulfill them with default float32 tensors
        for (let i = 1; i < inputNames.length; i++) {
            const name = inputNames[i];
            feeds[name] = new ort.Tensor('float32', new Float32Array([0.5]), [1]);
        }

        const outputs = await safeRun(session, feeds, modelName);

        // 4. Extract and Validate Embedding
        const embedding = this.parseOutputs(outputs, normalize);

        // FAIL CLOSED: Ensure embedding is not all zeros
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (norm < 1e-6) {
            throw new Error(`Invalid embedding generated for ${modelName}: Zero-vector detected. Inference may have failed.`);
        }

        return {
            embedding,
            confidence: faceBox.confidence
        };
    }

    /**
     * Parse model outputs into embedding
     */
    private parseOutputs(outputs: any, normalize: boolean): Float32Array {
        try {
            // ArcFace models output a 512-dimensional embedding
            // Usually 'output', 'embedding', 'output0', or just the first output
            const firstOutputName = Object.keys(outputs)[0];
            const embeddingTensor = outputs.output || outputs.output0 || outputs.embedding || outputs[firstOutputName];

            if (!embeddingTensor) {
                throw new Error('Embedding output not found');
            }

            let embedding = new Float32Array(embeddingTensor.data);

            // Verify dimension
            // MobileFaceNet usually 128 or 512. ResNet usually 512.
            // Just warn if unexpected
            // if (embedding.length !== 512 && embedding.length !== 128) {
            //    console.warn(`[FaceEmbedder] Unexpected embedding dimension: ${embedding.length}`);
            // }

            // Normalize if requested (L2 normalization)
            if (normalize) {
                embedding = normalizeEmbedding(embedding);
            }

            return embedding;
        } catch (e) {
            console.error('[FaceEmbedder] Failed to parse outputs:', e);
            throw new Error('Failed to extract face embedding');
        }
    }

    /**
     * Batch extract embeddings (for enrollment of multiple photos)
     */
    async extractBatchEmbeddings(
        images: Array<{ imageData: ImageData; faceBox: BoundingBox }>,
        options?: { model?: EmbeddingModel; normalize?: boolean }
    ): Promise<EmbeddingResult[]> {
        const results: EmbeddingResult[] = [];

        for (const { imageData, faceBox } of images) {
            const result = await this.extractEmbedding(imageData, faceBox, options);
            results.push(result);
        }

        return results;
    }

    /**
     * Release resources
     */
    async release(model?: EmbeddingModel): Promise<void> {
        if (!model || model === 'mobile') {
            this.mobileSession = null;
        }

        if (!model || model === 'accurate') {
            this.accurateSession = null;
        }
    }
}

// Export singleton
export const faceEmbedder = new FaceEmbedder();
