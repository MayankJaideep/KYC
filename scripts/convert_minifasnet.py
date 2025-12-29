#!/usr/bin/env python3
"""
Convert MiniFASNetV2 PyTorch to ONNX
Requires: torch, onnx
Install: pip install torch onnx
"""

import sys
import torch
import torch.onnx

# MiniFASNetV2 Model Definition
# Source: https://github.com/minivision-ai/Silent-Face-Anti-Spoofing
class MiniFASNetV2(torch.nn.Module):
    def __init__(self, embedding_size=128, conv6_kernel=(5, 5)):
        super(MiniFASNetV2, self).__init__()
        
        self.conv1 = torch.nn.Conv2d(3, 32, kernel_size=3, stride=2, padding=1, bias=False)
        self.bn1 = torch.nn.BatchNorm2d(32)
        
        self.conv2_dw = torch.nn.Conv2d(32, 32, kernel_size=3, stride=1, padding=1, groups=32, bias=False)
        self.bn2_dw = torch.nn.BatchNorm2d(32)
        self.conv2_sep = torch.nn.Conv2d(32, 64, kernel_size=1, stride=1, padding=0, bias=False)
        self.bn2_sep = torch.nn.BatchNorm2d(64)
        
        self.conv3_dw = torch.nn.Conv2d(64, 64, kernel_size=3, stride=2, padding=1, groups=64, bias=False)
        self.bn3_dw = torch.nn.BatchNorm2d(64)
        self.conv3_sep = torch.nn.Conv2d(64, 64, kernel_size=1, stride=1, padding=0, bias=False)
        self.bn3_sep = torch.nn.BatchNorm2d(64)
        
        self.conv4_dw = torch.nn.Conv2d(64, 64, kernel_size=3, stride=1, padding=1, groups=64, bias=False)
        self.bn4_dw = torch.nn.BatchNorm2d(64)
        self.conv4_sep = torch.nn.Conv2d(64, 128, kernel_size=1, stride=1, padding=0, bias=False)
        self.bn4_sep = torch.nn.BatchNorm2d(128)
        
        self.conv5_dw = torch.nn.Conv2d(128, 128, kernel_size=3, stride=2, padding=1, groups=128, bias=False)
        self.bn5_dw = torch.nn.BatchNorm2d(128)
        self.conv5_sep = torch.nn.Conv2d(128, 128, kernel_size=1, stride=1, padding=0, bias=False)
        self.bn5_sep = torch.nn.BatchNorm2d(128)
        
        self.conv6_dw = torch.nn.Conv2d(128, 128, kernel_size=conv6_kernel, stride=1, padding=0, groups=128, bias=False)
        self.bn6_dw = torch.nn.BatchNorm2d(128)
        self.conv6_flatten = torch.nn.Conv2d(128, embedding_size, kernel_size=1, stride=1, padding=0, bias=False)
        
        self.fc = torch.nn.Linear(embedding_size, 2)  # Binary: [live, spoof]
        
        self.relu = torch.nn.ReLU(inplace=True)
    
    def forward(self, x):
        x = self.relu(self.bn1(self.conv1(x)))
        
        x = self.relu(self.bn2_dw(self.conv2_dw(x)))
        x = self.relu(self.bn2_sep(self.conv2_sep(x)))
        
        x = self.relu(self.bn3_dw(self.conv3_dw(x)))
        x = self.relu(self.bn3_sep(self.conv3_sep(x)))
        
        x = self.relu(self.bn4_dw(self.conv4_dw(x)))
        x = self.relu(self.bn5_sep(self.conv4_sep(x)))
        
        x = self.relu(self.bn5_dw(self.conv5_dw(x)))
        x = self.relu(self.bn5_sep(self.conv5_sep(x)))
        
        x = self.relu(self.bn6_dw(self.conv6_dw(x)))
        x = self.conv6_flatten(x)
        x = x.view(x.size(0), -1)
        
        x = self.fc(x)
        return x

def main():
    print("=" * 60)
    print("MiniFASNetV2 PyTorch → ONNX Converter")
    print("=" * 60)
    print()
    
    output_path = "../public/models/onnx/minifasnet_v2.onnx"
    
    # Create model
    print("Creating MiniFASNetV2 model...")
    model = MiniFASNetV2(conv6_kernel=(1, 1))  # For 80x80 input
    model.eval()
    
    # You would normally load pretrained weights here:
    # model.load_state_dict(torch.load('minifasnetv2.pth'))
    # For now, we'll export the architecture only
    
    print("✓ Model created\n")
    
    # Dummy input (1, 3, 80, 80)
    dummy_input = torch.randn(1, 3, 80, 80)
    
    print("Exporting to ONNX...")
    try:
        torch.onnx.export(
            model,
            dummy_input,
            output_path,
            opset_version=13,
            input_names=['input'],
            output_names=['output'],
            dynamic_axes={
                'input': {0: 'batch_size'},
                'output': {0: 'batch_size'}
            }
        )
        print()
        print("=" * 60)
        print("✓ SUCCESS: MiniFASNetV2 ONNX model created!")
        print(f"  Location: {output_path}")
        print()
        print("⚠️  NOTE: This is the model ARCHITECTURE only.")
        print("   For production, download pretrained weights from:")
        print("   https://github.com/minivision-ai/Silent-Face-Anti-Spoofing")
        print("=" * 60)
        return 0
    except Exception as e:
        print()
        print("=" * 60)
        print(f"✗ ERROR: Export failed - {e}")
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
