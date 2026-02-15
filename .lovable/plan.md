

# Corrigir envio de audio e transcrição vazia no Check-In

## Problema Identificado

Os logs da edge function mostram que o audio chega ao servidor (39-68KB), mas o Pulse STT retorna transcrição vazia repetidamente. Existem dois problemas:

1. **Content-Type incorreto no STT**: O audio e gravado como `audio/webm;codecs=opus` pelo MediaRecorder, mas o edge function envia ao Pulse com `Content-Type: audio/webm`. O Pulse pode nao estar decodificando corretamente o container webm. A solução e enviar o Content-Type correto (`audio/webm;codecs=opus`) ou, melhor ainda, enviar o blob diretamente como `application/octet-stream` com o formato especificado como query parameter.

2. **Stale closure no `conversationHistory`**: Em `sendAudioToVoiceChat` (linha 465), `conversationHistory` captura o valor do estado no momento da criação do callback, não o valor atual. Isso pode causar contexto de conversa desatualizado.

## Solução

### 1. Melhorar compatibilidade do audio com Pulse STT

No edge function `voice-chat/index.ts`:
- Mudar o Content-Type para `application/octet-stream` que e mais universalmente aceito
- Adicionar query parameter `content_type=audio/webm` para informar o Pulse do formato real
- Alternativa: testar com `audio/webm;codecs=opus` como Content-Type

### 2. Corrigir stale closure

Em `sendAudioToVoiceChat` no `CheckIn.tsx`:
- Usar um ref para `conversationHistory` para sempre ter o valor mais recente
- Ou usar a forma funcional do setState para ler o valor atual

### 3. Aumentar robustez do VAD

- Reduzir `SILENCE_THRESHOLD` de 30 para 20 para capturar vozes mais baixas
- Aumentar `MIN_RECORDING_DURATION_MS` de 800 para 1000 para garantir capturas mais substanciais

---

## Detalhes Tecnicos

### Arquivo: `supabase/functions/voice-chat/index.ts`

Alterar o envio ao Pulse STT para usar Content-Type mais preciso:

```typescript
const sttRes = await fetch('https://waves-api.smallest.ai/api/v1/pulse/get_text?model=pulse&language=en', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SMALLEST_AI_API_KEY}`,
    'Content-Type': 'audio/webm;codecs=opus',
  },
  body: audioBytes.buffer,
});
```

### Arquivo: `src/pages/CheckIn.tsx`

**Correcao 1 — Ref para conversationHistory**:
Adicionar um `conversationHistoryRef` que se mantém sincronizado com o state, e usar o ref dentro de `sendAudioToVoiceChat`:

```typescript
const conversationHistoryRef = useRef(conversationHistory);
useEffect(() => { conversationHistoryRef.current = conversationHistory; }, [conversationHistory]);
```

Depois em `sendAudioToVoiceChat`:
```typescript
body: JSON.stringify({
  audioBase64,
  history: conversationHistoryRef.current, // usar ref em vez de state
  patientContext,
}),
```

**Correcao 2 — Ajuste VAD**:
```typescript
const SILENCE_THRESHOLD = 20;      // era 30
const MIN_RECORDING_DURATION_MS = 1000; // era 800
```

