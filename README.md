# Gym Tracker

A mobile-first gym tracking PWA built with Next.js 16, TypeScript, Tailwind CSS, and Supabase. Tracks workouts, exercises, and templates with cloud sync so your data follows you across phone and laptop.

## Quick start

```powershell
# 1. Install dependencies (first time only)
npm install

# 2. Set up your environment
copy .env.example .env.local
#   then edit .env.local and paste your Supabase Project URL + anon key
#   (get them from https://supabase.com/dashboard → Project Settings → API)

# 3. Run the SQL in public/supabase-setup.sql
#    in your Supabase dashboard → SQL Editor

# 4. Dev server
npm run dev          # http://localhost:3000

# 5. Production build
npm run build        # outputs to out/
```

## Security notes

- `.env.local` is in `.gitignore` — your real Supabase keys are never committed
- `.env.example` is the safe template you copy and fill in
- The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is meant to be public (RLS policies protect your data)
- If you fork/clone this project elsewhere, just copy `.env.example` → `.env.local` and add your keys

## Deploy

The app is set up for static export (`output: "export"` in `next.config.ts`). After `npm run build`, the `out/` directory contains a fully static site that can be hosted on any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages, etc.).

## Supabase setup

The full SQL schema is in [`public/supabase-setup.sql`](./public/supabase-setup.sql). It is idempotent and safe to re-run. It creates:

- `exercises` — your exercise library
- `workouts` — logged sessions
- `workout_templates` — reusable templates like "Push day"
- Row-Level Security policies so each user only sees their own data

In the Supabase dashboard, **disable "Confirm email"** under Authentication → Sign In/Up if you want password sign-up to work without sending a real confirmation email.

## Features

- **Log workout** — add exercises, log sets (weight × reps), bodyweight, notes
- **History** — browse past sessions, grouped by week
- **Progress** — pick any exercise, see 4 metrics (max weight, total volume, est. 1RM, total reps) over time, with PR highlights and week-over-week % change
- **Exercises** — manage your library, add common ones in one tap
- **Templates** — build reusable routines ("Push day", "Legs A"), start any workout from one
- **Cloud sync** — username + password (or email magic link), data syncs between phone and laptop

## Project layout

```
src/
├── app/                       # Next.js App Router pages
│   ├── exercises/             # exercise library
│   ├── history/               # workout history
│   ├── log/                   # log a workout
│   ├── progress/              # progress charts
│   └── templates/             # workout templates
├── components/                # shared UI
│   ├── AppGate.tsx            # auth gate + cloud sync
│   ├── BottomNav.tsx          # bottom navigation
│   ├── PageHeader.tsx         # page header with profile menu
│   ├── ProfileMenu.tsx        # avatar menu + sign-in modal + sync dialog
│   ├── StatCard.tsx           # dashboard stat cards
│   ├── WorkoutCard.tsx        # workout list item
│   ├── WorkoutDetailModal.tsx # workout detail popup
│   └── WorkoutEditor.tsx      # workout / template editor
└── lib/                       # core logic
    ├── auth.ts                # sign in / up / out
    ├── cloud.ts               # Supabase reads/writes
    ├── format.ts              # display formatters
    ├── hooks.ts               # React hooks (useExercises, useWorkouts, useTemplates, useAuth, useCloudSync)
    ├── stats.ts               # analytics (weekly volume, e1RM, PRs, etc.)
    ├── storage.ts             # localStorage + cloud sync orchestration
    ├── supabase.ts            # Supabase client init
    └── types.ts               # TypeScript types
```

## Notes

- All data lives in localStorage first for instant UI, then queued for cloud push
- A pending write queue survives offline/disconnections and auto-retries
- Pull-from-cloud also flushes the pending queue first, so you never lose writes when syncing
- The site is fully static (no server needed) — perfect for PWAs and cheap hosting
