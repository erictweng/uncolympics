import { create } from 'zustand'
import type { Title, Team } from '../types'

interface CeremonyStore {
  // State
  globalTitles: (Title & { playerName: string })[]
  winningTeam: Team | null
  isTied: boolean
  ceremonyPhase: 'loading' | 'global_titles' | 'winner' | 'summary'
  ceremonyRevealIndex: number

  // Actions
  // Sprint 7: Ceremony actions
  setGlobalTitles: (titles: (Title & { playerName: string })[]) => void
  setWinningTeam: (team: Team | null) => void
  setIsTied: (tied: boolean) => void
  setCeremonyPhase: (phase: 'loading' | 'global_titles' | 'winner' | 'summary') => void
  nextCeremonyReveal: () => void
  reset: () => void
}

const useCeremonyStore = create<CeremonyStore>((set) => ({
  // Initial state
  globalTitles: [],
  winningTeam: null,
  isTied: false,
  ceremonyPhase: 'loading',
  ceremonyRevealIndex: 0,
  
  // Sprint 7: Ceremony action implementations
  setGlobalTitles: (titles) => set({ globalTitles: titles }),
  
  setWinningTeam: (team) => set({ winningTeam: team }),
  
  setIsTied: (tied) => set({ isTied: tied }),
  
  setCeremonyPhase: (phase) => set({ ceremonyPhase: phase }),
  
  nextCeremonyReveal: () => set((state) => ({
    ceremonyRevealIndex: state.ceremonyRevealIndex + 1
  })),

  reset: () => set({
    globalTitles: [],
    winningTeam: null,
    isTied: false,
    ceremonyPhase: 'loading',
    ceremonyRevealIndex: 0
  }),
}))

export default useCeremonyStore