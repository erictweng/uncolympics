import { supabase } from '../supabase'
import type { Tournament, DiceRollData } from '../../types'

/**
 * Submit a leader's dice pick (1-6). When both leaders have picked,
 * generates the target and determines the winner.
 */
export async function submitDicePick(
  tournamentId: string,
  teamId: string,
  pick: number
): Promise<Tournament> {
  if (pick < 1 || pick > 6 || !Number.isInteger(pick)) {
    throw new Error('Pick must be an integer between 1 and 6')
  }

  // Get current tournament state
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments').select('*').eq('id', tournamentId).single()
  if (fetchErr || !tournament) throw new Error(`Failed to fetch tournament: ${fetchErr?.message}`)

  const current: DiceRollData = tournament.dice_roll_data || {
    picks: {},
    target: null,
    winnerId: null,
    round: 1
  }

  // Record this team's pick
  current.picks[teamId] = pick

  // Get all teams to check if both have picked
  const { data: teams, error: teamsErr } = await supabase
    .from('teams').select('id').eq('tournament_id', tournamentId).order('created_at')
  if (teamsErr) throw new Error(`Failed to fetch teams: ${teamsErr.message}`)

  const teamIds = (teams || []).map(t => t.id)
  const allPicked = teamIds.every(id => current.picks[id] !== undefined)

  if (allPicked && teamIds.length >= 2) {
    // Generate random target 1-6
    const target = Math.floor(Math.random() * 6) + 1
    current.target = target

    // Calculate distances
    const distances = teamIds.map(id => ({
      id,
      pick: current.picks[id],
      distance: Math.abs(current.picks[id] - target)
    }))

    distances.sort((a, b) => a.distance - b.distance)

    if (distances[0].distance < distances[1].distance) {
      // Clear winner
      current.winnerId = distances[0].id
    } else {
      // Tie — no winner yet, will need re-roll
      current.winnerId = null
    }
  }

  // Save updated dice_roll_data
  const { data: updatedList, error: updateErr } = await supabase
    .from('tournaments')
    .update({ dice_roll_data: current })
    .eq('id', tournamentId)
    .select()
    .limit(1)

  if (updateErr || !updatedList || updatedList.length === 0) throw new Error(`Failed to update dice roll: ${updateErr?.message}`)
  return updatedList[0]
}

/**
 * Reset dice roll for a re-roll (tie scenario). Clears picks, keeps round counter.
 */
export async function resetDiceRoll(tournamentId: string): Promise<Tournament> {
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments').select('*').eq('id', tournamentId).single()
  if (fetchErr || !tournament) throw new Error(`Failed to fetch tournament: ${fetchErr?.message}`)

  const current: DiceRollData = tournament.dice_roll_data || { picks: {}, target: null, winnerId: null, round: 1 }

  const reset: DiceRollData = {
    picks: {},
    target: null,
    winnerId: null,
    round: current.round + 1
  }

  const { data: updatedList, error: updateErr } = await supabase
    .from('tournaments')
    .update({ dice_roll_data: reset })
    .eq('id', tournamentId)
    .select()
    .limit(1)

  if (updateErr || !updatedList || updatedList.length === 0) throw new Error(`Failed to reset dice roll: ${updateErr?.message}`)
  return updatedList[0]
}

/**
 * Confirm dice roll winner and set them as current_pick_team. 
 * Transitions tournament to ready-to-pick state.
 */
export async function confirmDiceWinner(tournamentId: string): Promise<Tournament> {
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments').select('*').eq('id', tournamentId).single()
  if (fetchErr || !tournament) throw new Error(`Failed to fetch tournament: ${fetchErr?.message}`)

  const rollData: DiceRollData | null = tournament.dice_roll_data
  if (!rollData?.winnerId) throw new Error('No dice roll winner to confirm')

  const { data: updatedList, error: updateErr } = await supabase
    .from('tournaments')
    .update({ current_pick_team: rollData.winnerId })
    .eq('id', tournamentId)
    .select()
    .limit(1)

  if (updateErr || !updatedList || updatedList.length === 0) throw new Error(`Failed to confirm winner: ${updateErr?.message}`)
  return updatedList[0]
}
