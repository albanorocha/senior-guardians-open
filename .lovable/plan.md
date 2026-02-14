
# GuardIAns — Voice AI Senior Health Companion

A web app where seniors receive friendly voice check-in calls from "Clara," an AI health companion, to confirm medication adherence and report status to caregivers.

---

## Phase 1: Foundation & Auth

### Design System
- Custom color palette: soft teal primary (#4A90A4), warm amber accents (#F5A623), off-white background
- Senior-friendly typography: large text, high contrast, rounded corners (12px cards, 8px buttons)
- Warm, caring aesthetic — not clinical

### Authentication
- Email/password signup with name, age fields
- Login page with simple, large-text form
- Auto-create profile on signup (Supabase trigger)
- Protected route wrapper for all app pages

---

## Phase 2: Database & Data Layer

### Supabase Tables
- **profiles** — user info (name, age, phone, role)
- **medications** — medication details with time slots, dosage, frequency, instructions
- **check_ins** — check-in records with status, mood, AI summary
- **check_in_responses** — per-medication responses (taken yes/no, reported issues)
- Row Level Security on all tables (user can only access own data)

### Seed Data
- Demo user "Margaret Johnson, age 78" with 3 medications (Lisinopril, Metformin, Vitamin D3)
- 5 sample check-ins over the past week with realistic summaries and mood data

---

## Phase 3: Dashboard (`/dashboard`)

- Personalized greeting: "Good morning, Margaret" with current date
- **Today's Medications** card showing each medication with time, dosage, and status (taken ✓ / pending ○ / missed ✗)
- **"Talk to Clara" hero CTA** — large, visually dominant button with pulsing animation, navigates to `/check-in`
- **Recent Check-ins** — last 3-5 entries with date, status badge, mood emoji, expandable summaries
- Link to medications management page

---

## Phase 4: Medications CRUD (`/medications`)

- List/table of all medications with name, dosage, frequency, times, instructions, active toggle
- Add Medication modal with form fields: name, dosage, frequency selector, time slots, special instructions
- Edit and delete actions per medication
- Built with React Hook Form for validation

---

## Phase 5: Voice Check-in Page (`/check-in`) — Hero Demo Page

Full-screen immersive phone call simulation with three states:

### State 1 — "Incoming Call"
- Calming gradient background (teal to blue)
- Centered Clara avatar with pulsing ring animation
- "Clara — GuardIAns Health Companion" / "Incoming call..."
- Green "Answer" button and red "Decline" button (phone call style)

### State 2 — "Active Call"
- Clara avatar with animated audio visualizer (CSS pulsing bars/waveform)
- Call timer counting up
- **Smallest.ai Atoms Widget** embedded for real voice conversation
- Minimal UI — focus entirely on the voice experience
- Red "End Call" button at bottom center
- Fallback message if widget fails to load

### State 3 — "Call Summary"
- Call duration display
- AI conversation summary text
- Medication checklist with taken/not-taken toggles and issue text fields for each medication
- Mood selector (happy / neutral / confused / distressed)
- "Save Check-in" button → writes to Supabase, returns to dashboard
- "Discard" option to return without saving

---

## Phase 6: Check-in History (`/history`)

- Reverse-chronological list of all check-ins
- Each entry: date/time, status badge, mood emoji, duration, summary
- Expandable rows showing per-medication responses
- Pre-seeded with sample data for demo

---

## Phase 7: Polish & Demo Readiness

- Loading skeletons on all data-fetching pages
- Empty states with helpful messages
- Subtle fade-in animations on page transitions
- Responsive layout (desktop-first, but functional on tablet)
- Navigation bar with links to Dashboard, Medications, History, and Logout
- Error handling and toast notifications for all actions
