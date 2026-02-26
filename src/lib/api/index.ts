// Barrel re-export — all API functions accessible from '../lib/api'
// Domain modules: tournaments, lobby, games, titles, scoreboard, ceremony, history

export { createTournament, validateRoomCode, joinTournament, reconnectPlayer, startTournament, cancelTournament, leaveTournament, assignRandomLeaders, setTournamentShuffling } from './tournaments'
export { fetchLobbyState, createTeam, updateTeamName, joinTeam, leaveTeam, voteForLeader } from './lobby'
export { fetchAvailableGames, fetchPickState, pickGame, fetchGameState, submitPlayerStats, submitGameResult, endGame, createCustomGameType } from './games'
export { saveTitles, saveGlobalTitles, updateTeamPoints, fetchTitlesForGame, advanceToNextRound } from './titles'
export { fetchScoreboard, fetchPlayerDetail } from './scoreboard'
export { fetchCeremonyData } from './ceremony'
export { fetchTournamentHistory, fetchTournamentDetail } from './history'
export { submitDicePick, resetDiceRoll, confirmDiceWinner } from './diceroll'
