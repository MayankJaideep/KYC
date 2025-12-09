import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface BrowserCompatibilityErrorProps {
    issues: string[];
    onClose?: () => void;
}

export function BrowserCompatibilityError({ issues, onClose }: BrowserCompatibilityErrorProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg mx-auto"
        >
            <div className="glass-card p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>

                <h3 className="text-xl font-semibold text-foreground mb-2">
                    Browser Not Supported
                </h3>

                <p className="text-sm text-muted-foreground mb-4">
                    Your browser doesn't support the required features for liveness detection.
                </p>

                <div className="glass-card p-4 text-left text-sm space-y-2 mb-6 bg-destructive/10 border-destructive/20">
                    <p className="font-medium text-foreground mb-2">Issues detected:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        {issues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                        ))}
                    </ul>
                </div>

                <div className="text-sm text-muted-foreground mb-6">
                    <p className="font-medium text-foreground mb-2">Recommended browsers:</p>
                    <p>Chrome, Firefox, Safari, or Edge (latest versions)</p>
                </div>

                {onClose && (
                    <Button onClick={onClose} variant="outline" size="lg" className="w-full">
                        Go Back
                    </Button>
                )}
            </div>
        </motion.div>
    );
}
