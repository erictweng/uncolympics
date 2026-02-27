-- Phase 2: Snake Draft System

-- Add captain flag to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_captain BOOLEAN DEFAULT false;

-- Add draft state to tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS draft_turn UUID;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS draft_pick_number INTEGER DEFAULT 0;

-- Update tournament status constraint: replace team_select/shuffling with drafting
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_status_check CHECK (status IN ('lobby', 'game_setup', 'drafting', 'playing', 'scoring', 'completed'));
