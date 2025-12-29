#!/bin/bash
# Download ONNX Models Script
# This script downloads pre-converted ONNX models for the biometric system

set -e

echo "🚀 Downloading ONNX models for offline biometric system..."

MODELS_DIR="public/models/onnx"
mkdir -p "$MODELS_DIR"

# Function to download with wget or curl
download_file() {
    local url=$1
    local output=$2
    
    if command -v wget &> /dev/null; then
        wget -O "$output" "$url"
    elif command -v curl &> /dev/null; then
        curl -L -o "$output" "$url"
    else
        echo "❌ Error: Neither wget nor curl found. Please install one of them."
        exit 1
    fi
}

echo ""
echo "📥 Step 1: Downloading ArcFace ResNet100 (Face Recognition - 512-dim embeddings)..."
echo "   Source: ONNX Model Zoo"
echo "   Size: ~25MB (high accuracy) or ~4MB (mobile)"

# Option 1: High-accuracy ResNet100
# download_file \
#     "https://github.com/onnx/models/raw/main/vision/body_analysis/arcface/model/arcfaceresnet100-8.onnx" \
#     "$MODELS_DIR/resnet50_arcface.onnx"

# Option 2: Mobile-optimized (if available)
echo "⚠️  Note: MobileFaceNet ONNX model requires manual download from InsightFace"
echo "   Visit: https://github.com/deepinsight/insightface/tree/master/model_zoo"
echo "   Download w600k_r50.onnx or mobilefacenet and place in $MODELS_DIR/"

echo ""
echo "📥 Step 2: BlazeFace (Face Detection)..."
echo "   Note: BlazeFace requires conversion from TFLite"
echo "   Visit: https://developers.google.com/mediapipe/solutions/vision/face_detector"

echo ""
echo "📥 Step 3: MiniFASNetV2 (Liveness Detection)..."
echo "   Note: Requires conversion from PyTorch"
echo "   Visit: https://github.com/minivision-ai/Silent-Face-Anti-Spoofing"

echo ""
echo "✅ Model download instructions displayed."
echo ""
echo "⚠️  IMPORTANT: This script provides download links only."
echo "   Most models require manual download or conversion."
echo ""
echo "📖 See BIOMETRIC_SETUP.md for detailed conversion instructions."
echo ""
echo "Current model directory: $MODELS_DIR"
ls -lh "$MODELS_DIR" 2>/dev/null || echo "   (empty - no models yet)"

echo ""
echo "🔧 Next steps:"
echo "   1. Download/convert the required ONNX models"
echo "   2. Place them in $MODELS_DIR/"
echo "   3. Verify model-manifest.json is up to date"
echo "   4. Run 'npm run dev' to test"
