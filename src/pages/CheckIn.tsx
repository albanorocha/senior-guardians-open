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
import { Phone, PhoneOff, PhoneIncoming, X, Save, Loader2, Mic, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type CallState = 'incoming' | 'active' | 'summary';
type Mood = 'happy' | 'neutral' | 'confused' | 'distressed';
type MicStatus = 'listening' | 'speaking' | 'processing' | 'clara-speaking';

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

const SILENCE_THRESHOLD = 20;
const SILENCE_TIMEOUT_MS = 2000;
const VAD_CHECK_INTERVAL_MS = 100;
const MIN_BLOB_SIZE = 5000;
const MIN_RECORDING_DURATION_MS = 1000;

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [micStatus, setMicStatus] = useState<MicStatus>('listening');
  const [conversationHistory, setConversationHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const conversationHistoryRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [textInput, setTextInput] = useState('');
  const [patientContext, setPatientContext] = useState<{
    patientName: string;
    patientAge: number | string | null;
    medications: { name: string; dosage: string }[];
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const silenceStartRef = useRef<number | null>(null);
  const isSpeakingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const isPlayingRef = useRef(false);
  const isProcessingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { conversationHistoryRef.current = conversationHistory; }, [conversationHistory]);

  // Full state reset function
  const resetCallState = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(vadIntervalRef.current);
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();

    mediaRecorderRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    
    isRecordingRef.current = false;
    isSpeakingRef.current = false;
    silenceStartRef.current = null;

    setElapsed(0);
    setCallStart(null);
    setTranscripts([]);
    setConversationHistory([]);
    setIsProcessing(false);
    setIsPlaying(false);
    setMicStatus('listening');
    setTextInput('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => resetCallState();
  }, [resetCallState]);

  // Ringtone effect — synthesized phone ring using Web Audio API
  useEffect(() => {
    if (callState !== 'incoming') return;

    let audioCtx: AudioContext | null = null;
    let ringInterval: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const startRingtone = () => {
      audioCtx = new AudioContext();
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0;
      gainNode.connect(audioCtx.destination);

      const osc1 = audioCtx.createOscillator();
      osc1.frequency.value = 440;
      osc1.type = 'sine';
      osc1.connect(gainNode);
      osc1.start();

      const osc2 = audioCtx.createOscillator();
      osc2.frequency.value = 480;
      osc2.type = 'sine';
      osc2.connect(gainNode);
      osc2.start();

      let ringing = false;
      const toggle = () => {
        if (stopped) return;
        ringing = !ringing;
        gainNode.gain.setTargetAtTime(ringing ? 0.15 : 0, audioCtx!.currentTime, 0.02);
      };

      // Start with ring on
      toggle();
      // Pattern: 1s ring, 2s silence (toggle every 1s on, 2s off)
      let count = 0;
      ringInterval = setInterval(() => {
        count++;
        if (count % 3 === 1) {
          // ring on
          gainNode.gain.setTargetAtTime(0.15, audioCtx!.currentTime, 0.02);
        } else if (count % 3 === 2) {
          // ring off after 1s
          gainNode.gain.setTargetAtTime(0, audioCtx!.currentTime, 0.02);
        }
        // count % 3 === 0: still silent (2nd second of silence)
      }, 1000);
    };

    startRingtone();

    return () => {
      stopped = true;
      if (ringInterval) clearInterval(ringInterval);
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
    };
  }, [callState]);

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

  // Update micStatus based on state — ensure VAD resumes after Clara speaks
  useEffect(() => {
    if (isPlaying) {
      setMicStatus('clara-speaking');
    } else if (isProcessing) {
      setMicStatus('processing');
    } else {
      setMicStatus('listening');
    }
  }, [isPlaying, isProcessing]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    // Pre-fill summary with transcript before reset
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

    // Clean up all refs and streams
    resetCallState();
    setCallState('summary');
  };

  // --- VAD: Start/stop recording based on voice activity ---
  const startVADRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || isRecordingRef.current) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    mediaRecorderRef.current = recorder;
    const recordStartTime = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const duration = Date.now() - recordStartTime;
      if (duration < MIN_RECORDING_DURATION_MS || chunksRef.current.length === 0) return;

      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      if (blob.size > MIN_BLOB_SIZE) {
        sendAudioToVoiceChat(blob);
      }
    };

    recorder.start(250);
    isRecordingRef.current = true;
    setMicStatus('speaking');
  }, []);

  const stopVADRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    isRecordingRef.current = false;
  }, []);

  const startVADMonitoring = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    vadIntervalRef.current = setInterval(() => {
      // Don't process while Clara is speaking or processing
      if (isPlayingRef.current || isProcessingRef.current) {
        // If we were recording, stop
        if (isRecordingRef.current) {
          stopVADRecording();
        }
        silenceStartRef.current = null;
        isSpeakingRef.current = false;
        return;
      }

      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;

      if (avg > SILENCE_THRESHOLD) {
        // Voice detected
        silenceStartRef.current = null;
        if (!isSpeakingRef.current) {
          isSpeakingRef.current = true;
          startVADRecording();
        }
      } else {
        // Silence
        if (isSpeakingRef.current) {
          if (!silenceStartRef.current) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current > SILENCE_TIMEOUT_MS) {
            // Silence long enough — send recording
            isSpeakingRef.current = false;
            silenceStartRef.current = null;
            stopVADRecording();
          }
        } else {
          // Not speaking, show listening
          if (!isPlayingRef.current && !isProcessingRef.current) {
            setMicStatus('listening');
          }
        }
      }
    }, VAD_CHECK_INTERVAL_MS);
  }, [startVADRecording, stopVADRecording]);

  const [connecting, setConnecting] = useState(false);

  const handleAnswer = async () => {
    // Limpar qualquer chamada anterior antes de iniciar nova
    resetCallState();
    setConnecting(true);
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

      // --- AUDIO UNLOCK: Create and resume AudioContext during user gesture ---
      const unlockCtx = new AudioContext();
      await unlockCtx.resume();
      unlockCtx.close();

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up AudioContext + AnalyserNode for VAD
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      setCallStart(new Date());
      setCallState('active');

      // Start VAD monitoring
      startVADMonitoring();

      // Send an initial greeting — pass empty history to avoid stale state race condition
      await sendToVoiceChat('Hello Clara, I\'m ready for my check-in.', ctx, []);
    } catch (err: any) {
      console.error('Failed to start voice session:', err);
      toast({
        title: 'Failed to start call',
        description: err.message?.includes('Permission') ? 'Microphone access is required.' : err.message,
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  };

  const sendToVoiceChat = async (text: string, ctx?: typeof patientContext, historyOverride?: { role: 'user' | 'assistant'; content: string }[]) => {
    const context = ctx || patientContext;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Add user message to transcript & history — use override if provided (avoids stale state)
    const history = historyOverride ?? conversationHistory;
    const newUserMsg = { role: 'user' as const, content: text };
    const updatedHistory = [...history, newUserMsg];
    setConversationHistory(updatedHistory);
    setTranscripts(prev => [...prev, { text, timestamp: Date.now(), sender: 'user' }]);

    setIsProcessing(true);

    try {
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
          history: conversationHistoryRef.current,
          patientContext,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Silently ignore empty transcription errors (background noise)
        const errMsg = data.error || 'Voice chat failed';
        if (errMsg.includes('Could not transcribe') || errMsg.includes('No speech') || errMsg.includes('empty')) {
          console.log('[CheckIn] Empty transcription, resuming listening');
          setIsProcessing(false);
          return;
        }
        throw new Error(errMsg);
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

  const handleVoiceResponse = (data: { userText?: string; agentText: string; audioBase64?: string | null; empty?: boolean }) => {
    // Skip empty transcriptions (background noise)
    if (data.empty || !data.agentText) {
      console.log('[CheckIn] Empty response, resuming listening');
      return;
    }

    // Add agent transcript
    setTranscripts(prev => [...prev, { text: data.agentText, timestamp: Date.now(), sender: 'agent' }]);
    setConversationHistory(prev => [...prev, { role: 'assistant', content: data.agentText }]);

    // Play audio if available
    if (data.audioBase64) {
      playAudio(data.audioBase64);
    }
  };

  const playAudio = async (base64: string) => {
    setIsPlaying(true);
    try {
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        console.error('[CheckIn] Audio playback error');
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (err) {
      console.error('[CheckIn] Audio playback error:', err);
      setIsPlaying(false);
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

  // Mic status label
  const micStatusLabel = {
    'listening': 'Listening...',
    'speaking': 'You\'re speaking...',
    'processing': 'Processing...',
    'clara-speaking': 'Clara is speaking...',
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
                disabled={connecting}
                className="w-16 h-16 rounded-full p-0 bg-success hover:bg-success/90 text-success-foreground"
              >
                {connecting ? <Loader2 className="h-7 w-7 animate-spin" /> : <Phone className="h-7 w-7" />}
              </Button>
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
            </div>
            {isPlaying ? (
              <AudioVisualizer />
            ) : (
              <div className="h-8" />
            )}
            <p className="text-senior-lg font-mono mt-1">{formatTime(elapsed)}</p>

            {/* Chat panel with text input */}
            <div className="w-full max-w-md flex-1 mt-4 mb-4 min-h-0 flex flex-col">
              <div
                ref={scrollRef}
                className="flex-1 h-[30vh] overflow-y-auto rounded-t-xl bg-primary-foreground/10 backdrop-blur-sm p-3 space-y-2"
              >
                {transcripts.length === 0 && (
                  <p className="text-sm opacity-50 text-center mt-8">
                    Chat will appear here...
                  </p>
                )}
                {transcripts.map((t, i) => (
                  <div key={i} className={`flex flex-col ${t.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-3 py-2 max-w-[90%] ${
                      t.sender === 'user'
                        ? 'bg-white/25 rounded-lg rounded-br-none'
                        : 'bg-accent/30 rounded-lg rounded-bl-none border-l-2 border-secondary'
                    }`}>
                      {t.sender === 'agent' && (
                        <p className="text-xs font-semibold text-secondary mb-0.5">Clara</p>
                      )}
                      {t.sender === 'user' && (
                        <p className="text-xs opacity-60 mb-0.5">You</p>
                      )}
                      <p className="text-sm leading-relaxed">{t.text}</p>
                    </div>
                    <span className="text-[10px] opacity-40 mt-0.5 mx-1">
                      {new Date(t.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
              {/* Text input bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!textInput.trim() || isProcessing) return;
                  const msg = textInput.trim();
                  setTextInput('');
                  sendToVoiceChat(msg);
                }}
                className="flex gap-2 rounded-b-xl bg-primary-foreground/15 backdrop-blur-sm p-2"
              >
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type a message..."
                  disabled={isProcessing || isPlaying}
                  className="flex-1 bg-primary-foreground/20 border-0 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:ring-primary-foreground/30"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!textInput.trim() || isProcessing || isPlaying}
                  className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground shrink-0"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>

            {/* Controls: Mic status indicator + End call */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-6">
                {/* Mic status indicator */}
                <div className="relative flex items-center justify-center">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                    micStatus === 'speaking'
                      ? 'bg-secondary'
                      : micStatus === 'listening'
                      ? 'bg-secondary/80'
                      : micStatus === 'clara-speaking'
                      ? 'bg-accent/60'
                      : 'bg-primary-foreground/10'
                  }`}>
                    {micStatus === 'processing' ? (
                      <Loader2 className="h-7 w-7 animate-spin" />
                    ) : (
                      <Mic className="h-7 w-7" />
                    )}
                  </div>
                  {micStatus === 'speaking' && (
                    <>
                      <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-secondary/60 animate-ping" />
                      <div className="absolute -inset-2 w-20 h-20 rounded-full border border-secondary/30 animate-pulse" />
                    </>
                  )}
                  {micStatus === 'listening' && (
                    <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-primary-foreground/30 animate-pulse" />
                  )}
                </div>

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
              <p className="text-xs opacity-60">
                {micStatusLabel[micStatus]}
              </p>
            </div>
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
              <Button
                variant="outline"
                onClick={() => { resetCallState(); setCallState('incoming'); }}
                className="w-full h-12 gap-2"
              >
                <Phone className="h-4 w-4" /> New Call
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CheckIn;
