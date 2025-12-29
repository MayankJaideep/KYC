# ONNX Model Testing Guide

## Current Status

✅ **ArcFace ResNet100** - Downloading (248MB)  
⚠️ **BlazeFace** - Requires conversion (script ready)  
⚠️ **MiniFASNetV2** - Requires conversion (script ready)

---

## Quick Start: Test with ArcFace Only

You can test the **core face recognition** system with just the ArcFace model!

### Step 1: Rename Downloaded Model
```bash
cd public/models/onnx
mv arcfaceresnet100-8.onnx mobilefacenet_arcface.onnx
```

### Step 2: Test in Browser
```bash
# Dev server already running
# Open: http://localhost:8082/
```

### Step 3: Run Tests
Open browser console and run:
```javascript
import('/src/lib/biometric/test.ts').then(m => m.runBiometricTests());
```

**Expected behavior:**
- ✅ Face detection will fail (no BlazeFace model yet)
- ✅ Shows graceful error messages
- ✅ Verifies infrastructure is working

---

## Testing Without Liveness (Face Recognition Only)

Create a simple test file to bypass face detection and liveness:

### Test Script: `test-arcface-only.html`

Create this file in `/public/`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>ArcFace Test</title>
</head>
<body>
    <h1>ArcFace Embedding Test</h1>
    
    <input type="file" id="imageInput" accept="image/*">
    <canvas id="canvas" width="112" height="112"></canvas>
    
    <button onclick="testEmbedding()">Extract Embedding</button>
    <pre id="output"></pre>

    <script type="module">
        import { faceEmbedder } from '/src/lib/biometric/face-embedder.ts';
        
        window.testEmbedding = async function() {
            const input = document.getElementById('imageInput');
            const canvas = document.getElementById('canvas');
            const output = document.getElementById('output');
            
            if (!input.files[0]) {
                output.textContent = 'Please select an image first';
                return;
            }
            
            // Load image
            const img = new Image();
            img.src = URL.createObjectURL(input.files[0]);
            await new Promise(resolve => img.onload = resolve);
            
            // Draw to canvas
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 112, 112);
            const imageData = ctx.getImageData(0, 0, 112, 112);
            
            // Create dummy face box (whole image)
            const faceBox = { x: 0, y: 0, width: 112, height: 112, confidence: 1.0 };
            
            try {
                // Extract embedding (without alignment since no landmarks)
                const result = await faceEmbedder.extractEmbedding(imageData, faceBox, {
                    useAlignment: false  // Skip alignment for this test
                });
                
                output.textContent = `✅ SUCCESS!\n\nEmbedding dimension: ${result.embedding.length}\nFirst 10 values:\n${Array.from(result.embedding.slice(0, 10)).map(v => v.toFixed(4)).join(', ')}...`;
            } catch (e) {
                output.textContent = `❌ ERROR:\n${e.message}\n\n${e.stack}`;
            }
        };
    </script>
</body>
</html>
```

**Access:** `http://localhost:8082/test-arcface-only.html`

---

## Full System Testing (All Models Required)

### Option A: Use Conversion Scripts

#### 1. Convert BlazeFace
```bash
cd scripts
pip install tf2onnx tensorflow onnx
python3 convert_blazeface.py
```

#### 2. Convert MiniFASNetV2
```bash
pip install torch onnx
python3 convert_minifasnet.py
```

**NOTE:** MiniFASNetV2 script creates architecture only. For production, download pretrained weights.

### Option B: Use Placeholder Models (Testing Only)

For initial testing, you can use **random weights** just to verify the pipeline:

```bash
# The conversion scripts will create architecture-only models
# They won't give accurate results but will test the pipeline
```

---

## Verifying Models

### Check Model Files
```bash
ls -lh public/models/onnx/
```

Expected:
```
arcfaceresnet100-8.onnx      # 248MB (downloaded)
mobilefacenet_arcface.onnx   # Rename from above
blazeface.onnx               # ~1MB (after conversion)
minifasnet_v2.onnx           # ~500KB (after conversion)
```

### Test Each Model

#### Test ArcFace (Face Recognition)
```javascript
import { faceEmbedder } from '/src/lib/biometric/face-embedder.ts';
await faceEmbedder.initialize('mobile');
console.log('✅ ArcFace loaded');
```

#### Test BlazeFace (Face Detection)
```javascript
import { faceDetector } from '/src/lib/biometric/face-detector.ts';
await faceDetector.initialize();
console.log('✅ BlazeFace loaded');
```

#### Test MiniFASNetV2 (Liveness)
```javascript
import { livenessDetector } from '/src/lib/biometric/liveness-detector.ts';
await livenessDetector.initialize();
console.log('✅ MiniFASNetV2 loaded');
```

---

## Production Model Sources

### For Production Use:

**ArcFace:**
- ✅ Already downloaded: ResNet100 variant
- Alternative (faster): MobileFaceNet from InsightFace
  - https://github.com/deepinsight/insightface/tree/master/model_zoo

**BlazeFace:**
- MediaPipe: https://developers.google.com/mediapipe/solutions/vision/face_detector
- ONNX Model Zoo: https://github.com/onnx/models

**MiniFASNetV2:**
- Pretrained weights: https://github.com/minivision-ai/Silent-Face-Anti-Spoofing
- Download `2.7_80x80_MiniFASNetV2.pth`
- Load weights before export in convert script

---

## Troubleshooting

### Model Not Loading
```javascript
// Check model loader cache
import { modelLoader } from '/src/lib/onnx/model-loader.ts';
const stats = await modelLoader.getCacheStats();
console.log('Cached models:', stats.models);
```

### Clear Cache
```javascript
await modelLoader.clearCache();
```

### Backend Issues
```javascript
import { onnxRuntime } from '/src/lib/onnx/runtime.ts';
await onnxRuntime.initialize();
console.log('Backend:', onnxRuntime.getBackend()); // 'webgpu' or 'wasm'
```

---

## Next Steps

1. ✅ Wait for ArcFace download to complete
2. ✅ Rename to `mobilefacenet_arcface.onnx`
3. ✅ Test face embedding extraction
4. ⚠️ Convert BlazeFace (optional for full system)
5. ⚠️ Convert MiniFASNetV2 (optional for liveness)

**Minimum for testing:** Just Arc Face is enough to verify the biometric pipeline!

**For production:** All three models required.
