-- Add 'shuffling' to tournaments.status CHECK constraint for leader shuffle animation
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_status_check
  CHECK (status IN ('lobby', 'team_select', 'shuffling', 'picking', 'playing', 'scoring', 'completed'));
