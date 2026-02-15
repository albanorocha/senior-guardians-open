

# Fix: Name usage, call duration, and medication completeness

## 3 Issues to Fix

### Issue 1: Clara must always call the user by name
The current prompt (line 221) says: "Do not repeat the senior's name in every reply - that's unnatural"
This contradicts what the user wants. Change to instruct Clara to always address the patient by their first name.

### Issue 2: Call duration always saves as 0 in History
In `handleEndCall` (line 235), `resetCallState()` is called which sets `elapsed` to 0 (line 114). Then when `handleSave` runs, it saves `duration_seconds: elapsed` which is already 0.
Fix: add a `savedElapsed` state, capture `elapsed` before reset, use it in `handleSave`.

### Issue 3: Clara must always ask about ALL medications
Looking at the logs, Clara sometimes only asks about some medications (e.g., asks about Tylenol but skips Desloratadina). The prompt says "ask about each medication BY NAME" but doesn't enforce asking about ALL of them before moving on.
Fix: add stronger instruction to the prompt making it explicit that Clara must ask about EVERY medication in the list, one by one, and must NOT move to the wellness check until ALL medications have been individually confirmed or denied.

## File Changes

### 1. `supabase/functions/voice-chat/index.ts`

**Line 221** - Replace "Do not repeat the senior's name in every reply" with:
"Always address the patient by their first name. Use their name naturally to make them feel recognized and cared for."

**Lines 240-248** - Strengthen medication check instructions:
Add: "You MUST ask about EVERY medication in the list. Do NOT skip any. Do NOT move to the wellness check until every single medication has been confirmed or denied. If the patient says 'I took everything', still call report_medication_status for EACH one."

### 2. `src/pages/CheckIn.tsx`

**Add state** `savedElapsed` (after line 62):
```typescript
const [savedElapsed, setSavedElapsed] = useState(0);
```

**In `handleEndCall`** (line 235), before `resetCallState()`:
```typescript
setSavedElapsed(elapsed);
```

**In `handleSave`** (line 650), change `duration_seconds: elapsed` to `duration_seconds: savedElapsed`.

## Technical Summary

| File | Change |
|------|--------|
| `supabase/functions/voice-chat/index.ts` | Always use patient name; enforce asking about ALL medications |
| `src/pages/CheckIn.tsx` | Preserve call duration before state reset |

