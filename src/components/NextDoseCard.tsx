import React, { useMemo, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pill, Clock, ChevronRight, Phone, Bot, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface Medication {
    id: string;
    name: string;
    dosage: string;
    time_slots: string[];
}

interface NextDoseCardProps {
    medications: Medication[];
    todayMedStatus: Record<string, boolean | null>;
}

const NextDoseCard: React.FC<NextDoseCardProps> = ({ medications, todayMedStatus }) => {
    const [timeUntil, setTimeUntil] = useState<string>('');

    // Find the next upcoming dose
    const nextDose = useMemo(() => {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        let upcoming: { time: string; minutes: number; meds: Medication[] } | null = null;
        let missed: { time: string; minutes: number; meds: Medication[] } | null = null;

        const slotMap = new Map<string, Medication[]>();

        medications.forEach((med) => {
            // If todayMedStatus is true, it means it was taken today.
            if (todayMedStatus[med.id]) return;

            med.time_slots?.forEach((slotString) => {
                const slots = slotString.split(/[;,]/).map(s => s.trim()).filter(Boolean);
                slots.forEach(slot => {
                    if (!slotMap.has(slot)) slotMap.set(slot, []);
                    slotMap.get(slot)!.push(med);
                });
            });
        });

        const slots = Array.from(slotMap.keys()).sort();

        for (const slot of slots) {
            const [h, m] = slot.split(':').map(Number);
            const minutes = h * 60 + m;

            if (minutes >= currentMinutes) {
                if (!upcoming || minutes < upcoming.minutes) {
                    upcoming = { time: slot, minutes, meds: slotMap.get(slot)! };
                }
            } else {
                // Find the most recent missed dose
                if (!missed || minutes > missed.minutes) {
                    missed = { time: slot, minutes, meds: slotMap.get(slot)! };
                }
            }
        }

        return upcoming || missed; // Prefer upcoming, fallback to missed
    }, [medications, todayMedStatus]);

    // Update countdown
    useEffect(() => {
        if (!nextDose) return;

        const updateTimer = () => {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            let diff = nextDose.minutes - currentMinutes;

            if (diff < 0) {
                setTimeUntil('Overdue');
                return;
            }

            if (diff === 0) {
                setTimeUntil('Now');
                return;
            }

            const h = Math.floor(diff / 60);
            const m = diff % 60;

            if (h > 0) {
                setTimeUntil(`In ${h}h ${m}m`);
            } else {
                setTimeUntil(`In ${m} min`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000);
        return () => clearInterval(interval);
    }, [nextDose]);

    const isOverdue = timeUntil === 'Overdue';
    const checkInUrl = nextDose ? `/check-in?time=${nextDose.time}` : '/check-in?type=wellness';

    return (
        <Card className={`relative overflow-hidden border-0 shadow-soft-lg ${!nextDose ? 'bg-gradient-to-br from-emerald-600 to-emerald-500 text-white' : isOverdue ? 'bg-destructive/10 border-2 border-destructive/20' : 'bg-gradient-to-br from-primary/90 to-primary/80 text-primary-foreground'}`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                {nextDose ? (
                    <Pill className={`h-32 w-32 ${isOverdue ? 'text-destructive' : 'text-primary-foreground'}`} />
                ) : (
                    <Bot className="h-32 w-32 text-white" />
                )}
            </div>

            <CardContent className="p-6 relative z-10 flex flex-col gap-4">
                {nextDose ? (
                    <div className="flex items-center gap-6">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner backdrop-blur-md ${isOverdue ? 'bg-destructive text-destructive-foreground' : 'bg-white/20'}`}>
                            <Clock className="h-8 w-8" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className={`text-senior-sm font-semibold uppercase tracking-wider mb-1 ${isOverdue ? 'text-destructive' : 'text-primary-foreground/80'}`}>
                                {isOverdue ? 'Missed Dose' : 'Next Dose'} • {nextDose.time}
                            </p>
                            <h2 className={`text-senior-2xl font-bold leading-tight mb-1 truncate ${isOverdue ? 'text-foreground' : 'text-white'}`}>
                                {timeUntil}
                            </h2>
                            <p className={`text-senior-base font-medium truncate ${isOverdue ? 'text-muted-foreground' : 'text-primary-foreground/90'}`}>
                                {nextDose.meds.map(m => m.name).join(', ')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-6">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner backdrop-blur-md bg-white/20`}>
                            <CheckCircle className="h-8 w-8" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className={`text-senior-xl font-bold leading-tight mb-1 text-white`}>
                                All caught up!
                            </h2>
                            <p className={`text-senior-base font-medium text-white/90`}>
                                No upcoming medications today.
                            </p>
                        </div>
                    </div>
                )}

                <div className="pt-2 border-t border-black/10">
                    <Link to={checkInUrl}>
                        <Button
                            className={`w-full h-14 text-senior-base font-bold shadow-lg transition-transform hover:scale-[1.02] ${isOverdue ? 'bg-destructive text-white hover:bg-destructive/90' : 'bg-white text-primary hover:bg-white/90'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="relative flex items-center justify-center">
                                    <Phone className="h-5 w-5" />
                                    <div className="absolute inset-0 rounded-full border border-current animate-ping opacity-50" />
                                </div>
                                Simulate Clara AI Call
                            </div>
                        </Button>
                    </Link>
                    <p className="text-center text-[11px] font-medium mt-3 opacity-60 uppercase tracking-wider">
                        Guardian View · Triggers AI Simulation
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};

export default NextDoseCard;
