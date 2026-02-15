import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface MethodResult {
  status: "idle" | "playing" | "success" | "error";
  error?: string;
}

interface DebugInfo {
  base64Length: number;
  audioSizeBytes: number;
  headerBytes: string;
  riffSignature: string;
  sampleRate: number;
  bitsPerSample: number;
  numChannels: number;
}

const TtsTest = () => {
  const [text, setText] = useState("Olá, como você está hoje?");
  const [loading, setLoading] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [methodA, setMethodA] = useState<MethodResult>({ status: "idle" });
  const [methodB, setMethodB] = useState<MethodResult>({ status: "idle" });
  const [methodC, setMethodC] = useState<MethodResult>({ status: "idle" });
  const audioRefA = useRef<HTMLAudioElement>(null);
  const audioRefB = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const parseWavHeader = (base64: string) => {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const view = new DataView(bytes.buffer);
    const riffSignature = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    const numChannels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    return { riffSignature, numChannels, sampleRate, bitsPerSample };
  };

  const handleGenerate = async () => {
    setLoading(true);
    setAudioBase64(null);
    setDebugInfo(null);
    setLogs([]);
    setMethodA({ status: "idle" });
    setMethodB({ status: "idle" });
    setMethodC({ status: "idle" });
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);

    addLog("Chamando edge function tts-test...");

    try {
      const { data, error } = await supabase.functions.invoke("tts-test", {
        body: { text },
      });

      if (error) {
        addLog(`Erro na chamada: ${error.message}`);
        setLoading(false);
        return;
      }

      if (data.error) {
        addLog(`Erro do servidor: ${data.error} ${data.details || ""}`);
        setLoading(false);
        return;
      }

      const { audioBase64: ab, audioSizeBytes, headerBytes } = data;
      setAudioBase64(ab);
      addLog(`Base64 recebido: ${ab.length} chars`);
      addLog(`Tamanho do áudio: ${audioSizeBytes} bytes`);
      addLog(`Header hex: ${headerBytes}`);

      const wavInfo = parseWavHeader(ab);
      addLog(`RIFF: "${wavInfo.riffSignature}", Channels: ${wavInfo.numChannels}, Sample Rate: ${wavInfo.sampleRate}, Bits: ${wavInfo.bitsPerSample}`);

      setDebugInfo({
        base64Length: ab.length,
        audioSizeBytes,
        headerBytes,
        ...wavInfo,
      });
    } catch (err: any) {
      addLog(`Erro inesperado: ${err.message}`);
    }

    setLoading(false);
  };

  // Method A: <audio> with data URL
  const playMethodA = () => {
    if (!audioBase64 || !audioRefA.current) return;
    setMethodA({ status: "playing" });
    addLog("[A] Tentando data URL...");
    const dataUrl = `data:audio/wav;base64,${audioBase64}`;
    audioRefA.current.src = dataUrl;
    audioRefA.current.onended = () => {
      setMethodA({ status: "success" });
      addLog("[A] ✅ Playback concluído!");
    };
    audioRefA.current.onerror = (e) => {
      const err = audioRefA.current?.error;
      const msg = err ? `code=${err.code} message=${err.message}` : String(e);
      setMethodA({ status: "error", error: msg });
      addLog(`[A] ❌ Erro: ${msg}`);
    };
    audioRefA.current.play().catch((err) => {
      setMethodA({ status: "error", error: err.message });
      addLog(`[A] ❌ Play error: ${err.message}`);
    });
  };

  // Method B: <audio> with Blob URL
  const playMethodB = () => {
    if (!audioBase64 || !audioRefB.current) return;
    setMethodB({ status: "playing" });
    addLog("[B] Tentando Blob URL...");
    try {
      const binaryStr = atob(audioBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/wav" });
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      audioRefB.current.src = url;
      audioRefB.current.onended = () => {
        setMethodB({ status: "success" });
        addLog("[B] ✅ Playback concluído!");
      };
      audioRefB.current.onerror = (e) => {
        const err = audioRefB.current?.error;
        const msg = err ? `code=${err.code} message=${err.message}` : String(e);
        setMethodB({ status: "error", error: msg });
        addLog(`[B] ❌ Erro: ${msg}`);
      };
      audioRefB.current.play().catch((err) => {
        setMethodB({ status: "error", error: err.message });
        addLog(`[B] ❌ Play error: ${err.message}`);
      });
    } catch (err: any) {
      setMethodB({ status: "error", error: err.message });
      addLog(`[B] ❌ Exception: ${err.message}`);
    }
  };

  // Method C: Manual PCM decode
  const playMethodC = async () => {
    if (!audioBase64) return;
    setMethodC({ status: "playing" });
    addLog("[C] Tentando manual PCM decode...");
    try {
      const binaryStr = atob(audioBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const view = new DataView(bytes.buffer);
      const sampleRate = view.getUint32(24, true);
      const bitsPerSample = view.getUint16(34, true);
      const dataOffset = 44;
      const bytesPerSample = bitsPerSample / 8;
      const numSamples = (bytes.length - dataOffset) / bytesPerSample;

      addLog(`[C] sampleRate=${sampleRate}, bits=${bitsPerSample}, samples=${numSamples}`);

      const float32 = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        const sample = view.getInt16(dataOffset + i * 2, true);
        float32[i] = sample / 32768;
      }

      const playbackCtx = new AudioContext();
      const audioBuffer = playbackCtx.createBuffer(1, numSamples, sampleRate);
      audioBuffer.getChannelData(0).set(float32);
      const source = playbackCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(playbackCtx.destination);
      source.onended = () => {
        setMethodC({ status: "success" });
        addLog("[C] ✅ Playback concluído!");
        playbackCtx.close();
      };
      source.start(0);
    } catch (err: any) {
      setMethodC({ status: "error", error: err.message });
      addLog(`[C] ❌ Erro: ${err.message}`);
    }
  };

  const statusBadge = (result: MethodResult) => {
    const colors: Record<string, string> = {
      idle: "bg-muted text-muted-foreground",
      playing: "bg-primary/20 text-primary",
      success: "bg-green-500/20 text-green-700",
      error: "bg-destructive/20 text-destructive",
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-mono ${colors[result.status]}`}>
        {result.status}
        {result.error && `: ${result.error}`}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-foreground">TTS Test Page</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Gerar Áudio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite o texto para converter em áudio..."
            rows={3}
          />
          <Button onClick={handleGenerate} disabled={loading || !text.trim()}>
            {loading ? "Gerando..." : "Gerar Áudio"}
          </Button>
        </CardContent>
      </Card>

      {debugInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Debug Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xs space-y-1 text-muted-foreground">
              <p>Base64 length: {debugInfo.base64Length} chars</p>
              <p>Audio size: {debugInfo.audioSizeBytes} bytes</p>
              <p>RIFF signature: "{debugInfo.riffSignature}"</p>
              <p>Channels: {debugInfo.numChannels}</p>
              <p>Sample rate: {debugInfo.sampleRate} Hz</p>
              <p>Bits per sample: {debugInfo.bitsPerSample}</p>
              <p className="break-all">Header hex: {debugInfo.headerBytes}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {audioBase64 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Playback Methods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={playMethodA}>
                  A: Data URL
                </Button>
                {statusBadge(methodA)}
              </div>
              <audio ref={audioRefA} controls className="w-full h-8" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={playMethodB}>
                  B: Blob URL
                </Button>
                {statusBadge(methodB)}
              </div>
              <audio ref={audioRefB} controls className="w-full h-8" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={playMethodC}>
                  C: Manual PCM
                </Button>
                {statusBadge(methodC)}
              </div>
              <p className="text-xs text-muted-foreground">(Áudio via Web Audio API, sem controle visual)</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded p-3 font-mono text-xs max-h-60 overflow-y-auto space-y-0.5">
            {logs.length === 0 ? (
              <p className="text-muted-foreground">Nenhum log ainda...</p>
            ) : (
              logs.map((log, i) => <p key={i}>{log}</p>)
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TtsTest;
