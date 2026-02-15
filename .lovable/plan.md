

# Fix Audio Playback and Add Always-On Microphone

## Problem 1: Cannot hear Clara's voice

The `playAudio` function (line 285) calls `new Audio().play()` after an async fetch completes. Browsers block audio playback unless it's initiated from a direct user gesture. Since the audio plays after the edge function response (async), the browser silently blocks it.

**Fix**: Pre-create and "unlock" an `Audio` element during the user's click gesture (answering the call or pressing talk), then reuse it for playback later.

## Problem 2: Microphone should always be on

Replace push-to-talk with a continuous recording + silence detection approach:
- Keep the microphone recording at all times during the active call
- Use a simple volume-based Voice Activity Detection (VAD): monitor audio levels via `AnalyserNode`
- When the user stops speaking (silence for ~1.5 seconds), automatically stop and send the audio
- When Clara finishes speaking, automatically resume listening

## Changes

### `src/pages/CheckIn.tsx`

**Audio playback fix:**
- In `handleAnswer`, immediately after the user clicks the green phone button, create an `Audio` element and call `audio.play().catch(() => {})` to unlock it (line ~129)
- Store this unlocked element in `audioRef`
- In `playAudio` (line 285), reuse the existing `audioRef.current` instead of creating a new `Audio` -- just set its `.src` property and call `.play()`

**Always-on microphone (VAD):**
- Remove push-to-talk button; replace with a microphone status indicator
- After `handleAnswer` sets up the `MediaRecorder`, also create an `AudioContext` + `AnalyserNode` from the same stream
- Start a monitoring loop that checks audio volume every 100ms
- When volume exceeds a threshold, start recording (if not already)
- When volume drops below threshold for ~1.5 seconds, stop recording and send audio
- While Clara is speaking (`isPlaying`) or processing (`isProcessing`), pause the VAD detection
- After Clara finishes speaking, automatically resume listening
- Show visual feedback: "Listening...", "You're speaking...", "Processing...", "Clara is speaking..."

### Technical details

**Audio unlock pattern:**
```typescript
// In handleAnswer (user gesture context):
const audio = new Audio();
audio.play().catch(() => {}); // unlock
audioRef.current = audio;

// In playAudio:
const audio = audioRef.current!;
audio.src = `data:audio/wav;base64,${base64}`;
await audio.play();
```

**VAD with AnalyserNode:**
```typescript
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(stream);
const analyser = audioContext.createAnalyser();
analyser.fftSize = 512;
source.connect(analyser);

// Monitor loop checks getByteFrequencyData average
// If avg > threshold (e.g. 15) -> speech detected
// If avg < threshold for 1500ms -> silence, send recording
```

**UI changes in active call:**
- Remove hold-to-talk button
- Show a microphone icon with status text: "Listening..." / "Speaking..." / "Processing..." / "Clara is speaking..."
- Add a pulsing animation around the mic icon when the user is speaking
- Keep the end call button

