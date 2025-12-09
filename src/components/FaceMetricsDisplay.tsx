import React from 'react';
import { motion } from 'framer-motion';
import { FaceMetrics } from '@/lib/liveness-types';
import { Eye, Smile, RotateCcw } from 'lucide-react';

interface FaceMetricsDisplayProps {
  metrics: FaceMetrics | null;
  visible?: boolean;
}

export function FaceMetricsDisplay({ metrics, visible = true }: FaceMetricsDisplayProps) {
  if (!metrics || !visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute left-4 top-1/2 -translate-y-1/2 space-y-2"
    >
      {/* Eye Aspect Ratio */}
      <div className="glass-card px-3 py-2 flex items-center gap-2">
        <Eye className={`w-4 h-4 ${metrics.isBlinking ? 'text-primary' : 'text-muted-foreground'}`} />
        <div className="text-xs">
          <div className="text-muted-foreground">Eyes</div>
          <div className={`font-mono font-medium ${metrics.isBlinking ? 'text-primary' : 'text-foreground'}`}>
            {metrics.isBlinking ? 'Blinking' : 'Open'}
          </div>
        </div>
      </div>

      {/* Smile Detection */}
      <div className="glass-card px-3 py-2 flex items-center gap-2">
        <Smile className={`w-4 h-4 ${metrics.isSmiling ? 'text-primary' : 'text-muted-foreground'}`} />
        <div className="text-xs">
          <div className="text-muted-foreground">Mouth</div>
          <div className={`font-mono font-medium ${metrics.isSmiling ? 'text-primary' : 'text-foreground'}`}>
            {metrics.isSmiling ? 'Smiling' : 'Neutral'}
          </div>
        </div>
      </div>

      {/* Head Pose */}
      <div className="glass-card px-3 py-2 flex items-center gap-2">
        <RotateCcw className="w-4 h-4 text-muted-foreground" />
        <div className="text-xs">
          <div className="text-muted-foreground">Head Pose</div>
          <div className="font-mono font-medium text-foreground">
            {Math.abs(metrics.headPoseYaw) > 10 
              ? metrics.headPoseYaw > 0 ? 'Right' : 'Left'
              : Math.abs(metrics.headPosePitch) > 10
              ? metrics.headPosePitch > 0 ? 'Down' : 'Up'
              : 'Center'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
