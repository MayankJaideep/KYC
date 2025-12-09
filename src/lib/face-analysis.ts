import { FaceMetrics, ChallengeType } from './liveness-types';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

// Correct MediaPipe Face Mesh landmark indices
const LEFT_EYE_INDICES = {
  upper: [159, 158, 157, 173, 133],
  lower: [145, 144, 153, 154, 155],
  innerCorner: 133,
  outerCorner: 33,
};

const RIGHT_EYE_INDICES = {
  upper: [386, 385, 384, 398, 362],
  lower: [374, 373, 380, 381, 382],
  innerCorner: 362,
  outerCorner: 263,
};

const MOUTH_INDICES = {
  upperOuter: 13,
  lowerOuter: 14,
  upperInner: 82,
  lowerInner: 87,
  leftCorner: 61,
  rightCorner: 291,
};

function distance(p1: Point3D, p2: Point3D): number {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) +
    Math.pow(p1.y - p2.y, 2) +
    Math.pow(p1.z - p2.z, 2)
  );
}

function distance2D(p1: Point3D, p2: Point3D): number {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) +
    Math.pow(p1.y - p2.y, 2)
  );
}

function getAveragePoint(landmarks: Point3D[], indices: number[]): Point3D {
  const sum = indices.reduce(
    (acc, idx) => ({
      x: acc.x + landmarks[idx].x,
      y: acc.y + landmarks[idx].y,
      z: acc.z + landmarks[idx].z,
    }),
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: sum.x / indices.length,
    y: sum.y / indices.length,
    z: sum.z / indices.length,
  };
}

export function calculateEyeAspectRatio(landmarks: Point3D[]): { left: number; right: number; average: number } {
  // Left eye EAR using proper vertical/horizontal measurements
  const leftUpperAvg = getAveragePoint(landmarks, LEFT_EYE_INDICES.upper);
  const leftLowerAvg = getAveragePoint(landmarks, LEFT_EYE_INDICES.lower);
  const leftWidth = distance2D(
    landmarks[LEFT_EYE_INDICES.outerCorner],
    landmarks[LEFT_EYE_INDICES.innerCorner]
  );
  const leftHeight = distance2D(leftUpperAvg, leftLowerAvg);
  const leftEAR = leftHeight / (leftWidth + 0.0001);

  // Right eye EAR
  const rightUpperAvg = getAveragePoint(landmarks, RIGHT_EYE_INDICES.upper);
  const rightLowerAvg = getAveragePoint(landmarks, RIGHT_EYE_INDICES.lower);
  const rightWidth = distance2D(
    landmarks[RIGHT_EYE_INDICES.outerCorner],
    landmarks[RIGHT_EYE_INDICES.innerCorner]
  );
  const rightHeight = distance2D(rightUpperAvg, rightLowerAvg);
  const rightEAR = rightHeight / (rightWidth + 0.0001);

  return {
    left: leftEAR,
    right: rightEAR,
    average: (leftEAR + rightEAR) / 2,
  };
}

export function calculateMouthAspectRatio(landmarks: Point3D[]): { outer: number; inner: number } {
  // Outer mouth ratio
  const outerHeight = distance2D(
    landmarks[MOUTH_INDICES.upperOuter],
    landmarks[MOUTH_INDICES.lowerOuter]
  );
  const outerWidth = distance2D(
    landmarks[MOUTH_INDICES.leftCorner],
    landmarks[MOUTH_INDICES.rightCorner]
  );

  // Inner mouth ratio (more accurate for smile detection)
  const innerHeight = distance2D(
    landmarks[MOUTH_INDICES.upperInner],
    landmarks[MOUTH_INDICES.lowerInner]
  );

  return {
    outer: outerHeight / (outerWidth + 0.0001),
    inner: innerHeight / (outerWidth + 0.0001),
  };
}

export function estimateHeadPose(landmarks: Point3D[]): { yaw: number; pitch: number; roll: number } {
  const noseTip = landmarks[4]; // More accurate nose tip
  const leftEyeOuter = landmarks[33];
  const rightEyeOuter = landmarks[263];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const forehead = landmarks[10];
  const chin = landmarks[152];
  const noseBase = landmarks[168];

  // Calculate yaw using nose position relative to face center
  const faceCenterX = (leftCheek.x + rightCheek.x) / 2;
  const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
  const noseOffsetX = noseTip.x - faceCenterX;

  // Use z-depth difference between cheeks for more accurate yaw
  const zDiff = leftCheek.z - rightCheek.z;
  const yaw = Math.atan2(noseOffsetX, faceWidth * 0.4) * (180 / Math.PI) + (zDiff * 100);

  // Calculate pitch using nose-to-face-center ratio
  const faceCenterY = (forehead.y + chin.y) / 2;
  const faceHeight = Math.abs(chin.y - forehead.y);
  const noseOffsetY = noseTip.y - faceCenterY;

  // Also consider the z-position of nose relative to face (reduced multiplier for better upward detection)
  const noseZOffset = noseTip.z - noseBase.z;
  const pitch = Math.atan2(noseOffsetY, faceHeight * 0.4) * (180 / Math.PI) - (noseZOffset * 20);

  // Calculate roll from eye line angle
  const roll = Math.atan2(
    rightEyeOuter.y - leftEyeOuter.y,
    rightEyeOuter.x - leftEyeOuter.x
  ) * (180 / Math.PI);

  return {
    yaw: Math.max(-45, Math.min(45, yaw)),
    pitch: Math.max(-45, Math.min(45, pitch)),
    roll: Math.max(-45, Math.min(45, roll))
  };
}

// Calibrated thresholds based on typical face mesh values
const THRESHOLDS = {
  blinkEAR: 0.18, // Eyes are blinking when EAR drops below this (increased for easier detection)
  blinkEAROpen: 0.22, // Eyes are open when EAR is above this
  smileMouthRatio: 0.08, // Smile detected when outer mouth ratio exceeds this
  smileWidthIncrease: 1.15, // Or when mouth width increases by this factor
  headTurnYaw: 8, // Degrees for head turn detection (lowered for better detection)
  headTurnPitch: 6, // Degrees for look up/down detection (lowered for better sensitivity)
  nodThreshold: 10, // Degrees change for nod detection
};

export function extractFaceMetrics(landmarks: Point3D[], confidence: number = 1): FaceMetrics {
  const ear = calculateEyeAspectRatio(landmarks);
  const mar = calculateMouthAspectRatio(landmarks);
  const headPose = estimateHeadPose(landmarks);

  // More accurate blink detection with hysteresis
  const isBlinking = ear.average < THRESHOLDS.blinkEAR;

  // Debug logging for blink detection
  if (ear.average < 0.15) {
    console.log('👁️ EAR:', ear.average.toFixed(3), 'Threshold:', THRESHOLDS.blinkEAR, 'isBlinking:', isBlinking);
  }

  // Smile detection using mouth aspect ratio
  const isSmiling = mar.outer > THRESHOLDS.smileMouthRatio;

  return {
    eyeAspectRatio: ear.average,
    mouthAspectRatio: mar.outer,
    headPoseYaw: headPose.yaw,
    headPosePitch: headPose.pitch,
    headPoseRoll: headPose.roll,
    faceConfidence: confidence,
    isBlinking,
    isSmiling,
  };
}

export function checkChallengeCompletion(
  challengeType: ChallengeType,
  currentMetrics: FaceMetrics,
  previousMetrics: FaceMetrics | null,
  blinkCount: number
): { completed: boolean; score: number } {
  switch (challengeType) {
    case 'blink':
      // Need at least 2 blinks
      if (blinkCount >= 2) {
        return { completed: true, score: Math.min(1, 0.5 + blinkCount * 0.25) };
      }
      return { completed: false, score: blinkCount * 0.3 };

    case 'turn_left':
      // In mirrored camera view, turning left shows positive yaw
      if (Math.abs(currentMetrics.headPoseYaw) > THRESHOLDS.headTurnYaw && currentMetrics.headPoseYaw > 0) {
        const intensity = Math.abs(currentMetrics.headPoseYaw) / 25;
        return { completed: true, score: Math.min(1, 0.6 + intensity * 0.4) };
      }
      return {
        completed: false,
        score: Math.max(0, Math.max(0, currentMetrics.headPoseYaw) / 25)
      };

    case 'turn_right':
      // In mirrored camera view, turning right shows negative yaw
      if (Math.abs(currentMetrics.headPoseYaw) > THRESHOLDS.headTurnYaw && currentMetrics.headPoseYaw < 0) {
        const intensity = Math.abs(currentMetrics.headPoseYaw) / 25;
        return { completed: true, score: Math.min(1, 0.6 + intensity * 0.4) };
      }
      return {
        completed: false,
        score: Math.max(0, Math.abs(Math.min(0, currentMetrics.headPoseYaw)) / 25)
      };

    case 'look_up':
      // Pitch is positive when looking up in MediaPipe
      if (currentMetrics.headPosePitch > THRESHOLDS.headTurnPitch) {
        const intensity = Math.abs(currentMetrics.headPosePitch) / 20;
        return { completed: true, score: Math.min(1, 0.6 + intensity * 0.4) };
      }
      return {
        completed: false,
        score: Math.max(0, Math.max(0, currentMetrics.headPosePitch) / 20)
      };

    case 'look_down':
      // Pitch is negative when looking down in MediaPipe
      if (currentMetrics.headPosePitch < -THRESHOLDS.headTurnPitch) {
        const intensity = Math.abs(currentMetrics.headPosePitch) / 20;
        return { completed: true, score: Math.min(1, 0.6 + intensity * 0.4) };
      }
      return {
        completed: false,
        score: Math.max(0, Math.abs(Math.min(0, currentMetrics.headPosePitch)) / 20)
      };

    case 'smile':
      if (currentMetrics.isSmiling && currentMetrics.mouthAspectRatio > THRESHOLDS.smileMouthRatio) {
        const intensity = currentMetrics.mouthAspectRatio / 0.15;
        return { completed: true, score: Math.min(1, 0.7 + intensity * 0.3) };
      }
      return {
        completed: false,
        score: Math.min(0.5, currentMetrics.mouthAspectRatio / THRESHOLDS.smileMouthRatio * 0.5)
      };

    case 'nod':
      if (previousMetrics) {
        const pitchChange = Math.abs(currentMetrics.headPosePitch - previousMetrics.headPosePitch);
        if (pitchChange > THRESHOLDS.nodThreshold) {
          return { completed: true, score: Math.min(1, 0.6 + pitchChange / 30) };
        }
        return { completed: false, score: Math.min(0.5, pitchChange / THRESHOLDS.nodThreshold * 0.5) };
      }
      return { completed: false, score: 0 };

    default:
      return { completed: false, score: 0 };
  }
}

// Texture analysis for spoof detection
export function analyzeTextureVariance(imageData: ImageData): number {
  const data = imageData.data;
  let variance = 0;
  let prevIntensity = 0;

  for (let i = 0; i < data.length; i += 16) {
    const intensity = (data[i] + data[i + 1] + data[i + 2]) / 3;
    variance += Math.abs(intensity - prevIntensity);
    prevIntensity = intensity;
  }

  return variance / (data.length / 16);
}

// Anti-Spoofing Detection
export function calculateDepthVariance(landmarks: Point3D[]): number {
  const zValues = landmarks.map(p => p.z);
  const mean = zValues.reduce((a, b) => a + b, 0) / zValues.length;
  const variance = zValues.reduce((sum, z) => sum + Math.pow(z - mean, 2), 0) / zValues.length;
  return Math.sqrt(variance);
}

export function detectLighting(landmarks: Point3D[]): {
  isLowLight: boolean;
  brightness: number;
} {
  // Use z-coordinate variance as proxy for lighting quality
  // Well-lit faces have more consistent depth detection
  const variance = calculateDepthVariance(landmarks);
  const brightness = Math.min(1, variance * 100);

  return {
    isLowLight: brightness < 0.3,
    brightness
  };
}

const SPOOFING_THRESHOLDS = {
  minDepthVariance: 0.008, // Real faces have higher depth variance
  minMotionScore: 0.3,     // Real faces have natural micro-movements
};

export function analyzeSpoofing(
  depthVariance: number,
  motionHistory: number[]
): { isSpoofing: boolean; confidence: number; reason?: string } {
  if (motionHistory.length < 10) {
    return { isSpoofing: false, confidence: 0 };
  }

  const avgMotion = motionHistory.reduce((a, b) => a + b, 0) / motionHistory.length;

  const depthScore = depthVariance > SPOOFING_THRESHOLDS.minDepthVariance ? 1 : 0;
  const motionScore = avgMotion > SPOOFING_THRESHOLDS.minMotionScore ? 1 : 0;

  const livenessConfidence = (depthScore + motionScore) / 2;
  const spoofingConfidence = 1 - livenessConfidence;

  let reason: string | undefined;
  if (spoofingConfidence > 0.5) {
    if (depthScore === 0) reason = 'Flat surface detected (possible photo/screen)';
    else if (motionScore === 0) reason = 'No natural movement detected';
  }

  return {
    isSpoofing: spoofingConfidence > 0.5,
    confidence: spoofingConfidence,
    reason
  };
}

// Motion detection for replay attack detection
export function detectMicroMotion(
  currentLandmarks: Point3D[],
  previousLandmarks: Point3D[] | null
): number {
  if (!previousLandmarks) return 0;

  let totalMotion = 0;
  const samplePoints = [4, 33, 263, 61, 291, 10, 152]; // Key face points

  for (const idx of samplePoints) {
    if (currentLandmarks[idx] && previousLandmarks[idx]) {
      totalMotion += distance(currentLandmarks[idx], previousLandmarks[idx]);
    }
  }

  return totalMotion / samplePoints.length;
}
