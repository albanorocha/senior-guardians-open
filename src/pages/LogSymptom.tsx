import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useImpersonation } from '@/hooks/useImpersonation';
import AppNav from '@/components/AppNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Activity, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const symptoms = [
    { id: 'headache', label: 'Headache', emoji: '🤕', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    { id: 'nausea', label: 'Nausea', emoji: '🤢', color: 'bg-green-100 text-green-700 border-green-200' },
    { id: 'fatigue', label: 'Fatigue', emoji: '🥱', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    { id: 'pain', label: 'Pain', emoji: '💥', color: 'bg-red-100 text-red-700 border-red-200' },
    { id: 'dizziness', label: 'Dizziness', emoji: '💫', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    { id: 'other', label: 'Other', emoji: '❔', color: 'bg-gray-100 text-gray-700 border-gray-200' },
];

const severities = [
    { id: 'mild', label: 'Mild', color: 'bg-green-100/50 hover:bg-green-100 border-green-200 text-green-800' },
    { id: 'moderate', label: 'Moderate', color: 'bg-yellow-100/50 hover:bg-yellow-100 border-yellow-200 text-yellow-800' },
    { id: 'severe', label: 'Severe', color: 'bg-red-100/50 hover:bg-red-100 border-red-200 text-red-800' },
];

const LogSymptom = () => {
    const navigate = useNavigate();
    const { effectiveUserId } = useImpersonation();
    const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);
    const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async () => {
        if (!effectiveUserId || !selectedSymptom || !selectedSeverity) return;

        setIsSubmitting(true);

        const symptomObj = symptoms.find(s => s.id === selectedSymptom);

        const { error } = await supabase
            .from('health_logs')
            .insert({
                user_id: effectiveUserId,
                category: 'symptom',
                details: `Reported ${symptomObj?.label} (${selectedSeverity} severity)`,
                tag: selectedSymptom
            });

        setIsSubmitting(false);

        if (error) {
            toast.error('Failed to log symptom. Please try again.');
        } else {
            setIsSuccess(true);
            toast.success('Symptom logged successfully');
            setTimeout(() => {
                navigate('/dashboard');
            }, 2000);
        }
    };

    if (isSuccess) {
        return (
            <main className="container max-w-2xl py-6 pb-24 px-4 bg-background min-h-screen flex flex-col items-center justify-center">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                    <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="h-12 w-12 text-green-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-foreground mb-2">Saved!</h2>
                    <p className="text-senior-lg text-muted-foreground">Your symptom has been securely logged.</p>
                </motion.div>
            </main>
        );
    }

    return (
        <>
            <AppNav />
            <main className="container max-w-2xl py-6 pb-32 px-4 bg-background min-h-screen">
                {/* Header */}
                <header className="flex items-center gap-3 mb-8">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-12 w-12 shrink-0 bg-muted/30">
                        <ArrowLeft className="h-7 w-7 text-foreground" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 tracking-tight">
                            <Activity className="h-7 w-7 text-primary" />
                            Log Symptom
                        </h1>
                    </div>
                </header>

                <div className="space-y-8">
                    {/* Step 1: Select Symptom */}
                    <section>
                        <h2 className="text-senior-lg font-bold mb-4 px-1">1. What are you feeling?</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {symptoms.map((symptom) => {
                                const isSelected = selectedSymptom === symptom.id;
                                return (
                                    <Card
                                        key={symptom.id}
                                        className={`cursor-pointer transition-all border-2 shadow-sm ${isSelected ? `${symptom.color} ring-4 ring-primary/20 scale-[1.02]` : 'border-border hover:border-primary/50 bg-card'}`}
                                        onClick={() => setSelectedSymptom(symptom.id)}
                                    >
                                        <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center h-28">
                                            <span className="text-4xl">{symptom.emoji}</span>
                                            <span className={`font-bold text-senior-base ${isSelected ? 'text-inherit' : 'text-foreground'}`}>{symptom.label}</span>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </section>

                    {/* Step 2: Select Severity */}
                    <AnimatePresence>
                        {selectedSymptom && (
                            <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2 border-t border-border/50">
                                <h2 className="text-senior-lg font-bold mb-4 px-1">2. How severe is it?</h2>
                                <div className="flex flex-col gap-3">
                                    {severities.map((severity) => {
                                        const isSelected = selectedSeverity === severity.id;
                                        return (
                                            <Button
                                                key={severity.id}
                                                variant="outline"
                                                className={`h-16 text-lg font-bold border-2 justify-start px-6 ${isSelected ? `${severity.color} ring-2 ring-offset-2 ring-primary border-transparent` : 'border-border bg-card hover:bg-muted'}`}
                                                onClick={() => setSelectedSeverity(severity.id)}
                                            >
                                                <div className={`w-4 h-4 rounded-full mr-4 border-2 ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground bg-transparent'}`} />
                                                {severity.label}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </motion.section>
                        )}
                    </AnimatePresence>
                </div>

                {/* Submit Button (Fixed Bottom) */}
                <AnimatePresence>
                    {selectedSymptom && selectedSeverity && (
                        <motion.div
                            initial={{ y: 100 }}
                            animate={{ y: 0 }}
                            className="fixed bottom-[88px] left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pointer-events-none z-40"
                        >
                            <div className="container max-w-2xl mx-auto pointer-events-auto">
                                <Button
                                    size="lg"
                                    className="w-full h-16 text-senior-lg font-bold shadow-xl rounded-2xl"
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Symptom'}
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </>
    );
};

export default LogSymptom;
