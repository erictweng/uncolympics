import { supabase } from '../supabase'
import type { Tournament, Player, Team, GameType, Game, PlayerStat, GameResult } from '../../types'

export async function fetchAvailableGames(
  tournamentId: string
): Promise<{ available: GameType[]; picked: Game[] }> {
  const { data: gameTypes, error: gameTypesError } = await supabase
    .from('game_types').select('*')
    .or(`tournament_id.is.null,tournament_id.eq.${tournamentId}`)
    .order('created_at')
  if (gameTypesError) throw new Error(`Failed to fetch game types: ${gameTypesError.message}`)

  const { data: pickedGames, error: pickedGamesError } = await supabase
    .from('games').select(`*, game_type:game_types(*)`)
    .eq('tournament_id', tournamentId).order('game_order')
  if (pickedGamesError) throw new Error(`Failed to fetch picked games: ${pickedGamesError.message}`)

  const pickedGameTypeIds = new Set((pickedGames || []).map(game => game.game_type_id))
  const availableGameTypes = (gameTypes || []).filter(gameType => !pickedGameTypeIds.has(gameType.id))

  return { available: availableGameTypes, picked: pickedGames || [] }
}

export async function fetchPickState(tournamentId: string): Promise<{
  tournament: Tournament; currentPickTeam: Team; currentLeader: Player;
  roundNumber: number; totalRounds: number; teams: Team[]; gamesPlayed: Game[];
}> {
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments').select('*').eq('id', tournamentId).single()
  if (tournamentError || !tournament) throw new Error(`Failed to fetch tournament: ${tournamentError?.message}`)

  const { data: games, error: gamesError } = await supabase
    .from('games').select(`*, game_type:game_types(*)`)
    .eq('tournament_id', tournamentId).order('game_order')
  if (gamesError) throw new Error(`Failed to fetch games: ${gamesError.message}`)

  const { data: teams, error: teamsError } = await supabase
    .from('teams').select(`*, players(*)`).eq('tournament_id', tournamentId).order('created_at')
  if (teamsError) throw new Error(`Failed to fetch teams: ${teamsError.message}`)

  const currentPickTeam = teams?.find(team => team.id === tournament.current_pick_team)
  if (!currentPickTeam) throw new Error('Current pick team not found')

  const currentLeader = currentPickTeam.players.find((player: Player) => player.is_leader)
  if (!currentLeader) throw new Error('Current team has no leader')

  return {
    tournament, currentPickTeam, currentLeader,
    roundNumber: (games || []).length + 1,
    totalRounds: tournament.num_games,
    teams: teams || [],
    gamesPlayed: games || []
  }
}

export async function pickGame(
  tournamentId: string, teamId: string, gameTypeId: string, playerId: string
): Promise<{ game: Game; tournament: Tournament }> {
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments').select('*').eq('id', tournamentId).single()
  if (tournamentError || !tournament) throw new Error(`Failed to fetch tournament: ${tournamentError?.message}`)
  if (tournament.status !== 'picking') throw new Error('Tournament is not in picking phase')
  if (teamId !== tournament.current_pick_team) throw new Error("It is not this team's turn to pick")

  const { data: player, error: playerError } = await supabase
    .from('players').select('*').eq('id', playerId).eq('team_id', teamId).single()
  if (playerError || !player) throw new Error(`Failed to fetch player: ${playerError?.message}`)
  if (!player.is_leader) throw new Error('Only team leaders can pick games')

  const { data: existingGame, error: existingGameError } = await supabase
    .from('games').select('id').eq('tournament_id', tournamentId).eq('game_type_id', gameTypeId).single()
  if (existingGame) throw new Error('This game has already been picked')
  if (existingGameError && existingGameError.code !== 'PGRST116') {
    throw new Error(`Failed to check existing games: ${existingGameError.message}`)
  }

  const { count: gameCount, error: countError } = await supabase
    .from('games').select('id', { count: 'exact' }).eq('tournament_id', tournamentId)
  if (countError) throw new Error(`Failed to count games: ${countError.message}`)

  const { data: newGame, error: gameInsertError } = await supabase
    .from('games')
    .insert({
      tournament_id: tournamentId, game_type_id: gameTypeId,
      status: 'active', picked_by_team: teamId, game_order: (gameCount || 0) + 1
    })
    .select(`*, game_type:game_types(*)`).single()
  if (gameInsertError || !newGame) throw new Error(`Failed to create game: ${gameInsertError?.message}`)

  const { data: otherTeam, error: otherTeamError } = await supabase
    .from('teams').select('id').eq('tournament_id', tournamentId).neq('id', teamId).single()
  if (otherTeamError || !otherTeam) throw new Error(`Failed to find other team: ${otherTeamError?.message}`)

  const { data: updatedTournamentList, error: updateError } = await supabase
    .from('tournaments')
    .update({ current_pick_team: otherTeam.id, status: 'playing' })
    .eq('id', tournamentId).select().limit(1)
  if (updateError || !updatedTournamentList || updatedTournamentList.length === 0) throw new Error(`Failed to update tournament: ${updateError?.message}`)
  const updatedTournament = updatedTournamentList[0]

  return { game: newGame, tournament: updatedTournament }
}

export async function fetchGameState(gameId: string): Promise<{
  game: Game; gameType: GameType; stats: PlayerStat[]; result: GameResult | null; players: Player[];
}> {
  const { data: game, error: gameError } = await supabase
    .from('games').select(`*, game_type:game_types(*)`).eq('id', gameId).single()
  if (gameError || !game) throw new Error(`Failed to fetch game: ${gameError?.message}`)

  const { data: stats, error: statsError } = await supabase
    .from('player_stats').select('*').eq('game_id', gameId).order('submitted_at')
  if (statsError) throw new Error(`Failed to fetch stats: ${statsError.message}`)

  const { data: result, error: resultError } = await supabase
    .from('game_results').select('*').eq('game_id', gameId).single()
  if (resultError && resultError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch result: ${resultError.message}`)
  }

  const { data: players, error: playersError } = await supabase
    .from('players').select('*').eq('tournament_id', game.tournament_id).order('name')
  if (playersError) throw new Error(`Failed to fetch players: ${playersError.message}`)

  return { game, gameType: game.game_type as GameType, stats: stats || [], result: result || null, players: players || [] }
}

export async function submitPlayerStats(
  gameId: string, playerId: string, stats: { key: string; value: number }[]
): Promise<PlayerStat[]> {
  const statRecords = stats.map(stat => ({
    game_id: gameId, player_id: playerId, stat_key: stat.key, stat_value: stat.value
  }))
  const { data, error } = await supabase
    .from('player_stats').upsert(statRecords, { onConflict: 'game_id,player_id,stat_key' }).select()
  if (error || !data) throw new Error(`Failed to submit stats: ${error?.message}`)
  return data
}

export async function submitGameResult(
  gameId: string, winningTeamId: string | null, resultData: Record<string, any>
): Promise<GameResult> {
  const { data: result, error } = await supabase
    .from('game_results')
    .insert({ game_id: gameId, winning_team_id: winningTeamId, result_data: resultData })
    .select().single()
  if (error || !result) throw new Error(`Failed to submit result: ${error?.message}`)
  return result
}

export async function endGame(
  tournamentId: string, gameId: string
): Promise<{ game: Game; tournament: Tournament }> {
  const { data: gameList, error: gameError } = await supabase
    .from('games').update({ status: 'titles' }).eq('id', gameId).select().limit(1)
  if (gameError || !gameList || gameList.length === 0) throw new Error(`Failed to update game status: ${gameError?.message}`)

  const { data: tournamentList, error: tournamentError } = await supabase
    .from('tournaments').update({ status: 'scoring' }).eq('id', tournamentId).select().limit(1)
  if (tournamentError || !tournamentList || tournamentList.length === 0) throw new Error(`Failed to update tournament status: ${tournamentError?.message}`)

  return { game: gameList[0], tournament: tournamentList[0] }
}

export async function createCustomGameType(tournamentId: string, gameData: {
  name: string; emoji: string; description: string;
  playerInputs: { key: string; label: string; type: 'number' | 'boolean'; min?: number; max?: number }[];
  refereeInputs: { key: string; label: string; type: 'team_select' | 'player_select' | 'team_scores' | 'player_times' }[];
  titleDefinitions: { name: string; desc: string; isFunny: boolean; condition: { type: string; stat: string; value?: number } }[];
}): Promise<GameType> {
  const { data, error } = await supabase
    .from('game_types')
    .insert({
      tournament_id: tournamentId, name: gameData.name, emoji: gameData.emoji,
      description: gameData.description, player_inputs: gameData.playerInputs,
      referee_inputs: gameData.refereeInputs, title_definitions: gameData.titleDefinitions
    })
    .select().single()
  if (error || !data) throw new Error(`Failed to create custom game: ${error?.message}`)
  return data
}
