import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { CameraFeed } from '@/components/CameraFeed';
import { ConsentDialog } from '@/components/ConsentDialog';
import { SystemCheck } from '@/components/SystemCheck';
import { ChallengeDisplay } from '@/components/ChallengeDisplay';
import { FaceMetricsDisplay } from '@/components/FaceMetricsDisplay';
import { VerificationResult } from '@/components/VerificationResult';
import { SpoofingWarning } from '@/components/SpoofingWarning';
import { LightingWarning } from '@/components/LightingWarning';
import { FacePositioningGuide } from '@/components/FacePositioningGuide';
import { BrowserCompatibilityError } from '@/components/BrowserCompatibilityError';
import { CameraPermissionError } from '@/components/CameraPermissionError';
import { checkBrowserCompatibility, detectFacePosition } from '@/lib/browser-utils';
import { useLivenessDetection } from '@/hooks/use-liveness-detection';
import {
  FaceMatcher,
  cosineSimilarity,
  centerSquareRegion,
  estimateFaceRegionFromLandmarks
} from '@/lib/face-matching';

interface FaceComparisonResult {
  match: boolean;
  similarity: number;
  confidence: number;
  reason: string;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

type Phase = 'system' | 'consent' | 'document' | 'liveness' | 'result';

const FACE_MODEL_URL = 'face-api.js'; // Placeholder, actual loading handles multiple files
const MATCH_THRESHOLD = 0.55; // 0.55 Similarity threshold (55%)

export function LivenessVerification() {
  const { state, startVerification, processFrame, reset } = useLivenessDetection();

  const [phase, setPhase] = useState<Phase>('system');
  const [browserIssues, setBrowserIssues] = useState<string[] | null>(null);
  const [cameraError, setCameraError] = useState(false);

  // Reference photo removed - using Aadhaar photo instead

  // Document/Aadhaar state (NEW for KYC)
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [documentImageData, setDocumentImageData] = useState<ImageData | null>(null);
  const [aadhaarData, setAadhaarData] = useState<any>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [manualAadhaarInput, setManualAadhaarInput] = useState('');
  const [aadhaarValid, setAadhaarValid] = useState<boolean | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);

  // ONNX Runtime initialization state
  const [onnxInitialized, setOnnxInitialized] = useState(false);
  const [onnxInitializing, setOnnxInitializing] = useState(false);
  const [onnxError, setOnnxError] = useState<string | null>(null);

  const [faceModelStatus, setFaceModelStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>(
    FaceMatcher.isLoaded() ? 'loaded' : 'idle'
  );
  const [faceModelError, setFaceModelError] = useState<string | null>(null);

  const lastGoodFrameRef = useRef<ImageData | null>(null);
  const lastLandmarksRef = useRef<Point3D[] | null>(null);

  const [matchStatus, setMatchStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [comparisonResult, setComparisonResult] = useState<FaceComparisonResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Initialize ONNX Runtime on mount
  useEffect(() => {
    const initONNX = async () => {
      if (onnxInitialized || onnxInitializing) return;

      setOnnxInitializing(true);
      setOnnxError(null);

      try {
        console.log('[LivenessVerification] Initializing ONNX Runtime...');
        const { initializeBiometricSystem } = await import('@/lib/biometric/init');

        const status = await initializeBiometricSystem();

        console.log('[LivenessVerification] ONNX initialized:', status);
        setOnnxInitialized(true);

        if (!status.webgpuAvailable) {
          console.warn('[LivenessVerification] WebGPU not available, using WASM (slower)');
        }
      } catch (error) {
        console.error('[LivenessVerification] ONNX initialization failed:', error);
        setOnnxError(error instanceof Error ? error.message : 'Failed to initialize');
      } finally {
        setOnnxInitializing(false);
      }
    };

    initONNX();
  }, []);

  useEffect(() => {
    const res = checkBrowserCompatibility();
    setBrowserIssues(res.isCompatible ? null : res.issues);
  }, []);

  useEffect(() => {
    const res = checkBrowserCompatibility();
    setBrowserIssues(res.isCompatible ? null : res.issues);
  }, []);

  useEffect(() => {
    if (phase !== 'liveness') return;
    if (FaceMatcher.isLoaded()) {
      setFaceModelStatus('loaded');
      setFaceModelError(null);
      return;
    }

    setFaceModelStatus('loading');
    setFaceModelError(null);
    FaceMatcher.loadModel()
      .then(ok => {
        if (ok) {
          setFaceModelStatus('loaded');
          setFaceModelError(null);
        } else {
          setFaceModelStatus('error');
          setFaceModelError(
            FaceMatcher.getLastLoadError() || 'Failed to load face-api.js models. Ensure /public/models exists.'
          );
        }
      })
      .catch(e => {
        setFaceModelStatus('error');
        setFaceModelError(e instanceof Error ? e.message : 'Face comparison model not available. Put face_recognition.onnx in /public.');
      });
  }, [phase]);

  useEffect(() => {
    if (phase !== 'liveness') return;
    if (state.status === 'success' || state.status === 'failed') {
      setPhase('result');
    }
  }, [phase, state.status]);

  useEffect(() => {
    if (phase !== 'result') return;
    if (state.status !== 'success') return;
    if (!documentImageData) {
      // No Aadhaar → show message
      setMatchError('Please upload Aadhaar card for KYC verification');
      return;
    }
    if (!lastGoodFrameRef.current) return;

    let cancelled = false;
    setMatchStatus('running');
    setMatchError(null);

    (async () => {
      try {
        const liveImage = lastGoodFrameRef.current;

        console.log('[KYC] Using ONNX-based Aadhaar comparison...');

        // Use KYC service with ONNX models
        const { aadhaarKYCService } = await import('@/lib/document');

        const kycResult = await aadhaarKYCService.verifyKYC({
          aadhaarImage: documentImageData,
          liveImage: liveImage!,
          userId: 'user-' + Date.now(),
          threshold: 0.60
        });

        if (cancelled) return;

        console.log('[KYC] Match:', kycResult.match, 'Similarity:', kycResult.similarity);

        setComparisonResult({
          match: kycResult.match,
          similarity: kycResult.similarity,
          confidence: kycResult.confidence,
          reason: kycResult.match
            ? `✓ Aadhaar photo matches live face (${(kycResult.similarity * 100).toFixed(1)}%)`
            : kycResult.error || `✗ Mismatch (${(kycResult.similarity * 100).toFixed(1)}%)`
        });
        setMatchStatus('done');
      } catch (e) {
        if (cancelled) return;
        console.error('[Verification] Comparison failed:', e);
        setMatchStatus('error');
        setMatchError(e instanceof Error ? e.message : 'Biometric matching failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, documentImageData, state.status]);

  const spoofConfidence = useMemo(() => {
    const metrics = state.faceMetrics;
    if (!metrics) return 0;
    if (metrics.aiProbability !== undefined) return 1 - metrics.aiProbability;
    if (metrics.isSpoof) return 0.7;
    return 0;
  }, [state.faceMetrics]);

  const facePosition = useMemo(() => {
    const landmarks = lastLandmarksRef.current;
    if (!landmarks || landmarks.length === 0) return 'center';
    return detectFacePosition(landmarks as any);
  }, [state.faceDetected, state.faceMetrics]);

  const onFaceDetected = useCallback(
    (landmarks: Point3D[], confidence: number, imageData?: ImageData) => {
      try {
        processFrame(landmarks, confidence, imageData);
      } catch {
        return;
      }

      if (imageData && confidence >= 0.9) {
        lastGoodFrameRef.current = imageData;
        lastLandmarksRef.current = landmarks;
      }
    },
    [processFrame]
  );

  // Removed: handleFileChange (old reference photo upload - replaced with Aadhaar)

  // NEW: Handle document upload (Aadhaar)
  const handleDocumentChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setDocumentFile(file);
      setDocumentError(null);

      const url = URL.createObjectURL(file);
      setDocumentPreviewUrl(url);

      // Convert to ImageData for processing
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setDocumentImageData(imageData);

          // Process Aadhaar
          processAadhaar(imageData);
        }
      };
      img.src = url;
    },
    []
  );

  const processAadhaar = async (imageData: ImageData) => {
    try {
      const { aadhaarKYCService } = await import('@/lib/document');

      setDocumentError(null);
      console.log('[UI] Processing Aadhaar with complete KYC service...');

      // Note: At this point we only have the document image
      // We'll run full verification after liveness check in the result phase
      // For now, just extract and validate the Aadhaar number

      const { ocrEngine, aadhaarParser } = await import('@/lib/document');
      const ocrResult = await ocrEngine.extractNumberRegion(imageData);
      const parseResult = aadhaarParser.parseFromText(ocrResult.text, ocrResult.confidence);

      if (parseResult.success && parseResult.data) {
        setAadhaarData(parseResult.data);
        if (!parseResult.data.isValid) {
          setDocumentError(`Invalid Aadhaar: ${parseResult.error || 'Checksum failed'}`);
        }
      } else {
        setDocumentError(parseResult.error || 'Could not extract Aadhaar number');
      }
    } catch (e) {
      setDocumentError(`Processing failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleConsent = useCallback(() => {
    setPhase('document'); // Go to document upload first
  }, []);

  const handleDocumentContinue = useCallback(() => {
    setPhase('liveness');
    startVerification();
  }, [startVerification]);

  const startLiveness = useCallback(() => {
    setCameraError(false);
    setMatchStatus('idle');
    setComparisonResult(null);
    setMatchError(null);
    startVerification();
  }, [startVerification]);

  const handleReset = useCallback(() => {
    reset();
    setPhase('system');
    setCameraError(false);
    setMatchStatus('idle');
    setComparisonResult(null);
    setMatchError(null);
  }, [reset]);

  // Removed: loadReferenceImage - using Aadhaar extraction instead

  const matchPassed = useMemo(() => {
    if (!comparisonResult) return null;
    return comparisonResult.match;
  }, [comparisonResult]);

  if (browserIssues) {
    return <BrowserCompatibilityError issues={browserIssues} />;
  }

  return (
    <div className="space-y-6">
      <div className="glass-card-elevated p-6">
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-sm font-medium text-foreground">Aadhaar KYC Verification</div>
            <div className="text-xs text-muted-foreground">
              Using ONNX models for secure, offline biometric verification
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-200 dark:border-blue-800">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              ✓ Complete KYC Flow:
            </div>
            <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
              <li>Upload Aadhaar card → Extract & validate number</li>
              <li>Extract face photo from Aadhaar</li>
              <li>Complete liveness challenge → Capture live face</li>
              <li>Compare Aadhaar photo with live face (ONNX embeddings)</li>
            </ol>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'system' && (
          <SystemCheck
            onComplete={() => {
              setPhase('consent');
            }}
          />
        )}

        {phase === 'consent' && (
          <ConsentDialog
            onConsent={(consented) => {
              if (!consented) {
                setPhase('system');
                return;
              }
              handleConsent(); // Go to document phase
            }}
          />
        )}

        {phase === 'document' && (
          <motion.div
            key="document"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="glass-card-elevated p-6">
              <h2 className="text-xl font-semibold mb-4">KYC: Upload Aadhaar Card</h2>
              <p className="text-sm text-muted-foreground mb-6">
                For banking-grade verification, please upload your Aadhaar card
              </p>

              <Input
                type="file"
                accept="image/*"
                onChange={handleDocumentChange}
                className="mb-4"
              />

              {documentPreviewUrl && (
                <div className="space-y-4">
                  <img src={documentPreviewUrl} alt="Document" className="w-full max-w-xs rounded border" />

                  {aadhaarData && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-green-900 dark:text-green-100">Aadhaar Detected</span>
                      </div>
                      <div className="text-sm text-green-800 dark:text-green-200">
                        <div>Number: XXXX XXXX {aadhaarData.numberRaw.slice(-4)}</div>
                        {aadhaarData.name && <div>Name: {aadhaarData.name}</div>}
                        {aadhaarData.dob && <div>DOB: {aadhaarData.dob}</div>}
                      </div>
                    </div>
                  )}

                  {documentError && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-amber-600" />
                        <span className="text-sm text-amber-900 dark:text-amber-100">{documentError}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setPhase('consent')} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleDocumentContinue}
                  className="flex-1"
                  disabled={!documentImageData}
                >
                  Continue to Liveness Check
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {phase === 'liveness' && (
          <motion.div
            key="liveness"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {cameraError && <CameraPermissionError onRetry={() => setCameraError(false)} />}

            {!cameraError && (
              <div className="relative">
                <CameraFeed
                  isActive={!cameraError}
                  onFaceDetected={onFaceDetected}
                  showMesh
                />
                <FaceMetricsDisplay metrics={state.faceMetrics} />
                <FacePositioningGuide faceDetected={state.faceDetected} facePosition={facePosition as any} />
              </div>
            )}

            {state.faceMetrics?.isLowLight && <LightingWarning />}
            {spoofConfidence > 0.5 && <SpoofingWarning confidence={spoofConfidence} />}

            <ChallengeDisplay
              challenge={state.currentChallenge}
              holdProgress={state.holdProgress || 0}
            />

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                Reset
              </Button>
            </div>
          </motion.div>
        )}

        {phase === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <VerificationResult
              success={state.status === 'success'}
              confidence={state.overallScore}
              challenges={state.completedChallenges}
              deviceTrust={state.deviceTrust}
              onRetry={handleReset}
            />

            {state.status === 'success' && (
              <div className="glass-card-elevated p-6">
                <div className="text-sm font-medium text-foreground mb-4">Aadhaar KYC Verification</div>

                {!documentImageData && (
                  <div className="text-xs text-muted-foreground">
                    Upload Aadhaar card in the document phase to enable KYC verification.
                  </div>
                )}

                {documentImageData && matchStatus === 'running' && (
                  <div className="flex flex-col items-center justify-center p-8 space-y-3">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                    <div className="text-sm font-medium">Comparing Aadhaar Photo with Live Face...</div>
                    <div className="text-xs text-muted-foreground">Using ONNX embeddings (YOLOv8 + ArcFace)</div>
                  </div>
                )}

                {documentImageData && matchStatus === 'done' && comparisonResult && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Similarity</div>
                        <div className={`text-2xl font-mono font-bold ${matchPassed ? 'text-success' : 'text-destructive'}`}>
                          {(comparisonResult.similarity * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</div>
                        <div className={`text-sm font-bold mt-2 ${matchPassed ? 'text-success' : 'text-destructive'}`}>
                          {matchPassed ? 'VERIFIED' : 'FAILED'}
                        </div>
                      </div>
                    </div>

                    <div className={`p-3 rounded-lg border ${matchPassed ? 'bg-success/5 border-success/20' : 'bg-destructive/5 border-destructive/20'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {matchPassed ? (
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                        <span className={`text-sm font-bold ${matchPassed ? 'text-success' : 'text-destructive'}`}>
                          {matchPassed ? 'KYC Approved' : 'KYC Failed'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {comparisonResult.reason}
                      </p>
                    </div>

                    <div className="text-[10px] text-muted-foreground flex justify-between">
                      <span>Threshold: 60%</span>
                      <span>Engine: ONNX (Offline)</span>
                    </div>
                  </div>
                )}

                {documentImageData && matchStatus === 'error' && (
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-destructive">
                    <div className="font-bold mb-1">KYC Verification Error</div>
                    {matchError || 'The Aadhaar comparison engine encountered an issue.'}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
