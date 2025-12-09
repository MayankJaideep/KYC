import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoveUp, MoveDown, MoveLeft, MoveRight, Target } from 'lucide-react';

interface FacePositioningGuideProps {
    faceDetected: boolean;
    facePosition?: 'center' | 'left' | 'right' | 'up' | 'down';
}

export function FacePositioningGuide({ faceDetected, facePosition = 'center' }: FacePositioningGuideProps) {
    // Don't show if face is centered
    if (faceDetected && facePosition === 'center') return null;

    const getMessage = () => {
        if (!faceDetected) return 'Position your face in the frame';
        switch (facePosition) {
            case 'left': return 'Move slightly to the right';
            case 'right': return 'Move slightly to the left';
            case 'up': return 'Move down a bit';
            case 'down': return 'Move up a bit';
            default: return 'Center your face';
        }
    };

    const getIcon = () => {
        if (!faceDetected) return <Target className="w-4 h-4" />;
        switch (facePosition) {
            case 'left': return <MoveRight className="w-4 h-4" />;
            case 'right': return <MoveLeft className="w-4 h-4" />;
            case 'up': return <MoveDown className="w-4 h-4" />;
            case 'down': return <MoveUp className="w-4 h-4" />;
            default: return <Target className="w-4 h-4" />;
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-10"
            >
                <div className="glass-card px-4 py-2 bg-primary/10 border-primary/20 backdrop-blur-xl">
                    <div className="flex items-center gap-2">
                        {getIcon()}
                        <p className="text-sm font-medium text-primary">{getMessage()}</p>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
