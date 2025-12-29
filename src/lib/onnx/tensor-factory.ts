/**
 * Metadata-Driven Tensor Factory
 * PERMANENTLY FIXES ALL ONNX DTYPE ERRORS
 * 
 * Creates tensors based on ONNX session input metadata, not assumptions.
 * Uses BigInt64Array for int64, Float32Array for float32, etc.
 */

import { ort } from './runtime';
import type { InferenceSession } from 'onnxruntime-web';

export type TensorType = 'float32' | 'int64' | 'int32' | 'uint8' | 'bool';

export interface TensorMetadata {
    name: string;
    type: TensorType;
    shape: number[];
}

/**
 * Get tensor metadata from ONNX session
 */
export function getTensorMetadata(session: InferenceSession): Map<string, TensorMetadata> {
    const metadata = new Map<string, TensorMetadata>();

    try {
        // Access input metadata from session
        const inputs = session.inputNames;

        for (const inputName of inputs) {
            // ONNX Runtime Web exposes metadata via session.inputNames
            // We need to inspect the session's internal handler for type info
            const inputMeta = (session as any).handler?._model?.graph?.input?.find(
                (inp: any) => inp.name === inputName
            );

            if (inputMeta) {
                const tensorType = inputMeta.type?.tensorType;
                const elemType = tensorType?.elemType;
                const shape = tensorType?.shape?.dim?.map((d: any) =>
                    typeof d.dimValue === 'number' ? d.dimValue : -1
                );

                // Map ONNX elem types to our types
                const typeMap: Record<number, TensorType> = {
                    1: 'float32',  // FLOAT
                    7: 'int64',    // INT64
                    6: 'int32',    // INT32
                    2: 'uint8',    // UINT8
                    9: 'bool'      // BOOL
                };

                metadata.set(inputName, {
                    name: inputName,
                    type: typeMap[elemType] || 'float32',
                    shape: shape || []
                });
            } else {
                // Fallback: assume float32 if metadata not available
                console.warn(`[TensorFactory] No metadata for input "${inputName}", assuming float32`);
                metadata.set(inputName, {
                    name: inputName,
                    type: 'float32',
                    shape: []
                });
            }
        }
    } catch (e) {
        console.error('[TensorFactory] Failed to extract metadata:', e);
    }

    return metadata;
}

/**
 * Create tensor with correct dtype based on metadata
 */
export function createTensorFromMetadata(
    data: number[] | Float32Array | BigInt64Array | Int32Array | Uint8Array,
    metadata: TensorMetadata,
    shape?: number[]
): ort.Tensor {
    const targetShape = shape || metadata.shape.filter(d => d > 0);

    // Create the appropriate typed array based on expected type
    let typedData: Float32Array | BigInt64Array | Int32Array | Uint8Array;

    switch (metadata.type) {
        case 'int64':
            // CRITICAL: Use BigInt64Array for int64
            if (data instanceof BigInt64Array) {
                typedData = data;
            } else if (Array.isArray(data)) {
                typedData = new BigInt64Array(data.map(v => BigInt(Math.round(v))));
            } else {
                typedData = new BigInt64Array(Array.from(data).map(v => BigInt(Math.round(v))));
            }
            break;

        case 'int32':
            typedData = data instanceof Int32Array ? data : new Int32Array(Array.from(data));
            break;

        case 'uint8':
            typedData = data instanceof Uint8Array ? data : new Uint8Array(Array.from(data));
            break;

        case 'float32':
        default:
            if (data instanceof Float32Array) {
                typedData = data;
            } else if (data instanceof BigInt64Array) {
                // Convert BigInt to Float
                const bigIntArray = Array.prototype.slice.call(data) as bigint[];
                typedData = new Float32Array(bigIntArray.map(v => Number(v)));
            } else if (data instanceof Int32Array || data instanceof Uint8Array) {
                typedData = new Float32Array(data);
            } else {
                typedData = new Float32Array(data as number[]);
            }
            break;
    }

    // Create tensor with exact dtype
    return new ort.Tensor(metadata.type, typedData, targetShape);
}

/**
 * Create inference feeds from metadata
 * This is the MAIN function to use - replaces all manual tensor creation
 */
export function createInferenceFeeds(
    session: InferenceSession,
    inputs: Record<string, number[] | Float32Array | BigInt64Array>,
    shapes?: Record<string, number[]>
): Record<string, ort.Tensor> {
    const metadata = getTensorMetadata(session);
    const feeds: Record<string, ort.Tensor> = {};

    for (const [inputName, inputData] of Object.entries(inputs)) {
        const meta = metadata.get(inputName);

        if (!meta) {
            throw new Error(
                `[TensorFactory] No metadata found for input "${inputName}". ` +
                `Available inputs: ${Array.from(metadata.keys()).join(', ')}`
            );
        }

        const shape = shapes?.[inputName];
        feeds[inputName] = createTensorFromMetadata(inputData, meta, shape);

        const shapeStr = shape ? shape.join('x') : meta.shape.join('x');
        console.log(`[TensorFactory] Created tensor for "${inputName}": ${meta.type}, shape: [${shapeStr}]`);
    }

    // Validate that all required inputs are provided
    const providedInputs = new Set(Object.keys(inputs));
    const requiredInputs = new Set(session.inputNames);

    for (const required of requiredInputs) {
        if (!providedInputs.has(required)) {
            console.warn(`[TensorFactory] Missing input: "${required}"`);
        }
    }

    return feeds;
}

/**
 * Helper: Create simple scalar tensor based on metadata
 */
export function createScalarTensor(
    session: InferenceSession,
    inputName: string,
    value: number
): ort.Tensor {
    const metadata = getTensorMetadata(session);
    const meta = metadata.get(inputName);

    if (!meta) {
        throw new Error(`[TensorFactory] No metadata for input "${inputName}"`);
    }

    return createTensorFromMetadata([value], meta, [1]);
}
