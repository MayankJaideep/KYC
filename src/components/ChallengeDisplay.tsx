import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Challenge } from '@/lib/liveness-types';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface ChallengeDisplayProps {
  challenge: Challenge | null;
  timeRemaining?: number;
  isCompleted?: boolean;
  holdProgress?: number; // 0-100 for progress bar
}

export function ChallengeDisplay({ challenge, timeRemaining = 10, isCompleted = false, holdProgress = 0 }: ChallengeDisplayProps) {
  if (!challenge) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-md mx-auto"
    >
      <div className={`glass-card p-6 text-center transition-all duration-300 ${isCompleted ? 'glow-success border-success/30' : 'glow-primary border-primary/30'
        }`}>
        {/* Challenge icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          className="relative mx-auto mb-4"
        >
          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl transition-colors duration-300 ${isCompleted ? 'bg-success/20' : 'bg-primary/20'
            }`}>
            {isCompleted ? (
              <CheckCircle2 className="w-10 h-10 text-success" />
            ) : (
              <span className="pulse-ring">{challenge.icon}</span>
            )}
          </div>

          {/* Timer ring */}
          {!isCompleted && (
            <svg className="absolute inset-0 w-20 h-20 -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="38"
                fill="none"
                stroke="hsl(var(--primary) / 0.2)"
                strokeWidth="3"
              />
              <circle
                cx="40"
                cy="40"
                r="38"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="3"
                strokeDasharray={238.76}
                strokeDashoffset={238.76 * (1 - timeRemaining / 10)}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
          )}
        </motion.div>

        {/* Challenge instruction */}
        <motion.h3
          key={challenge.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xl font-semibold text-foreground mb-2"
        >
          {isCompleted ? 'Completed!' : challenge.instruction}
        </motion.h3>

        {/* Time remaining */}
        {!isCompleted && (
          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{timeRemaining}s remaining</span>
          </div>
        )}

        {/* Hold progress bar for non-blink challenges */}
        {!isCompleted && challenge.type !== 'blink' && challenge.type !== 'nod' && holdProgress > 0 && (
          <div className="mt-4">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-200 ease-out"
                style={{ width: `${holdProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Hold position: {Math.round(holdProgress)}%
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface ChallengeProgressProps {
  challenges: Challenge[];
  currentIndex: number;
}

export function ChallengeProgress({ challenges, currentIndex }: ChallengeProgressProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {challenges.map((challenge, index) => (
        <div
          key={challenge.id}
          className={`flex items-center ${index < challenges.length - 1 ? 'gap-2' : ''}`}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${challenge.completed
              ? 'bg-success text-success-foreground'
              : index === currentIndex
                ? 'bg-primary text-primary-foreground pulse-ring'
                : 'bg-secondary text-muted-foreground'
              }`}
          >
            {challenge.completed ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              index + 1
            )}
          </motion.div>

          {index < challenges.length - 1 && (
            <div className={`w-8 h-0.5 transition-colors duration-300 ${challenge.completed ? 'bg-success' : 'bg-secondary'
              }`} />
          )}
        </div>
      ))}
    </div>
  );
}
