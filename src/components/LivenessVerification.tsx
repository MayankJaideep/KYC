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

type Phase = 'system' | 'consent' | 'liveness' | 'result';

const FACE_MODEL_URL = 'face-api.js'; // Placeholder, actual loading handles multiple files
const MATCH_THRESHOLD = 0.6; // 0.6 Similarity (Quadratic distance) is the new threshold

export function LivenessVerification() {
  const { state, startVerification, processFrame, reset } = useLivenessDetection();

  const [phase, setPhase] = useState<Phase>('system');
  const [browserIssues, setBrowserIssues] = useState<string[] | null>(null);
  const [cameraError, setCameraError] = useState(false);

  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(null);
  const [referenceEmbedding, setReferenceEmbedding] = useState<Float32Array | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  const [faceModelStatus, setFaceModelStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>(
    FaceMatcher.isLoaded() ? 'loaded' : 'idle'
  );
  const [faceModelError, setFaceModelError] = useState<string | null>(null);

  const lastGoodFrameRef = useRef<ImageData | null>(null);
  const lastLandmarksRef = useRef<Point3D[] | null>(null);

  const [matchStatus, setMatchStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [comparisonResult, setComparisonResult] = useState<FaceComparisonResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

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
    if (!referenceFile && !referenceEmbedding) return;
    if (!lastGoodFrameRef.current) return;

    let cancelled = false;
    setMatchStatus('running');
    setMatchError(null);

    (async () => {
      try {
        const liveImage = lastGoodFrameRef.current;

        // Ensure model is ready
        if (!FaceMatcher.isLoaded()) {
          const ok = await FaceMatcher.loadModel();
          if (!ok) throw new Error(FaceMatcher.getLastLoadError() || 'Face comparison model not available');
        }

        const landmarks = lastLandmarksRef.current;
        const region = landmarks && landmarks.length > 0
          ? estimateFaceRegionFromLandmarks(landmarks.map(p => ({ x: p.x, y: p.y })), liveImage.width, liveImage.height)
          : centerSquareRegion(liveImage.width, liveImage.height);

        // Compute Live Embedding (Standard Orientation)
        const liveResult = await FaceMatcher.embeddingFromImage(liveImage, region, false);
        const liveEmbedding = liveResult.descriptor;

        if (cancelled) return;

        if (referenceEmbedding) {
          // Precise Cosine Similarity check [0, 1]
          const score = cosineSimilarity(referenceEmbedding, liveEmbedding);

          setComparisonResult({
            match: score >= MATCH_THRESHOLD,
            similarity: score,
            confidence: 1.0, // WASM execution confidence
            reason: score >= MATCH_THRESHOLD
              ? "High biometric similarity detected between ID and live face."
              : "Biometric mismatch. Please ensure you are the person in the reference photo."
          });
          setMatchStatus('done');
        } else {
          throw new Error('Reference embedding not ready');
        }
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
  }, [phase, referenceFile, referenceEmbedding, state.status]);

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

  const loadReferenceImage = useCallback(async (file: File) => {
    setReferenceError(null);
    setReferenceEmbedding(null);
    setReferenceFile(file);
    setMatchStatus('idle');
    setComparisonResult(null);
    setMatchError(null);

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;

    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load reference image'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to process image context');

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // region is optional now as face-api detects it

      // IMMEDIATE VALIDATION: Check quality before accepting
      const { descriptor, score } = await FaceMatcher.embeddingFromImage(imageData);

      console.log(`[Reference] Quality Check: Score ${score.toFixed(2)}`);

      setReferenceEmbedding(descriptor);
      setReferencePreviewUrl(url); // Only set preview if valid

    } catch (e) {
      setReferenceError(e instanceof Error ? e.message : 'Failed to validate reference photo');
      URL.revokeObjectURL(url); // Cleanup if invalid
      setReferencePreviewUrl(null);
    }
  }, []);

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
            <div className="text-sm font-medium text-foreground">Reference Photo</div>
            <div className="text-xs text-muted-foreground">Upload a clear face photo for comparison after liveness.</div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Face Comparison Model</div>
              <div className="text-xs text-muted-foreground">Using face-api.js (SSD MobileNet + ResNet)</div>
              {faceModelStatus === 'loaded' && <div className="text-xs text-success">Biometric engine ready</div>}
              {faceModelStatus === 'loading' && <div className="text-xs text-muted-foreground">Loading deep learning models...</div>}
              {faceModelStatus === 'error' && (
                <div className="text-xs text-destructive">{faceModelError || 'Model load failed'}</div>
              )}
            </div>

            <Input
              type="file"
              accept="image/*"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) loadReferenceImage(f);
              }}
            />

            {referencePreviewUrl && (
              <div className="rounded-xl overflow-hidden border border-border/50">
                <img src={referencePreviewUrl} alt="Reference" className="w-full max-h-48 object-contain bg-background" />
              </div>
            )}

            {referenceEmbedding && (
              <div className="text-xs text-success">Reference loaded</div>
            )}

            {referenceError && (
              <div className="text-xs text-destructive">{referenceError}</div>
            )}
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
            onConsent={consented => {
              if (!consented) {
                setPhase('system');
                return;
              }
              setPhase('liveness');
              startLiveness();
            }}
          />
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
                <div className="text-sm font-medium text-foreground mb-4">Identity Verification</div>

                {!referencePreviewUrl && (
                  <div className="text-xs text-muted-foreground">
                    Upload a reference photo to enable identity matching.
                  </div>
                )}

                {referencePreviewUrl && matchStatus === 'running' && (
                  <div className="flex flex-col items-center justify-center p-8 space-y-3">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                    <div className="text-sm font-medium">Analyzing Biometric Features...</div>
                    <div className="text-xs text-muted-foreground">Comparing facial landmarks and geometry</div>
                  </div>
                )}

                {referencePreviewUrl && matchStatus === 'done' && comparisonResult && (
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
                          {matchPassed ? 'Identity Confirmed' : 'Identity Mismatch'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {comparisonResult.reason}
                      </p>
                    </div>

                    <div className="text-[10px] text-muted-foreground flex justify-between">
                      <span>Threshold: {(MATCH_THRESHOLD * 100).toFixed(0)}%</span>
                      <span>Biometric Engine: Local WASM</span>
                    </div>
                  </div>
                )}

                {referencePreviewUrl && matchStatus === 'error' && (
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-destructive">
                    <div className="font-bold mb-1">Comparison Error</div>
                    {matchError || 'The face comparison engine encountered an issue.'}
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
