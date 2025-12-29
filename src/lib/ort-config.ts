
import { ort } from './onnx/ort-global';

/**
 * Initialize ONNX Runtime with explicit configuration.
 * Must be called early in application bootstrap before any models are loaded.
 */
export function initializeOrtRuntime() {
  if (!ort) {
    console.warn('[Initialize] Global ort not found yet, skipping init. Ensure script tag is in index.html');
    return;
  }

  // Set WASM paths to CDN. This is the only way to avoid Vite's ?import intercepts
  // and ensure the correct .mjs/worker/wasm files are loaded.
  const cdnPath = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
  ort.env.wasm.wasmPaths = cdnPath;

  // Use recommended settings for stability
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  ort.env.wasm.proxy = false; // Run in main thread to bypass worker import issues

  // Explicitly disable WebGPU to force stable WASM
  (ort.env as any).webgpu = { enabled: false };

  console.log('ONNX Runtime configured with CDN wasmPaths:', ort.env.wasm.wasmPaths);

  // Fail-fast probe to verify WASM files are actually available
  probeWasmAvailability();
}

async function probeWasmAvailability() {
  const cdnPath = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
  const wasmFile = cdnPath + 'ort-wasm-simd-threaded.wasm';
  try {
    const res = await fetch(wasmFile, { method: 'HEAD' });
    if (!res.ok) {
      console.error(`[QuickCheck] Failed to fetch ${wasmFile} (${res.status})`);
      return;
    }
    const type = res.headers.get('content-type') || '';
    if (type.includes('text/html')) {
      console.error(`[QuickCheck] CRITICAL: ${wasmFile} returned HTML. ONNX Runtime will fail!`);
    } else {
      console.log(`[QuickCheck] CDN WASM is reachable (${type})`);
    }
  } catch (e) {
    console.error(`[QuickCheck] Network error probing ${wasmFile}`, e);
  }
}
