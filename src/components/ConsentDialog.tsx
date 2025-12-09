import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Shield, Camera, Lock, AlertTriangle } from 'lucide-react';

interface ConsentDialogProps {
  onConsent: (consented: boolean) => void;
}

export function ConsentDialog({ onConsent }: ConsentDialogProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="glass-card-elevated p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4"
          >
            <Shield className="w-8 h-8 text-primary" />
          </motion.div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Camera Access Required</h2>
          <p className="text-muted-foreground">
            We need to access your camera to verify you're a real person
          </p>
        </div>

        {/* Features list */}
        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/50">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Camera className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">Real-time Face Detection</h4>
              <p className="text-xs text-muted-foreground">
                We'll analyze your face to ensure you're a real person
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/50">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">Privacy Protected</h4>
              <p className="text-xs text-muted-foreground">
                Video is processed locally. No recordings are stored.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-warning/10 border border-warning/20">
            <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-warning" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">Authorized Use Only</h4>
              <p className="text-xs text-muted-foreground">
                This system is for authorized identity verification only
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            variant="glow"
            size="lg"
            onClick={() => onConsent(true)}
            className="w-full"
          >
            <Camera className="w-5 h-5 mr-2" />
            Allow Camera Access
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => onConsent(false)}
            className="w-full text-muted-foreground"
          >
            Cancel
          </Button>
        </div>

        {/* Privacy notice */}
        <p className="text-xs text-center text-muted-foreground mt-6">
          By proceeding, you agree to our{' '}
          <a href="#" className="text-primary hover:underline">Privacy Policy</a>
          {' '}and{' '}
          <a href="#" className="text-primary hover:underline">Terms of Service</a>
        </p>
      </div>
    </motion.div>
  );
}
