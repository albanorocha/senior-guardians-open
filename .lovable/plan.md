

# Rebuild Call Feature: Fix State Reset, Audio Playback, and VAD

## Problems Identified

1. **Call doesn't reload after ending** -- After ending a call, there's no way to return to the "incoming" state without a page refresh. The state (streams, audio context, refs) from the previous call aren't cleaned up properly.

2. **Clara's audio not playing** -- The session replay shows the call gets stuck at "Connecting..." and never reaches the active state. The `handleAnswer` function likely fails silently because the initial `sendToVoiceChat` call happens before state is fully committed (React batches state updates), so `conversationHistory` is stale when building the request.

3. **VAD not sending audio** -- Since the call never fully initializes (stuck at "Connecting"), the VAD monitoring never starts. Additionally, the `AudioVisualizer` function component wrapped in `AnimatePresence` causes React ref warnings that may interfere with rendering.

## Changes to `src/pages/CheckIn.tsx`

### 1. Full state reset function
Create a `resetCallState()` function that clears all refs (stream, audioContext, mediaRecorder, VAD interval) and resets all state variables. Call this:
- In `handleEndCall` before transitioning to summary
- When starting a new call from the summary screen

### 2. Add "Call Again" button in summary
Add a button in the summary screen that calls `resetCallState()` and sets `callState` back to `'incoming'`.

### 3. Fix initial greeting race condition
The `sendToVoiceChat` function uses `conversationHistory` state, but when called inside `handleAnswer`, the state hasn't been committed yet (React batches). Fix by passing the history explicitly to `sendToVoiceChat` instead of reading from state:
- Add an optional `historyOverride` parameter to `sendToVoiceChat`
- Pass `[]` as the history override when calling from `handleAnswer`

### 4. Fix AudioVisualizer ref warning
The `AudioVisualizer` is a function component rendered inside `AnimatePresence` which tries to pass a ref to it. Fix by either:
- Moving `AudioVisualizer` outside the `AnimatePresence` scope, or
- Converting it to use `React.forwardRef`, or
- Simply rendering it without motion wrapper (simplest approach -- just remove it from inside a motion div that AnimatePresence controls)

### 5. Improve audio playback reliability
- Add a small delay (50ms) after setting `audio.src` before calling `play()` to ensure the browser has loaded the blob URL
- Add more detailed error logging in `playAudio` to diagnose failures

### 6. Ensure VAD resumes after Clara speaks
After `isPlaying` transitions from `true` to `false`, explicitly set `micStatus` back to `'listening'`. Currently the VAD loop handles this, but there's a timing gap where `isProcessing` might still be `true` when `isPlaying` goes `false`.

## Technical Details

**State reset function:**
```typescript
const resetCallState = () => {
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
  audioRef.current = null;
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
};
```

**Fix sendToVoiceChat history race:**
```typescript
const sendToVoiceChat = async (
  text: string, 
  ctx?: typeof patientContext, 
  historyOverride?: typeof conversationHistory
) => {
  const history = historyOverride ?? conversationHistory;
  const updatedHistory = [...history, { role: 'user' as const, content: text }];
  setConversationHistory(updatedHistory);
  // ... use updatedHistory in fetch body
};

// In handleAnswer:
await sendToVoiceChat('Hello Clara, I\'m ready for my check-in.', ctx, []);
```

**Summary screen "Call Again" button:**
```typescript
<Button onClick={() => { resetCallState(); setCallState('incoming'); }}>
  New Call
</Button>
```

