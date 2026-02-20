-- Migration 008: Fix Sprint 5 bugs
-- BUG-014: titles missing created_at column (ORDER BY fails)
-- BUG-015: titles.ts uses Object.entries on array (title names become indices)
-- BUG-016: titles missing DELETE policy (cleanup fails)

-- ============================================================
-- FIX 14: Add created_at to titles
-- ============================================================

ALTER TABLE titles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ============================================================
-- FIX 16: Add DELETE policy for titles (referee only)
-- ============================================================

CREATE POLICY "Referee can delete titles" ON titles
    FOR DELETE USING (
        tournament_id IN (
            SELECT players.tournament_id FROM players
            WHERE players.device_id = current_setting('request.headers', true)::json->>'x-device-id'
            AND players.role = 'referee'
        )
    );
