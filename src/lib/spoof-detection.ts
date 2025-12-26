import * as ort from 'onnxruntime-web';

// Singleton to prevent multiple model loads
let session: ort.InferenceSession | null = null;
let isLoading = false;

// MiniFASNet expects 80x80 input
const INPUT_SIZE = 80;

export class SpoofDetector {
    static async loadModel(modelUrl: string): Promise<boolean> {
        if (session) return true;
        if (isLoading) return false; // Simple debounce

        try {
            isLoading = true;
            console.log('Loading AI Model from:', modelUrl);

            session = await ort.InferenceSession.create(modelUrl, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all'
            });

            console.log('AI Model Loaded Successfully');
            isLoading = false;
            return true;
        } catch (e) {
            console.error('Failed to load AI model:', e);
            isLoading = false;
            return false;
        }
    }

    static isLoaded(): boolean {
        return !!session;
    }

    static async predict(imageData: ImageData): Promise<{ score: number; latency: number }> {
        if (!session) {
            throw new Error('Model not loaded');
        }

        const start = performance.now();
        const tensor = this.preprocess(imageData);

        // Run inference
        const feeds: Record<string, ort.Tensor> = {};
        const inputNames = session.inputNames;
        feeds[inputNames[0]] = tensor;

        const outputMap = await session.run(feeds);
        const outputTensor = outputMap[session.outputNames[0]];
        const outputData = outputTensor.data as Float32Array;

        // Output is usually [Real_Score, Spoof_Score] or similar softmax
        // For MiniFASNet, index 1 is often 'Real' and index 0 is 'Spoof', OR distinct classes.
        // Assuming softmax output where higher is better for liveness.
        // We need to softmax the logits if the model returns logits.
        // Let's assume standard Softmax: e^x_i / sum(e^x_j)

        const spoofLogit = outputData[0];
        const realLogit = outputData[1];
        const realScore = Math.exp(realLogit) / (Math.exp(realLogit) + Math.exp(spoofLogit));

        return {
            score: realScore,
            latency: performance.now() - start
        };
    }

    private static preprocess(imageData: ImageData): ort.Tensor {
        const { data, width, height } = imageData;

        // 1. Resize to 80x80 (Nearest Neighbor for speed, or Bilinear)
        // We'll use a simple resize here. 
        // Ideally, we'd use an OffscreenCanvas, but let's do manual sampling for web worker compatibility.

        const float32Data = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);

        const scaleX = width / INPUT_SIZE;
        const scaleY = height / INPUT_SIZE;

        // Format: NCHW (1, 3, 80, 80)
        // R channel starts at 0
        // G channel starts at 80*80
        // B channel starts at 2*80*80
        const stride = INPUT_SIZE * INPUT_SIZE;

        for (let y = 0; y < INPUT_SIZE; y++) {
            for (let x = 0; x < INPUT_SIZE; x++) {
                // Nearest neighbor coordinates
                const srcX = Math.floor(x * scaleX);
                const srcY = Math.floor(y * scaleY);

                const srcIdx = (srcY * width + srcX) * 4;

                // Normalize 0-255 to 0-1 (or specific model requirements)
                // MiniFASNet typically uses standard normalization or simple 0-1.
                // Let's use 0-1 for now.
                const r = data[srcIdx] / 255.0;
                const g = data[srcIdx + 1] / 255.0;
                const b = data[srcIdx + 2] / 255.0;

                float32Data[y * INPUT_SIZE + x] = r;
                float32Data[stride + y * INPUT_SIZE + x] = g;
                float32Data[stride * 2 + y * INPUT_SIZE + x] = b;
            }
        }

        return new ort.Tensor('float32', float32Data, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    }
}
