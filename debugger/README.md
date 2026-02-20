# 🐛 Debugger Log — UNCOLYMPICS

This folder documents every bug found, how it was debugged, and how it was fixed. Each file follows a consistent format for retrospective learning.

## Format

Each bug file includes:
- **Discovery** — how the bug was found & detection method
- **Root Cause** — what actually went wrong and why
- **Impact** — what broke and severity
- **Fix** — what changed (code + SQL)
- **Verification** — how we confirmed the fix works
- **Lessons** — what to learn from this for future work

## Index

| ID | Title | Severity | Sprint | Status |
|----|-------|----------|--------|--------|
| 001 | [RLS Chicken-and-Egg](001-rls-chicken-and-egg.md) | 🔴 Critical | 1 | ✅ Fixed |
| 002 | [Status Update Blocked](002-status-update-blocked.md) | 🔴 Critical | 1 | ✅ Fixed |
| 003 | [Room Code Reuse](003-room-code-reuse.md) | ⚠️ Medium | 1 | ✅ Fixed |
| 004 | [Referee Team Name RLS](004-referee-team-name-rls.md) | ⚠️ Medium | 2 | ✅ Fixed |
| 005 | [Vote DELETE Policy Missing](005-vote-delete-policy-missing.md) | ⚠️ Medium | 2 | ✅ Fixed |
| 006 | [Teams Missing created_at](006-teams-missing-created-at.md) | ⚠️ Medium | 2 | ✅ Fixed |
| 007 | [Realtime Not Enabled](007-realtime-not-enabled.md) | 🔴 Critical | 2 | ✅ Fixed |
| 008 | [game_types Missing created_at](008-game-types-missing-created-at.md) | ⚠️ Medium | 3 | ✅ Fixed |
| 009 | [Duplicate Game Pick No Constraint](009-duplicate-game-pick-no-constraint.md) | ⚠️ Medium | 3 | ✅ Fixed |
| 010 | [Games Missing DELETE Policy](010-games-missing-delete-policy.md) | ⚠️ Medium | 3 | ✅ Fixed |
| 011 | [player_stats No UPDATE Policy](011-player-stats-no-update-policy.md) | 🔴 Critical | 4 | ✅ Fixed |
| 012 | [Spectator Can Submit Stats](012-spectator-can-submit-stats.md) | ⚠️ Medium | 4 | ✅ Fixed |
| 013 | [player_stats Realtime](013-player-stats-realtime.md) | ⚠️ Medium | 4 | ✅ Fixed |

## Process (v1)

1. Write automated test script hitting real Supabase
2. Run full test matrix, collect pass/fail
3. Investigate failures — check DB state, RLS policies, constraints
4. Write migration fix
5. Apply to live DB
6. Re-run full test suite to confirm 0 failures
7. Document in this folder

## Retro Notes

*To be filled after sprint retro.*
