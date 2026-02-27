-- Phase 3c: Opening Ceremony
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_status_check CHECK (status IN ('lobby', 'game_setup', 'ceremony', 'drafting', 'playing', 'scoring', 'completed'));
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS ceremony_player_index INTEGER DEFAULT -1;
