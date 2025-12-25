import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, RefreshCw, Shield, AlertTriangle } from 'lucide-react';
import { Challenge, DeviceTrustMetrics } from '@/lib/liveness-types';

interface VerificationResultProps {
  success: boolean;
  confidence: number;
  challenges: Challenge[];
  deviceTrust?: DeviceTrustMetrics;
  onRetry: () => void;
}

export function VerificationResult({ success, confidence, challenges, deviceTrust, onRetry }: VerificationResultProps) {
  const confidencePercent = Math.round(confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="w-full max-w-lg mx-auto"
    >
      <div className={`glass-card-elevated p-8 ${success ? 'glow-success' : 'glow-danger'}`}>
        {/* Result icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12, delay: 0.1 }}
          className="relative mx-auto mb-6"
        >
          <div className={`w-24 h-24 rounded-full flex items-center justify-center ${success ? 'bg-success/20' : 'bg-destructive/20'
            }`}>
            {success ? (
              <CheckCircle2 className="w-14 h-14 text-success" />
            ) : (
              <XCircle className="w-14 h-14 text-destructive" />
            )}
          </div>

          {/* Confidence ring */}
          <svg className="absolute inset-0 w-24 h-24 -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="44"
              fill="none"
              stroke={success ? 'hsl(var(--success) / 0.2)' : 'hsl(var(--destructive) / 0.2)'}
              strokeWidth="4"
            />
            <motion.circle
              cx="48"
              cy="48"
              r="44"
              fill="none"
              stroke={success ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
              strokeWidth="4"
              strokeDasharray={276.46}
              initial={{ strokeDashoffset: 276.46 }}
              animate={{ strokeDashoffset: 276.46 * (1 - confidence) }}
              transition={{ duration: 1, delay: 0.3 }}
              strokeLinecap="round"
            />
          </svg>
        </motion.div>

        {/* Result text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-6"
        >
          <h2 className={`text-2xl font-bold mb-2 ${success ? 'text-success' : 'text-destructive'}`}>
            {success ? 'Verification Successful' : 'Verification Failed'}
          </h2>
          <p className="text-muted-foreground">
            {success
              ? 'You have been verified as a real human'
              : 'We could not verify you as a real human'}
          </p>
        </motion.div>

        {/* Confidence score */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-3 mb-6"
        >
          <Shield className={`w-5 h-5 ${success ? 'text-success' : 'text-destructive'}`} />
          <span className="text-sm text-muted-foreground">Confidence Score:</span>
          <span className={`text-2xl font-bold font-mono ${success ? 'text-success' : 'text-destructive'}`}>
            {confidencePercent}%
          </span>
        </motion.div>

        {/* Device Trust Scorecard */}
        {deviceTrust && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ delay: 0.35 }}
            className="mb-8 rounded-xl bg-card/50 border border-primary/10 overflow-hidden"
          >
            <div className="p-4 bg-primary/5 flex items-center justify-between">
              <span className="text-sm font-medium">Device Trust Score</span>
              <span className={`text-lg font-bold font-mono ${deviceTrust.trustScore > 80 ? 'text-success' : 'text-warning'}`}>
                {deviceTrust.trustScore}/100
              </span>
            </div>
            <div className="p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Bot Detection</span>
                <span className={!deviceTrust.isBot ? 'text-success' : 'text-destructive'}>
                  {!deviceTrust.isBot ? 'Passed' : 'Failed'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Screen Integrity</span>
                <span className={deviceTrust.screenPropertiesValid ? 'text-success' : 'text-destructive'}>
                  {deviceTrust.screenPropertiesValid ? 'Verified' : 'Abnormal'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Platform Check</span>
                <span className={!deviceTrust.platformMismatch ? 'text-success' : 'text-destructive'}>
                  {!deviceTrust.platformMismatch ? 'Consistent' : 'Mismatch'}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Challenge results */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-2 mb-8"
        >
          <h4 className="text-sm font-medium text-foreground mb-3">Challenge Results</h4>
          {challenges.map((challenge, index) => (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="flex items-center justify-between p-3 rounded-xl bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{challenge.icon}</span>
                <span className="text-sm text-foreground">{challenge.instruction}</span>
              </div>
              {challenge.completed ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive" />
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {!success && (
            <Button
              variant="glow"
              size="lg"
              onClick={onRetry}
              className="w-full"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Try Again
            </Button>
          )}

          {success && (
            <Button
              variant="success"
              size="lg"
              className="w-full"
              onClick={onRetry}
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Continue
            </Button>
          )}
        </div>

        {/* Warning for failed verification */}
        {!success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-start gap-2 mt-6 p-3 rounded-xl bg-warning/10 border border-warning/20"
          >
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              If you're having trouble, ensure good lighting, face the camera directly, and follow the on-screen instructions carefully.
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
