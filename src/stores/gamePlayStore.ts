import { create } from 'zustand'
import type { Game, PlayerStat, GameType, GameResult } from '../types'

interface GamePlayStore {
  // State
  currentGame: Game | null
  currentGameStats: PlayerStat[]
  currentGameResult: GameResult | null
  liveFeed: { 
    playerName: string
    statKey: string
    statValue: number
    statLabel: string
    timestamp: string
  }[]
  availableGames: GameType[]
  pickedGames: Game[]
  currentPickTeam: string | null
  currentRound: number
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected' | null

  // Actions
  // Sprint 3: Game Pick actions
  setAvailableGames: (games: GameType[]) => void
  setPickedGames: (games: Game[]) => void
  setCurrentPickTeam: (teamId: string | null) => void
  setCurrentRound: (round: number) => void
  addPickedGame: (game: Game) => void
  
  // Sprint 4: Game Play actions
  setCurrentGameStats: (stats: PlayerStat[]) => void
  addGameStat: (stat: PlayerStat) => void
  setCurrentGameResult: (result: GameResult | null) => void
  addFeedItem: (item: { 
    playerName: string
    statKey: string
    statValue: number
    statLabel: string
    timestamp: string
  }) => void
  clearGameState: () => void
  reset: () => void
  
  // Connection status
  setConnectionStatus: (status: 'connected' | 'reconnecting' | 'disconnected') => void
  
  // Legacy actions (keeping for existing functionality)
  setGame: (game: Game | null) => void
}

const useGamePlayStore = create<GamePlayStore>((set) => ({
  // Initial state
  currentGame: null,
  currentGameStats: [],
  currentGameResult: null,
  liveFeed: [],
  availableGames: [],
  pickedGames: [],
  currentPickTeam: null,
  currentRound: 1,
  connectionStatus: null,
  
  // Sprint 3: Game Pick actions
  setAvailableGames: (games) => set({ availableGames: games }),
  
  setPickedGames: (games) => set({ pickedGames: games }),
  
  setCurrentPickTeam: (teamId) => set({ currentPickTeam: teamId }),
  
  setCurrentRound: (round) => set({ currentRound: round }),
  
  addPickedGame: (game) => set((state) => ({
    pickedGames: [...state.pickedGames, game],
    // Remove the game type from available games
    availableGames: state.availableGames.filter(gt => gt.id !== game.game_type_id)
  })),
  
  // Sprint 4: Game Play actions
  setCurrentGameStats: (stats) => set({ currentGameStats: stats }),
  
  addGameStat: (stat) => set((state) => {
    // Update or add stat in currentGameStats
    const existingIndex = state.currentGameStats.findIndex(
      s => s.game_id === stat.game_id && 
           s.player_id === stat.player_id && 
           s.stat_key === stat.stat_key
    );
    
    const updatedStats = existingIndex >= 0 
      ? state.currentGameStats.map((s, i) => i === existingIndex ? stat : s)
      : [...state.currentGameStats, stat];
      
    return { currentGameStats: updatedStats };
  }),
  
  setCurrentGameResult: (result) => set({ currentGameResult: result }),
  
  addFeedItem: (item) => set((state) => ({
    liveFeed: [item, ...state.liveFeed].slice(0, 50) // Keep last 50 items
  })),
  
  clearGameState: () => set({
    currentGameStats: [],
    currentGameResult: null,
    liveFeed: []
  }),
  
  // Connection status
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  
  // Legacy actions (keeping for existing functionality)
  setGame: (game) => set({ currentGame: game }),

  reset: () => set({
    currentGame: null,
    availableGames: [],
    pickedGames: [],
    currentPickTeam: null,
    currentRound: 1,
    currentGameStats: [],
    currentGameResult: null,
    liveFeed: [],
    connectionStatus: null
  }),
}))

export default useGamePlayStore