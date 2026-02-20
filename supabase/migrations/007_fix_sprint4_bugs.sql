-- Migration 007: Fix Sprint 4 bugs
-- BUG-011: player_stats missing UPDATE policy (upsert fails)
-- BUG-012: Spectator can submit stats (no role check in INSERT policy)
-- BUG-013: player_stats realtime not working (replica identity)

-- ============================================================
-- FIX 11: Add UPDATE policy for player_stats (needed for upsert)
-- ============================================================

CREATE POLICY "Players can update their own stats" ON player_stats
    FOR UPDATE USING (
        player_id IN (
            SELECT id FROM players
            WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
        )
    );

-- ============================================================
-- FIX 12: Replace INSERT policy to check role != 'spectator'
-- ============================================================

DROP POLICY IF EXISTS "Players can insert their own stats" ON player_stats;

CREATE POLICY "Players can insert their own stats" ON player_stats
    FOR INSERT WITH CHECK (
        player_id IN (
            SELECT id FROM players
            WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
            AND role IN ('player', 'referee')
        )
    );

-- ============================================================
-- FIX 13: Set replica identity for realtime on player_stats
-- ============================================================

ALTER TABLE player_stats REPLICA IDENTITY FULL;
