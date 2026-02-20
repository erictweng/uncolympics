-- Migration 005: Fix Sprint 2 bugs
-- BUG-004: Referee can't update team names (RLS)
-- BUG-005: leader_votes has no DELETE policy (vote cleanup on leave)
-- BUG-006: teams table missing created_at (fetchLobbyState ORDER BY fails)
-- BUG-007: No tables in supabase_realtime publication (realtime broken)
-- BUG-008: Spectator can join team via RLS (missing role check)

-- ============================================================
-- FIX 4: Allow referee to update team names
-- Old policy only allows team members. Referee has no team_id.
-- ============================================================

DROP POLICY IF EXISTS "Team members can update team info" ON teams;

CREATE POLICY "Team members or referee can update team info" ON teams
    FOR UPDATE USING (
        -- Team member
        id IN (
            SELECT team_id FROM players 
            WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
        )
        OR
        -- Referee of the tournament this team belongs to
        tournament_id IN (
            SELECT t.id FROM tournaments t
            JOIN players p ON t.referee_id = p.id
            WHERE p.device_id = current_setting('request.headers', true)::json->>'x-device-id'
        )
    );

-- ============================================================
-- FIX 5: Add DELETE policy for leader_votes
-- Needed for vote cleanup when a player leaves a team
-- ============================================================

CREATE POLICY "Players can delete their votes" ON leader_votes
    FOR DELETE USING (
        voter_id IN (
            SELECT id FROM players
            WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
        )
        OR
        -- Also allow deletion of votes FOR a player who left
        candidate_id IN (
            SELECT id FROM players
            WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
        )
    );

-- ============================================================
-- FIX 6: Add created_at to teams table
-- fetchLobbyState and startTournament ORDER BY created_at
-- ============================================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ============================================================
-- FIX 7: Enable realtime for all tables
-- Without this, postgres_changes subscriptions get zero events
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE leader_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE player_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE game_results;
ALTER PUBLICATION supabase_realtime ADD TABLE titles;
