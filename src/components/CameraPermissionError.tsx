import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Camera } from 'lucide-react';

interface CameraPermissionErrorProps {
    onRetry: () => void;
}

export function CameraPermissionError({ onRetry }: CameraPermissionErrorProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg mx-auto"
        >
            <div className="glass-card p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
                    <Camera className="w-8 h-8 text-warning" />
                </div>

                <h3 className="text-xl font-semibold text-foreground mb-2">
                    Camera Access Required
                </h3>

                <p className="text-sm text-muted-foreground mb-6">
                    Please allow camera access to continue with verification.
                </p>

                <div className="glass-card p-4 text-left text-xs space-y-3 mb-6 bg-secondary/50">
                    <p className="font-medium text-foreground mb-2">How to enable camera:</p>
                    <div className="space-y-2">
                        <p><strong className="text-foreground">Chrome/Edge:</strong> Click the camera icon (🎥) in the address bar</p>
                        <p><strong className="text-foreground">Firefox:</strong> Click the lock icon (🔒) → Permissions → Camera → Allow</p>
                        <p><strong className="text-foreground">Safari:</strong> Safari menu → Settings → Websites → Camera → Allow</p>
                    </div>
                </div>

                <Button onClick={onRetry} variant="glow" size="lg" className="w-full">
                    <Camera className="w-4 h-4 mr-2" />
                    Try Again
                </Button>
            </div>
        </motion.div>
    );
}
