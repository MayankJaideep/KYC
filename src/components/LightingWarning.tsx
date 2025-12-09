import React from 'react';
import { Sun } from 'lucide-react';

export function LightingWarning() {
    return (
        <div className="glass-card p-4 bg-warning/10 border-warning/20 mb-4">
            <div className="flex items-start gap-3">
                <Sun className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-foreground">Low Lighting Detected</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Move to a well-lit area or turn on more lights for better results
                    </p>
                </div>
            </div>
        </div>
    );
}
