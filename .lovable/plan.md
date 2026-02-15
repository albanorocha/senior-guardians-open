

# Corrigir TTS: Usar `output_format: "mp3"` em vez de PCM

## Problema Identificado

A documentacao oficial da API Lightning v3.1 mostra que o parametro correto para controlar o formato de saida e `output_format`, com as opcoes: `pcm` (padrao), `mp3`, `wav`, `mulaw`.

O codigo atual usa `add_wav_header: true`, que e um parametro do modelo Lightning antigo (deprecated). O Lightning v3.1 ignora esse parametro e retorna PCM cru (sem header), o que explica por que todos os metodos de playback falham.

## Solucao

Usar `output_format: "mp3"` -- o formato MP3 e suportado nativamente por todos os browsers no elemento `<audio>`, sem necessidade de parsing manual de headers.

## Alteracoes

### 1. Edge function `supabase/functions/tts-test/index.ts`

- Remover `add_wav_header: true`
- Adicionar `output_format: "mp3"`
- Atualizar o Content-Type do debug para refletir MP3

### 2. Edge function `supabase/functions/voice-chat/index.ts`

- Mesma correcao: remover `add_wav_header: true`, adicionar `output_format: "mp3"`

### 3. Pagina de teste `src/pages/TtsTest.tsx`

- Atualizar o Metodo A para usar `data:audio/mp3;base64,...` em vez de `audio/wav`
- Atualizar o Metodo B para criar Blob com tipo `audio/mp3`
- Simplificar o Metodo C (PCM manual) -- manter como fallback mas nao sera mais necessario

### 4. Pagina de check-in `src/pages/CheckIn.tsx`

- Simplificar `playAudio` para usar `<audio>` com Blob URL de MP3, removendo toda a logica de parsing manual de WAV/PCM que nao sera mais necessaria

## Por que isso resolve

- MP3 e universalmente suportado em todos os browsers
- Nao precisa de parsing manual de headers
- O `<audio>` element toca MP3 diretamente sem nenhum workaround
- A API ja suporta esse formato nativamente

