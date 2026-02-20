# UNCOLYMPICS — Architecture (LOCKED)

> **Version:** 1.0 — Locked 2026-01-31
> **Author:** Eric + Aibert-Wengs

---

## Overview

Uncolympics is a **real-time party Olympics scoring app** inspired by Mario Party. Teams compete in real-life games, players self-report title-relevant stats, and at the end of each game a dramatic title reveal awards bonus points. The final ceremony crowns the winning team.

---

## Tech Stack (All Free Tier)

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | React + Vite + TypeScript | Mobile-first, dark theme, neon accents |
| State | Zustand | Local client state |
| Database | Supabase (Postgres) | Free: 500MB, realtime included |
| Real-time | Supabase Realtime | Postgres changes → broadcast to all clients |
| Auth | Supabase Anonymous Auth + device_id | No login required, reconnect via device_id |
| Deploy | Vercel | Free |
| Animations | Framer Motion | Title reveals, ceremony |

**No custom backend.** All game logic runs client-side. Referee's client is the authority — their writes trigger broadcasts.

---

## Roles

| Role | How Assigned | Permissions |
|------|-------------|-------------|
| **Referee** | Creates the tournament | Input game scores, advance state, manage settings, add custom games |
| **Team Leader** | Voted/chosen by teammates in lobby | Pick next game (alternating turns) |
| **Player** | Joins via room code, picks team | Input own title-relevant stats only |
| **Spectator** | Joins via room code, no team | View only |

---

## App Flow

```
1. CREATE TOURNAMENT
   → Referee sets: name, room code (custom, max 5 chars), # of games
   → Time estimate auto-calculated (games × 20 min)

2. LOBBY
   → Players/spectators join via room code
   → Players pick a team (or spectate)
   → Teams vote/choose team leader
   → Referee starts when ready

3. GAME PICK (alternating)
   → Current team leader picks from remaining games
   → Game rules/context shown to all devices

4. PLAY (real life happens)
   → App shows game context on every device
   → Players self-report title-relevant stats
   → Referee inputs game outcome (winner, final scores)

5. GAME COMPLETE — TITLE REVEAL 🎬
   → Title engine auto-calculates from stats
   → Animated one-by-one reveal (pop-out style)
   → Each title = +0.5 points to player's team
   → Scoreboard updates

6. REPEAT 3-5 until all games played

7. AWARDS CEREMONY 🏆
   → Global titles revealed (MVP, Late Bloomer, etc.)
   → Final team score + winner crowned
   → Results saved to history
```

---

## Data Model

### tournaments
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| room_code | text UNIQUE | Referee-chosen, max 5 chars |
| name | text | |
| status | enum | `lobby`, `picking`, `playing`, `scoring`, `completed` |
| num_games | int | Chosen by referee |
| time_est_min | int | Auto: num_games × 20 |
| referee_id | uuid FK → players | |
| current_pick_team | uuid FK → teams | Whose turn to pick |
| created_at | timestamp | |

### players
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK | |
| name | text | |
| device_id | text | For reconnection on refresh |
| team_id | uuid FK nullable | null = spectator |
| role | enum | `referee`, `player`, `spectator` |
| is_leader | boolean | default false |
| created_at | timestamp | |

### teams
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK | |
| name | text | |
| total_points | decimal | default 0 |

### game_types
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK nullable | null = built-in, non-null = custom |
| name | text | e.g. "Beer Pong" |
| emoji | text | e.g. "🍺" |
| description | text | Rules summary |
| player_inputs | jsonb | What stats players self-report |
| referee_inputs | jsonb | What the referee inputs |
| title_definitions | jsonb | Title conditions (see Title Engine) |

### games (played rounds)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK | |
| game_type_id | uuid FK → game_types | |
| status | enum | `pending`, `active`, `scoring`, `titles`, `completed` |
| picked_by_team | uuid FK | |
| game_order | int | |
| created_at | timestamp | |

### player_stats
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| game_id | uuid FK | |
| player_id | uuid FK | |
| stat_key | text | e.g. "cups_made" |
| stat_value | decimal | |
| submitted_at | timestamp | |

### game_results
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| game_id | uuid FK | |
| winning_team_id | uuid FK nullable | |
| result_data | jsonb | Game-specific final data |

### titles
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK | |
| game_id | uuid FK nullable | null = global end-of-tournament title |
| player_id | uuid FK | |
| title_name | text | "Sniper" |
| title_desc | text | "Made the most cups" |
| is_funny | boolean | |
| points | decimal | default 0.5 |

---

## Title Engine

### How It Works

Each `game_type` has a `title_definitions` JSON array. After a game completes, the title engine evaluates all conditions against `player_stats` and `game_results`.

```typescript
// Title definition schema (stored in game_types.title_definitions)
interface TitleDef {
  name: string;          // "Sniper"
  desc: string;          // "Made the most cups"
  isFunny: boolean;
  condition: {
    type: "highest" | "lowest" | "exact" | "flag" | "threshold";
    stat: string;        // stat_key to evaluate
    value?: number;      // for "exact" or "threshold"
  };
}

// Example: Beer Pong
[
  { name: "Sniper", desc: "Most cups made", isFunny: false,
    condition: { type: "highest", stat: "cups_made" } },
  { name: "Emotional Support", desc: "Made 0 cups", isFunny: true,
    condition: { type: "exact", stat: "cups_made", value: 0 } },
  { name: "Clutch Gene", desc: "Sank the last cup", isFunny: false,
    condition: { type: "flag", stat: "last_cup" } }
]
```

### Built-In Games + Titles

**🍺 Beer Pong**
- Player inputs: `cups_made`, `last_cup` (flag)
- Referee inputs: winner
- Titles: Sniper (most cups), Emotional Support (0 cups), Clutch Gene (last cup)

**🥤 Rage Cage**
- Player inputs: `sinks`
- Referee inputs: winner
- Titles: Rage Monster (most sinks), Pacifist (least sinks)

**🏎️ Mario Kart**
- Player inputs: `placement` (per race, 1st-4th)
- Titles: Speed Demon (most 1sts), Scenic Route (most lasts), Consistent (all same placement)

**👊 Smash Bros**
- Player inputs: `kos`, `last_alive` (flag)
- Referee inputs: match winner
- Titles: Destroyer (most KOs), Survivor (last alive most), Glass Cannon (most KOs + most deaths)

**🏓 Pickleball**
- Referee inputs: team scores, longest rally, fastest point
- Titles: Wall (longest rally player), Lightning (fastest point)

**🎯 Cornhole**
- Player inputs: `bags_in_hole`
- Titles: Bullseye (most in hole), Throwing Blind (0 in hole)

**🏃 Obstacle Course**
- Referee inputs: time per player
- Titles: Flash (fastest), Scenic Route (slowest), Photo Finish (closest times)

**🏆 Global (End of Tournament)**
- MVP (most total titles)
- Title Hoarder (titles across most different games)
- Late Bloomer (worst first half, best second half)
- Consistent (earned same title type multiple times)

### Custom Games

Referee can create custom games in the lobby or between rounds:
1. Set game name + emoji + description
2. Define player inputs (stat keys + labels)
3. Define title conditions (using the same condition types: highest/lowest/exact/flag/threshold)
4. Saved to `game_types` with `tournament_id` set

---

## Real-Time Sync

```
Client connects → subscribes to tournament tables via Supabase Realtime

Channels:
  tournament:{room_code}:state    → tournament status changes
  tournament:{room_code}:games    → game picks, status
  tournament:{room_code}:stats    → player stat submissions (live)
  tournament:{room_code}:titles   → title reveals
  tournament:{room_code}:teams    → score updates
  tournament:{room_code}:players  → joins, leaves, role changes
```

**Reconnection:** On page refresh, client uses `device_id` (stored in localStorage) to re-authenticate and rejoin the tournament room. Full state pulled from DB, then live sync resumes.

---

## Player Input Matrix

| Game | Player Self-Reports | Referee Inputs |
|------|-------------------|----------------|
| Beer Pong | cups_made, last_cup | winner |
| Rage Cage | sinks | winner |
| Mario Kart | placement (per race) | — |
| Smash Bros | kos, last_alive | match winner |
| Pickleball | — | team scores, longest rally, fastest point |
| Cornhole | bags_in_hole | winner |
| Obstacle Course | — | time per player |

---

## Project Structure

```
uncolympics/
├── docs/
│   └── ARCHITECTURE.md        ← you are here
├── src/
│   ├── pages/
│   │   ├── Home.tsx            create / join tournament
│   │   ├── Lobby.tsx           team pick, leader vote, settings
│   │   ├── GamePick.tsx        leader selects next game
│   │   ├── GamePlay.tsx        live game — context + stat input
│   │   ├── TitleReveal.tsx     post-game animated title reveal
│   │   ├── Scoreboard.tsx      running team + title totals
│   │   ├── Ceremony.tsx        final awards ceremony
│   │   └── History.tsx         past tournaments
│   ├── components/
│   │   ├── ui/                 buttons, cards, inputs
│   │   ├── game/               game-specific score input forms
│   │   └── animation/          title reveal, ceremony animations
│   ├── lib/
│   │   ├── supabase.ts         client init + helpers
│   │   ├── sync.ts             realtime subscriptions
│   │   ├── titles.ts           title engine (calculate from stats)
│   │   ├── scoring.ts          point tallying
│   │   └── gameTypes.ts        built-in game definitions
│   ├── types/
│   │   └── index.ts            all TypeScript types
│   └── stores/
│       └── gameStore.ts        Zustand local state
├── supabase/
│   └── migrations/
│       └── 001_initial.sql     full schema
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vercel.json
```

---

## Design Direction

- **Theme:** Dark background, neon accent colors (think arcade/party)
- **Mobile-first** but responsive to laptop
- **Animations:** Framer Motion — titles pop/bounce in, ceremony has dramatic reveals
- **Typography:** Bold, playful — not corporate
- **Spectator view:** Same as player view minus input controls

---

## Constraints

- All free tier (Supabase free, Vercel free)
- No custom backend server
- Max 5-char room codes (referee-chosen)
- Flexible team sizes (2v2, 3v3, 4v4, uneven)
- Variable game count (referee picks)
- Time estimate = games × 20 min
