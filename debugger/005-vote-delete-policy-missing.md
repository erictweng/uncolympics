# BUG-005: leader_votes Missing DELETE Policy

**Sprint:** 2 | **Severity:** ⚠️ Medium | **Status:** ✅ Fixed

## Discovery
**How found:** Live test — when Diana left Team Beta, the vote cleanup call `DELETE FROM leader_votes WHERE voter_id = diana_id` was silently dropped.
**Detection method:** Compared vote count before and after leave — count unchanged.

## Root Cause
The `leader_votes` table had INSERT, SELECT, and UPDATE policies but **no DELETE policy**. With RLS enabled, missing policy = deny all. Votes could never be deleted.

## Impact
- Players who leave a team keep phantom votes in the system
- Vote counts can be wrong after team switches
- Leader election could be influenced by stale votes

## Fix
**Migration:** `005_fix_sprint2_bugs.sql`

Added DELETE policy allowing players to delete their own votes (as voter or candidate):
```sql
CREATE POLICY "Players can delete their votes" ON leader_votes
    FOR DELETE USING (
        voter_id IN (SELECT id FROM players WHERE device_id = header)
        OR candidate_id IN (SELECT id FROM players WHERE device_id = header)
    );
```

## Lessons
1. **When adding a new table with RLS, always define all 4 operations:** SELECT, INSERT, UPDATE, DELETE. Missing any one silently blocks that operation.
2. **Test the cleanup/teardown paths, not just the happy path.** Create + read + update worked. Delete was never tested until a player left.
