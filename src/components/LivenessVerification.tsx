import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CameraFeed } from './CameraFeed';
import { ConsentDialog } from './ConsentDialog';
import { ChallengeDisplay, ChallengeProgress } from './ChallengeDisplay';
import { VerificationResult } from './VerificationResult';
import { FaceMetricsDisplay } from './FaceMetricsDisplay';
import { useLivenessDetection } from '@/hooks/use-liveness-detection';
import { Button } from '@/components/ui/button';
import { Shield, Fingerprint, Zap, Eye, RefreshCw } from 'lucide-react';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

export function LivenessVerification() {
  const { state, startVerification, processFrame, reset, setConsent, showConsentDialog } = useLivenessDetection();
  const [showMetrics, setShowMetrics] = useState(false);
  const [challengeTimeRemaining, setChallengeTimeRemaining] = useState(10);

  const handleFaceDetected = useCallback((landmarks: Point3D[], confidence: number) => {
    processFrame(landmarks, confidence);
  }, [processFrame]);

  const handleConsent = useCallback((consented: boolean) => {
    if (consented) {
      setConsent(true);
      startVerification();
    } else {
      reset();
    }
  }, [setConsent, startVerification, reset]);

  // Challenge timer
  useEffect(() => {
    if (state.status !== 'challenge') {
      setChallengeTimeRemaining(10);
      return;
    }

    const interval = setInterval(() => {
      setChallengeTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [state.status, state.currentChallenge?.id]);

  // Reset timer when challenge changes
  useEffect(() => {
    setChallengeTimeRemaining(10);
  }, [state.currentChallenge?.id]);

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {/* Idle state - Start screen */}
        {state.status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            {/* Hero section */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-8"
            >
              <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-6 glow-primary">
                <Fingerprint className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-3">
                Liveness Verification
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Complete a quick verification to prove you're a real person.
                This helps prevent fraud and ensures security.
              </p>
            </motion.div>

            {/* Features */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8"
            >
              <div className="glass-card p-4 text-center">
                <Shield className="w-6 h-6 text-primary mx-auto mb-2" />
                <div className="text-xs text-muted-foreground">Secure</div>
              </div>
              <div className="glass-card p-4 text-center">
                <Zap className="w-6 h-6 text-primary mx-auto mb-2" />
                <div className="text-xs text-muted-foreground">Fast</div>
              </div>
              <div className="glass-card p-4 text-center">
                <Eye className="w-6 h-6 text-primary mx-auto mb-2" />
                <div className="text-xs text-muted-foreground">Private</div>
              </div>
            </motion.div>

            {/* Start button */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                variant="glow"
                size="xl"
                onClick={showConsentDialog}
                className="px-12"
              >
                Start Verification
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* Consent dialog */}
        {state.status === 'consent' && (
          <motion.div
            key="consent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ConsentDialog onConsent={handleConsent} />
          </motion.div>
        )}

        {/* Active verification */}
        {(state.status === 'initializing' || state.status === 'detecting' || state.status === 'challenge') && (
          <motion.div
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Challenge progress */}
            {state.status === 'challenge' && state.currentChallenge && (
              <ChallengeProgress
                challenges={[
                  ...(state.completedChallenges || []),
                  state.currentChallenge,
                ]}
                currentIndex={state.completedChallenges?.length || 0}
              />
            )}

            {/* Camera feed with metrics overlay */}
            <div className="relative">
              <CameraFeed
                onFaceDetected={handleFaceDetected}
                isActive={true}
                showMesh={true}
              />

              {/* Face metrics debug display */}
              {showMetrics && (
                <FaceMetricsDisplay metrics={state.faceMetrics} visible={showMetrics} />
              )}
            </div>

            {/* Current challenge */}
            {state.status === 'challenge' && (
              <ChallengeDisplay
                challenge={state.currentChallenge}
                timeRemaining={challengeTimeRemaining}
                isCompleted={false}
                holdProgress={state.holdProgress}
              />
            )}

            {/* Detecting state */}
            {state.status === 'detecting' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <p className="text-muted-foreground">
                  Detecting your face... Please look at the camera.
                </p>
              </motion.div>
            )}

            {/* Debug toggle */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMetrics(!showMetrics)}
                className="text-xs text-muted-foreground"
              >
                {showMetrics ? 'Hide' : 'Show'} Debug Info
              </Button>
            </div>
          </motion.div>
        )}

        {/* Success state */}
        {state.status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <VerificationResult
              success={true}
              confidence={state.overallScore}
              challenges={state.completedChallenges}
              onRetry={reset}
            />
          </motion.div>
        )}

        {/* Failed state */}
        {state.status === 'failed' && (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <VerificationResult
              success={false}
              confidence={state.overallScore}
              challenges={state.completedChallenges}
              onRetry={reset}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
