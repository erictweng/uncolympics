# BUG-004: Referee Can't Update Team Names (RLS)

**Sprint:** 2 | **Severity:** ⚠️ Medium | **Status:** ✅ Fixed

## Discovery
**How found:** Live test — referee client attempted `UPDATE teams SET name = 'Team Awesome'`. Silently dropped by RLS.
**Detection method:** Test verified actual DB state after update call.

## Root Cause
The RLS policy `"Team members can update team info"` only allowed updates from players whose `team_id` matched the team being updated. The referee has `team_id = NULL` (not on any team), so the policy never matched.

The Lobby UI shows the "Edit" button only for referees — but the RLS blocked the actual write. **UI and RLS disagreed.**

## Fix
**Migration:** `005_fix_sprint2_bugs.sql`

New policy allows update if the caller is a team member OR the referee of the tournament:
```sql
CREATE POLICY "Team members or referee can update team info" ON teams
    FOR UPDATE USING (
        id IN (SELECT team_id FROM players WHERE device_id = header)
        OR
        tournament_id IN (
            SELECT t.id FROM tournaments t JOIN players p ON t.referee_id = p.id
            WHERE p.device_id = header
        )
    );
```

## Lessons
1. **When UI shows an action, verify the backend allows it.** The "edit" button rendered but the write silently failed.
2. **Referees are special — they need explicit RLS carve-outs** since they don't belong to teams.
