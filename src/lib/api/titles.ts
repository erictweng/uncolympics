import { supabase } from '../supabase'
import type { Tournament, Team, Title } from '../../types'

export async function saveTitles(
  tournamentId: string, gameId: string,
  titles: { playerId: string; titleName: string; titleDesc: string; isFunny: boolean; points: number }[]
): Promise<any[]> {
  if (titles.length === 0) return []

  const titleRecords = titles.map(title => ({
    tournament_id: tournamentId, game_id: gameId,
    player_id: title.playerId, title_name: title.titleName,
    title_desc: title.titleDesc, is_funny: title.isFunny, points: title.points
  }))

  const { data, error } = await supabase.from('titles').insert(titleRecords).select()
  if (error || !data) throw new Error(`Failed to save titles: ${error?.message}`)
  return data
}

export async function saveGlobalTitles(
  tournamentId: string,
  titles: { playerId: string; titleName: string; titleDesc: string; isFunny: boolean; points: number }[]
): Promise<any[]> {
  if (titles.length === 0) return []

  const records = titles.map(t => ({
    tournament_id: tournamentId, game_id: null,
    player_id: t.playerId, title_name: t.titleName,
    title_desc: t.titleDesc, is_funny: t.isFunny, points: t.points
  }))

  const { data, error } = await supabase.from('titles').insert(records).select()
  if (error) throw new Error(`Failed to save global titles: ${error.message}`)
  return data || []
}

export async function updateTeamPoints(tournamentId: string): Promise<Team[]> {
  const { data: titles, error: titlesError } = await supabase
    .from('titles').select('player_id, points').eq('tournament_id', tournamentId)
  if (titlesError) throw new Error(`Failed to fetch titles: ${titlesError.message}`)

  if (!titles || titles.length === 0) {
    const { data: teams, error: teamsError } = await supabase
      .from('teams').select('*').eq('tournament_id', tournamentId)
    if (teamsError) throw new Error(`Failed to fetch teams: ${teamsError.message}`)
    return teams || []
  }

  const { data: players, error: playersError } = await supabase
    .from('players').select('id, team_id').eq('tournament_id', tournamentId).not('team_id', 'is', null)
  if (playersError) throw new Error(`Failed to fetch players: ${playersError.message}`)

  const playerToTeam = new Map<string, string>()
  ;(players || []).forEach(player => {
    if (player.team_id) playerToTeam.set(player.id, player.team_id)
  })

  const teamPoints = new Map<string, number>()
  titles.forEach(title => {
    const teamId = playerToTeam.get(title.player_id)
    if (teamId) teamPoints.set(teamId, (teamPoints.get(teamId) || 0) + title.points)
  })

  for (const [teamId, totalPoints] of teamPoints) {
    const { error: updateError } = await supabase
      .from('teams').update({ total_points: totalPoints }).eq('id', teamId)
    if (updateError) throw new Error(`Failed to update team points: ${updateError.message}`)
  }

  const { data: allTeams, error: allTeamsError } = await supabase
    .from('teams').select('*').eq('tournament_id', tournamentId)
  if (allTeamsError) throw new Error(`Failed to fetch all teams: ${allTeamsError.message}`)
  return allTeams || []
}

export async function fetchTitlesForGame(gameId: string): Promise<(Title & { playerName: string })[]> {
  const { data: titles, error: titlesError } = await supabase
    .from('titles').select('*').eq('game_id', gameId).order('created_at')
  if (titlesError) throw new Error(`Failed to fetch titles: ${titlesError.message}`)
  if (!titles || titles.length === 0) return []

  const playerIds = [...new Set(titles.map(t => t.player_id))]
  const { data: players, error: playersError } = await supabase
    .from('players').select('id, name').in('id', playerIds)
  if (playersError) throw new Error(`Failed to fetch player names: ${playersError.message}`)

  const playerNames = new Map<string, string>()
  ;(players || []).forEach(player => playerNames.set(player.id, player.name))

  return titles.map(title => ({
    ...title,
    playerName: playerNames.get(title.player_id) || 'Unknown Player'
  }))
}

export async function advanceToNextRound(tournamentId: string, gameId: string): Promise<{ tournament: Tournament; isLastGame: boolean }> {
  const { error: gameError } = await supabase
    .from('games').update({ status: 'completed' }).eq('id', gameId)
  if (gameError) throw new Error(`Failed to update game status: ${gameError?.message}`)

  const { count: completedGames, error: countError } = await supabase
    .from('games').select('id', { count: 'exact' })
    .eq('tournament_id', tournamentId).eq('status', 'completed')
  if (countError) throw new Error(`Failed to count completed games: ${countError.message}`)

  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments').select('*').eq('id', tournamentId).single()
  if (tournamentError || !tournament) throw new Error(`Failed to fetch tournament: ${tournamentError?.message}`)

  const totalGamesCompleted = completedGames || 0

  if (totalGamesCompleted < tournament.num_games) {
    const { data: otherTeam, error: otherTeamError } = await supabase
      .from('teams').select('id').eq('tournament_id', tournamentId)
      .neq('id', tournament.current_pick_team).single()
    if (otherTeamError || !otherTeam) throw new Error(`Failed to find other team: ${otherTeamError?.message}`)

    const { data: updatedList, error: updateError } = await supabase
      .from('tournaments')
      .update({ status: 'picking', current_pick_team: otherTeam.id })
      .eq('id', tournamentId).select().limit(1)
    if (updateError || !updatedList || updatedList.length === 0) throw new Error(`Failed to update tournament: ${updateError?.message}`)
    return { tournament: updatedList[0], isLastGame: false }
  } else {
    const { data: updatedList, error: updateError } = await supabase
      .from('tournaments').update({ status: 'completed' }).eq('id', tournamentId).select().limit(1)
    if (updateError || !updatedList || updatedList.length === 0) throw new Error(`Failed to complete tournament: ${updateError?.message}`)
    return { tournament: updatedList[0], isLastGame: true }
  }
}
