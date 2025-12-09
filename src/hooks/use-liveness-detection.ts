import { useState, useRef, useCallback, useEffect } from 'react';
import {
  LivenessState,
  Challenge,
  FaceMetrics,
  generateRandomChallenges,
  calculateOverallScore
} from '@/lib/liveness-types';
import {
  extractFaceMetrics,
  checkChallengeCompletion,
  detectMicroMotion
} from '@/lib/face-analysis';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

const CHALLENGE_TIMEOUT = 10000; // 10 seconds per challenge
const BLINK_COOLDOWN = 150; // 150ms between blinks (very fast detection)

export function useLivenessDetection() {
  const [state, setState] = useState<LivenessState>({
    status: 'idle',
    currentChallenge: null,
    completedChallenges: [],
    overallScore: 0,
    faceDetected: false,
    faceMetrics: null,
    holdProgress: 0, // Track hold duration for progress bar
  });

  const previousLandmarksRef = useRef<Point3D[] | null>(null);
  const previousMetricsRef = useRef<FaceMetrics | null>(null);
  const blinkCountRef = useRef(0);
  const lastBlinkTimeRef = useRef(0);
  const wasBlinkingRef = useRef(false);
  const challengeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const challengesRef = useRef<Challenge[]>([]);
  const currentChallengeIndexRef = useRef(0);
  const motionHistoryRef = useRef<number[]>([]);
  const frameCountRef = useRef(0);
  const WARMUP_FRAMES = 10; // ~0.3-0.5 seconds at 30fps to allow metrics to stabilize
  const statusRef = useRef(state.status);
  const currentChallengeRef = useRef(state.currentChallenge);
  const challengeCompletedRef = useRef(false);
  const holdFrameCountRef = useRef(0);
  const HOLD_FRAMES_REQUIRED = 30; // Must hold position for ~30 processed frames (~1 second with throttling)
  const frameSkipCountRef = useRef(0);
  const FRAME_SKIP = 2; // Process every 2nd frame for 30% CPU reduction

  // Update refs when state changes
  useEffect(() => {
    statusRef.current = state.status;
    currentChallengeRef.current = state.currentChallenge;
  }, [state.status, state.currentChallenge]);

  const startVerification = useCallback(() => {
    // Generate random challenges
    const challenges = generateRandomChallenges(2);
    challengesRef.current = challenges;
    currentChallengeIndexRef.current = 0;
    blinkCountRef.current = 0;
    motionHistoryRef.current = [];
    frameCountRef.current = 0;

    setState({
      status: 'detecting',
      currentChallenge: null,
      completedChallenges: [],
      overallScore: 0,
      faceDetected: false,
      faceMetrics: null,
    });
  }, []);

  const startChallenge = useCallback(() => {
    const currentChallenge = challengesRef.current[currentChallengeIndexRef.current];
    if (!currentChallenge) {
      // All challenges completed
      const finalScore = calculateOverallScore(challengesRef.current);
      setState(prev => ({
        ...prev,
        status: finalScore >= 0.6 ? 'success' : 'failed',
        completedChallenges: [...challengesRef.current],
        overallScore: finalScore,
        currentChallenge: null,
      }));
      return;
    }

    // Only reset blink count for non-blink challenges
    if (currentChallenge.type !== 'blink') {
      blinkCountRef.current = 0;
    }

    setState(prev => ({
      ...prev,
      status: 'challenge',
      currentChallenge,
    }));

    // Reset challenge completed flag for new challenge
    challengeCompletedRef.current = false;
    holdFrameCountRef.current = 0;

    // Set timeout for challenge
    if (challengeTimeoutRef.current) {
      clearTimeout(challengeTimeoutRef.current);
    }

    challengeTimeoutRef.current = setTimeout(() => {
      // Challenge timeout - mark as failed and move to next
      const updatedChallenge = { ...currentChallenge, completed: false, score: 0 };
      challengesRef.current[currentChallengeIndexRef.current] = updatedChallenge;
      currentChallengeIndexRef.current++;
      startChallenge();
    }, CHALLENGE_TIMEOUT);
  }, []);

  const processFrame = useCallback((landmarks: Point3D[], confidence: number) => {
    if (statusRef.current === 'idle' || statusRef.current === 'consent' || statusRef.current === 'success' || statusRef.current === 'failed') {
      return;
    }

    const metrics = extractFaceMetrics(landmarks, confidence);

    // Detect blinks on EVERY frame (don't throttle this - blinks are fast!)
    const now = Date.now();
    if (metrics.isBlinking && !wasBlinkingRef.current && now - lastBlinkTimeRef.current > BLINK_COOLDOWN) {
      blinkCountRef.current++;
      lastBlinkTimeRef.current = now;
      console.log('🔵 BLINK DETECTED! Count:', blinkCountRef.current, 'Current challenge:', currentChallengeRef.current?.type);
    }
    wasBlinkingRef.current = metrics.isBlinking;

    // Frame throttling: Skip frames for other processing to reduce CPU usage
    frameSkipCountRef.current++;
    if (frameSkipCountRef.current % FRAME_SKIP !== 0) {
      return;
    }

    // Detect micro motion for anti-spoofing
    const motion = detectMicroMotion(landmarks, previousLandmarksRef.current);
    motionHistoryRef.current.push(motion);
    if (motionHistoryRef.current.length > 30) {
      motionHistoryRef.current.shift();
    }

    // Update state with face metrics
    setState(prev => ({
      ...prev,
      faceDetected: confidence > 0.5,
      faceMetrics: metrics,
    }));

    // If in detecting phase and face is stable, start challenges
    // Wait for warm-up frames to allow metrics to stabilize before first challenge
    if (statusRef.current === 'detecting' && confidence > 0.7) {
      frameCountRef.current++;

      if (frameCountRef.current >= WARMUP_FRAMES) {
        frameCountRef.current = 0;
        // Reset blink count before starting first challenge
        blinkCountRef.current = 0;
        startChallenge();
      }
    }

    // Check current challenge completion
    if (statusRef.current === 'challenge' && currentChallengeRef.current && !challengeCompletedRef.current) {
      // For blink challenge, check immediately without throttling
      if (currentChallengeRef.current.type === 'blink') {
        console.log('🟡 Blink challenge check - Count:', blinkCountRef.current);
        if (blinkCountRef.current >= 2) {
          console.log('✅ BLINK CHALLENGE COMPLETE!');
          challengeCompletedRef.current = true;

          if (challengeTimeoutRef.current) {
            clearTimeout(challengeTimeoutRef.current);
          }

          const updatedChallenge = {
            ...currentChallengeRef.current,
            completed: true,
            score: 1
          };
          challengesRef.current[currentChallengeIndexRef.current] = updatedChallenge;
          currentChallengeIndexRef.current++;

          blinkCountRef.current = 0;

          setTimeout(() => {
            startChallenge();
          }, 500);
        }
        return; // Don't process other challenge logic for blink
      }

      // For other challenges, use normal completion check
      const result = checkChallengeCompletion(
        currentChallengeRef.current.type,
        metrics,
        previousMetricsRef.current,
        blinkCountRef.current
      );

      console.log('🟡 Challenge check:', currentChallengeRef.current.type, 'Completed:', result.completed);

      // For non-blink/non-nod challenges, require holding the position
      if (result.completed && currentChallengeRef.current.type !== 'nod') {
        holdFrameCountRef.current++;

        // Update progress bar
        const progress = Math.min(100, (holdFrameCountRef.current / HOLD_FRAMES_REQUIRED) * 100);
        setState(prev => ({ ...prev, holdProgress: progress }));

        // Only mark as truly completed after holding for required frames
        if (holdFrameCountRef.current >= HOLD_FRAMES_REQUIRED) {
          // Mark as completed to prevent duplicate processing
          challengeCompletedRef.current = true;

          if (challengeTimeoutRef.current) {
            clearTimeout(challengeTimeoutRef.current);
          }

          const updatedChallenge = {
            ...currentChallengeRef.current,
            completed: true,
            score: result.score
          };
          challengesRef.current[currentChallengeIndexRef.current] = updatedChallenge;
          currentChallengeIndexRef.current++;

          // Reset blink count for next challenge
          blinkCountRef.current = 0;

          // Small delay before next challenge
          setTimeout(() => {
            startChallenge();
          }, 500);
        }
      } else if (result.completed && currentChallengeRef.current.type === 'nod') {
        // Nod challenges complete immediately (no hold required)
        challengeCompletedRef.current = true;

        if (challengeTimeoutRef.current) {
          clearTimeout(challengeTimeoutRef.current);
        }

        const updatedChallenge = {
          ...currentChallengeRef.current,
          completed: true,
          score: result.score
        };
        challengesRef.current[currentChallengeIndexRef.current] = updatedChallenge;
        currentChallengeIndexRef.current++;

        blinkCountRef.current = 0;

        setTimeout(() => {
          startChallenge();
        }, 500);
      } else {
        // Reset hold counter and progress if condition not met
        holdFrameCountRef.current = 0;
        setState(prev => ({ ...prev, holdProgress: 0 }));
      }
    }

    previousLandmarksRef.current = landmarks;
    previousMetricsRef.current = metrics;
  }, [startChallenge]);

  const reset = useCallback(() => {
    if (challengeTimeoutRef.current) {
      clearTimeout(challengeTimeoutRef.current);
    }

    // Reset all refs
    challengesRef.current = [];
    currentChallengeIndexRef.current = 0;
    blinkCountRef.current = 0;
    motionHistoryRef.current = [];
    previousLandmarksRef.current = null;
    previousMetricsRef.current = null;
    frameCountRef.current = 0;
    holdFrameCountRef.current = 0;
    challengeCompletedRef.current = false;
    frameSkipCountRef.current = 0;

    setState({
      status: 'idle',
      currentChallenge: null,
      completedChallenges: [],
      overallScore: 0,
      faceDetected: false,
      faceMetrics: null,
      holdProgress: 0,
    });
  }, []);

  const setConsent = useCallback((consented: boolean) => {
    if (consented) {
      setState(prev => ({ ...prev, status: 'initializing' }));
    }
  }, []);

  const showConsentDialog = useCallback(() => {
    setState(prev => ({ ...prev, status: 'consent' }));
  }, []);

  useEffect(() => {
    return () => {
      if (challengeTimeoutRef.current) {
        clearTimeout(challengeTimeoutRef.current);
      }
    };
  }, []);

  return {
    state,
    startVerification,
    processFrame,
    reset,
    setConsent,
    showConsentDialog,
  };
}
