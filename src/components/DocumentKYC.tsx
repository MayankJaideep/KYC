import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, Camera, CheckCircle2, XCircle, AlertCircle, FileText } from 'lucide-react';

import { AadhaarDetailForm, type AadhaarDetails } from './AadhaarDetailForm';

interface DocumentKYCProps {
    onComplete?: (result: any) => void;
}

type Step = 'collect-details' | 'upload-document' | 'confirm-photo' | 'capture-live' | 'processing' | 'result';

export function DocumentKYC({ onComplete }: DocumentKYCProps) {
    const [step, setStep] = useState<Step>('collect-details');
    const [userData, setUserData] = useState<AadhaarDetails | null>(null);
    const [documentImage, setDocumentImage] = useState<string | null>(null);
    const [extractedPhoto, setExtractedPhoto] = useState<string | null>(null);
    const [liveImage, setLiveImage] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const documentInputRef = useRef<HTMLInputElement>(null);
    const liveInputRef = useRef<HTMLInputElement>(null);

    const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
            setDocumentImage(reader.result as string);

            // Extract Aadhaar photo for user confirmation
            try {
                const imageData = await loadImageData(reader.result as string);
                const { aadhaarPhotoExtractor } = await import('@/lib/document/photo-extractor');
                const photoResult = await aadhaarPhotoExtractor.extractPhotoForConfirmation(imageData);

                if (photoResult.success && photoResult.photoImage) {
                    // Convert ImageData to data URL for display
                    const photoUrl = imageDataToDataURL(photoResult.photoImage);
                    setExtractedPhoto(photoUrl);
                    setStep('confirm-photo');
                } else {
                    setError(photoResult.error || 'Could not extract photo from Aadhaar');
                    setStep('result');
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to process Aadhaar document');
                setStep('result');
            }
        };
        reader.readAsDataURL(file);
    };

    const imageDataToDataURL = (imageData: ImageData): string => {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL();
    };

    const handleLiveCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
            setLiveImage(reader.result as string);
            setStep('processing');

            // Process KYC using the confirmed photo and live image
            await processKYC(reader.result as string, userData!);
        };
        reader.readAsDataURL(file);
    };

    const processKYC = async (liveImageUrl: string, userDetails: AadhaarDetails) => {
        try {
            // Convert live image to ImageData
            const liveImageData = await loadImageData(liveImageUrl);

            // Convert confirmed Aadhaar photo to ImageData
            // NOTE: We use the extractedPhoto (user-confirmed crop), NOT the full document
            if (!extractedPhoto) {
                throw new Error('No confirmed Aadhaar photo available');
            }
            const aadhaarPhotoData = await loadImageData(extractedPhoto);

            // Import NEW biometric service (MediaPipe-based, no ONNX)
            const { newAadhaarKYCService } = await import('@/lib/document/new-aadhaar-service');

            // Initialize the service
            await newAadhaarKYCService.initialize();

            // Run KYC verification pipeline
            // Pass the confirmed photo crop as the "aadhaarImage"
            const kycResult = await newAadhaarKYCService.verifyKYC({
                aadhaarImage: aadhaarPhotoData, // User-confirmed crop
                liveImage: liveImageData,
                userId: 'kyc-user-' + Date.now(),
                userData: {
                    fullName: userDetails.fullName,
                    dob: userDetails.dob,
                    gender: userDetails.gender,
                    aadhaarLast4: userDetails.aadhaarLast4
                }
            });

            setResult(kycResult);
            setStep('result');

            if (kycResult.success && onComplete) {
                onComplete(kycResult);
            } else if (!kycResult.success) {
                setError(kycResult.error || 'Verification failed');
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'KYC verification failed');
            setStep('result');
        }
    };

    const loadImageData = (dataUrl: string): Promise<ImageData> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = dataUrl;
        });
    };

    const reset = () => {
        setStep('upload-document');
        setDocumentImage(null);
        setExtractedPhoto(null);
        setLiveImage(null);
        setResult(null);
        setError(null);
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-2">Banking KYC Verification</h1>
            <p className="text-muted-foreground mb-8">
                Complete offline document verification with Aadhaar
            </p>

            <AnimatePresence mode="wait">
                {/* Step 0: Collect Details */}
                {step === 'collect-details' && (
                    <AadhaarDetailForm
                        onComplete={(details) => {
                            setUserData(details);
                            setStep('upload-document');
                        }}
                    />
                )}

                {/* Step 1: Upload Document */}
                {step === 'upload-document' && (
                    <motion.div
                        key="upload-document"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <Card className="glass-panel p-8 overflow-hidden relative border-none">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-600" />
                            <div className="text-center relative z-10">
                                <FileText className="w-16 h-16 mx-auto mb-4 text-primary" />
                                <h2 className="text-2xl font-semibold mb-2">Step 1: Upload Aadhaar Card</h2>
                                <p className="text-muted-foreground mb-6">
                                    Upload a clear photo of your Aadhaar card
                                </p>

                                <input
                                    ref={documentInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleDocumentUpload}
                                />

                                <Button
                                    size="lg"
                                    onClick={() => documentInputRef.current?.click()}
                                    className="gap-2"
                                >
                                    <Upload className="w-5 h-5" />
                                    Upload Aadhaar Card
                                </Button>
                            </div>
                        </Card>
                    </motion.div>
                )}

                {/* Step 1.5: Confirm Aadhaar Photo */}
                {step === 'confirm-photo' && (
                    <motion.div
                        key="confirm-photo"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <Card className="glass-panel p-8 border-none relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
                            <div className="space-y-6 relative z-10">
                                <div className="text-center">
                                    <h2 className="text-2xl font-semibold mb-2">Confirm Your Photo</h2>
                                    <p className="text-muted-foreground mb-4">
                                        Is this the photo from your Aadhaar card?
                                    </p>
                                </div>

                                {extractedPhoto && (
                                    <div className="flex justify-center">
                                        <div className="relative p-4 bg-white rounded-lg border-2 border-primary/20">
                                            <img
                                                src={extractedPhoto}
                                                alt="Extracted Aadhaar Photo"
                                                className="w-48 h-48 object-cover rounded"
                                            />
                                            <div className="absolute top-2 right-2 bg-primary/20 backdrop-blur-sm rounded px-2 py-1 text-xs font-mono">
                                                Aadhaar Photo
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                                    <p className="text-sm text-amber-900 dark:text-amber-200">
                                        ⚠️ <strong>Important:</strong> Only confirm if this is clearly your photo from the Aadhaar card.
                                        This photo will be used for identity verification.
                                    </p>
                                </div>

                                <div className="flex gap-4">
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        onClick={reset}
                                        className="flex-1"
                                    >
                                        No, Try Again
                                    </Button>
                                    <Button
                                        size="lg"
                                        onClick={() => setStep('capture-live')}
                                        className="flex-1 gap-2"
                                    >
                                        <CheckCircle2 className="w-5 h-5" />
                                        Yes, This is My Photo
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}

                {/* Step 2: Capture Live Photo */}
                {step === 'capture-live' && (
                    <motion.div
                        key="capture-live"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <div className="grid grid-cols-2 gap-6">
                            <Card className="glass-panel p-4 border-none">
                                <h3 className="font-semibold mb-2">Document Uploaded</h3>
                                {documentImage && (
                                    <img src={documentImage} alt="Document" className="w-full rounded" />
                                )}
                            </Card>

                            <Card className="glass-panel p-8 border-none relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                                <div className="text-center relative z-10">
                                    <Camera className="w-16 h-16 mx-auto mb-4 text-primary" />
                                    <h2 className="text-2xl font-semibold mb-2">Step 2: Live Photo</h2>
                                    <p className="text-muted-foreground mb-6">
                                        Upload or capture your live photo for comparison
                                    </p>

                                    <input
                                        ref={liveInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="user"
                                        className="hidden"
                                        onChange={handleLiveCapture}
                                    />

                                    <Button
                                        size="lg"
                                        onClick={() => liveInputRef.current?.click()}
                                        className="gap-2"
                                    >
                                        <Camera className="w-5 h-5" />
                                        Capture Live Photo
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    </motion.div>
                )}

                {/* Step 3: Processing */}
                {step === 'processing' && (
                    <motion.div
                        key="processing"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <Card className="glass-panel p-12 border-none">
                            <div className="text-center relative">
                                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                    <div className="w-32 h-32 rounded-full border-4 border-primary animate-ping" />
                                </div>
                                <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mb-4 shadow-lg shadow-primary/20" />
                                <h2 className="text-2xl font-semibold mb-2">Verifying...</h2>
                                <p className="text-muted-foreground">
                                    Scanning Aadhaar • Detecting face • Comparing embeddings
                                </p>
                            </div>
                        </Card>
                    </motion.div>
                )}

                {/* Step 4: Result */}
                {step === 'result' && (
                    <motion.div
                        key="result"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <Card className="glass-panel p-10 border-none relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-green-500" />
                            {error ? (
                                <div className="text-center">
                                    <XCircle className="w-16 h-16 mx-auto mb-4 text-destructive animate-bounce" />
                                    <h2 className="text-2xl font-bold mb-2">Verification Failed</h2>
                                    <div className="text-muted-foreground mb-8 bg-destructive/5 p-6 rounded-lg border border-destructive/10 text-left">
                                        <p className="font-semibold text-destructive mb-2">{error}</p>
                                        <div className="text-sm space-y-2">
                                            <p>💡 Tips for successful Aadhaar scan:</p>
                                            <ul className="list-disc pl-5 space-y-1">
                                                <li>Ensure the card is placed on a flat, dark surface.</li>
                                                <li>Avoid glare and shadows on the ID photo.</li>
                                                <li>Keep the card's edges visible in the frame.</li>
                                                <li>Hold the camera steady for a sharp image.</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <Button size="lg" onClick={reset} className="w-full">Try Again</Button>
                                </div>
                            ) : result?.success ? (
                                <div className="space-y-8">
                                    <div className="text-center">
                                        <div className="relative inline-block">
                                            <CheckCircle2 className="w-20 h-20 mx-auto mb-4 text-green-500 relative z-10" />
                                            <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full" />
                                        </div>
                                        <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-600">KYC Verified!</h2>
                                        <p className="text-muted-foreground">Identity successfully verified</p>
                                    </div>

                                    {/* Show Results */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-muted p-4 rounded">
                                            <div className="text-sm text-muted-foreground mb-1">Aadhaar Number</div>
                                            <div className="font-mono font-semibold">
                                                {result.details?.documentCheck?.aadhaarNumber
                                                    ? `XXXX XXXX ${result.details.documentCheck.aadhaarNumber.slice(-4)}`
                                                    : 'Detected ✓'}
                                            </div>
                                        </div>

                                        <div className="bg-muted p-4 rounded">
                                            <div className="text-sm text-muted-foreground mb-1">Document Match</div>
                                            <div className="font-semibold">
                                                {result.details?.documentCheck?.documentMatch?.similarity
                                                    ? `${(result.details.documentCheck.documentMatch.similarity * 100).toFixed(1)}%`
                                                    : 'Verified'} ✓
                                            </div>
                                        </div>

                                        <div className="bg-muted p-4 rounded">
                                            <div className="text-sm text-muted-foreground mb-1">Face Quality</div>
                                            <div className="font-semibold">
                                                {result.details?.quality
                                                    ? `${(result.details.quality * 100).toFixed(0)}%`
                                                    : 'Good'} ✓
                                            </div>
                                        </div>

                                        <div className="bg-muted p-4 rounded">
                                            <div className="text-sm text-muted-foreground mb-1">Enrollment ID</div>
                                            <div className="font-mono text-xs">
                                                {result.enrollmentId?.slice(0, 20)}...
                                            </div>
                                        </div>
                                    </div>

                                    <Button onClick={reset} variant="outline" className="w-full">
                                        Verify Another
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
                                    <h2 className="text-2xl font-semibold mb-2">Verification Issues</h2>
                                    <p className="text-muted-foreground mb-6">
                                        {result?.error || 'Please check your documents and try again'}
                                    </p>
                                    <Button onClick={reset}>Try Again</Button>
                                </div>
                            )}
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Preview Images */}
            {(documentImage || liveImage) && step !== 'result' && (
                <div className="mt-6 grid grid-cols-2 gap-4">
                    {documentImage && (
                        <div>
                            <div className="text-sm text-muted-foreground mb-2">Document</div>
                            <img src={documentImage} alt="Document" className="w-full rounded border" />
                        </div>
                    )}
                    {liveImage && (
                        <div>
                            <div className="text-sm text-muted-foreground mb-2">Live Photo</div>
                            <img src={liveImage} alt="Live" className="w-full rounded border" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
