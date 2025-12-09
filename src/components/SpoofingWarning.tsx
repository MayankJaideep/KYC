import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Shield } from 'lucide-react';

interface SpoofingWarningProps {
  confidence: number;
  reason?: string;
}

export function SpoofingWarning({ confidence, reason }: SpoofingWarningProps) {
  if (confidence < 0.5) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="glass-card p-4 bg-warning/10 border-warning/20 mb-4"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Potential Spoofing Detected</p>
            <p className="text-xs text-muted-foreground mt-1">
              {reason || 'Please ensure you are using a real face, not a photo or video'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Shield className="w-3 h-3 text-warning" />
              <span className="text-xs text-warning">
                Confidence: {Math.round(confidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
