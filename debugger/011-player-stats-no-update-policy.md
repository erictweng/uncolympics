# BUG-011: player_stats Missing UPDATE Policy (Upsert Fails)

**Sprint:** 4 | **Severity:** 🔴 Critical | **Status:** ✅ Fixed

## Discovery
**How found:** Live test — upsert call to update Alice's cups_made from 4→5. Error: "new row violates row-level security policy (USING expression)".

## Root Cause
`player_stats` had INSERT but no UPDATE policy. Supabase `upsert()` needs both — first attempts INSERT, on conflict does UPDATE. The UPDATE half was blocked by RLS.

## Fix
`007_fix_sprint4_bugs.sql`: Added UPDATE policy matching device_id → player_id.

## Lessons
1. **Upsert = INSERT + UPDATE.** Both policies required. Fifth missing policy bug. This is now a systemic issue.
