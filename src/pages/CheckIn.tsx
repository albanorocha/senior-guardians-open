import { useState, useEffect, useRef, useCallback } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Phone, PhoneOff, PhoneIncoming, X, Save, Check, Loader2, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type CallState = 'incoming' | 'preparing' | 'active' | 'summary';
type Mood = 'happy' | 'neutral' | 'confused' | 'distressed';

interface TranscriptMessage {
  text: string;
  timestamp: number;
  sender: 'agent' | 'system';
}

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
  const [connecting, setConnecting] = useState(false);
  const [prepStep, setPrepStep] = useState<'profile' | 'context' | 'connecting' | 'done'>('profile');
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [isAgentTalking, setIsAgentTalking] = useState(false);
  const [preparedVariables, setPreparedVariables] = useState<{
    patientName: string;
    patientAge: number | string | null;
    medications: { name: string; dosage: string }[];
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const atomsClientRef = useRef<AtomsClient | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (atomsClientRef.current) {
        try { atomsClientRef.current.stopSession(); } catch {}
        atomsClientRef.current = null;
      }
    };
  }, []);

  // Auto-scroll transcripts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

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

  const handleEndCall = async () => {
    clearInterval(timerRef.current);
    if (atomsClientRef.current) {
      try {
        await atomsClientRef.current.stopSession();
      } catch (err) {
        console.error('Error stopping session:', err);
      }
      atomsClientRef.current = null;
    }
    setConnecting(false);
    setIsAgentTalking(false);

    // Pre-fill summary with transcript
    if (transcripts.length > 0) {
      const transcriptText = transcripts
        .map(t => {
          const time = new Date(t.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          return `[${time}] Clara: ${t.text}`;
        })
        .join('\n');
      setSummary(transcriptText);
    }

    setCallState('summary');
  };

  const handleAnswer = async () => {
    if (connecting) return;
    setConnecting(true);
    setPrepStep('profile');
    setCallState('preparing');
    setTranscripts([]);
    setIsAgentTalking(false);

    try {
      // Stop any previous session
      if (atomsClientRef.current) {
        try { atomsClientRef.current.stopSession(); } catch {}
        atomsClientRef.current = null;
      }

      // === PHASE 1: Prepare data ===

      // Fetch patient profile
      let patientName = 'Patient';
      let patientAge: number | null = null;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, age')
          .eq('id', user.id)
          .single();
        if (profile) {
          patientName = profile.full_name || 'Patient';
          patientAge = profile.age;
        }
      }

      // Format medications string
      let medicationsStr = 'No medications registered.';
      if (medications.length > 0) {
        medicationsStr = medications.map((med, i) => {
          const parts = [`${i + 1}. ${med.name} - ${med.dosage}, ${med.frequency}`];
          if (med.instructions) parts.push(`Instructions: ${med.instructions}`);
          return parts.join('. ');
        }).join('\n');
      }

      const now = new Date();
      const variables = {
        patient_name: patientName,
        patient_age: patientAge ?? 'unknown',
        medications: medicationsStr,
        current_date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        current_time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };

      setPreparedVariables({
        patientName: patientName,
        patientAge: patientAge,
        medications: medications.map(m => ({ name: m.name, dosage: m.dosage })),
      });

      console.log('[CheckIn] Variables prepared:', JSON.stringify(variables));

      // Save context FIRST via dedicated function
      setPrepStep('context');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const saveRes = await fetch(`${supabaseUrl}/functions/v1/atoms-save-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ variables, userId: user?.id }),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success) {
        throw new Error(saveData.error || 'Failed to save context');
      }
      console.log('[CheckIn] Context saved successfully');

      // === PHASE 2: Create call (data is already persisted) ===
      setPrepStep('connecting');
      setCallStart(new Date());

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
      console.log('[CheckIn] atoms-session response:', res.status);

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start session');
      }

      const client = new AtomsClient();
      atomsClientRef.current = client;

      client.on('session_started', () => {
        console.log('Atoms voice session started');
        setConnecting(false);
        setCallState('active');
      });

      client.on('session_ended', () => {
        console.log('Atoms voice session ended by agent');
        handleEndCall();
      });

      // Debug: log all events from SDK
      const originalEmit = (client as any).emit?.bind(client);
      if (originalEmit) {
        (client as any).emit = (event: string, ...args: any[]) => {
          console.log(`[Atoms SDK Event] "${event}"`, ...args);
          return originalEmit(event, ...args);
        };
      }

      client.on('transcript', (data: any) => {
        console.log('[CheckIn] Transcript event received:', JSON.stringify(data));
        const text = typeof data === 'string' ? data : data?.text || data?.transcript || data?.message || JSON.stringify(data);
        setTranscripts(prev => [...prev, {
          text,
          timestamp: data?.timestamp || Date.now(),
          sender: 'agent',
        }]);
      });

      // Alternative event names as fallback
      for (const eventName of ['message', 'agent_transcript', 'text', 'captions', 'caption']) {
        client.on(eventName as any, (data: any) => {
          console.log(`[CheckIn] Alternative event "${eventName}" received:`, JSON.stringify(data));
          const text = typeof data === 'string' ? data : data?.text || data?.transcript || data?.message || JSON.stringify(data);
          setTranscripts(prev => [...prev, {
            text,
            timestamp: data?.timestamp || Date.now(),
            sender: 'agent',
          }]);
        });
      }

      client.on('agent_start_talking', () => {
        console.log('[CheckIn] agent_start_talking');
        setIsAgentTalking(true);
      });
      client.on('agent_stop_talking', () => {
        console.log('[CheckIn] agent_stop_talking');
        setIsAgentTalking(false);
      });

      await client.startSession({
        accessToken: data.data.token,
        mode: 'webcall',
        host: data.data.host,
      });
    } catch (err: any) {
      console.error('Failed to start voice session:', err);
      setConnecting(false);
      setCallState('incoming');
      toast({
        title: 'Failed to start call',
        description: err.message,
        variant: 'destructive',
      });
    }
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

  const PrepStep = ({ label, done, active }: { label: string; done: boolean; active: boolean }) => (
    <div className={`flex items-center gap-3 text-primary-foreground transition-opacity ${!done && !active ? 'opacity-40' : 'opacity-100'}`}>
      {done ? (
        <Check className="h-5 w-5 text-green-300" />
      ) : active ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <div className="h-5 w-5 rounded-full border-2 border-primary-foreground/40" />
      )}
      <span className="text-senior-base">{label}</span>
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
                disabled={connecting}
                size="lg"
                className="w-16 h-16 rounded-full p-0 bg-success hover:bg-success/90 text-success-foreground disabled:opacity-50"
              >
                <Phone className="h-7 w-7" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* PREPARING */}
        {callState === 'preparing' && (
          <motion.div key="preparing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center min-h-screen px-4 text-primary-foreground">
            <div className="relative mb-8">
              <div className="w-28 h-28 rounded-full bg-primary-foreground/20 flex items-center justify-center text-senior-3xl font-bold">
                C
              </div>
              <div className="absolute inset-0 w-28 h-28 rounded-full border-4 border-primary-foreground/30 animate-spin" style={{ borderTopColor: 'transparent', animationDuration: '1.5s' }} />
            </div>
            <h1 className="text-senior-2xl font-bold mb-6">Preparing...</h1>
            <div className="space-y-4 w-full max-w-xs">
              <PrepStep label="Loading profile" done={prepStep !== 'profile'} active={prepStep === 'profile'} />
              <PrepStep label="Sending data" done={prepStep === 'connecting' || prepStep === 'done'} active={prepStep === 'context'} />
              <PrepStep label="Connecting to Clara" done={prepStep === 'done'} active={prepStep === 'connecting'} />
            </div>

            {/* Patient data card */}
            {preparedVariables && prepStep !== 'profile' && (
              <div className="w-full max-w-xs mt-6 rounded-xl bg-primary-foreground/10 backdrop-blur-sm p-4 space-y-3">
                <h3 className="text-senior-sm font-semibold">Patient data</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="opacity-60">Name</span>
                    <span className="font-medium">{preparedVariables.patientName}</span>
                  </div>
                  {preparedVariables.patientAge && preparedVariables.patientAge !== 'unknown' && (
                    <div className="flex justify-between">
                      <span className="opacity-60">Age</span>
                      <span className="font-medium">{preparedVariables.patientAge} years</span>
                    </div>
                  )}
                  {preparedVariables.medications.length > 0 && (
                    <div>
                      <span className="opacity-60">Medications</span>
                      <ol className="mt-1 space-y-0.5 list-decimal list-inside">
                        {preparedVariables.medications.map((med, i) => (
                          <li key={i} className="text-xs">
                            <span className="font-medium">{med.name}</span> — {med.dosage}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t border-primary-foreground/20">
                  {prepStep === 'context' ? (
                    <span className="flex items-center gap-2 text-xs opacity-70">
                      <Loader2 className="h-3 w-3 animate-spin" /> Sending to Clara...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-xs text-green-300">
                      <Check className="h-3 w-3" /> Clara has access to this data
                    </span>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ACTIVE CALL */}
        {callState === 'active' && (
          <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center min-h-screen px-4 pt-8 pb-4 text-primary-foreground">
            <div className="relative w-20 h-20 rounded-full bg-primary-foreground/20 flex items-center justify-center text-senior-2xl font-bold mb-2">
              C
              {isAgentTalking && (
                <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-primary-foreground/50 animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-senior-lg font-bold">Clara</h2>
              {isAgentTalking && (
                <span className="flex items-center gap-1 text-sm opacity-80">
                  <Mic className="h-3 w-3" /> Speaking...
                </span>
              )}
            </div>
            {connecting ? (
              <p className="text-senior-base opacity-80 animate-pulse">Connecting...</p>
            ) : (
              <AudioVisualizer />
            )}
            <p className="text-senior-lg font-mono mt-1">{formatTime(elapsed)}</p>

            {/* Transcript panel */}
            <div className="w-full max-w-md flex-1 mt-4 mb-4 min-h-0">
              <div
                ref={scrollRef}
                className="h-[40vh] overflow-y-auto rounded-xl bg-primary-foreground/10 backdrop-blur-sm p-3 space-y-2"
              >
                {transcripts.length === 0 && (
                  <p className="text-sm opacity-50 text-center mt-8">
                    Transcript will appear here...
                  </p>
                )}
                {transcripts.map((t, i) => (
                  <div key={i} className="flex flex-col">
                    <div className="bg-primary-foreground/15 rounded-lg px-3 py-2 max-w-[90%]">
                      <p className="text-sm leading-relaxed">{t.text}</p>
                    </div>
                    <span className="text-[10px] opacity-40 mt-0.5 ml-1">
                      {new Date(t.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleEndCall}
              variant="destructive"
              size="lg"
              className="w-16 h-16 rounded-full p-0"
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
