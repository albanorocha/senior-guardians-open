

# Remove Debug Page, Atoms References, and Fix Stuck "Connecting" Screen

## Overview

The "Connecting..." screen gets stuck because `handleAnswer` errors out silently before reaching the `active` state. The fix is to remove the intermediate `preparing` state entirely -- go straight from `incoming` to `active`, and handle errors gracefully. Additionally, the Debug page and all atoms-related code will be removed.

## Changes

### 1. Delete `src/pages/Debug.tsx`
Remove the entire file -- it only contains atoms-related diagnostic tests.

### 2. Remove Debug route from `src/App.tsx`
- Remove the `import Debug` line
- Remove the `<Route path="/debug" ...>` line

### 3. Remove "preparing" state from `src/pages/CheckIn.tsx`

**Remove the `preparing` CallState:**
- Change the type from `'incoming' | 'preparing' | 'active' | 'summary'` to `'incoming' | 'active' | 'summary'`
- Delete the entire "PREPARING" UI block (lines 583-598)

**Simplify `handleAnswer`:**
- Remove `setCallState('preparing')` at the start
- Keep all the setup logic (fetch profile, unlock audio, get mic, create AudioContext)
- Only set `setCallState('active')` at the end on success
- On error, stay on `incoming` (already handled) and show the toast

This way, the user stays on the "incoming" screen while setup happens (the green button can show a loading spinner), and transitions directly to the active call once everything is ready.

**Add loading state to the answer button:**
- Add a `connecting` boolean state
- Set it `true` when `handleAnswer` starts, `false` when done (success or error)
- Show a `Loader2` spinner on the green answer button while connecting
- Disable the button while connecting

### 4. Remove any atoms references from `src/components/AppNav.tsx` (if any)
Check if there's a link to `/debug` in the navigation and remove it.

## Technical Summary

| File | Action |
|------|--------|
| `src/pages/Debug.tsx` | Delete |
| `src/App.tsx` | Remove Debug import and route |
| `src/pages/CheckIn.tsx` | Remove `preparing` state, add loading spinner to answer button |
| `src/components/AppNav.tsx` | Remove `/debug` link if present |

