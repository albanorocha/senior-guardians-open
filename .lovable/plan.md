

# Fix Clara's Audio: Manual PCM Decoding

## Root Cause

The console shows:
```
EncodingError: Unable to decode audio data
```

Both the HTML `<audio>` element AND `AudioContext.decodeAudioData()` fail to decode the TTS audio. The Lightning v3.1 API returns 24kHz, 16-bit mono PCM WAV. The browser sandbox environment's decoders don't support this specific format.

## Solution

Manually parse the WAV file: skip the 44-byte RIFF header, read the raw 16-bit PCM samples into a Float32Array, and create an AudioBuffer at the correct sample rate. This bypasses all browser codec limitations.

## Changes

### `src/pages/CheckIn.tsx` -- Replace `playAudio` function

Replace the current `playAudio` with a manual PCM decoder:

```typescript
const playAudio = async (base64: string) => {
  setIsPlaying(true);
  try {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Parse WAV header to get sample rate and data offset
    const view = new DataView(bytes.buffer);
    const sampleRate = view.getUint32(24, true);  // offset 24 in WAV header
    const bitsPerSample = view.getUint16(34, true); // offset 34
    const dataOffset = 44; // standard WAV header size
    const bytesPerSample = bitsPerSample / 8;
    const numSamples = (bytes.length - dataOffset) / bytesPerSample;

    // Convert 16-bit PCM to Float32
    const float32 = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const sample = view.getInt16(dataOffset + i * 2, true);
      float32[i] = sample / 32768;
    }

    // Create AudioBuffer and play
    const playbackCtx = new AudioContext();
    const audioBuffer = playbackCtx.createBuffer(1, numSamples, sampleRate);
    audioBuffer.getChannelData(0).set(float32);
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

### Why this works

- No dependency on browser codec support at all
- Reads the sample rate (24000) directly from the WAV header
- Converts 16-bit signed integer PCM samples to Float32 (the format AudioBuffer expects)
- Creates a buffer at the native sample rate, so no resampling artifacts
- Works in every browser that supports Web Audio API (all modern browsers)

