# BUG-012: Spectator Can Submit Stats

**Sprint:** 4 | **Severity:** ⚠️ Medium | **Status:** ✅ Fixed

## Discovery
**How found:** Live test — spectator client successfully inserted a player_stat row.

## Root Cause
INSERT policy only checked `player_id IN (SELECT id FROM players WHERE device_id = header)`. Spectators ARE players (role='spectator'), so the check passed. No role filter.

## Fix
`007_fix_sprint4_bugs.sql`: Replaced policy to add `AND role IN ('player', 'referee')`.

## Lessons
1. **RLS policies must consider role, not just identity.** Being a valid player row isn't enough — spectators shouldn't have write access to game data.
