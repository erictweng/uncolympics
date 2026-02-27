import { supabase } from '../supabase'
import type { Player, Tournament } from '../../types'

/**
 * Determine whose turn it is based on pick number (snake draft: 1-2-2-2... pattern)
 * Pick 1: A, Pick 2-3: B, Pick 4-5: A, Pick 6-7: B, ...
 */
export function getSnakeDraftTeam(pickNumber: number): 'A' | 'B' {
  if (pickNumber === 1) return 'A'
  return (Math.floor((pickNumber - 2) / 2) % 2 === 0) ? 'B' : 'A'
}

/**
 * Select two captains. First = Captain A (Team A), second = Captain B (Team B).
 */
export async function selectCaptains(
  tournamentId: string,
  captainAId: string,
  captainBId: string
): Promise<void> {
  // Get teams
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at')

  if (teamsError || !teams || teams.length < 2) {
    throw new Error('Need at least 2 teams')
  }

  const teamA = teams[0]
  const teamB = teams[1]

  // Set captain A
  const { error: errA } = await supabase
    .from('players')
    .update({ is_captain: true, team_id: teamA.id, is_leader: true })
    .eq('id', captainAId)

  if (errA) throw new Error(`Failed to set captain A: ${errA.message}`)

  // Set captain B
  const { error: errB } = await supabase
    .from('players')
    .update({ is_captain: true, team_id: teamB.id, is_leader: true })
    .eq('id', captainBId)

  if (errB) throw new Error(`Failed to set captain B: ${errB.message}`)

  // Set draft_turn to captain A, pick number 1
  const { error: errT } = await supabase
    .from('tournaments')
    .update({ draft_turn: captainAId, draft_pick_number: 1 })
    .eq('id', tournamentId)

  if (errT) throw new Error(`Failed to start draft: ${errT.message}`)
}

/**
 * Get available (undrafted, non-captain) players
 */
export async function getAvailablePlayers(tournamentId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', tournamentId)
    .is('team_id', null)
    .eq('is_captain', false)
    .neq('role', 'referee')
    .order('created_at')

  if (error) throw new Error(`Failed to get available players: ${error.message}`)
  return data || []
}

/**
 * Draft a player onto a team. Increments pick number and updates turn.
 */
export async function draftPlayer(
  tournamentId: string,
  playerId: string,
  teamId: string
): Promise<void> {
  // Assign player to team
  const { error: playerErr } = await supabase
    .from('players')
    .update({ team_id: teamId })
    .eq('id', playerId)

  if (playerErr) throw new Error(`Failed to draft player: ${playerErr.message}`)

  // Get current state
  const { data: tournaments, error: tErr } = await supabase
    .from('tournaments')
    .select('draft_pick_number')
    .eq('id', tournamentId)
    .limit(1)

  if (tErr || !tournaments?.[0]) throw new Error('Failed to get tournament')

  const currentPick = tournaments[0].draft_pick_number || 1
  const nextPick = currentPick + 1

  // Determine next captain's turn
  const nextTeam = getSnakeDraftTeam(nextPick)

  // Get captains
  const { data: captains } = await supabase
    .from('players')
    .select('id, team_id')
    .eq('tournament_id', tournamentId)
    .eq('is_captain', true)

  const teams = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at')

  const teamA = teams.data?.[0]
  const teamB = teams.data?.[1]

  const nextCaptain = captains?.find(c =>
    nextTeam === 'A' ? c.team_id === teamA?.id : c.team_id === teamB?.id
  )

  // Check if draft is complete (no more available players)
  const available = await getAvailablePlayers(tournamentId)

  if (available.length === 0) {
    // Draft complete - clear draft turn
    const { error } = await supabase
      .from('tournaments')
      .update({ draft_pick_number: currentPick, draft_turn: null })
      .eq('id', tournamentId)
    if (error) throw new Error(`Failed to finalize draft: ${error.message}`)
  } else {
    // Update turn
    const { error } = await supabase
      .from('tournaments')
      .update({
        draft_pick_number: nextPick,
        draft_turn: nextCaptain?.id || null
      })
      .eq('id', tournamentId)
    if (error) throw new Error(`Failed to update draft turn: ${error.message}`)
  }
}

/**
 * Get full draft state
 */
export async function getDraftState(tournamentId: string): Promise<{
  tournament: Tournament
  players: Player[]
  captainA: Player | null
  captainB: Player | null
  available: Player[]
  teamAPlayers: Player[]
  teamBPlayers: Player[]
}> {
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .limit(1)

  const tournament = tournaments?.[0] as Tournament
  if (!tournament) throw new Error('Tournament not found')

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at')

  const allPlayers = (players || []) as Player[]

  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at')

  const teamA = teams?.[0]
  const teamB = teams?.[1]

  const captainA = allPlayers.find(p => p.is_captain && p.team_id === teamA?.id) || null
  const captainB = allPlayers.find(p => p.is_captain && p.team_id === teamB?.id) || null

  const available = allPlayers.filter(p => !p.team_id && !p.is_captain && p.role !== 'referee')
  const teamAPlayers = allPlayers.filter(p => p.team_id === teamA?.id)
  const teamBPlayers = allPlayers.filter(p => p.team_id === teamB?.id)

  return { tournament, players: allPlayers, captainA, captainB, available, teamAPlayers, teamBPlayers }
}

/**
 * Start the draft phase (set tournament status to 'drafting')
 */
export async function startDraft(tournamentId: string): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'drafting' })
    .eq('id', tournamentId)

  if (error) throw new Error(`Failed to start draft: ${error.message}`)
}

/**
 * Finish draft and transition to playing
 */
export async function finishDraft(tournamentId: string): Promise<void> {
  // Assign leaders (captains are already leaders)
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'playing' })
    .eq('id', tournamentId)

  if (error) throw new Error(`Failed to finish draft: ${error.message}`)
}
