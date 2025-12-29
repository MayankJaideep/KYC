
/**
 * ONNX Runtime Web Infrastructure
 * Handles low-level ONNX Runtime initialization, session management, and backend selection
 */

import * as ort from 'onnxruntime-web';

export { ort };
export type ONNXBackend = 'webgpu' | 'wasm' | 'webgl';

export interface RuntimeConfig {
    preferredBackend?: ONNXBackend;
    numThreads?: number;
    graphOptimizationLevel?: 'disabled' | 'basic' | 'extended' | 'all';
}

export interface InferenceSession {
    session: any; // InferenceSession;
    backend: ONNXBackend;
    modelPath: string;
}

class ONNXRuntimeManager {
    private sessions: Map<string, InferenceSession> = new Map();
    private initialized = false;
    private backend: ONNXBackend = 'wasm';

    /**
     * Initialize ONNX Runtime with best available backend
     */
    async initialize(config: RuntimeConfig = {}): Promise<void> {
        if (this.initialized) return;
        if (!ort) {
            console.error('[ONNX] Runtime (global ort) not found. Check index.html');
            return;
        }

        const { numThreads = 1 } = config;

        // Force WASM for stability in dev
        this.backend = 'wasm';

        // Configure ONNX Runtime with maximum stability
        ort.env.wasm.numThreads = numThreads;
        ort.env.wasm.simd = true;
        ort.env.wasm.proxy = false; // Run in main thread to bypass Vite .mjs interceptor

        // Set WASM paths with CDN fallback
        const cdnPath = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
        ort.env.wasm.wasmPaths = cdnPath;

        // Disable WebGPU temporarily to solve worker issues
        (ort.env as any).webgpu = { enabled: false };

        console.log(`[ONNX] Global configuration initialized via global ort`);

        this.initialized = true;
    }

    /**
     * Test if a backend is available
     */
    private async testBackend(backend: ONNXBackend): Promise<void> {
        if (backend === 'webgpu') {
            if (!(navigator as any).gpu) {
                throw new Error('WebGPU not supported');
            }
            await (navigator as any).gpu.requestAdapter();
        } else if (backend === 'wasm') {
            if (typeof WebAssembly === 'undefined') {
                throw new Error('WebAssembly not supported');
            }
        }
    }

    /**
     * Load a model and create an inference session
     */
    async loadModel(
        modelPath: string,
        options: any = {}
    ): Promise<InferenceSession> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (this.sessions.has(modelPath)) {
            return this.sessions.get(modelPath)!;
        }

        console.log(`[ONNX] Loading model: ${modelPath}`);

        const sessionOptions = {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
            ...options
        };

        const session = await ort.InferenceSession.create(modelPath, sessionOptions);

        const inferenceSession: InferenceSession = {
            session,
            backend: this.backend,
            modelPath
        };

        this.sessions.set(modelPath, inferenceSession);
        console.log(`[ONNX] Model loaded successfully: ${modelPath}`);

        return inferenceSession;
    }

    /**
     * Run inference on a session
     */
    async runInference(
        sessionOrPath: InferenceSession | string,
        inputs: Record<string, any>
    ): Promise<any> {
        const session = typeof sessionOrPath === 'string'
            ? await this.loadModel(sessionOrPath)
            : sessionOrPath;

        return await session.session.run(inputs);
    }

    /**
     * Release a session to free memory
     */
    async releaseSession(modelPath: string): Promise<void> {
        const session = this.sessions.get(modelPath);
        if (session) {
            await session.session.release();
            this.sessions.delete(modelPath);
            console.log(`[ONNX] Session released: ${modelPath}`);
        }
    }

    getBackend(): ONNXBackend {
        return this.backend;
    }

    isInitialized(): boolean {
        return this.initialized;
    }
}

export const onnxRuntime = new ONNXRuntimeManager();
export { type InferenceSession as ORTSession };
