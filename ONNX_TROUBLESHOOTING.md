# ONNX Runtime Troubleshooting Guide

## Issue: "no available backend found. ERR: [webgpu] Error: worker not ready"

### What This Means
ONNX Runtime Web cannot initialize WebGPU workers or load WASM files. This blocks all inference (face detection, liveness, embedding).

---

## Quick Fix Checklist

### 1. Check Browser Console
Open DevTools (F12) and look for:

**✅ Success Logs (what you want to see):**
```
[ONNX] Initializing ONNX Runtime Web...
[ONNX] WASM paths: https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/
[ONNX] WebGPU available: true/false
[ONNX] ✓ Runtime initialized successfully
[LivenessVerification] ONNX initialized: { initialized: true, ...}
```

**❌ Error Logs (problems):**
```
[webgpu] Error: worker not ready
Failed to load WASM from ...
net::ERR_FILE_NOT_FOUND
CORS policy blocked...
```

### 2. Verify WASM Files Load
**Network Tab Check:**
1. Open Network tab in DevTools
2. Filter by "wasm"
3. Look for these requests:
   - `ort-wasm-simd-threaded.wasm`
   - `ort-wasm-threaded.worker.js`
4. Status should be `200 OK`

**If 404/blocked:**
- WASM files not accessible
- Check CDN URL is correct
- Check CORS headers

### 3. Test WebGPU Availability
**In console, run:**
```javascript
console.log('WebGPU:', navigator.gpu !== undefined);
```

**Expected:**
- Chrome 113+: `true`
- Firefox/Safari: `false` (OK, will use WASM)

### 4. Force WASM Mode (Bypass WebGPU)
**Temporary test - edit runtime-config.ts:**
```typescript
// Line ~50 - Force WASM only
export function getExecutionProviderChain(webgpuEnabled: boolean = false): string[] {
  // Changed from: webgpuEnabled = true
```

**Or in browser console:**
```javascript
// Force disable WebGPU
navigator.gpu = undefined;
location.reload();
```

---

## Common Causes & Fixes

### Cause 1: WASM Files Not Served
**Symptom:** `net::ERR_FILE_NOT_FOUND` for `.wasm` files

**Fix:** Verify CDN accessibility
```bash
# Test CDN manually
curl -I https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort-wasm-simd-threaded.wasm

# Should return: HTTP/2 200
```

**Alternative:** Host WASM locally
```typescript
// In runtime-config.ts
ort.env.wasm.wasmPaths = '/public/wasm/'; // Local path
```

Then copy WASM files:
```bash
cp node_modules/onnxruntime-web/dist/*.wasm public/wasm/
```

### Cause 2: CORS Policy Blocking
**Symptom:** `CORS policy: No 'Access-Control-Allow-Origin'`

**Fix:** Use same-origin WASM files (see Cause 1 fix)

**Or** update Vite config:
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  }
})
```

### Cause 3: WebGPU Initialization Timeout
**Symptom:** Slow browser, WebGPU query hangs

**Fix:** Add timeout to WebGPU check
```typescript
// In runtime-config.ts - add timeout
const checkWebGPU = async () => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(false), 1000); // 1s timeout
    if (navigator.gpu) {
      navigator.gpu.requestAdapter().then(adapter => {
        resolve(!!adapter);
      }).catch(() => resolve(false));
    } else {
      resolve(false);
    }
  });
};
```

### Cause 4: Module Import Order
**Symptom:** ONNX used before initialization

**Fix:** Ensure `initializeBiometricSystem()` called first
```typescript
// In LivenessVerification.tsx
useEffect(() => {
  initializeBiometricSystem().then(() => {
    console.log('ONNX ready, can now use models');
  });
}, []);
```

---

## Testing After Fix

### 1. Clear Cache & Reload
```javascript
// In console
localStorage.clear();
sessionStorage.clear();
location.reload(true);
```

### 2. Verify Initialization
**Check console for:**
```
[ONNX] ✓ Runtime initialized successfully
[BiometricSystem] ===== INITIALIZATION COMPLETE =====
```

### 3. Test Simple Inference
**In console:**
```javascript
// Test if ONNX is working
import { initializeBiometricSystem } from '@/lib/biometric/init';
const status = await initializeBiometricSystem();
console.log('System status:', status);
```

### 4. Upload Aadhaar & Check
1. Upload Aadhaar card
2. Watch console for model loading logs
3. Should see: `[ModelLoader] Model loaded successfully: ...`
4. Should NOT see: "worker not ready"

---

## Fallback: Disable ONNX Completely (Emergency)
**If all else fails, use face-api.js fallback:**

```typescript
// In components - check ONNX status
const { isSystemInitialized } = await import('@/lib/biometric/init');

if (!isSystemInitialized()) {
  console.warn('ONNX failed, using face-api.js fallback');
  // Use face-api.js instead
}
```

---

## Success Criteria

✅ Console shows: `[ONNX] ✓ Runtime initialized successfully`
✅ No "worker not ready" errors
✅ Network tab shows WASM files loading (200 OK)
✅ Face detection works (similarity > 0%)
✅ Liveness check completes
✅ Embedding extraction succeeds

---

## Still Not Working?

### Debug Checklist:
1. Browser version? (Chrome 113+ recommended)
2. HTTPS or localhost? (WebGPU requires secure context)
3. Incognito mode? (Test without extensions)
4. Console errors? (Copy full stack trace)
5. WASM files accessible? (Check Network tab)

### Get Diagnostic Info:
```javascript
// Run in console
const diag = {
  webgpu: navigator.gpu !== undefined,
  wasm: typeof WebAssembly !== 'undefined',
  workers: typeof Worker !== 'undefined',
  sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
  crossOriginIsolated: crossOriginIsolated
};
console.table(diag);
```

### Contact Support With:
- Browser & version
- Console logs (full)
- Network tab screenshot
- Diagnostic info (above)
