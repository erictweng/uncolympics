// Tournament and Player types (existing in store/api)
export type TournamentStatus = 'lobby' | 'game_setup' | 'ceremony' | 'drafting' | 'playing' | 'scoring' | 'completed'

export interface Tournament {
  id: string
  room_code: string
  name: string
  status: TournamentStatus
  num_games: number
  time_est_min: number
  referee_id: string
  current_pick_team: string | null
  current_game_index: number
  dice_roll_data: DiceRollData | null
  draft_turn: string | null
  draft_pick_number: number
  ceremony_player_index: number
  created_at: string
}

export interface DiceRollData {
  picks: Record<string, number>  // teamId -> chosen number (1-6)
  target: number | null          // random target (1-6), set after both pick
  winnerId: string | null        // winning team id
  round: number                  // roll round (1+, increments on tie)
}

export interface Player {
  id: string
  tournament_id: string
  name: string
  device_id: string
  user_id: string | null
  team_id: string | null
  role: 'referee' | 'player' | 'spectator'
  is_leader: boolean
  tier: 'wonderkid' | 'rising_prospect' | 'certified' | 'seasoned_veteran' | null
  is_captain: boolean
  draft_order: number | null
  created_at: string
}

export interface Team {
  id: string
  tournament_id: string
  name: string
  total_points: number
  created_at: string
}

export interface Game {
  id: string
  tournament_id: string
  game_type_id: string
  status: 'pending' | 'active' | 'scoring' | 'titles' | 'completed'
  picked_by_team: string
  game_order: number
  created_at: string
}

// Phase 1: Predetermined game format
export interface GameV2 {
  id: string
  tournament_id: string
  index: number
  name: string
  type: 'physical' | 'video'
  status: 'upcoming' | 'active' | 'completed'
  winner_team: 'A' | 'B' | null
  points_a: number
  points_b: number
  created_at: string
}

export interface Title {
  id: string
  tournament_id: string
  game_id: string | null
  player_id: string
  title_name: string
  title_desc: string
  is_funny: boolean
  points: number
}

export interface PlayerStat {
  id: string
  game_id: string
  player_id: string
  stat_key: string
  stat_value: number
  submitted_at: string
}

export interface GameResult {
  id: string
  game_id: string
  winning_team_id: string | null
  result_data: Record<string, any>
}

// New Sprint 2 type
export interface LeaderVote {
  id: string
  team_id: string
  voter_id: string
  candidate_id: string
  created_at: string
}

// Sprint 3: Game Types
export interface GameType {
  id: string
  tournament_id: string | null
  name: string
  emoji: string
  description: string
  player_inputs: Record<string, any>
  referee_inputs: Record<string, any>
  title_definitions: Record<string, any>
  created_at: string
}

// Sprint 6: Scoreboard Types
export interface ScoreboardData {
  tournament: Tournament
  teams: Team[]
  players: Player[]
  games: GameWithType[]
  titles: TitleWithPlayer[]
  playerStats: PlayerStat[]
  titleLeaderboard: LeaderboardEntry[]
}

export interface GameWithType extends Game {
  gameType: GameType
  winnerName?: string
}

export interface TitleWithPlayer extends Title {
  playerName: string
  teamName: string
}

export interface LeaderboardEntry {
  playerId: string
  playerName: string
  teamName: string
  titleCount: number
}

export interface PlayerDetail {
  player: Player
  statsByGame: { game: GameWithType; stats: PlayerStat[] }[]
  titles: Title[]
  pointsContributed: number
}

// Sprint 7: Ceremony Types
export interface CeremonyData {
  tournament: Tournament
  teams: Team[]
  players: Player[]
  games: GameWithType[]
  allTitles: TitleWithPlayer[]
  globalTitles: TitleWithPlayer[]
  winningTeam: Team | null
  isTied: boolean
  titleLeaderboard: LeaderboardEntry[]
}

// Auth / Profile types
export interface Profile {
  id: string
  name: string
  avatar_url: string | null
  email: string | null
  tier: 'wonderkid' | 'rising_prospect' | 'certified' | 'seasoned_veteran' | null
  survey_responses: Record<string, any> | null
  survey_complete: boolean
  created_at: string
  updated_at: string
}

// Dead types removed: TournamentSummary, TournamentRecap (were unused)