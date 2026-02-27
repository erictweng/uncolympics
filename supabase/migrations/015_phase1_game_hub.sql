-- Phase 1: Game Hub + Simplified Game Flow

-- New games_v2 table (predetermined 5-game format)
CREATE TABLE IF NOT EXISTS games_v2 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  index INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'physical' CHECK (type IN ('physical', 'video')),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  winner_team TEXT CHECK (winner_team IN ('A', 'B')),
  points_a INTEGER DEFAULT 0,
  points_b INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE games_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games_v2_open" ON games_v2 FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE games_v2 REPLICA IDENTITY FULL;

-- Alter tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS current_game_index INTEGER DEFAULT 0;
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_status_check CHECK (status IN ('lobby', 'game_setup', 'team_select', 'shuffling', 'picking', 'playing', 'scoring', 'completed'));

-- Alter players
ALTER TABLE players ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IN ('wonderkid', 'rising_prospect', 'certified', 'seasoned_veteran'));
ALTER TABLE players ADD COLUMN IF NOT EXISTS draft_order INTEGER;
