# BUG-013: player_stats Realtime Not Working

**Sprint:** 4 | **Severity:** ⚠️ Medium | **Status:** ✅ Fixed

## Discovery
**How found:** Live test — subscribed to player_stats changes, triggered upsert, received 0 events.

## Root Cause
`player_stats` had default replica identity (`d` = primary key only). For realtime with filters like `filter: game_id=eq.X`, Supabase needs REPLICA IDENTITY FULL to include all columns in the WAL output.

## Fix
`007_fix_sprint4_bugs.sql`: `ALTER TABLE player_stats REPLICA IDENTITY FULL;`

## Lessons
1. **Second time replica identity caused realtime failure** (also games table). All tables with realtime subscriptions need REPLICA IDENTITY FULL.
