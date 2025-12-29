
/**
 * Global ONNX Runtime Wrapper
 * Provides access to the ONNX Runtime loaded via index.html script tag.
 * This bypasses Vite's ESM/Worker handling issues.
 */

// Grab 'ort' from window, but provide type safety
const globalOrt = (typeof window !== 'undefined' && (window as any).ort) ? (window as any).ort : null;

if (!globalOrt && typeof window !== 'undefined') {
    console.error('[ONNX-Global] "ort" not found on window. Ensure script tag is in index.html');
}

export const ort = globalOrt;
export const Tensor = globalOrt?.Tensor;
export type InferenceSession = any; // ort.InferenceSession;
