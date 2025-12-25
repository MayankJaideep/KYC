# Liveness Detection with Anti-Spoofing

A robust, real-time liveness detection system that verifies the presence of a live person using facial analysis and AI-powered anti-spoofing techniques.

## 🚀 Features

- **Multi-Challenge Liveness Verification**
  - Blink detection
  - Head movement tracking (left/right/up/down)
  - Smile detection
  - Nod detection

- **Advanced Anti-Spoofing**
  - AI-powered spoof detection using MiniFASNetV2
  - Texture analysis to detect screens/prints
  - Motion analysis for natural movement detection
  - 3D face landmark analysis
  - Lighting condition assessment

- **User Experience**
  - Real-time feedback
  - Clear visual instructions
  - Progress indicators
  - Responsive design

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: TailwindCSS, shadcn/ui, Framer Motion
- **Face Detection**: MediaPipe Face Mesh
- **AI**: ONNX Runtime with MiniFASNetV2
- **State Management**: React Query, React Hook Form
- **Build Tools**: Vite, TypeScript, ESLint

## 🚀 Getting Started

### Prerequisites

- Node.js 16+
- npm 7+ or yarn 1.22+
- Webcam access

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/MayankJaideep/LivelinessDetection.git
   cd LivelinessDetection
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

3. Download the ONNX model:
   - Place `MiniFASNetV2.onnx` in the `public/` directory
   - The model will be automatically loaded when the app starts

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

## 🎮 Usage

1. Click "Start Verification" to begin
2. Grant camera permissions when prompted
3. Follow the on-screen instructions to complete the liveness challenges
4. The system will analyze your responses and provide a liveness score

## ⚙️ Configuration

Environment variables can be configured in `.env.local`:

```env
VITE_APP_NAME="Liveness Detection"
# Add other configuration as needed
```

## 🏗 Building for Production

To create a production build:

```bash
npm run build
# or
yarn build
```

The build artifacts will be stored in the `dist/` directory.

## 🚀 Deployment

The project is configured for deployment on Vercel. You can deploy by:

1. Pushing to the `main` branch (auto-deploy)
2. Using Vercel CLI:
   ```bash
   vercel
   ```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

- MediaPipe for the face mesh model
- MiniFASNetV2 authors for the anti-spoofing model
- The open-source community for various libraries and tools
