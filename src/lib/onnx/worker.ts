/**
 * ONNX Runtime Web Worker
 * Runs inference in a separate thread to avoid blocking the main UI thread
 */

import { onnxRuntime } from './runtime';
// import type { Tensor } from 'onnxruntime-web';

export interface WorkerMessage {
    id: string;
    type: 'init' | 'load-model' | 'inference' | 'release';
    payload: any;
}

export interface WorkerResponse {
    id: string;
    type: 'success' | 'error';
    payload: any;
}

// Worker script as string (will be converted to Blob URL)
const workerScript = `
  import { onnxRuntime } from './runtime.js';
  
  const sessions = new Map();

  self.addEventListener('message', async (event) => {
    const { id, type, payload } = event.data;

    try {
      let result;

      switch (type) {
        case 'init':
          await onnxRuntime.initialize(payload);
          result = { backend: onnxRuntime.getBackend() };
          break;

        case 'load-model':
          const session = await onnxRuntime.loadModel(payload.modelPath, payload.options);
          sessions.set(payload.modelPath, session);
          result = { modelPath: payload.modelPath };
          break;

        case 'inference':
          const outputs = await onnxRuntime.runInference(payload.modelPath, payload.inputs);
          result = outputs;
          break;

        case 'release':
          await onnxRuntime.releaseSession(payload.modelPath);
          sessions.delete(payload.modelPath);
          result = { released: payload.modelPath };
          break;

        default:
          throw new Error(\`Unknown message type: \${type}\`);
      }

      self.postMessage({ id, type: 'success', payload: result });
    } catch (error) {
      self.postMessage({
        id,
        type: 'error',
        payload: { message: error.message, stack: error.stack }
      });
    }
  });
`;

class ONNXWorkerManager {
    private worker: Worker | null = null;
    private messageId = 0;
    private pendingMessages = new Map<string, { resolve: (value: any) => void; reject: (reason: any) => void }>();
    private useWorker: boolean;

    constructor() {
        // Disable worker for now due to module loading complexity
        // Will enable after testing core functionality
        this.useWorker = false;
    }

    /**
     * Initialize the worker
     */
    async initialize(): Promise<void> {
        if (!this.useWorker) {
            // Use main thread
            await onnxRuntime.initialize();
            return;
        }

        if (this.worker) return;

        // Create worker from blob
        const blob = new Blob([workerScript], { type: ' application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        this.worker = new Worker(workerUrl, { type: 'module' });

        this.worker.addEventListener('message', this.handleWorkerMessage.bind(this));
        this.worker.addEventListener('error', (error) => {
            console.error('[ONNXWorker] Worker error:', error);
        });

        // Initialize runtime in worker
        await this.sendMessage('init', {});
    }

    /**
     * Load a model
     */
    async loadModel(modelPath: string, options?: any): Promise<void> {
        if (!this.useWorker) {
            await onnxRuntime.loadModel(modelPath, options);
            return;
        }

        await this.sendMessage('load-model', { modelPath, options });
    }

    /**
     * Run inference
     */
    async runInference(modelPath: string, inputs: Record<string, any>): Promise<any> {
        if (!this.useWorker) {
            return await onnxRuntime.runInference(modelPath, inputs);
        }

        // Serialize tensors for worker
        const serializedInputs: Record<string, any> = {};
        for (const [name, tensor] of Object.entries(inputs)) {
            serializedInputs[name] = {
                data: Array.from(tensor.data),
                dims: tensor.dims,
                type: tensor.type
            };
        }

        const result = await this.sendMessage('inference', { modelPath, inputs: serializedInputs });
        return result;
    }

    /**
     * Release a model session
     */
    async releaseSession(modelPath: string): Promise<void> {
        if (!this.useWorker) {
            await onnxRuntime.releaseSession(modelPath);
            return;
        }

        await this.sendMessage('release', { modelPath });
    }

    /**
     * Send message to worker
     */
    private sendMessage(type: string, payload: any): Promise<any> {
        if (!this.worker) {
            throw new Error('Worker not initialized');
        }

        const id = `msg-${this.messageId++}`;

        return new Promise((resolve, reject) => {
            this.pendingMessages.set(id, { resolve, reject });
            this.worker!.postMessage({ id, type, payload });
        });
    }

    /**
     * Handle messages from worker
     */
    private handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
        const { id, type, payload } = event.data;

        const pending = this.pendingMessages.get(id);
        if (!pending) return;

        this.pendingMessages.delete(id);

        if (type === 'success') {
            pending.resolve(payload);
        } else {
            pending.reject(new Error(payload.message));
        }
    }

    /**
     * Terminate worker
     */
    terminate(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

// Export singleton
export const onnxWorker = new ONNXWorkerManager();
