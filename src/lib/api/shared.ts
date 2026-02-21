import { supabase } from '../supabase'
import type { Tournament, Player, Team, GameResult, GameType, GameWithType, TitleWithPlayer, LeaderboardEntry } from '../../types'

/**
 * Shared tournament data fetcher — single source of truth.
 * Used by scoreboard, ceremony, history detail, and recap views.
 * Eliminates the 4 duplicate query patterns that existed before.
 */
export async function fetchFullTournamentData(tournamentId: string) {
  // 1. Tournament
  const { data: tournaments, error: tErr } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .limit(1)
  const tournament = tournaments?.[0]
  if (tErr || !tournament) throw new Error(`Failed to fetch tournament: ${tErr?.message}`)

  // 2. Teams ordered by points
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('total_points', { ascending: false })
  if (teamsErr) throw new Error(`Failed to fetch teams: ${teamsErr.message}`)

  // 3. Players
  const { data: players, error: playersErr } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('name')
  if (playersErr) throw new Error(`Failed to fetch players: ${playersErr.message}`)

  // 4. Completed games with game_type
  const { data: completedGames, error: gamesErr } = await supabase
    .from('games')
    .select('*, game_type:game_types(*)')
    .eq('tournament_id', tournamentId)
    .eq('status', 'completed')
    .order('game_order')
  if (gamesErr) throw new Error(`Failed to fetch games: ${gamesErr.message}`)

  // 5. Game results
  const gameIds = (completedGames || []).map(g => g.id)
  let gameResults: GameResult[] = []
  if (gameIds.length > 0) {
    const { data: results, error: resErr } = await supabase
      .from('game_results')
      .select('*')
      .in('game_id', gameIds)
    if (resErr) throw new Error(`Failed to fetch results: ${resErr.message}`)
    gameResults = results || []
  }

  // 6. All titles
  const { data: allTitlesRaw, error: titlesErr } = await supabase
    .from('titles')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at')
  if (titlesErr) throw new Error(`Failed to fetch titles: ${titlesErr.message}`)

  // 7. Player stats (for scoreboard)
  let playerStats: any[] = []
  if (gameIds.length > 0) {
    const { data: stats, error: statsErr } = await supabase
      .from('player_stats')
      .select('*')
      .in('game_id', gameIds)
      .order('submitted_at')
    if (!statsErr) playerStats = stats || []
  }

  // --- Derived data ---

  const teamList = teams || []
  const playerList = players || []

  // Player name/team maps
  const playerNameMap = new Map<string, string>()
  const playerTeamMap = new Map<string, string>()
  playerList.forEach(p => {
    playerNameMap.set(p.id, p.name)
    if (p.team_id) {
      const team = teamList.find(t => t.id === p.team_id)
      playerTeamMap.set(p.id, team?.name || 'No Team')
    }
  })

  // Games with type + winner name
  const games: GameWithType[] = (completedGames || []).map(game => {
    const result = gameResults.find(r => r.game_id === game.id)
    const winningTeam = result?.winning_team_id
      ? teamList.find(t => t.id === result.winning_team_id)
      : null
    return {
      ...game,
      gameType: game.game_type as GameType,
      winnerName: winningTeam?.name
    }
  })

  // Titles with player/team names
  const allTitles: TitleWithPlayer[] = (allTitlesRaw || []).map(t => ({
    ...t,
    playerName: playerNameMap.get(t.player_id) || 'Unknown',
    teamName: playerTeamMap.get(t.player_id) || 'No Team'
  }))

  const globalTitles = allTitles.filter(t => !t.game_id)
  const gameTitles = allTitles.filter(t => t.game_id !== null)

  // Title leaderboard
  const titleCounts = new Map<string, { count: number; playerName: string; teamName: string }>()
  allTitles.forEach(t => {
    if (titleCounts.has(t.player_id)) {
      titleCounts.get(t.player_id)!.count += 1
    } else {
      titleCounts.set(t.player_id, {
        count: 1,
        playerName: t.playerName,
        teamName: t.teamName
      })
    }
  })
  const titleLeaderboard: LeaderboardEntry[] = Array.from(titleCounts.entries())
    .map(([playerId, data]) => ({
      playerId,
      playerName: data.playerName,
      teamName: data.teamName,
      titleCount: data.count
    }))
    .sort((a, b) => b.titleCount - a.titleCount)

  // Winner determination
  let winningTeam: Team | null = null
  let isTied = false
  if (teamList.length >= 2) {
    if (teamList[0].total_points > teamList[1].total_points) {
      winningTeam = teamList[0]
    } else if (teamList[0].total_points === teamList[1].total_points) {
      isTied = true
    }
  } else if (teamList.length === 1) {
    winningTeam = teamList[0]
  }

  return {
    tournament: tournament as Tournament,
    teams: teamList as Team[],
    players: playerList as Player[],
    games,
    gameResults,
    allTitles,
    globalTitles,
    gameTitles,
    playerStats,
    titleLeaderboard,
    winningTeam,
    isTied
  }
}
