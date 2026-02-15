

# Fix Clara's Audio Playback

## Root Cause

Console logs show repeated errors:
```
[CheckIn] Audio play() failed: NotSupportedError: The element has no supported sources.
```

The TTS API (Lightning v3.1) returns 24kHz WAV audio. While the edge function adds a WAV header (`add_wav_header: true`), the HTML `<audio>` element in the browser sandbox doesn't support this specific WAV encoding. The Blob URL approach fixed the size issue but the format is still unsupported by `<audio>`.

## Solution

Replace the `<audio>` element playback with **Web Audio API** (`AudioContext.decodeAudioData`), which supports a much wider range of audio formats including raw PCM WAV at any sample rate.

## Changes to `src/pages/CheckIn.tsx`

### 1. Replace `playAudio` function

Instead of:
```typescript
const audio = new Audio();
audio.src = blobUrl;
audio.play(); // FAILS: "no supported sources"
```

Use:
```typescript
const playAudio = async (base64: string) => {
  setIsPlaying(true);
  try {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Use Web Audio API which supports more formats
    const playbackCtx = new AudioContext();
    const audioBuffer = await playbackCtx.decodeAudioData(bytes.buffer.slice(0));
    const source = playbackCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackCtx.destination);
    source.onended = () => {
      setIsPlaying(false);
      playbackCtx.close();
    };
    source.start(0);
  } catch (err) {
    console.error('[CheckIn] Audio playback error:', err);
    setIsPlaying(false);
  }
};
```

### 2. Remove `audioRef`

The `audioRef` (which held an `HTMLAudioElement`) is no longer needed since we use `AudioContext` directly. Remove its declaration and any references in `resetCallState`.

### 3. Keep the "unlock audio" tap in `handleAnswer`

The existing silent audio context unlock on iOS/Safari remains important -- it ensures `AudioContext` can be created after a user gesture.

## Why This Works

- `AudioContext.decodeAudioData()` supports PCM WAV at any sample rate (8kHz, 16kHz, 24kHz, 44.1kHz, 48kHz)
- No dependency on browser codec support for `<audio>` element
- Creates a fresh `AudioContext` per playback, avoiding state issues between calls
- The `onended` callback properly resets `isPlaying` so VAD resumes after Clara finishes speaking

