import * as ort from 'onnxruntime-web';

/**
 * Initialize ONNX Runtime with explicit configuration.
 * Must be called early in application bootstrap before any models are loaded.
 */
export function initializeOrtRuntime() {
  // Set explicit WASM paths to public root
  // This prevents ONNX Runtime from trying incorrect paths that trigger SPA fallback
  ort.env.wasm.wasmPaths = '/onnxruntime/';

  // Use recommended settings for performance and stability
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;

  console.log('ONNX Runtime configured with wasmPaths:', ort.env.wasm.wasmPaths);

  // Fail-fast probe to verify WASM files are actually available
  probeWasmAvailability();
}

async function probeWasmAvailability() {
  const wasmFile = '/onnxruntime/ort-wasm-simd-threaded.wasm';
  try {
    const res = await fetch(wasmFile, { method: 'HEAD' });
    if (!res.ok) {
      console.error(`[QuickCheck] Failed to fetch ${wasmFile} (${res.status})`);
      return;
    }
    const type = res.headers.get('content-type') || '';
    if (type.includes('text/html')) {
      console.error(`[QuickCheck] CRITICAL: ${wasmFile} returned HTML. ONNX Runtime will fail! Check explicit wasmPaths.`);
    } else {
      console.log(`[QuickCheck] ${wasmFile} is serving correctly (${type})`);
    }
  } catch (e) {
    console.error(`[QuickCheck] Network error probing ${wasmFile}`, e);
  }
}
