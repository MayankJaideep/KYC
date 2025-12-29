# Offline Biometric System - Setup Guide

## Current Status

✅ **Infrastructure Complete** (Phases 1-3)
- ONNX Runtime with WebGPU/WASM backends
- Face detector, liveness detector, embedder, matcher modules
- Encrypted storage with AES-256-GCM
- Production-grade API

⚠️ **Models Required** (Phase 1, Step 4)
- BlazeFace ONNX model
- MiniFASNetV2 ONNX model
- MobileFaceNet-ArcFace ONNX model

---

## Quick Start

### Option 1: Download Pre-converted ONNX Models (Recommended)

#### 1. BlazeFace (Face Detection)
```bash
# MediaPipe BlazeFace
cd public/models/onnx/
wget https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite

# Convert TFLite to ONNX (requires tf2onnx)
pip install tf2onnx
python -m tf2onnx.convert --tflite blaze_face_short_range.tflite --output blazeface.onnx
```

**Alternative:** Download from ONNX Model Zoo
- https://github.com/onnx/models/tree/main/vision/body_analysis/

#### 2. MiniFASNetV2 (Liveness Detection)
```bash
# Clone Silent Face Anti-Spoofing repo
git clone https://github.com/minivision-ai/Silent-Face-Anti-Spoofing
cd Silent-Face-Anti-Spoofing

# Download pretrained model (PyTorch)
# Convert to ONNX
python export_onnx.py --model minifasnetv2 --output minifasnet_v2.onnx

# Move to project
cp minifasnet_v2.onnx /path/to/veriface-live-main/public/models/onnx/
```

#### 3. MobileFaceNet-ArcFace (Face Recognition)
```bash
# Download from InsightFace
wget https://github.com/onnx/models/raw/main/vision/body_analysis/arcface/model/arcfaceresnet100-8.onnx

# Or use MobileFaceNet variant (smaller, faster)
# From: https://github.com/deepinsight/insightface/tree/master/model_zoo

# Rename and move
mv arcfaceresnet100-8.onnx public/models/onnx/mobilefacenet_arcface.onnx
```

---

### Option 2: Use Existing face-api.js (Temporary Fallback)

Since model conversion can be complex, **you can continue using face-api.js while preparing ONNX models**.

The new biometric system will gracefully fall back to the existing implementation if ONNX models are not available.

---

## Running the System

### 1. Development Mode
```bash
npm run dev
```

Your dev server is already running on:
- http://localhost:8082/

### 2. Test the Current System

The **existing face-api.js system** is still functional at the same URL. To enable the new ONNX system:

1. Place ONNX models in `/public/models/onnx/`
2. Update `LivenessVerification.tsx` to use new biometric API
3. Refresh browser

---

## System Architecture

```
Camera Stream
    ↓
Face Detection (BlazeFace ONNX)
    ↓
Liveness Check (MiniFASNetV2 ONNX) → [PASS/FAIL]
    ↓
Face Embedding (ArcFace 512-dim)
    ↓
Comparison (Cosine Similarity)
    ↓
Encrypted Storage (IndexedDB + AES-256-GCM)
```

---

## Using the Biometric API

### Enroll a Face
```typescript
import { enrollFace } from '@/lib/biometric';

const result = await enrollFace(imageData, 'user-123', {
  checkLiveness: true,
  livenessThreshold: 'medium',
  embeddingModel: 'mobile'
});

if (result.success) {
  console.log('Enrolled:', result.enrollmentId);
}
```

### Verify Identity (1:1)
```typescript
import { verifyFace } from '@/lib/biometric';

const result = await verifyFace(liveImageData, referenceEmbedding, {
  checkLiveness: true,
  securityLevel: 'high'
});

console.log('Match:', result.match, 'Similarity:', result.similarity);
```

### Identify from Gallery (1:N)
```typescript
import { identifyFace } from '@/lib/biometric';

const result = await identifyFace(liveImageData, {
  checkLiveness: true,
  securityLevel: 'medium',
  topK: 5
});

if (result.matched) {
  console.log('Identified user:', result.userId);
}
```

---

## Model Acquisition: Detailed Guide

### Prerequisites
```bash
pip install torch onnx onnxruntime tf2onnx
```

### BlazeFace Conversion Script
Create `scripts/convert_blazeface.py`:
```python
import tensorflow as tf
import tf2onnx

# Load TFLite model
interpreter = tf.lite.Interpreter(model_path="blaze_face_short_range.tflite")
interpreter.allocate_tensors()

# Convert to ONNX
tf2onnx.convert.from_tflite(
    "blaze_face_short_range.tflite",
    output_path="blazeface.onnx",
    opset=13
)
```

### MiniFASNetV2 Export Script
```python
import torch
import torch.onnx
from models import MiniFASNetV2

# Load pretrained model
model = MiniFASNetV2()
model.load_state_dict(torch.load('minifasnetv2.pth'))
model.eval()

# Dummy input
dummy_input = torch.randn(1, 3, 80, 80)

# Export
torch.onnx.export(
    model,
    dummy_input,
    "minifasnet_v2.onnx",
    opset_version=13,
    input_names=['input'],
    output_names=['output']
)
```

---

## Troubleshooting

### Models Not Loading
```typescript
// Check model cache
import { modelLoader } from '@/lib/onnx';

const stats = await modelLoader.getCacheStats();
console.log('Cached models:', stats.models);
```

### Backend Issues
```typescript
// Check ONNX Runtime backend
import { onnxRuntime } from '@/lib/onnx';

await onnxRuntime.initialize();
console.log('Backend:', onnxRuntime.getBackend()); // 'webgpu' or 'wasm'
```

### Encryption Key Lost
```typescript
// Clear and re-initialize storage
import { biometricStorage } from '@/lib/biometric';

await biometricStorage.clearAll();
```

---

## Next Steps

1. **Download/convert ONNX models** (see guides above)
2. **Place models in** `/public/models/onnx/`
3. **Update UI** to use new biometric API (Phase 4)
4. **Test offline** (disable network in DevTools)
5. **Benchmark performance** (see implementation plan)

---

## Performance Targets

- Face detection: ≤ 20ms
- Liveness check: ≤ 80ms
- Face embedding: ≤ 150ms
- **Total verification: ≤ 300ms**

---

## Security Features

- ✅ 100% offline operation
- ✅ AES-256-GCM encryption at rest
- ✅ No network calls
- ✅ GDPR-compliant data deletion
- ✅ Configurable security levels
- ✅ Audit logging ready

---

## Model Sources

- **BlazeFace**: https://github.com/google/mediapipe
- **MiniFASNetV2**: https://github.com/minivision-ai/Silent-Face-Anti-Spoofing
- **ArcFace**: https://github.com/deepinsight/insightface
- **ONNX Model Zoo**: https://github.com/onnx/models

---

## Support

For issues or questions, refer to:
- Implementation plan: `/brain/implementation_plan.md`
- Task checklist: `/brain/task.md`
