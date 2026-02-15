
# Criar Página de Teste TTS

## Objetivo

Criar uma página isolada `/tts-test` para testar apenas a conversão de texto em áudio, sem depender do fluxo completo de check-in. Isso vai ajudar a identificar se o problema é na API TTS, na conversão base64, ou no playback.

## O que será criado

### 1. Nova edge function `tts-test/index.ts`

Uma função simplificada que recebe apenas texto e retorna o áudio base64. Chama somente o TTS (Lightning v3.1), sem STT nem LLM. Também retornará metadados do áudio (tamanho em bytes, primeiros bytes do header) para debug.

### 2. Nova página `src/pages/TtsTest.tsx`

Página simples com:
- Campo de texto para digitar a frase
- Botão "Gerar Áudio"
- Painel de debug mostrando:
  - Tamanho do base64 recebido
  - Primeiros bytes do WAV header (RIFF signature, sample rate, bits per sample)
  - Status de cada etapa do playback
- Três métodos de playback lado a lado para comparar:
  1. **Método A** -- `<audio>` tag com data URL (`data:audio/wav;base64,...`)
  2. **Método B** -- `<audio>` tag com Blob URL
  3. **Método C** -- Manual PCM decode (o método atual)
- Cada método mostra se funcionou ou o erro

### 3. Rota em `src/App.tsx`

Adicionar rota `/tts-test` (sem proteção, para facilitar o teste).

## Detalhes Técnicos

### Edge function `tts-test`

```
POST /tts-test
Body: { "text": "Olá, como você está?" }
Response: { 
  "audioBase64": "...", 
  "audioSizeBytes": 48044,
  "headerBytes": "52494646..." (primeiros 44 bytes em hex)
}
```

### Página de teste

A página testará os 3 métodos de playback e mostrará logs visuais na tela para cada um, facilitando o diagnóstico do problema sem precisar abrir o console.
