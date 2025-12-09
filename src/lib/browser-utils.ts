// Browser compatibility and utility functions

export function checkBrowserCompatibility(): {
    isCompatible: boolean;
    issues: string[];
} {
    const issues: string[] = [];

    // Check MediaDevices API
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        issues.push('Camera API not supported');
    }

    // Check WebAssembly (needed for MediaPipe)
    if (typeof WebAssembly === 'undefined') {
        issues.push('WebAssembly not supported');
    }

    // Warn on old browsers
    const ua = navigator.userAgent;
    if (ua.includes('MSIE') || ua.includes('Trident/')) {
        issues.push('Internet Explorer is not supported. Please use Chrome, Firefox, Safari, or Edge.');
    }

    // Check for very old Chrome/Firefox
    const chromeMatch = ua.match(/Chrome\/(\d+)/);
    const firefoxMatch = ua.match(/Firefox\/(\d+)/);

    if (chromeMatch && parseInt(chromeMatch[1]) < 80) {
        issues.push('Chrome version too old. Please update to the latest version.');
    }

    if (firefoxMatch && parseInt(firefoxMatch[1]) < 75) {
        issues.push('Firefox version too old. Please update to the latest version.');
    }

    return {
        isCompatible: issues.length === 0,
        issues
    };
}

export function detectFacePosition(landmarks: any[]): 'center' | 'left' | 'right' | 'up' | 'down' {
    if (!landmarks || landmarks.length === 0) return 'center';

    // Get nose tip (landmark 1) as reference point
    const noseTip = landmarks[1];

    // Check horizontal position (x-axis)
    if (noseTip.x < 0.35) return 'left';
    if (noseTip.x > 0.65) return 'right';

    // Check vertical position (y-axis)
    if (noseTip.y < 0.35) return 'up';
    if (noseTip.y > 0.65) return 'down';

    return 'center';
}
