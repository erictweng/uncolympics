import { create } from 'zustand'
import type { Tournament, Player, Team, Game, Title, PlayerStat, LeaderVote, GameType, GameResult, ScoreboardData, PlayerDetail } from '../types'

interface GameStore {
  // State
  tournament: Tournament | null
  currentPlayer: Player | null
  players: Player[]
  teams: Team[]
  votes: LeaderVote[]
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected' | null
  currentGame: Game | null
  titles: Title[]
  playerStats: PlayerStat[]
  
  // Sprint 3: Game Pick state
  availableGames: GameType[]
  pickedGames: Game[]
  currentPickTeam: string | null
  currentRound: number
  
  // Sprint 4: Game Play state
  currentGameStats: PlayerStat[]
  currentGameResult: GameResult | null
  liveFeed: { 
    playerName: string
    statKey: string
    statValue: number
    statLabel: string
    timestamp: string
  }[]
  
  // Sprint 5: Title Reveal state
  gameTitles: (Title & { playerName: string })[]
  revealIndex: number
  revealComplete: boolean
  isLastGame: boolean
  
  // Sprint 6: Scoreboard state
  scoreboardData: ScoreboardData | null
  selectedPlayer: PlayerDetail | null
  
  // Sprint 7: Ceremony state
  globalTitles: (Title & { playerName: string })[]
  winningTeam: Team | null
  isTied: boolean
  ceremonyPhase: 'loading' | 'global_titles' | 'winner' | 'summary'
  ceremonyRevealIndex: number
  
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
  
  // Sprint 5: Title Reveal actions
  setGameTitles: (titles: (Title & { playerName: string })[]) => void
  nextReveal: () => void
  resetReveal: () => void
  setIsLastGame: (isLast: boolean) => void
  
  // Sprint 6: Scoreboard actions
  setScoreboardData: (data: ScoreboardData) => void
  setSelectedPlayer: (detail: PlayerDetail | null) => void
  clearSelectedPlayer: () => void
  
  // Sprint 7: Ceremony actions
  setGlobalTitles: (titles: (Title & { playerName: string })[]) => void
  setWinningTeam: (team: Team | null) => void
  setIsTied: (tied: boolean) => void
  setCeremonyPhase: (phase: 'loading' | 'global_titles' | 'winner' | 'summary') => void
  nextCeremonyReveal: () => void
  
  // Legacy actions (keeping for existing functionality)
  setTeam: (playerId: string, teamId: string) => void
  setGame: (game: Game) => void
  addStat: (stat: PlayerStat) => void
  addTitle: (title: Title) => void
  reset: () => void
}

const useGameStore = create<GameStore>((set) => ({
  // Initial state
  tournament: null,
  currentPlayer: null,
  players: [],
  teams: [],
  votes: [],
  connectionStatus: null,
  currentGame: null,
  titles: [],
  playerStats: [],
  
  // Sprint 3: Game Pick initial state
  availableGames: [],
  pickedGames: [],
  currentPickTeam: null,
  currentRound: 1,
  
  // Sprint 4: Game Play initial state
  currentGameStats: [],
  currentGameResult: null,
  liveFeed: [],
  
  // Sprint 5: Title Reveal initial state
  gameTitles: [],
  revealIndex: 0,
  revealComplete: false,
  isLastGame: false,
  
  // Sprint 6: Scoreboard initial state
  scoreboardData: null,
  selectedPlayer: null,
  
  // Sprint 7: Ceremony initial state
  globalTitles: [],
  winningTeam: null,
  isTied: false,
  ceremonyPhase: 'loading',
  ceremonyRevealIndex: 0,
  
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
  
  // Sprint 6: Scoreboard action implementations
  setScoreboardData: (data) => set({ scoreboardData: data }),
  
  setSelectedPlayer: (detail) => set({ selectedPlayer: detail }),
  
  clearSelectedPlayer: () => set({ selectedPlayer: null }),
  
  // Sprint 7: Ceremony action implementations
  setGlobalTitles: (titles) => set({ globalTitles: titles }),
  
  setWinningTeam: (team) => set({ winningTeam: team }),
  
  setIsTied: (tied) => set({ isTied: tied }),
  
  setCeremonyPhase: (phase) => set({ ceremonyPhase: phase }),
  
  nextCeremonyReveal: () => set((state) => ({
    ceremonyRevealIndex: state.ceremonyRevealIndex + 1
  })),
  
  // Legacy actions (keeping for existing functionality)
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
    currentPlayer: null,
    players: [],
    teams: [],
    votes: [],
    connectionStatus: null,
    currentGame: null,
    titles: [],
    playerStats: [],
    // Reset Sprint 3 state too
    availableGames: [],
    pickedGames: [],
    currentPickTeam: null,
    currentRound: 1,
    // Reset Sprint 4 state too
    currentGameStats: [],
    currentGameResult: null,
    liveFeed: [],
    // Reset Sprint 5 state too
    gameTitles: [],
    revealIndex: 0,
    revealComplete: false,
    isLastGame: false,
    // Reset Sprint 6 state too
    scoreboardData: null,
    selectedPlayer: null,
    // Reset Sprint 7 state too
    globalTitles: [],
    winningTeam: null,
    isTied: false,
    ceremonyPhase: 'loading',
    ceremonyRevealIndex: 0
  })
}))

export default useGameStore