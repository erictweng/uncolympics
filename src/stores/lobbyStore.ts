import { create } from 'zustand'
import type { Tournament, Player, Team, LeaderVote } from '../types'

interface LobbyStore {
  // State
  tournament: Tournament | null
  currentPlayer: Player | null
  players: Player[]
  teams: Team[]
  votes: LeaderVote[]
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected' | null

  // Actions
  setTournament: (tournament: Tournament) => void
  setCurrentPlayer: (player: Player) => void
  
  // Player actions
  addPlayer: (player: Player) => void
  updatePlayer: (player: Player) => void
  removePlayer: (playerId: string) => void
  setPlayers: (players: Player[]) => void
  
  // Team actions
  addTeam: (team: Team) => void
  updateTeam: (team: Team) => void
  removeTeam: (teamId: string) => void
  setTeams: (teams: Team[]) => void
  
  // Vote actions
  addVote: (vote: LeaderVote) => void
  updateVote: (vote: LeaderVote) => void
  removeVote: (voteId: string) => void
  setVotes: (votes: LeaderVote[]) => void
  
  // Connection status
  setConnectionStatus: (status: 'connected' | 'reconnecting' | 'disconnected') => void
  
  // Legacy actions (keeping for existing functionality)
  setTeam: (playerId: string, teamId: string) => void
}

const useLobbyStore = create<LobbyStore>((set) => ({
  // Initial state
  tournament: null,
  currentPlayer: null,
  players: [],
  teams: [],
  votes: [],
  connectionStatus: null,
  
  // Actions
  setTournament: (tournament) => set({ tournament }),
  
  setCurrentPlayer: (player) => set({ currentPlayer: player }),
  
  // Player actions
  addPlayer: (player) => set((state) => ({
    players: [...state.players.filter(p => p.id !== player.id), player]
  })),
  
  updatePlayer: (player) => set((state) => ({
    players: state.players.map(p => p.id === player.id ? player : p),
    // Update current player if it's the same person
    currentPlayer: state.currentPlayer?.id === player.id ? player : state.currentPlayer
  })),
  
  removePlayer: (playerId) => set((state) => ({
    players: state.players.filter(p => p.id !== playerId)
  })),
  
  setPlayers: (players) => set({ players }),
  
  // Team actions
  addTeam: (team) => set((state) => ({
    teams: [...state.teams.filter(t => t.id !== team.id), team]
  })),
  
  updateTeam: (team) => set((state) => ({
    teams: state.teams.map(t => t.id === team.id ? team : t)
  })),
  
  removeTeam: (teamId) => set((state) => ({
    teams: state.teams.filter(t => t.id !== teamId)
  })),
  
  setTeams: (teams) => set({ teams }),
  
  // Vote actions
  addVote: (vote) => set((state) => {
    const teamIds = state.teams.map(t => t.id);
    // Only add votes that belong to teams in current tournament
    if (teamIds.includes(vote.team_id)) {
      return {
        votes: [...state.votes.filter(v => v.id !== vote.id), vote]
      };
    }
    return state;
  }),
  
  updateVote: (vote) => set((state) => ({
    votes: state.votes.map(v => v.id === vote.id ? vote : v)
  })),
  
  removeVote: (voteId) => set((state) => ({
    votes: state.votes.filter(v => v.id !== voteId)
  })),
  
  setVotes: (votes) => set({ votes }),
  
  // Connection status
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  
  // Legacy actions (keeping for existing functionality)
  setTeam: (playerId, teamId) => set((state) => ({
    players: state.players.map(p => 
      p.id === playerId ? { ...p, team_id: teamId } : p
    )
  })),
}))

export default useLobbyStore