/**
 * Biometric System Demo/Test
 * Simple test to verify the biometric API works (with or without models)
 */

import {
    enrollFace,
    verifyFace,
    identifyFace,
    getSystemStats,
    type APIEnrollmentResult,
    type APIVerificationResult
} from '@/lib/biometric';

/**
 * Create a test image (simple colored square)
 */
function createTestImage(width: number = 640, height: number = 480): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Fill with gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#4facfe');
    gradient.addColorStop(1, '#00f2fe');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add some "face-like" shapes for testing
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(width / 2 - 50, height / 2 - 30, 20, 0, Math.PI * 2); // Left eye
    ctx.arc(width / 2 + 50, height / 2 - 30, 20, 0, Math.PI * 2); // Right eye
    ctx.fill();

    ctx.beginPath();
    ctx.arc(width / 2, height / 2 + 40, 40, 0, Math.PI); // Mouth
    ctx.stroke();

    return ctx.getImageData(0, 0, width, height);
}

/**
 * Test enrollment
 */
export async function testEnrollment(): Promise<void> {
    console.log('🧪 Testing enrollment...');

    const testImage = createTestImage();

    try {
        const result = await enrollFace(testImage, 'test-user-001', {
            checkLiveness: false, // Skip liveness for test
            embeddingModel: 'mobile'
        });

        console.log('Enrollment result:', result);

        if (result.success) {
            console.log('✅ Enrollment successful!');
            console.log('   Enrollment ID:', result.enrollmentId);
            console.log('   Quality:', result.details?.quality);
        } else {
            console.log('❌ Enrollment failed:', result.error);
        }
    } catch (e) {
        console.error('❌ Enrollment error:', e);
        console.log('ℹ️  This is expected if ONNX models are not available yet.');
    }
}

/**
 * Test system stats
 */
export async function testSystemStats(): Promise<void> {
    console.log('🧪 Testing system stats...');

    try {
        const stats = await getSystemStats();
        console.log('System stats:', stats);
        console.log(`   Enrollments: ${stats.enrollments}`);
        console.log(`   Users: ${stats.users.length}`);
    } catch (e) {
        console.error('❌ System stats error:', e);
    }
}

/**
 * Run all tests
 */
export async function runBiometricTests(): Promise<void> {
    console.log('🚀 Running biometric system tests...');
    console.log('');

    await testSystemStats();
    console.log('');

    await testEnrollment();
    console.log('');

    console.log('✅ Tests complete!');
    console.log('');
    console.log('ℹ️  To use the full system:');
    console.log('   1. Download ONNX models (see BIOMETRIC_SETUP.md)');
    console.log('   2. Place in public/models/onnx/');
    console.log('   3. Refresh and test again');
}

// Auto-run tests in development
if (import.meta.env.DEV) {
    console.log('📝 Biometric test module loaded');
    console.log('   Run: runBiometricTests() in console to test');

    // Expose to window for easy console access
    if (typeof window !== 'undefined') {
        (window as any).biometricTests = {
            runAll: runBiometricTests,
            testEnrollment,
            testSystemStats
        };
    }
}
