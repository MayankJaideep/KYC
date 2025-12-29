
/**
 * Safe ONNX Model Loader with Automatic Fallback
 * Handles model loading with WebGPU → WASM fallback
 */

import { ort } from './ort-global';
import { getExecutionProviderChain, isRuntimeInitialized } from './runtime-config';

export interface ModelLoadOptions {
    modelPath: string;
    modelName: string;
    useWebGPU?: boolean;
}

export interface LoadedModel {
    session: any; // InferenceSession;
    backend: string;
    modelName: string;
}

// Model session cache to avoid reloading
const modelCache = new Map<string, LoadedModel>();

/**
 * Load ONNX model with automatic fallback
 */
export async function loadONNXModel(options: ModelLoadOptions): Promise<LoadedModel> {
    const { modelPath, modelName, useWebGPU = true } = options;

    if (!ort) {
        throw new Error('[ModelLoader] Global ort not found. Check index.html script tag.');
    }

    if (!isRuntimeInitialized()) {
        console.warn('[ModelLoader] ONNX Runtime not initialized. This might cause issues.');
    }

    console.log(`[ModelLoader] Loading model: ${modelName}`);
    console.log(`[ModelLoader] Path: ${modelPath}`);

    // Verify model file existence and integrity (User Guide Points 1, 2, 3)
    try {
        await verifyModelFile(modelPath, modelName);
    } catch (error) {
        console.error(`[ModelLoader] Integrity check failed:`, error);
        throw error;
    }

    const providers = getExecutionProviderChain(useWebGPU);

    let session: any = null;
    let usedBackend = 'unknown';
    let lastError: Error | null = null;

    // Try each provider in order
    for (let i = 0; i < providers.length; i++) {
        const provider = providers[i];

        try {
            console.log(`[ModelLoader] Attempt ${i + 1}: Trying ${provider}...`);

            session = await ort.InferenceSession.create(modelPath, {
                executionProviders: [provider]
            });

            usedBackend = provider;
            console.log(`[ModelLoader] ✓ Success with ${provider}`);
            break;

        } catch (error) {
            lastError = error as Error;
            console.warn(`[ModelLoader] ✗ Failed with ${provider}:`, error);

            if (i === providers.length - 1) {
                throw new Error(
                    `Failed to load model "${modelName}" with all providers. ` +
                    `Last error: ${lastError.message}. ` +
                    `Tried: ${providers.join(', ')}. `
                );
            }
        }
    }

    const loadedModel: LoadedModel = {
        session,
        backend: usedBackend,
        modelName
    };

    return loadedModel;
}

/**
 * Ensure model is loaded (with caching)
 */
export async function ensureModelLoaded(
    modelPath: string,
    modelName: string,
    useWebGPU: boolean = true
): Promise<LoadedModel> {
    const cacheKey = `${modelName}-${useWebGPU ? 'gpu' : 'cpu'}`;

    if (modelCache.has(cacheKey)) {
        return modelCache.get(cacheKey)!;
    }

    const model = await loadONNXModel({ modelPath, modelName, useWebGPU });
    modelCache.set(cacheKey, model);

    return model;
}

/**
 * Verify model file existence and integrity before loading
 */
async function verifyModelFile(path: string, name: string): Promise<void> {
    try {
        const response = await fetch(path, { method: 'HEAD' });

        if (!response.ok) {
            throw new Error(`File not found (404) at ${path}. Please ensure the model is placed in the public folder accurately.`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
            throw new Error(`Server returned HTML instead of binary for ${path}. Likely a 404 fallback to index.html.`);
        }

        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
        if (contentLength > 0 && contentLength < 2048) {
            // Check if it's a Git LFS pointer (User Guide Point 1)
            const textResponse = await fetch(path);
            const text = await textResponse.text();
            if (text.includes('https://git-lfs.github.com')) {
                throw new Error(`Model file ${path} is a Git LFS pointer, not the actual binary. Please download the raw file.`);
            }
        }

        console.log(`[ModelLoader] File integrity verified for ${name} (${(contentLength / 1024 / 1024).toFixed(2)} MB)`);
    } catch (e) {
        if (e instanceof Error && e.message.includes('fetch')) {
            throw new Error(`Network error accessing model at ${path}. Check CORS or server status.`);
        }
        throw e;
    }
}

/**
 * Clear model cache
 */
export function clearModelCache(): void {
    modelCache.clear();
}

/**
 * Get cache status
 */
export function getCacheInfo(): { size: number; models: string[] } {
    return {
        size: modelCache.size,
        models: Array.from(modelCache.keys())
    };
}
