import { create } from 'zustand'
import type { Title, PlayerStat } from '../types'

interface TitleStore {
  // State
  gameTitles: (Title & { playerName: string })[]
  revealIndex: number
  revealComplete: boolean
  isLastGame: boolean
  titles: Title[]
  playerStats: PlayerStat[]

  // Actions
  // Sprint 5: Title Reveal actions
  setGameTitles: (titles: (Title & { playerName: string })[]) => void
  nextReveal: () => void
  resetReveal: () => void
  reset: () => void
  setIsLastGame: (isLast: boolean) => void
  
  // Legacy actions (keeping for existing functionality)
  addStat: (stat: PlayerStat) => void
  addTitle: (title: Title) => void
}

const useTitleStore = create<TitleStore>((set) => ({
  // Initial state
  gameTitles: [],
  revealIndex: 0,
  revealComplete: false,
  isLastGame: false,
  titles: [],
  playerStats: [],
  
  // Sprint 5: Title Reveal action implementations
  setGameTitles: (titles) => set({ 
    gameTitles: titles,
    revealIndex: 0,
    revealComplete: titles.length === 0
  }),
  
  nextReveal: () => set((state) => {
    const nextIndex = state.revealIndex + 1;
    return {
      revealIndex: nextIndex,
      revealComplete: nextIndex >= state.gameTitles.length
    };
  }),
  
  resetReveal: () => set({
    revealIndex: 0,
    revealComplete: false
  }),
  
  setIsLastGame: (isLast) => set({ isLastGame: isLast }),
  
  // Legacy actions (keeping for existing functionality)
  addStat: (stat) => set((state) => ({
    playerStats: [...state.playerStats, stat]
  })),
  
  addTitle: (title) => set((state) => ({
    titles: [...state.titles, title]
  })),

  reset: () => set({
    gameTitles: [],
    revealIndex: 0,
    revealComplete: false,
    isLastGame: false,
    titles: [],
    playerStats: []
  }),
}))

export default useTitleStore