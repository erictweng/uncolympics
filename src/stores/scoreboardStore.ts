import { create } from 'zustand'
import type { ScoreboardData, PlayerDetail } from '../types'

interface ScoreboardStore {
  // State
  scoreboardData: ScoreboardData | null
  selectedPlayer: PlayerDetail | null

  // Actions
  // Sprint 6: Scoreboard actions
  setScoreboardData: (data: ScoreboardData | null) => void
  setSelectedPlayer: (detail: PlayerDetail | null) => void
  clearSelectedPlayer: () => void
  reset: () => void
}

const useScoreboardStore = create<ScoreboardStore>((set) => ({
  // Initial state
  scoreboardData: null,
  selectedPlayer: null,
  
  // Sprint 6: Scoreboard action implementations
  setScoreboardData: (data) => set({ scoreboardData: data }),
  
  setSelectedPlayer: (detail) => set({ selectedPlayer: detail }),
  
  clearSelectedPlayer: () => set({ selectedPlayer: null }),

  reset: () => set({ scoreboardData: null, selectedPlayer: null }),
}))

export default useScoreboardStore