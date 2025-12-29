/**
 * Biometric System Initialization
 * Central initialization point for all ONNX models
 */

import { initializeONNXRuntime } from '../onnx/runtime-config';

export interface BiometricSystemStatus {
    initialized: boolean;
    webgpuAvailable: boolean;
    backend: string;
    error?: string;
}

let systemStatus: BiometricSystemStatus = {
    initialized: false,
    webgpuAvailable: false,
    backend: 'unknown'
};

/**
 * Initialize the entire biometric system
 * MUST be called before any biometric operations
 */
export async function initializeBiometricSystem(): Promise<BiometricSystemStatus> {
    if (systemStatus.initialized) {
        console.log('[BiometricSystem] Already initialized');
        return systemStatus;
    }

    console.log('[BiometricSystem] ===== INITIALIZING BIOMETRIC SYSTEM =====');

    try {
        // Step 1: Initialize ONNX Runtime
        console.log('[BiometricSystem] Step 1: Initializing ONNX Runtime...');
        const env = await initializeONNXRuntime();

        systemStatus.webgpuAvailable = env.supportsWebGPU;
        systemStatus.backend = env.supportsWebGPU ? 'webgpu-wasm-fallback' : 'wasm-only';

        console.log('[BiometricSystem] Runtime initialized:');
        console.log('  - WebGPU available:', env.supportsWebGPU);
        console.log('  - WASM available:', env.supportsWASM);
        console.log('  - Backend mode:', systemStatus.backend);

        // Success
        systemStatus.initialized = true;
        console.log('[BiometricSystem] ===== INITIALIZATION COMPLETE =====');

        return systemStatus;

    } catch (error) {
        console.error('[BiometricSystem] ===== INITIALIZATION FAILED =====');
        console.error('[BiometricSystem] Error:', error);

        systemStatus.initialized = false;
        systemStatus.error = error instanceof Error ? error.message : 'Unknown error';

        throw error;
    }
}

/**
 * Get current system status
 */
export function getSystemStatus(): BiometricSystemStatus {
    return { ...systemStatus };
}

/**
 * Check if system is initialized
 */
export function isSystemInitialized(): boolean {
    return systemStatus.initialized;
}

/**
 * Reset system (for testing)
 */
export function resetSystem(): void {
    systemStatus = {
        initialized: false,
        webgpuAvailable: false,
        backend: 'unknown'
    };
    console.log('[BiometricSystem] System reset');
}
