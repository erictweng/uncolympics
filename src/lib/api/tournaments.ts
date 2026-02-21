import { supabase } from '../supabase'
import type { Tournament, Player } from '../../types'

/**
 * Clean up stale tournaments in lobby status
 * Deletes tournaments that are:
 * - In 'lobby' status
 * - Older than 30 minutes
 * - Have 0-1 players (including referee)
 */
async function cleanupStaleTournaments(): Promise<void> {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    
    // Find stale lobby tournaments
    const { data: staleTournaments, error: fetchError } = await supabase
      .from('tournaments')
      .select('id')
      .eq('status', 'lobby')
      .lt('created_at', thirtyMinutesAgo)
    
    if (fetchError) {
      console.error('Error fetching stale tournaments:', fetchError)
      return
    }
    
    if (!staleTournaments || staleTournaments.length === 0) return
    
    // Delete all stale lobby tournaments older than 30 min
    const tournamentIdsToDelete = staleTournaments.map(tournament => tournament.id)
    
    // Delete stale tournaments (players will be cascade deleted)
    const { error: deleteError } = await supabase
      .from('tournaments')
      .delete()
      .in('id', tournamentIdsToDelete)
    
    if (deleteError) {
      console.error('Error deleting stale tournaments:', deleteError)
    }
  } catch (error) {
    console.error('Unexpected error in cleanupStaleTournaments:', error)
  }
}

export async function createTournament(
  name: string,
  roomCode: string,
  numGames: number,
  refereeName: string,
  deviceId: string
): Promise<{ tournament: Tournament; player: Player }> {
  // Clean up stale tournaments (fire-and-forget)
  cleanupStaleTournaments().catch(error => 
    console.error('Background cleanup failed:', error)
  )

  if (!roomCode || roomCode.length > 5 || !/^[A-Z0-9]+$/.test(roomCode)) {
    throw new Error('Room code must be 1-5 characters, alphanumeric, and uppercase')
  }

  // Delete any existing lobby tournament from the same device_id (handles referee refresh)
  const { data: existingReferee } = await supabase
    .from('players')
    .select('tournament_id')
    .eq('device_id', deviceId)
    .eq('role', 'referee')
    .limit(1)

  if (existingReferee && existingReferee.length > 0) {
    const tournamentId = existingReferee[0].tournament_id
    
    // Check if this tournament is still in lobby status
    const { data: existingTournaments } = await supabase
      .from('tournaments')
      .select('id, status')
      .eq('id', tournamentId)
      .eq('status', 'lobby')
      .limit(1)
    
    const existingTournament = existingTournaments?.[0]
    if (existingTournament) {
      await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournamentId)
    }
  }

  // Clean up any stale tournaments with this room code before checking
  const { data: existingTournaments } = await supabase
    .from('tournaments')
    .select('id, status, created_at')
    .eq('room_code', roomCode)
    .neq('status', 'completed')

  if (existingTournaments && existingTournaments.length > 0) {
    // Delete stale lobby tournaments with this room code (older than 5 min)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const staleIds = existingTournaments
      .filter(t => t.status === 'lobby' && t.created_at < fiveMinAgo)
      .map(t => t.id)
    
    if (staleIds.length > 0) {
      await supabase.from('tournaments').delete().in('id', staleIds)
    }

    // Re-check: any active (non-stale) tournaments still using this code?
    const remaining = existingTournaments.filter(t => !staleIds.includes(t.id))
    if (remaining.length > 0) {
      throw new Error('Room code already exists')
    }
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .insert({
      name,
      room_code: roomCode,
      num_games: numGames,
      time_est_min: numGames * 20,
      status: 'lobby',
      current_pick_team: null
    })
    .select()
    .single()

  if (tournamentError || !tournament) throw new Error(`Failed to create tournament: ${tournamentError?.message}`)

  const { data: player, error: playerError } = await supabase
    .from('players')
    .insert({
      tournament_id: tournament.id,
      name: refereeName,
      device_id: deviceId,
      role: 'referee',
      is_leader: true,
      team_id: null
    })
    .select()
    .single()

  if (playerError || !player) throw new Error(`Failed to create referee: ${playerError?.message}`)

  const { error: updateError } = await supabase
    .from('tournaments')
    .update({ referee_id: player.id })
    .eq('id', tournament.id)

  if (updateError) throw new Error(`Failed to set referee: ${updateError.message}`)

  return {
    tournament: { ...tournament, referee_id: player.id },
    player
  }
}

export async function validateRoomCode(
  roomCode: string
): Promise<{ valid: boolean; error?: string; tournament?: Tournament }> {
  if (!roomCode || roomCode.length > 5 || !/^[A-Z0-9]+$/.test(roomCode)) {
    return { valid: false, error: 'Invalid room code format' }
  }

  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('room_code', roomCode)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)

  const tournament = tournaments?.[0]
  if (error || !tournament) return { valid: false, error: 'Room not found' }
  return { valid: true, tournament }
}

export async function joinTournament(
  roomCode: string,
  playerName: string,
  deviceId: string,
  role: 'player' | 'spectator'
): Promise<{ tournament: Tournament; player: Player }> {
  // Clean up stale tournaments (fire-and-forget)
  cleanupStaleTournaments().catch(error => 
    console.error('Background cleanup failed:', error)
  )

  const validation = await validateRoomCode(roomCode)
  if (!validation.valid || !validation.tournament) {
    throw new Error(validation.error || 'Room not found')
  }

  const tournament = validation.tournament
  if (tournament.status !== 'lobby') throw new Error('Tournament has already started')

  const { data: existingPlayers } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', tournament.id)
    .eq('device_id', deviceId)
    .limit(1)

  if (existingPlayers && existingPlayers.length > 0) return { tournament, player: existingPlayers[0] }

  const { data: player, error } = await supabase
    .from('players')
    .insert({
      tournament_id: tournament.id,
      name: playerName,
      device_id: deviceId,
      role,
      is_leader: false,
      team_id: null
    })
    .select()
    .single()

  if (error || !player) throw new Error(`Failed to join tournament: ${error?.message}`)
  return { tournament, player }
}

export async function reconnectPlayer(
  deviceId: string
): Promise<{ tournament: Tournament; player: Player } | null> {
  // Two-step query: fetch player first, then check tournament status separately
  // (inner join + .neq on joined table can silently return 0 rows in some Supabase/PostgREST versions)
  const { data, error } = await supabase
    .from('players')
    .select(`*, tournament:tournaments(*)`)
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(5)

  console.log('reconnectPlayer result:', data, error)

  if (error || !data || data.length === 0) return null

  // Find the first player whose tournament is not completed
  const match = data.find(
    (row: any) => row.tournament && row.tournament.status !== 'completed'
  )
  if (!match) return null

  // Strip the nested tournament from the player object to keep types clean
  const { tournament: t, ...playerFields } = match as any
  return { tournament: t as Tournament, player: playerFields as Player }
}

export async function startTournament(tournamentId: string): Promise<Tournament> {
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select(`*, players(*)`)
    .eq('tournament_id', tournamentId)

  if (teamsError) throw new Error(`Failed to fetch teams: ${teamsError.message}`)

  const validTeams = teams?.filter(team => team.players && team.players.length > 0) || []
  if (validTeams.length < 2) throw new Error('Need at least 2 teams with players to start tournament')

  for (const team of validTeams) {
    const hasLeader = team.players.some((player: Player) => player.is_leader)
    if (!hasLeader) throw new Error(`Team "${team.name}" needs a leader before starting`)
  }

  const firstTeam = validTeams.sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )[0]

  const { data: tournament, error } = await supabase
    .from('tournaments')
    .update({ status: 'picking', current_pick_team: firstTeam.id })
    .eq('id', tournamentId)
    .select()
    .single()

  if (error || !tournament) throw new Error(`Failed to start tournament: ${error?.message}`)
  return tournament
}

export async function cancelTournament(tournamentId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', tournamentId)

    if (error) throw new Error(`Failed to cancel tournament: ${error.message}`)
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Unexpected error canceling tournament: ${error}`)
  }
}

export async function assignRandomLeaders(tournamentId: string): Promise<void> {
  // Get all teams with their players
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select(`id, players(id)`)
    .eq('tournament_id', tournamentId)

  if (teamsError) throw new Error(`Failed to fetch teams: ${teamsError.message}`)

  // Reset all leaders first
  await supabase
    .from('players')
    .update({ is_leader: false })
    .eq('tournament_id', tournamentId)

  // For each team, randomly pick one player as leader
  for (const team of (teams || [])) {
    const players = (team.players as any[]) || []
    if (players.length === 0) continue
    const randomPlayer = players[Math.floor(Math.random() * players.length)]
    await supabase
      .from('players')
      .update({ is_leader: true })
      .eq('id', randomPlayer.id)
  }
}

export async function leaveTournament(playerId: string): Promise<void> {
  try {
    // First, get the player to check if they are a leader
    const { data: players, error: fetchError } = await supabase
      .from('players')
      .select('id, team_id, is_leader')
      .eq('id', playerId)
      .limit(1)

    if (fetchError) throw new Error(`Failed to fetch player: ${fetchError.message}`)
    const player = players?.[0]
    if (!player) throw new Error('Player not found')

    // If the player is a leader, we need to remove their leader status first
    if (player.is_leader && player.team_id) {
      const { error: leaderError } = await supabase
        .from('players')
        .update({ is_leader: false })
        .eq('id', playerId)

      if (leaderError) throw new Error(`Failed to remove leader status: ${leaderError.message}`)
    }

    // Now delete the player (CASCADE will handle related data)
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId)

    if (deleteError) throw new Error(`Failed to remove player: ${deleteError.message}`)
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Unexpected error leaving tournament: ${error}`)
  }
}
