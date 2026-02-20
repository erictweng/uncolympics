# BUG-007: Realtime Subscriptions Receive Zero Events

**Sprint:** 2 | **Severity:** 🔴 Critical | **Status:** ✅ Fixed

## Discovery
**How found:** Live test — subscribed to `postgres_changes` on the `players` table, triggered an update, waited 3 seconds. Received 0 events.
**Detection method:** Counted payloads in subscription callback.

## Root Cause
**No tables were added to the `supabase_realtime` publication.** Supabase Realtime requires tables to be explicitly published:
```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- (0 rows)
```

The `sync.ts` code correctly subscribes to `postgres_changes`, but without publication membership, Postgres never emits change events.

## Impact
🔴 Critical — the entire multi-device sync system was dead. No player joins, team switches, votes, or tournament status changes would propagate to other devices. The app would appear functional on one device but completely static on others.

## Fix
**Migration:** `005_fix_sprint2_bugs.sql`
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE leader_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE player_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE game_results;
ALTER PUBLICATION supabase_realtime ADD TABLE titles;
```

Added all 8 tables to cover current and future sprints.

## Lessons
1. **Supabase Realtime requires explicit opt-in per table.** It's not automatic — you must add tables to the `supabase_realtime` publication.
2. **This should be in Sprint 0 setup, not discovered in Sprint 2.** Any project using Supabase Realtime needs this in the initial migration.
3. **Always test the actual subscription, not just the subscription setup code.** The `subscribe()` call succeeds even when no events will ever arrive.
