import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Phone, PhoneOff, PhoneIncoming, X, Save, Loader2, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type CallState = 'incoming' | 'preparing' | 'active' | 'summary';
type Mood = 'happy' | 'neutral' | 'confused' | 'distressed';

interface TranscriptMessage {
  text: string;
  timestamp: number;
  sender: 'user' | 'agent';
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
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [patientContext, setPatientContext] = useState<{
    patientName: string;
    patientAge: number | string | null;
    medications: { name: string; dosage: string }[];
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Auto-scroll transcripts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  // Load medications
  useEffect(() => {
    if (!user) return;
    supabase.from('medications').select('*').eq('user_id', user.id).eq('active', true).then(({ data }) => {
      setMedications(data || []);
      const init: Record<string, { taken: boolean; issues: string }> = {};
      data?.forEach(m => { init[m.id] = { taken: false, issues: '' }; });
      setResponses(init);
    });
  }, [user]);

  // Timer
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

  const handleEndCall = () => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    setIsRecording(false);
    setIsPlaying(false);

    // Pre-fill summary with transcript
    if (transcripts.length > 0) {
      const transcriptText = transcripts
        .map(t => {
          const time = new Date(t.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const label = t.sender === 'user' ? 'You' : 'Clara';
          return `[${time}] ${label}: ${t.text}`;
        })
        .join('\n');
      setSummary(transcriptText);
    }

    setCallState('summary');
  };

  const handleAnswer = async () => {
    setCallState('preparing');
    setTranscripts([]);
    setConversationHistory([]);

    try {
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

      const ctx = {
        patientName,
        patientAge,
        medications: medications.map(m => ({ name: m.name, dosage: m.dosage })),
      };
      setPatientContext(ctx);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      setCallStart(new Date());
      setCallState('active');

      // Send an initial greeting by calling the LLM with a "start" message
      await sendToVoiceChat('Hello Clara, I\'m ready for my check-in.', ctx);
    } catch (err: any) {
      console.error('Failed to start voice session:', err);
      setCallState('incoming');
      toast({
        title: 'Failed to start call',
        description: err.message?.includes('Permission') ? 'Microphone access is required.' : err.message,
        variant: 'destructive',
      });
    }
  };

  const sendToVoiceChat = async (text: string, ctx?: typeof patientContext) => {
    const context = ctx || patientContext;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Add user message to transcript & history
    const newUserMsg = { role: 'user' as const, content: text };
    const updatedHistory = [...conversationHistory, newUserMsg];
    setConversationHistory(updatedHistory);
    setTranscripts(prev => [...prev, { text, timestamp: Date.now(), sender: 'user' }]);

    setIsProcessing(true);

    try {
      // For the initial greeting, we send text directly instead of audio
      const res = await fetch(`${supabaseUrl}/functions/v1/voice-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          audioBase64: null,
          textInput: text,
          history: updatedHistory,
          patientContext: context,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Voice chat failed');
      }

      handleVoiceResponse(data);
    } catch (err: any) {
      console.error('[CheckIn] Voice chat error:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const sendAudioToVoiceChat = async (audioBlob: Blob) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    setIsProcessing(true);

    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const audioBase64 = btoa(binary);

      const res = await fetch(`${supabaseUrl}/functions/v1/voice-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          audioBase64,
          history: conversationHistory,
          patientContext,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Voice chat failed');
      }

      // Add user transcript
      if (data.userText) {
        setTranscripts(prev => [...prev, { text: data.userText, timestamp: Date.now(), sender: 'user' }]);
        setConversationHistory(prev => [...prev, { role: 'user', content: data.userText }]);
      }

      handleVoiceResponse(data);
    } catch (err: any) {
      console.error('[CheckIn] Voice chat error:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceResponse = (data: { userText?: string; agentText: string; audioBase64?: string | null }) => {
    // Add agent transcript
    setTranscripts(prev => [...prev, { text: data.agentText, timestamp: Date.now(), sender: 'agent' }]);
    setConversationHistory(prev => [...prev, { role: 'assistant', content: data.agentText }]);

    // Play audio if available
    if (data.audioBase64) {
      playAudio(data.audioBase64);
    }
  };

  const playAudio = (base64: string) => {
    setIsPlaying(true);
    const audio = new Audio(`data:audio/wav;base64,${base64}`);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    audio.play().catch(() => setIsPlaying(false));
  };

  const startRecording = () => {
    if (!mediaRecorderRef.current || isProcessing || isPlaying) return;

    chunksRef.current = [];
    
    // Create a fresh recorder each time since stop() makes it inactive
    const stream = mediaRecorderRef.current.stream;
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    mediaRecorderRef.current = recorder;
    
    const recordStartTime = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const duration = Date.now() - recordStartTime;
      console.log('[CheckIn] Recording duration:', duration, 'ms, chunks:', chunksRef.current.length);
      
      if (duration < 500) {
        toast({ title: 'Too short', description: 'Hold the button longer while speaking.', variant: 'destructive' });
        return;
      }
      
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      console.log('[CheckIn] Audio blob size:', blob.size, 'bytes');
      if (blob.size > 100) {
        sendAudioToVoiceChat(blob);
      }
    };

    recorder.start(250); // collect data every 250ms
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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

        {/* PREPARING */}
        {callState === 'preparing' && (
          <motion.div key="preparing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center min-h-screen px-4 text-primary-foreground">
            <div className="relative mb-8">
              <div className="w-28 h-28 rounded-full bg-primary-foreground/20 flex items-center justify-center text-senior-3xl font-bold">
                C
              </div>
              <div className="absolute inset-0 w-28 h-28 rounded-full border-4 border-primary-foreground/30 animate-spin" style={{ borderTopColor: 'transparent', animationDuration: '1.5s' }} />
            </div>
            <h1 className="text-senior-2xl font-bold mb-6">Connecting...</h1>
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-senior-base">Setting up your session</span>
            </div>
          </motion.div>
        )}

        {/* ACTIVE CALL */}
        {callState === 'active' && (
          <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center min-h-screen px-4 pt-8 pb-4 text-primary-foreground">
            <div className="relative w-20 h-20 rounded-full bg-primary-foreground/20 flex items-center justify-center text-senior-2xl font-bold mb-2">
              C
              {isPlaying && (
                <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-primary-foreground/50 animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-senior-lg font-bold">Clara</h2>
              {isPlaying && (
                <span className="flex items-center gap-1 text-sm opacity-80">
                  <Mic className="h-3 w-3" /> Speaking...
                </span>
              )}
              {isProcessing && (
                <span className="flex items-center gap-1 text-sm opacity-80">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
                </span>
              )}
            </div>
            {isPlaying ? (
              <AudioVisualizer />
            ) : (
              <div className="h-8" />
            )}
            <p className="text-senior-lg font-mono mt-1">{formatTime(elapsed)}</p>

            {/* Transcript panel */}
            <div className="w-full max-w-md flex-1 mt-4 mb-4 min-h-0">
              <div
                ref={scrollRef}
                className="h-[35vh] overflow-y-auto rounded-xl bg-primary-foreground/10 backdrop-blur-sm p-3 space-y-2"
              >
                {transcripts.length === 0 && (
                  <p className="text-sm opacity-50 text-center mt-8">
                    Transcript will appear here...
                  </p>
                )}
                {transcripts.map((t, i) => (
                  <div key={i} className={`flex flex-col ${t.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`rounded-lg px-3 py-2 max-w-[90%] ${t.sender === 'user' ? 'bg-primary-foreground/25' : 'bg-primary-foreground/15'}`}>
                      <p className="text-xs opacity-60 mb-0.5">{t.sender === 'user' ? 'You' : 'Clara'}</p>
                      <p className="text-sm leading-relaxed">{t.text}</p>
                    </div>
                    <span className="text-[10px] opacity-40 mt-0.5 mx-1">
                      {new Date(t.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-6">
              {/* Hold to talk button */}
              <Button
                onPointerDown={startRecording}
                onPointerUp={stopRecording}
                onPointerLeave={stopRecording}
                disabled={isProcessing || isPlaying}
                size="lg"
                className={`w-20 h-20 rounded-full p-0 transition-all ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 scale-110'
                    : 'bg-primary-foreground/20 hover:bg-primary-foreground/30'
                } disabled:opacity-40`}
              >
                {isRecording ? (
                  <MicOff className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </Button>

              {/* End call */}
              <Button
                onClick={handleEndCall}
                variant="destructive"
                size="lg"
                className="w-16 h-16 rounded-full p-0"
              >
                <PhoneOff className="h-7 w-7" />
              </Button>
            </div>
            <p className="text-xs opacity-60 mt-2">
              {isRecording ? 'Release to send' : isProcessing ? 'Processing...' : isPlaying ? 'Clara is speaking...' : 'Hold to talk'}
            </p>
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
