

# Frontend for Clara's New Features: Alerts, Health Data, Reminders, Adherence

## Overview

Clara's expanded prompt now generates emergency alerts, caregiver notifications, health logs, and scheduled reminders -- but all this data is lost after the call (only shown as toasts or console logs). This plan adds database persistence and new UI sections to surface everything.

## 1. Database: 3 New Tables

### `alerts`
Stores emergency and caregiver alerts triggered during calls.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto-generated |
| user_id | uuid NOT NULL | owner |
| check_in_id | uuid, nullable | links to the check-in |
| type | text | 'emergency' or 'caregiver' |
| severity | text | 'critical', 'warning', 'info' |
| reason | text | description from Clara |
| tag | text, nullable | category like 'Adherence Concern' |
| acknowledged | boolean | default false |
| created_at | timestamptz | default now() |

RLS: users can SELECT and INSERT their own alerts, UPDATE only `acknowledged` field.

### `health_logs`
Stores wellness data (sleep, nutrition, symptoms, etc.) logged by Clara.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto-generated |
| user_id | uuid NOT NULL | owner |
| check_in_id | uuid, nullable | links to the check-in |
| category | text | 'sleep', 'nutrition', 'symptom', 'mobility', 'social', 'cognitive', 'milestone', 'other' |
| details | text | description |
| tag | text, nullable | optional tag |
| created_at | timestamptz | default now() |

RLS: users can SELECT and INSERT their own logs.

### `scheduled_reminders`
Stores follow-up call requests Clara suggests.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto-generated |
| user_id | uuid NOT NULL | owner |
| check_in_id | uuid, nullable | links to the check-in |
| reason | text | purpose |
| scheduled_time | text | when Clara suggested ("this afternoon", "3 PM") |
| status | text | 'pending', 'completed', 'cancelled' -- default 'pending' |
| created_at | timestamptz | default now() |

RLS: users can SELECT, INSERT, and UPDATE their own reminders.

## 2. CheckIn.tsx -- Accumulate and Persist New Data

### During the call (handleVoiceResponse)
Add state arrays to accumulate data as tools fire:

```text
callAlerts[]      -- from send_alert + send_alert_to_caregiver
callHealthLogs[]  -- from log_health_data
callReminders[]   -- from schedule_reminder
```

Each tool handler pushes to the corresponding array (in addition to showing toasts).

### On save (handleSave)
After inserting the `check_in` and `check_in_responses`, also insert:
- All `callAlerts` into `alerts` table (with `check_in_id`)
- All `callHealthLogs` into `health_logs` table (with `check_in_id`)
- All `callReminders` into `scheduled_reminders` table (with `check_in_id`)

### Summary screen additions
After the existing Medications and Mood cards, add:
- **Alerts card** (if any were triggered): red/amber styling with reason
- **Health data card**: what Clara logged (sleep, symptoms, etc.)
- **Reminders card**: scheduled follow-ups with time and reason

## 3. Dashboard -- Enhanced with New Sections

### Active Alerts Banner (top of page)
- Fetches unacknowledged alerts from `alerts` table
- Red card for emergency, amber for caregiver notifications
- Shows reason and timestamp
- "Acknowledge" button to dismiss (updates `acknowledged = true`)

### Adherence Stats Card (new section)
- Calculates medication compliance from `check_in_responses` data
- Shows: compliance percentage (last 30 days) and current streak
- Simple progress bar visualization
- Calculated client-side from existing check-in data

### Upcoming Reminders (new small section)
- Shows pending reminders from `scheduled_reminders` where status = 'pending'
- Displays time and reason
- "Mark done" / "Cancel" buttons

### Recent Health Snapshot (new section)
- Last 5 mood entries as emoji row (from check_ins.mood_detected)
- Latest health log entries (sleep, symptoms) if available
- Link to History for more detail

Existing sections (Talk to Clara CTA, Today's Medications, Recent Check-ins) remain unchanged.

## 4. History Page -- Enhanced Detail View

Each expandable check-in section will also show:
- **Alerts fired**: colored badges for any alerts from that check-in
- **Health data logged**: sleep, nutrition, symptoms entries
- **Reminders scheduled**: follow-up requests with status

This requires joining the new tables by `check_in_id`.

## 5. AppNav -- Alert Badge

- Query for count of unacknowledged alerts
- Show a small red dot/number badge on the Dashboard nav item if count > 0
- Gives immediate visibility without a separate page

## Files Modified

| File | Changes |
|------|---------|
| Database migration | Create `alerts`, `health_logs`, `scheduled_reminders` with RLS |
| `src/pages/CheckIn.tsx` | Accumulate alerts/health/reminders in state; persist on save; show in summary screen |
| `src/pages/Dashboard.tsx` | Add alerts banner, adherence stats, reminders, health snapshot sections |
| `src/pages/History.tsx` | Fetch and display alerts + health logs + reminders per check-in |
| `src/components/AppNav.tsx` | Add unacknowledged alert count badge |

## Technical Notes

### Adherence Calculation
```text
For each check-in day:
  - Get all check_in_responses for that day
  - Day is "compliant" if ALL medications have taken=true
Streak: count consecutive compliant days backwards from today
Percentage: (compliant days / total check-in days) * 100, last 30 days
```

### Edge Function (voice-chat) -- No Changes Needed
The tools are already defined and working. The frontend just needs to persist the data they produce.

