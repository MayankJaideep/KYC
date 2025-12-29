import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { User, Calendar, CreditCard, ArrowRight } from 'lucide-react';

export interface AadhaarDetails {
    fullName: string;
    dob: string;
    gender: 'M' | 'F' | 'O';
    aadhaarLast4: string;
}

interface AadhaarDetailFormProps {
    onComplete: (details: AadhaarDetails) => void;
}

export function AadhaarDetailForm({ onComplete }: AadhaarDetailFormProps) {
    const [details, setDetails] = useState<AadhaarDetails>({
        fullName: '',
        dob: '',
        gender: 'M',
        aadhaarLast4: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onComplete(details);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg mx-auto"
        >
            <Card className="p-8 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 -transe-y-1/2 translate-x-1/2 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10">
                    <h2 className="text-2xl font-bold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
                        Verification Details
                    </h2>
                    <p className="text-muted-foreground mb-8 text-sm">
                        Please enter your details exactly as they appear on your Aadhaar card.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Full Name (as per ID)
                            </Label>
                            <div className="relative group">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                                <Input
                                    id="fullName"
                                    placeholder="e.g. MAYANK JAIDEEP"
                                    className="pl-10 h-12 bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 transition-all focus:ring-2 focus:ring-primary/20"
                                    required
                                    value={details.fullName}
                                    onChange={(e) => setDetails({ ...details, fullName: e.target.value.toUpperCase() })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="dob" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Date of Birth
                                </Label>
                                <div className="relative group">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                                    <Input
                                        id="dob"
                                        placeholder="DD/MM/YYYY"
                                        className="pl-10 h-12 bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 transition-all focus:ring-2 focus:ring-primary/20"
                                        required
                                        value={details.dob}
                                        onChange={(e) => setDetails({ ...details, dob: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="aadhaarLast4" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Aadhaar (Last 4)
                                </Label>
                                <div className="relative group">
                                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                                    <Input
                                        id="aadhaarLast4"
                                        placeholder="XXXX"
                                        maxLength={4}
                                        className="pl-10 h-12 bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 transition-all focus:ring-2 focus:ring-primary/20 font-mono"
                                        required
                                        value={details.aadhaarLast4}
                                        onChange={(e) => setDetails({ ...details, aadhaarLast4: e.target.value.replace(/\D/g, '') })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Gender
                            </Label>
                            <div className="flex gap-4">
                                {(['M', 'F', 'O'] as const).map((g) => (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => setDetails({ ...details, gender: g })}
                                        className={`flex-1 h-12 rounded-lg border text-sm font-medium transition-all ${details.gender === g
                                                ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25'
                                                : 'bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-900'
                                            }`}
                                    >
                                        {g === 'M' ? 'Male' : g === 'F' ? 'Female' : 'Other'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Button type="submit" className="w-full h-14 text-lg font-semibold group rounded-xl shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all">
                            Continue to Document Scan
                            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </form>
                </div>
            </Card>
        </motion.div>
    );
}
