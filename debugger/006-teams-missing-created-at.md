# BUG-006: Teams Table Missing created_at Column

**Sprint:** 2 | **Severity:** ⚠️ Medium | **Status:** ✅ Fixed

## Discovery
**How found:** Live test — `fetchLobbyState()` queries teams with `.order('created_at')`. With no `created_at` column, Supabase returned an error and `data` was `undefined`.
**Detection method:** Test checked `teams?.length` — got `undefined` instead of a number.

## Root Cause
The `teams` table in `001_initial.sql` was defined without a `created_at` column. The `Team` TypeScript interface in `types/index.ts` declares `created_at: string`, and both `fetchLobbyState()` and `startTournament()` order by it.

**Schema-type mismatch:** The TypeScript type promised a field the DB didn't have.

## Fix
**Migration:** `005_fix_sprint2_bugs.sql`
```sql
ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
```

## Lessons
1. **Types must match schema.** If the TypeScript interface has `created_at`, the table must too. A lint step or codegen from the schema would catch this.
2. **ORDER BY on a nonexistent column is a runtime error, not a type error.** TypeScript can't catch Supabase query column mismatches.
