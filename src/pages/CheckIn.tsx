import { useState, useEffect, useRef } from 'react';
import { AtomsClient } from 'atoms-client-sdk';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Phone, PhoneOff, PhoneIncoming, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type CallState = 'incoming' | 'active' | 'summary';
type Mood = 'happy' | 'neutral' | 'confused' | 'distressed';

const moodOptions: { value: Mood; emoji: string; label: string }[] = [
  { value: 'happy', emoji: '😊', label: 'Happy' },
  { value: 'neutral', emoji: '😐', label: 'Neutral' },
  { value: 'confused', emoji: '😕', label: 'Confused' },
  { value: 'distressed', emoji: '😟', label: 'Distressed' },
];

const CheckIn = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [callState, setCallState] = useState<CallState>('incoming');
  const [callStart, setCallStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [medications, setMedications] = useState<any[]>([]);
  const [responses, setResponses] = useState<Record<string, { taken: boolean; issues: string }>>({});
  const [mood, setMood] = useState<Mood>('neutral');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const atomsClientRef = useRef<AtomsClient | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('medications').select('*').eq('user_id', user.id).eq('active', true).then(({ data }) => {
      setMedications(data || []);
      const init: Record<string, { taken: boolean; issues: string }> = {};
      data?.forEach(m => { init[m.id] = { taken: false, issues: '' }; });
      setResponses(init);
    });
  }, [user]);

  useEffect(() => {
    if (callState === 'active' && callStart) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - callStart.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [callState, callStart]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleAnswer = async () => {
    setCallStart(new Date());
    setCallState('active');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/atoms-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ agentId: '6990ef650d1c87f0c9a42402' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start session');
      }

      const client = new AtomsClient();
      atomsClientRef.current = client;

      client.on('session_started', () => {
        console.log('Atoms voice session started');
      });

      client.on('session_ended', () => {
        console.log('Atoms voice session ended');
      });

      await client.startSession({
        accessToken: data.data.token,
        mode: 'webcall',
        host: data.data.host,
      });
    } catch (err: any) {
      console.error('Failed to start voice session:', err);
      toast({
        title: 'Erro ao iniciar chamada',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleEndCall = () => {
    clearInterval(timerRef.current);
    if (atomsClientRef.current) {
      atomsClientRef.current.stopSession();
      atomsClientRef.current = null;
    }
    setCallState('summary');
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { data: checkIn, error } = await supabase.from('check_ins').insert({
      user_id: user.id,
      scheduled_at: new Date().toISOString(),
      status: 'completed',
      started_at: callStart?.toISOString(),
      completed_at: new Date().toISOString(),
      summary: summary || null,
      mood_detected: mood,
      duration_seconds: elapsed,
    }).select().single();

    if (error || !checkIn) {
      toast({ title: 'Error saving check-in', description: error?.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    const responseRows = Object.entries(responses).map(([medId, resp]) => ({
      check_in_id: checkIn.id,
      medication_id: medId,
      taken: resp.taken,
      reported_issues: resp.issues || null,
    }));

    if (responseRows.length > 0) {
      await supabase.from('check_in_responses').insert(responseRows);
    }

    toast({ title: 'Check-in saved!' });
    setSaving(false);
    navigate('/dashboard');
  };

  // Audio visualizer bars
  const AudioVisualizer = () => (
    <div className="flex items-end gap-1 h-8">
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <div
          key={i}
          className="w-1 bg-primary-foreground/80 rounded-full animate-audio-bar"
          style={{ animationDelay: `${i * 0.1}s`, height: '8px' }}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-accent">
      <AnimatePresence mode="wait">
        {/* INCOMING CALL */}
        {callState === 'incoming' && (
          <motion.div key="incoming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center min-h-screen px-4 text-primary-foreground">
            <div className="relative mb-8">
              <div className="w-28 h-28 rounded-full bg-primary-foreground/20 flex items-center justify-center text-senior-3xl font-bold">
                C
              </div>
              <div className="absolute inset-0 w-28 h-28 rounded-full border-4 border-primary-foreground/30 animate-pulse-ring" />
              <div className="absolute inset-0 w-28 h-28 rounded-full border-4 border-primary-foreground/20 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
            </div>
            <h1 className="text-senior-2xl font-bold mb-1">Clara</h1>
            <p className="text-senior-base opacity-80 mb-1">GuardIAns Health Companion</p>
            <p className="text-senior-lg opacity-90 mb-12 flex items-center gap-2">
              <PhoneIncoming className="h-5 w-5" /> Incoming call...
            </p>
            <div className="flex gap-8">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="destructive"
                size="lg"
                className="w-16 h-16 rounded-full p-0"
              >
                <X className="h-7 w-7" />
              </Button>
              <Button
                onClick={handleAnswer}
                size="lg"
                className="w-16 h-16 rounded-full p-0 bg-success hover:bg-success/90 text-success-foreground"
              >
                <Phone className="h-7 w-7" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* ACTIVE CALL */}
        {callState === 'active' && (
          <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center min-h-screen px-4 text-primary-foreground">
            <div className="w-24 h-24 rounded-full bg-primary-foreground/20 flex items-center justify-center text-senior-3xl font-bold mb-4">
              C
            </div>
            <AudioVisualizer />
            <h2 className="text-senior-xl font-bold mt-4">Clara</h2>
            <p className="text-senior-2xl font-mono mt-2">{formatTime(elapsed)}</p>
            <p className="text-senior-sm opacity-70 mt-2 max-w-sm text-center">
              Voice check-in in progress. Speak naturally with Clara about your medications.
            </p>

            <Button
              onClick={handleEndCall}
              variant="destructive"
              size="lg"
              className="w-16 h-16 rounded-full p-0 mt-12"
            >
              <PhoneOff className="h-7 w-7" />
            </Button>
          </motion.div>
        )}

        {/* CALL SUMMARY */}
        {callState === 'summary' && (
          <motion.div key="summary" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-background py-8 px-4">
            <div className="container max-w-lg space-y-6">
              <div className="text-center">
                <h1 className="text-senior-2xl font-bold text-foreground">Call Summary</h1>
                <p className="text-senior-base text-muted-foreground">Duration: {formatTime(elapsed)}</p>
              </div>

              <Card className="shadow-soft">
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2">
                    <Label className="text-senior-sm">Conversation Summary</Label>
                    <Textarea
                      value={summary}
                      onChange={e => setSummary(e.target.value)}
                      placeholder="What did you discuss with Clara?"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardContent className="space-y-4 pt-6">
                  <Label className="text-senior-sm font-semibold">Medications</Label>
                  {medications.map(med => (
                    <div key={med.id} className="border-b border-border pb-3 last:border-0 last:pb-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-senior-sm font-semibold">{med.name}</p>
                          <p className="text-sm text-muted-foreground">{med.dosage}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Taken</span>
                          <Switch
                            checked={responses[med.id]?.taken || false}
                            onCheckedChange={v => setResponses(r => ({ ...r, [med.id]: { ...r[med.id], taken: v } }))}
                          />
                        </div>
                      </div>
                      <Input
                        placeholder="Any issues?"
                        value={responses[med.id]?.issues || ''}
                        onChange={e => setResponses(r => ({ ...r, [med.id]: { ...r[med.id], issues: e.target.value } }))}
                        className="h-9 text-sm"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <Label className="text-senior-sm font-semibold mb-3 block">How are you feeling?</Label>
                  <div className="flex justify-center gap-4">
                    {moodOptions.map(m => (
                      <button
                        key={m.value}
                        onClick={() => setMood(m.value)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors ${mood === m.value ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-muted'}`}
                      >
                        <span className="text-2xl">{m.emoji}</span>
                        <span className="text-xs">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => navigate('/dashboard')} className="flex-1 h-12">
                  Discard
                </Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1 h-12 gap-2">
                  <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Check-in'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CheckIn;
