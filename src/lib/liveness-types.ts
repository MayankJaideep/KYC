export type ChallengeType = 'blink' | 'turn_left' | 'turn_right' | 'look_up' | 'look_down' | 'smile' | 'nod';

export interface Challenge {
  id: string;
  type: ChallengeType;
  instruction: string;
  icon: string;
  completed: boolean;
  score: number;
}

export interface VerificationResult {
  success: boolean;
  confidence: number;
  challenges: Challenge[];
  spoofDetected: boolean;
  spoofType?: 'photo' | 'video' | 'mask' | 'deepfake';
  timestamp: Date;
}

export interface FaceMetrics {
  eyeAspectRatio: number;
  mouthAspectRatio: number;
  headPoseYaw: number;
  headPosePitch: number;
  headPoseRoll: number;
  faceConfidence: number;
  isBlinking: boolean;
  isSmiling: boolean;
}

export interface LivenessState {
  status: 'idle' | 'consent' | 'initializing' | 'detecting' | 'challenge' | 'processing' | 'success' | 'failed';
  currentChallenge: Challenge | null;
  completedChallenges: Challenge[];
  overallScore: number;
  faceDetected: boolean;
  faceMetrics: FaceMetrics | null;
  holdProgress?: number; // 0-100, tracks hold duration for progress bar
}

export const CHALLENGES: Omit<Challenge, 'id' | 'completed' | 'score'>[] = [
  { type: 'blink', instruction: 'Blink twice naturally', icon: '👁️' },
  { type: 'turn_left', instruction: 'Turn your head slightly left', icon: '👈' },
  { type: 'turn_right', instruction: 'Turn your head slightly right', icon: '👉' },
  { type: 'smile', instruction: 'Smile naturally', icon: '😊' },
  { type: 'nod', instruction: 'Nod your head', icon: '↕️' },
];

export function generateRandomChallenges(count: number = 3): Challenge[] {
  const shuffled = [...CHALLENGES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((challenge, index) => ({
    ...challenge,
    id: `challenge-${index}-${Date.now()}`,
    completed: false,
    score: 0,
  }));
}

export function calculateOverallScore(challenges: Challenge[]): number {
  if (challenges.length === 0) return 0;
  const totalScore = challenges.reduce((sum, c) => sum + c.score, 0);
  return Math.round((totalScore / challenges.length) * 100) / 100;
}
