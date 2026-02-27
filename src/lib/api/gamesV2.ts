import { supabase } from '../supabase'
import type { GameV2 } from '../../types'

export async function createGamesV2(
  tournamentId: string,
  games: { name: string; type: 'physical' | 'video' }[]
): Promise<GameV2[]> {
  const rows = games.map((g, i) => ({
    tournament_id: tournamentId,
    index: i + 1,
    name: g.name,
    type: g.type,
    status: 'upcoming' as const,
  }))

  const { data, error } = await supabase
    .from('games_v2')
    .insert(rows)
    .select()

  if (error || !data) throw new Error(`Failed to create games: ${error?.message}`)
  return data as GameV2[]
}

export async function getGamesV2(tournamentId: string): Promise<GameV2[]> {
  const { data, error } = await supabase
    .from('games_v2')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('index')

  if (error) throw new Error(`Failed to fetch games: ${error.message}`)
  return (data || []) as GameV2[]
}

export async function updateGameV2(
  gameId: string,
  updates: Partial<Pick<GameV2, 'name' | 'type'>>
): Promise<GameV2> {
  const { data, error } = await supabase
    .from('games_v2')
    .update(updates)
    .eq('id', gameId)
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to update game: ${error?.message}`)
  return data as GameV2
}

export async function startGameV2(
  gameId: string,
  gameIndex: number,
  tournamentId: string
): Promise<GameV2> {
  // Set game to active
  const { data: game, error: gameError } = await supabase
    .from('games_v2')
    .update({ status: 'active' })
    .eq('id', gameId)
    .select()
    .single()

  if (gameError || !game) throw new Error(`Failed to start game: ${gameError?.message}`)

  // Update tournament current_game_index
  const { error: tError } = await supabase
    .from('tournaments')
    .update({ current_game_index: gameIndex })
    .eq('id', tournamentId)

  if (tError) throw new Error(`Failed to update tournament: ${tError.message}`)

  return game as GameV2
}

export async function endGameV2(
  gameId: string,
  winnerTeam: 'A' | 'B',
  pointsA: number,
  pointsB: number
): Promise<GameV2> {
  const { data, error } = await supabase
    .from('games_v2')
    .update({
      status: 'completed',
      winner_team: winnerTeam,
      points_a: pointsA,
      points_b: pointsB,
    })
    .eq('id', gameId)
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to end game: ${error?.message}`)
  return data as GameV2
}

export async function getCurrentGameV2(tournamentId: string): Promise<GameV2 | null> {
  const { data, error } = await supabase
    .from('games_v2')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch current game: ${error.message}`)
  return data as GameV2 | null
}

export async function deleteGamesV2(tournamentId: string): Promise<void> {
  const { error } = await supabase
    .from('games_v2')
    .delete()
    .eq('tournament_id', tournamentId)

  if (error) throw new Error(`Failed to delete games: ${error.message}`)
}
