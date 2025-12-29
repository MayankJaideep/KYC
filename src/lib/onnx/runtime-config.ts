
/**
 * ONNX Runtime Configuration Module
 * Handles runtime initialization, WebGPU detection, and execution provider setup
 */

import { ort } from './ort-global';

export interface ONNXRuntimeEnvironment {
    supportsWebGPU: boolean;
    supportsWASM: boolean;
    wasmPaths: string;
    numThreads: number;
    platform: string;
}

let runtimeInitialized = false;
let environmentInfo: ONNXRuntimeEnvironment | null = null;

/**
 * Initialize ONNX Runtime Web environment
 * Must be called once before any model loading
 */
export async function initializeONNXRuntime(): Promise<ONNXRuntimeEnvironment> {
    if (runtimeInitialized && environmentInfo) {
        return environmentInfo;
    }

    if (!ort) {
        throw new Error('[ONNX] Global ort not found. Ensure script tag is in index.html');
    }

    console.log('[ONNX] Initializing environment via global ort...');

    // Configure WASM paths to use CDN
    const wasmPath = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
    ort.env.wasm.wasmPaths = wasmPath;
    ort.env.wasm.numThreads = 1;
    (ort.env.wasm as any).proxy = false;

    // Detect WebGPU availability
    const supportsWebGPU = typeof navigator !== 'undefined' && 'gpu' in (navigator as any);
    const supportsWASM = typeof WebAssembly !== 'undefined';

    // Get platform info
    const platform = typeof navigator !== 'undefined' ? navigator.platform : 'unknown';

    environmentInfo = {
        supportsWebGPU,
        supportsWASM,
        wasmPaths: wasmPath,
        numThreads: 1,
        platform
    };

    runtimeInitialized = true;
    console.log('[ONNX] environment initialized successfully');

    return environmentInfo;
}

/**
 * Get execution provider chain based on capabilities
 */
export function getExecutionProviderChain(webgpuEnabled: boolean = true): string[] {
    // Force WASM for now for stability
    return ['wasm'];
}

/**
 * Get current environment info
 */
export function getEnvironmentInfo(): ONNXRuntimeEnvironment | null {
    return environmentInfo;
}

/**
 * Check if runtime is initialized
 */
export function isRuntimeInitialized(): boolean {
    return runtimeInitialized;
}

/**
 * Force re-initialization
 */
export function resetRuntime(): void {
    runtimeInitialized = false;
    environmentInfo = null;
}
