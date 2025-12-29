/**
 * ONNX Utilities - Index file
 * Central export point for ONNX runtime utilities
 */

// New modules
export {
    initializeONNXRuntime,
    getExecutionProviderChain,
    getEnvironmentInfo,
    isRuntimeInitialized,
    resetRuntime,
    type ONNXRuntimeEnvironment
} from './runtime-config';

export {
    loadONNXModel,
    ensureModelLoaded,
    clearModelCache,
    getCacheInfo,
    type ModelLoadOptions,
    type LoadedModel
} from './model-loader';

export {
    safeRun,
    debugInferenceFailure,
    createTensorSafe
} from './safe-inference';

// Legacy/Utility modules (required by existing biometric modules)
export {
    imageDataToTensor,
    resizeImageData,
    cropImageData,
    normalizeEmbedding,
    cosineSimilarity,
    softmax
} from './tensor-utils';

export {
    onnxRuntime,
    type ORTSession,
    type InferenceSession as WrappedSession
} from './runtime';

export {
    ort,
    Tensor,
    type InferenceSession
} from './ort-global';
