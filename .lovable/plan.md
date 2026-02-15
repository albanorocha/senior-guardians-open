

# Replace Atoms with Custom Voice Pipeline (Pulse STT + LLM + Lightning v3.1 TTS)

## Overview

Remove the Atoms SDK dependency entirely and build a custom turn-based voice conversation using three APIs orchestrated through a single edge function:

1. **STT**: Smallest AI Pulse (`POST /api/v1/pulse/get_text`) - transcribes user speech
2. **LLM**: Lovable AI (e.g., `openai/gpt-5-mini`) - generates Clara's conversational response
3. **TTS**: Smallest AI Lightning v3.1 (`POST /api/v1/lightning-v3.1/get_speech`) - converts response to audio

## How it works

The user presses and holds a "Talk" button (or uses voice activity detection). When released, the recorded audio is sent to an edge function that runs the full STT -> LLM -> TTS pipeline and returns both the transcript and audio to play.

```text
Browser (mic)
  |-- records audio -->
  |                     Edge Function: voice-chat
  |                       1. POST audio to Pulse STT -> user text
  |                       2. Send [system prompt + history + user text] to LLM -> response text
  |                       3. POST response text to Lightning v3.1 TTS -> audio bytes
  |                     Returns: { userText, agentText, audio (base64) }
  |<-- plays audio --|
```

## Changes

### 1. New edge function: `supabase/functions/voice-chat/index.ts`

Single endpoint that:
- Receives audio as a base64 string + conversation history + patient context
- Calls Pulse STT to transcribe the audio
- Builds a prompt with Clara's personality, patient context (name, age, medications), and conversation history
- Calls Lovable AI LLM for the response
- Calls Lightning v3.1 TTS with a female voice to synthesize the response
- Returns JSON: `{ userText, agentText, audioBase64 }`

Uses `SMALLEST_AI_API_KEY` (already configured) and `LOVABLE_API_KEY` (already configured).

### 2. Update `supabase/config.toml`

Add `[functions.voice-chat]` with `verify_jwt = false`.

### 3. Rewrite `src/pages/CheckIn.tsx`

**Remove**: `AtomsClient` import, `atoms-client-sdk` dependency, all Atoms session/event code, `atoms-save-context` call, `atoms-session` call, `prepStep` states.

**Add**:
- `MediaRecorder` to capture mic audio when user holds the talk button
- `isRecording` state and a large "Hold to Talk" button during active call
- On release: encode audio to base64, POST to `voice-chat` edge function with conversation history and patient context
- On response: play audio via `AudioContext`, add both user and agent messages to transcript
- Keep existing: incoming call UI, preparing UI (simplified -- just "Connecting..."), active call UI with transcript, call summary

**Conversation history**: maintained as `Array<{role: 'user'|'assistant', content: string}>` in state, sent with each request so the LLM has full context.

### 4. Remove unused edge functions

- `atoms-session` - no longer needed
- `atoms-save-context` - context now sent directly in the voice-chat request  
- `atoms-precall` - no longer needed

Remove from `supabase/config.toml` as well.

### 5. Remove `atoms-client-sdk` dependency

No longer needed since we're using browser-native `MediaRecorder` + edge function.

## Technical details

### Pulse STT call (in edge function)
```
POST https://waves-api.smallest.ai/api/v1/pulse/get_text?model=pulse&language=en
Authorization: Bearer {SMALLEST_AI_API_KEY}
Content-Type: audio/wav
Body: raw audio bytes
```

### Lightning v3.1 TTS call (in edge function)
```
POST https://waves-api.smallest.ai/api/v1/lightning-v3.1/get_speech
Authorization: Bearer {SMALLEST_AI_API_KEY}
Content-Type: application/json
Body: { "text": "...", "voice_id": "emily", "sample_rate": 24000, "speed": 1 }
```

### LLM call (in edge function)
Uses Lovable AI gateway with `openai/gpt-5-mini` for fast, affordable responses. System prompt includes Clara's personality as a health companion, patient context, and instructions.

### Browser audio
- `MediaRecorder` with `audio/webm` format
- Audio playback via `new Audio()` with base64 data URL or `AudioContext` for PCM
- Push-to-talk UX: large circular button that records while held

## What stays the same
- Call summary screen (medications, mood, save)
- Incoming call animation
- Overall visual design
- Database tables and check-in saving logic

