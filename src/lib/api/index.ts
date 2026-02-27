// Barrel re-export — all API functions accessible from '../lib/api'
// Domain modules: tournaments, lobby, games, titles, scoreboard, ceremony, history

export { createTournament, validateRoomCode, joinTournament, reconnectPlayer, startTournament, cancelTournament, leaveTournament, assignRandomLeaders, setTournamentShuffling } from './tournaments'
export { fetchLobbyState, createTeam, updateTeamName, joinTeam, leaveTeam, voteForLeader } from './lobby'
export { fetchAvailableGames, fetchPickState, pickGame, fetchGameState, submitPlayerStats, submitGameResult, endGame, createCustomGameType } from './games'
export { saveTitles, saveGlobalTitles, updateTeamPoints, fetchTitlesForGame, advanceToNextRound } from './titles'
export { fetchScoreboard, fetchPlayerDetail } from './scoreboard'
export { fetchCeremonyData } from './ceremony'
export { fetchTournamentHistory, fetchTournamentDetail } from './history'
export { createGamesV2, getGamesV2, updateGameV2, startGameV2, endGameV2, getCurrentGameV2, deleteGamesV2 } from './gamesV2'
export { selectCaptains, getAvailablePlayers, draftPlayer, getDraftState, startDraft, finishDraft, getSnakeDraftTeam } from './draft'
export { getPlayersWithProfiles } from './openingCeremony'
export type { PlayerWithProfile } from './openingCeremony'
