#!/usr/bin/env python3
"""
Convert BlazeFace TFLite to ONNX
Requires: tf2onnx, tensorflow
Install: pip install tf2onnx tensorflow onnx
"""

import sys
import subprocess

def main():
    print("=" * 60)
    print("BlazeFace TFLite → ONNX Converter")
    print("=" * 60)
    print()
    
    # Check if TFLite file exists
    tflite_path = "blaze_face_short_range.tflite"
    onnx_path = "../public/models/onnx/blazeface.onnx"
    
    print(f"Input:  {tflite_path}")
    print(f"Output: {onnx_path}")
    print()
    
    # Step 1: Download TFLite model if not exists
    import os
    if not os.path.exists(tflite_path):
        print("Downloading BlazeFace TFLite model...")
        subprocess.run([
            "curl", "-L", "-o", tflite_path,
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
        ], check=True)
        print("✓ Downloaded\n")
    
    # Step 2: Convert
    print("Converting TFLite → ONNX...")
    try:
        subprocess.run([
            "python", "-m", "tf2onnx.convert",
            "--tflite", tflite_path,
            "--output", onnx_path,
            "--opset", "13"
        ], check=True)
        print()
        print("=" * 60)
        print("✓ SUCCESS: BlazeFace ONNX model created!")
        print(f"  Location: {onnx_path}")
        print("=" * 60)
        return 0
    except subprocess.CalledProcessError as e:
        print()
        print("=" * 60)
        print("✗ ERROR: Conversion failed")
        print(f"  {e}")
        print("=" * 60)
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\nCancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n✗ ERROR: {e}")
        sys.exit(1)
