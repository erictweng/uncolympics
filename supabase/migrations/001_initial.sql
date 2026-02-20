-- UNCOLYMPICS Initial Schema

-- UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tournaments table
CREATE TABLE tournaments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code text UNIQUE NOT NULL,
    name text NOT NULL,
    status text NOT NULL CHECK (status IN ('lobby', 'picking', 'playing', 'scoring', 'completed')),
    num_games int NOT NULL,
    time_est_min int NOT NULL,
    referee_id uuid,
    current_pick_team uuid,
    created_at timestamptz DEFAULT now()
);

-- Players table
CREATE TABLE players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL,
    name text NOT NULL,
    device_id text NOT NULL,
    team_id uuid,
    role text NOT NULL CHECK (role IN ('referee', 'player', 'spectator')),
    is_leader boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Teams table
CREATE TABLE teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL,
    name text NOT NULL,
    total_points decimal DEFAULT 0
);

-- Game types table
CREATE TABLE game_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid, -- NULL for built-ins
    name text NOT NULL,
    emoji text NOT NULL,
    description text NOT NULL,
    player_inputs jsonb NOT NULL,
    referee_inputs jsonb NOT NULL,
    title_definitions jsonb NOT NULL
);

-- Games table
CREATE TABLE games (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL,
    game_type_id uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'active', 'scoring', 'titles', 'completed')),
    picked_by_team uuid NOT NULL,
    game_order int NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Player stats table
CREATE TABLE player_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL,
    player_id uuid NOT NULL,
    stat_key text NOT NULL,
    stat_value decimal NOT NULL,
    submitted_at timestamptz DEFAULT now()
);

-- Game results table
CREATE TABLE game_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL,
    winning_team_id uuid,
    result_data jsonb
);

-- Titles table
CREATE TABLE titles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL,
    game_id uuid, -- NULL for global tournament titles
    player_id uuid NOT NULL,
    title_name text NOT NULL,
    title_desc text NOT NULL,
    is_funny boolean DEFAULT false,
    points decimal DEFAULT 0.5
);

-- Foreign Key Constraints
ALTER TABLE tournaments ADD CONSTRAINT fk_tournaments_referee 
    FOREIGN KEY (referee_id) REFERENCES players(id);
    
ALTER TABLE tournaments ADD CONSTRAINT fk_tournaments_current_pick_team 
    FOREIGN KEY (current_pick_team) REFERENCES teams(id);

ALTER TABLE players ADD CONSTRAINT fk_players_tournament 
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id);
    
ALTER TABLE players ADD CONSTRAINT fk_players_team 
    FOREIGN KEY (team_id) REFERENCES teams(id);

ALTER TABLE teams ADD CONSTRAINT fk_teams_tournament 
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id);

ALTER TABLE game_types ADD CONSTRAINT fk_game_types_tournament 
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id);

ALTER TABLE games ADD CONSTRAINT fk_games_tournament 
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id);
    
ALTER TABLE games ADD CONSTRAINT fk_games_game_type 
    FOREIGN KEY (game_type_id) REFERENCES game_types(id);
    
ALTER TABLE games ADD CONSTRAINT fk_games_picked_by_team 
    FOREIGN KEY (picked_by_team) REFERENCES teams(id);

ALTER TABLE player_stats ADD CONSTRAINT fk_player_stats_game 
    FOREIGN KEY (game_id) REFERENCES games(id);
    
ALTER TABLE player_stats ADD CONSTRAINT fk_player_stats_player 
    FOREIGN KEY (player_id) REFERENCES players(id);

ALTER TABLE game_results ADD CONSTRAINT fk_game_results_game 
    FOREIGN KEY (game_id) REFERENCES games(id);
    
ALTER TABLE game_results ADD CONSTRAINT fk_game_results_winning_team 
    FOREIGN KEY (winning_team_id) REFERENCES teams(id);

ALTER TABLE titles ADD CONSTRAINT fk_titles_tournament 
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id);
    
ALTER TABLE titles ADD CONSTRAINT fk_titles_game 
    FOREIGN KEY (game_id) REFERENCES games(id);
    
ALTER TABLE titles ADD CONSTRAINT fk_titles_player 
    FOREIGN KEY (player_id) REFERENCES players(id);

-- Indexes
CREATE INDEX idx_tournaments_room_code ON tournaments(room_code);
CREATE INDEX idx_players_tournament_id ON players(tournament_id);
CREATE INDEX idx_players_device_id ON players(device_id);
CREATE INDEX idx_teams_tournament_id ON teams(tournament_id);
CREATE INDEX idx_game_types_tournament_id ON game_types(tournament_id);
CREATE INDEX idx_games_tournament_id ON games(tournament_id);
CREATE INDEX idx_player_stats_game_id ON player_stats(game_id);
CREATE INDEX idx_player_stats_player_id ON player_stats(player_id);
CREATE INDEX idx_game_results_game_id ON game_results(game_id);
CREATE INDEX idx_titles_tournament_id ON titles(tournament_id);
CREATE INDEX idx_titles_game_id ON titles(game_id);
CREATE INDEX idx_titles_player_id ON titles(player_id);