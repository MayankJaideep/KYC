
import { ort } from './onnx/ort-global';

// Singleton to prevent multiple model loads
let session: any = null;
let isLoading = false;

// MiniFASNet expects 80x80 input
const INPUT_SIZE = 80;

export class SpoofDetector {
    static async loadModel(modelUrl: string): Promise<boolean> {
        if (session) return true;
        if (isLoading) return false; // Simple debounce

        if (!ort) {
            console.error('ONNX Runtime not found (global ort)');
            return false;
        }

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
        const feeds: Record<string, any> = {};
        const inputNames = session.inputNames;
        feeds[inputNames[0]] = tensor;

        const outputMap = await session.run(feeds);
        const outputTensor = outputMap[session.outputNames[0]];
        const outputData = outputTensor.data as Float32Array;

        const spoofLogit = outputData[0];
        const realLogit = outputData[1];
        const realScore = Math.exp(realLogit) / (Math.exp(realLogit) + Math.exp(spoofLogit) || 1e-10);

        return {
            score: realScore,
            latency: performance.now() - start
        };
    }

    private static preprocess(imageData: ImageData): any {
        const { data, width, height } = imageData;

        const float32Data = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);

        const scaleX = width / INPUT_SIZE;
        const scaleY = height / INPUT_SIZE;
        const stride = INPUT_SIZE * INPUT_SIZE;

        for (let y = 0; y < INPUT_SIZE; y++) {
            for (let x = 0; x < INPUT_SIZE; x++) {
                const srcX = Math.floor(x * scaleX);
                const srcY = Math.floor(y * scaleY);
                const srcIdx = (srcY * width + srcX) * 4;

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
