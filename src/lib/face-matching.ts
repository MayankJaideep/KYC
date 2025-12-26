import * as faceapi from 'face-api.js';

export interface FaceRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export class FaceMatcher {
  private static isModelLoaded = false;
  private static loadError: string | null = null;
  private static MODEL_URL = '/models';
  private static loadingPromise: Promise<boolean> | null = null;

  /**
   * Initializes the face-api.js models.
   * Loads SSD MobileNet (detection), Face Landmark 68 (alignment), and Face Recognition (embedding).
   */
  static async loadModel(): Promise<boolean> {
    if (this.isModelLoaded) return true;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        console.log('[FaceMatcher] Loading models from:', this.MODEL_URL);
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(this.MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(this.MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(this.MODEL_URL)
        ]);

        this.isModelLoaded = true;
        this.loadError = null;
        console.log('[FaceMatcher] Models loaded successfully');
        return true;
      } catch (e) {
        this.isModelLoaded = false;
        this.loadError = e instanceof Error ? e.message : String(e);
        console.error('[FaceMatcher] Failed to load models:', e);
        return false;
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  static isLoaded(): boolean {
    return !!this.isModelLoaded;
  }

  static getLastLoadError(): string | null {
    return this.loadError;
  }

  /**
   * Extract 128-dimensional face embedding from an image.
   * Handles detection and alignment internally.
   */
  static async embeddingFromImage(
    source: ImageData | HTMLImageElement | HTMLCanvasElement,
    region?: FaceRegion, // region is optional now as face-api detects it
    flip: boolean = false
  ): Promise<{ descriptor: Float32Array; score: number }> {
    // AUTO-HEAL: If not loaded, try to load instead of crashing
    if (!this.isModelLoaded) {
      console.warn('[FaceMatcher] Models not loaded when calling embeddingFromImage. Auto-loading...');
      const ok = await this.loadModel();
      if (!ok) {
        throw new Error(`Models failed to load: ${this.loadError || 'Unknown error'}`);
      }
    }

    // Convert ImageData to Canvas if necessary, or handling flipping
    let input: HTMLImageElement | HTMLCanvasElement;

    if (source instanceof ImageData) {
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas context');
      ctx.putImageData(source, 0, 0);
      input = canvas;
    } else {
      input = source;
    }

    if (flip) {
      // Create a temporary canvas to flip the image
      const canvas = document.createElement('canvas');
      canvas.width = input.width;
      canvas.height = input.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas context');

      // Flip horizontally
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(input, 0, 0);
      input = canvas;
    }

    // Detect face and compute descriptor
    // We use SSD MobileNet for high accuracy with strict confidence threshold
    const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.8 });
    const detection = await faceapi.detectSingleFace(input, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      throw new Error('Face not detected. Ensure face is clear and well-lit (Confidence < 80%).');
    }

    return {
      descriptor: detection.descriptor,
      score: detection.detection.score
    };
  }
}

/**
 * Calculates Euclidean Distance between two vectors.
 * For face-api.js embeddings:
 * - < 0.6 is usually a match
 * - < 0.4 is a strong match
 */
export function euclideanDistance(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  return faceapi.euclideanDistance(a, b);
}

/**
 * Helper to get a matching score (0-100%) from distance.
 * Distance 0.0 -> 100%
 * Distance 0.6 -> 0% (Threshold)
 */
export function distanceToSimilarity(distance: number): number {
  // Quadratic calibration: 1 - distance^2
  // 0.27 distance -> 1 - 0.0729 = 0.927 (92.7%)
  // 0.60 distance -> 1 - 0.36 = 0.64 (64%)
  return Math.max(0, 1 - (distance * distance));
}

// Keep existing exports to avoid breaking imports immediately
export const cosineSimilarity = (a: Float32Array, b: Float32Array) => {
  // We proxy to euclidean for logic, or keep it if needed. 
  // But face-api uses Euclidean. 
  // Let's just return 1 - distance/threshold to mimic similarity 
  const dist = faceapi.euclideanDistance(a, b);
  return Math.max(0, 1 - dist);
};

export function centerSquareRegion(imageWidth: number, imageHeight: number): FaceRegion {
  // Placeholder to keep API compatible
  return { x: 0, y: 0, width: imageWidth, height: imageHeight };
}

export function estimateFaceRegionFromLandmarks(landmarks: any[], imageWidth: number, imageHeight: number): FaceRegion {
  // Placeholder
  return { x: 0, y: 0, width: imageWidth, height: imageHeight };
}
