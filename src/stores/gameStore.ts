import { create } from 'zustand'

// Define types for the store
interface Tournament {
  id: string
  room_code: string
  name: string
  status: 'lobby' | 'picking' | 'playing' | 'scoring' | 'completed'
  num_games: number
  time_est_min: number
  referee_id: string
  current_pick_team: string | null
  created_at: string
}

interface Player {
  id: string
  tournament_id: string
  name: string
  device_id: string
  team_id: string | null
  role: 'referee' | 'player' | 'spectator'
  is_leader: boolean
  created_at: string
}

interface Team {
  id: string
  tournament_id: string
  name: string
  total_points: number
}

interface Game {
  id: string
  tournament_id: string
  game_type_id: string
  status: 'pending' | 'active' | 'scoring' | 'titles' | 'completed'
  picked_by_team: string
  game_order: number
  created_at: string
}

interface Title {
  id: string
  tournament_id: string
  game_id: string | null
  player_id: string
  title_name: string
  title_desc: string
  is_funny: boolean
  points: number
}

interface PlayerStat {
  id: string
  game_id: string
  player_id: string
  stat_key: string
  stat_value: number
  submitted_at: string
}

interface GameStore {
  // State
  tournament: Tournament | null
  players: Player[]
  teams: Team[]
  currentGame: Game | null
  titles: Title[]
  playerStats: PlayerStat[]
  
  // Actions
  setTournament: (tournament: Tournament) => void
  addPlayer: (player: Player) => void
  setTeam: (playerId: string, teamId: string) => void
  setGame: (game: Game) => void
  addStat: (stat: PlayerStat) => void
  addTitle: (title: Title) => void
  reset: () => void
}

const useGameStore = create<GameStore>((set) => ({
  // Initial state
  tournament: null,
  players: [],
  teams: [],
  currentGame: null,
  titles: [],
  playerStats: [],
  
  // Actions
  setTournament: (tournament) => set({ tournament }),
  
  addPlayer: (player) => set((state) => ({
    players: [...state.players, player]
  })),
  
  setTeam: (playerId, teamId) => set((state) => ({
    players: state.players.map(p => 
      p.id === playerId ? { ...p, team_id: teamId } : p
    )
  })),
  
  setGame: (game) => set({ currentGame: game }),
  
  addStat: (stat) => set((state) => ({
    playerStats: [...state.playerStats, stat]
  })),
  
  addTitle: (title) => set((state) => ({
    titles: [...state.titles, title]
  })),
  
  reset: () => set({
    tournament: null,
    players: [],
    teams: [],
    currentGame: null,
    titles: [],
    playerStats: []
  })
}))

export default useGameStore