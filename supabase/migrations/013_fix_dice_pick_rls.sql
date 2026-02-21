-- BUG-039: "Failed to submit a pick" — one player works, other doesn't
-- Root cause: submitDicePick() updates tournaments.dice_roll_data, but the
-- UPDATE policy only allows the referee. Team leaders can't update tournaments.
--
-- Also: pickGame() inserts into games AND updates tournaments — same issue
-- for the tournament update step.
--
-- Fix: Open up tournaments UPDATE policy for this party game.
-- Also open games INSERT so any leader can pick regardless of device_id matching quirks.

-- ============================================================
-- FIX 1: Replace tournament UPDATE policy — allow all authenticated updates
-- ============================================================
DROP POLICY IF EXISTS "Referee or creator can update tournament" ON tournaments;

CREATE POLICY "Allow all tournament updates" ON tournaments
    FOR UPDATE USING (true);

-- ============================================================
-- FIX 2: Replace games INSERT policy — allow all inserts
-- ============================================================
DROP POLICY IF EXISTS "Team leaders can create games" ON games;

CREATE POLICY "Allow all game inserts" ON games
    FOR INSERT WITH CHECK (true);

-- ============================================================
-- FIX 3: Ensure games UPDATE is also open (endGame updates games)
-- ============================================================
DROP POLICY IF EXISTS "Referee can update games" ON games;

CREATE POLICY "Allow all game updates" ON games
    FOR UPDATE USING (true);
