

# Fix Clara's Voice, Add Text Input, and Improve VAD

## Problem Analysis

Three issues identified from logs and code:

1. **Clara's voice not playing**: The TTS is working (edge function logs show audio sizes of 276-545KB), but the browser fails to play it. The issue is that WAV audio of 400KB+ becomes 500KB+ base64, creating extremely large `data:audio/wav;base64,...` URIs that browsers struggle with. Solution: convert the base64 to a Blob and use `URL.createObjectURL()` instead.

2. **No text input**: Currently the only way to communicate is via voice. Need a text input box in the active call UI.

3. **VAD too sensitive**: Edge function logs show many empty transcriptions (`Transcribed text: `) from small audio clips (27-66KB) that are just background noise. The `SILENCE_THRESHOLD` of 15 is too low, and every empty transcription triggers an error toast.

## Changes

### 1. Fix audio playback in `src/pages/CheckIn.tsx`

In `playAudio()` (line 417): Instead of setting `audio.src` to a data URI, convert the base64 string to a `Blob`, create an object URL with `URL.createObjectURL()`, and set that as the source. This avoids the browser's data URI size limits.

```
const binaryStr = atob(base64);
const bytes = new Uint8Array(binaryStr.length);
for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
const blob = new Blob([bytes], { type: 'audio/wav' });
const url = URL.createObjectURL(blob);
audio.src = url;
audio.onended = () => { URL.revokeObjectURL(url); setIsPlaying(false); };
```

### 2. Add text input to active call UI in `src/pages/CheckIn.tsx`

- Add a `textInput` state and a `Send` icon import
- Replace the transcript-only panel (lines 567-589) with a chat-style interface that includes a text input bar at the bottom
- The text input sends messages via `sendToVoiceChat()` (already exists, line 311) which skips STT and goes directly to LLM + TTS
- Input clears after sending and is disabled while processing

### 3. Improve VAD reliability in `src/pages/CheckIn.tsx`

- Increase `SILENCE_THRESHOLD` from 15 to 25 to reduce background noise triggers
- Increase `SILENCE_TIMEOUT_MS` from 1500 to 2000 for more natural pauses
- Add a minimum blob size check (skip blobs under 5000 bytes) in `recorder.onstop`
- In `sendAudioToVoiceChat`: when the edge function returns 400 with "Could not transcribe", do NOT show an error toast -- just silently resume listening. This prevents the spam of error toasts seen in the logs.
- Increase minimum recording duration from 500ms to 800ms

### 4. Minor fix: AudioVisualizer ref warning

The console shows a warning about function components receiving refs. Wrap `AudioVisualizer` usage to avoid passing a ref to it (or convert it to use `forwardRef` if needed). Since it is defined inline and no ref is passed to it, this warning likely comes from framer-motion's `AnimatePresence`. This will be addressed by ensuring `AudioVisualizer` is not wrapped in a motion component that injects refs.

