# 🏆 UNCOLYMPICS

Real-time party Olympics scoring app — Mario Party meets IRL games.

## Features

- Create tournaments with custom room codes
- Flexible teams (2v2, 3v3, 4v4, uneven)
- 7 built-in games + custom game creator
- Real-time multi-device sync
- Mario Party-style title reveals
- Awards ceremony with confetti
- Tournament history

## Tech Stack

- React + Vite + TypeScript
- Supabase (Postgres + Realtime)
- Zustand (state management)
- Framer Motion (animations)
- Tailwind CSS

## Setup

1. Clone the repo
2. `npm install`
3. Copy `.env.example` to `.env` and fill in Supabase credentials
4. Run Supabase migrations (see `supabase/migrations/`)
5. `npm run dev`

## Deploy

- Vercel: connect repo, set env vars, deploy