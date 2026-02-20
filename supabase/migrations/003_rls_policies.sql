-- Enable Row Level Security on all tables
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE titles ENABLE ROW LEVEL SECURITY;

-- Tournament policies
CREATE POLICY "Anyone can read tournaments" ON tournaments
    FOR SELECT USING (true);

CREATE POLICY "Anyone can create tournaments" ON tournaments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Only referee can update tournament" ON tournaments
    FOR UPDATE USING (
        referee_id IN (
            SELECT id FROM players WHERE device_id = current_setting('request.headers')::json->>'x-device-id'
        )
    );

-- Player policies
CREATE POLICY "Anyone can read players in their tournament" ON players
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert players" ON players
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Players can update themselves" ON players
    FOR UPDATE USING (
        device_id = current_setting('request.headers')::json->>'x-device-id'
    );

-- Team policies
CREATE POLICY "Anyone can read teams" ON teams
    FOR SELECT USING (true);

CREATE POLICY "Anyone can create teams" ON teams
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Team members can update team info" ON teams
    FOR UPDATE USING (
        id IN (
            SELECT team_id FROM players 
            WHERE device_id = current_setting('request.headers')::json->>'x-device-id'
        )
    );

-- Game types policies (built-ins are public, custom ones are per-tournament)
CREATE POLICY "Anyone can read built-in game types" ON game_types
    FOR SELECT USING (tournament_id IS NULL OR true);

CREATE POLICY "Anyone can create custom game types" ON game_types
    FOR INSERT WITH CHECK (true);

-- Games policies
CREATE POLICY "Anyone can read games" ON games
    FOR SELECT USING (true);

CREATE POLICY "Team leaders can create games" ON games
    FOR INSERT WITH CHECK (
        picked_by_team IN (
            SELECT team_id FROM players 
            WHERE device_id = current_setting('request.headers')::json->>'x-device-id'
            AND is_leader = true
        )
    );

CREATE POLICY "Referee can update games" ON games
    FOR UPDATE USING (
        tournament_id IN (
            SELECT tournament_id FROM players 
            WHERE device_id = current_setting('request.headers')::json->>'x-device-id'
            AND role = 'referee'
        )
    );

-- Player stats policies
CREATE POLICY "Anyone can read player stats" ON player_stats
    FOR SELECT USING (true);

CREATE POLICY "Players can insert their own stats" ON player_stats
    FOR INSERT WITH CHECK (
        player_id IN (
            SELECT id FROM players 
            WHERE device_id = current_setting('request.headers')::json->>'x-device-id'
        )
    );

-- Game results policies  
CREATE POLICY "Anyone can read game results" ON game_results
    FOR SELECT USING (true);

CREATE POLICY "Referee can insert game results" ON game_results
    FOR INSERT WITH CHECK (
        game_id IN (
            SELECT g.id FROM games g
            JOIN tournaments t ON g.tournament_id = t.id
            JOIN players p ON t.referee_id = p.id
            WHERE p.device_id = current_setting('request.headers')::json->>'x-device-id'
        )
    );

-- Titles policies
CREATE POLICY "Anyone can read titles" ON titles
    FOR SELECT USING (true);

CREATE POLICY "Referee can insert titles" ON titles
    FOR INSERT WITH CHECK (
        tournament_id IN (
            SELECT tournament_id FROM players 
            WHERE device_id = current_setting('request.headers')::json->>'x-device-id'
            AND role = 'referee'
        )
    );