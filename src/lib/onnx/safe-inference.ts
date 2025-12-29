
/**
 * Safe ONNX Inference Wrapper
 * Wraps inference calls with detailed error handling and logging
 */

import { ort } from './ort-global';

/**
 * Safe inference execution with error handling
 */
export async function safeRun(
    session: any,
    feeds: Record<string, any>,
    modelName: string
): Promise<Record<string, any>> {
    console.log(`[SafeInference] Running inference for: ${modelName}`);

    // Log session info
    console.log(`[SafeInference] Model expected inputs:`, session?.inputNames);
    console.log(`[SafeInference] Model expected outputs:`, session?.outputNames);

    // Log input tensor info
    console.log(`[SafeInference] Provided feeds:`);
    for (const [name, tensor] of Object.entries(feeds)) {
        console.log(`  - ${name}:`, {
            shape: (tensor as any).dims,
            type: (tensor as any).type,
            size: (tensor as any).size
        });
    }

    try {
        const startTime = performance.now();
        const results = await session.run(feeds);
        const duration = performance.now() - startTime;

        console.log(`[SafeInference] ✓ Inference complete in ${duration.toFixed(2)}ms`);
        console.log(`[SafeInference] Output tensors:`);
        for (const [name, tensor] of Object.entries(results)) {
            console.log(`  - ${name}:`, {
                shape: (tensor as any).dims,
                type: (tensor as any).type,
                size: (tensor as any).size
            });
        }

        return results;

    } catch (error) {
        console.error(`[SafeInference] ✗ Inference failed for ${modelName}`);
        debugInferenceFailure(error as Error, session, feeds);
        throw error;
    }
}

/**
 * Debug inference failure with detailed diagnostics
 */
export function debugInferenceFailure(
    error: Error,
    session: any,
    feeds: Record<string, any>
): void {
    console.error('[SafeInference] === INFERENCE FAILURE DIAGNOSTICS ===');

    // Error details
    console.error('[SafeInference] Error message:', error.message);

    // Session info
    console.error('[SafeInference] Session info:');
    console.error('  - Input names:', session?.inputNames);
    console.error('  - Output names:', session?.outputNames);

    // Feed info
    console.error('[SafeInference] Feed info:');
    for (const [name, tensor] of Object.entries(feeds)) {
        console.error(`  - ${name}:`, {
            shape: (tensor as any).dims,
            type: (tensor as any).type,
            size: (tensor as any).size
        });
    }

    // Common fixes
    console.error('[SafeInference] Common fixes:');
    console.error('  1. Check input tensor shapes match model expectations');
    console.error('  2. Verify WASM files are accessible (check Network tab)');
    console.error('  3. Try CPU-only mode (disable WebGPU)');
    console.error('  4. Check browser console for CORS or loading errors');
    console.error('  5. Ensure initializeONNXRuntime() was called first');
    console.error('[SafeInference] === END DIAGNOSTICS ===');
}

/**
 * Create tensor from data with validation
 */
export function createTensorSafe(
    data: Float32Array | Uint8Array | number[],
    dims: number[],
    type: string = 'float32'
): any {
    if (!ort) {
        throw new Error('ONNX Runtime not found');
    }

    const expectedSize = dims.reduce((a, b) => a * b, 1);
    const actualSize = data.length;

    if (expectedSize !== actualSize) {
        throw new Error(
            `Tensor size mismatch: expected ${expectedSize} elements (dims: ${dims}), ` +
            `got ${actualSize} elements`
        );
    }

    console.log(`[SafeInference] Creating tensor:`, {
        dims,
        type,
        size: actualSize
    });

    return new ort.Tensor(type, data, dims);
}
