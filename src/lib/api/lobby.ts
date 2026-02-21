import { supabase } from '../supabase'
import type { Tournament, Player, Team, LeaderVote } from '../../types'

export async function fetchLobbyState(
  tournamentId: string
): Promise<{ tournament: Tournament; players: Player[]; teams: Team[]; votes: LeaderVote[] }> {
  const { data: tournaments, error: tournamentError } = await supabase
    .from('tournaments').select('*').eq('id', tournamentId).limit(1)
  const tournament = tournaments?.[0]
  if (tournamentError || !tournament) throw new Error(`Failed to fetch tournament: ${tournamentError?.message}`)

  const { data: players, error: playersError } = await supabase
    .from('players').select('*').eq('tournament_id', tournamentId).order('created_at')
  if (playersError) throw new Error(`Failed to fetch players: ${playersError.message}`)

  const { data: teams, error: teamsError } = await supabase
    .from('teams').select('*').eq('tournament_id', tournamentId).order('created_at')
  if (teamsError) throw new Error(`Failed to fetch teams: ${teamsError.message}`)

  let votes: LeaderVote[] = []
  if (teams && teams.length > 0) {
    const teamIds = teams.map(team => team.id)
    const { data: votesData, error: votesError } = await supabase
      .from('leader_votes').select('*').in('team_id', teamIds)
    if (votesError) throw new Error(`Failed to fetch votes: ${votesError.message}`)
    votes = votesData || []
  }

  return { tournament, players: players || [], teams: teams || [], votes }
}

export async function createTeam(tournamentId: string, name: string): Promise<Team> {
  const { data: team, error } = await supabase
    .from('teams').insert({ tournament_id: tournamentId, name, total_points: 0 }).select().single()
  if (error || !team) throw new Error(`Failed to create team: ${error?.message}`)
  return team
}

export async function updateTeamName(teamId: string, name: string): Promise<Team> {
  const { data: teamList, error } = await supabase
    .from('teams').update({ name }).eq('id', teamId).select().limit(1)
  if (error || !teamList || teamList.length === 0) throw new Error(`Failed to update team name: ${error?.message}`)
  return teamList[0]
}

export async function joinTeam(playerId: string, teamId: string): Promise<Player> {
  const { data: currentPlayers } = await supabase
    .from('players').select('team_id').eq('id', playerId).limit(1)
  const currentPlayer = currentPlayers?.[0]

  const { data: updatedPlayers, error } = await supabase
    .from('players')
    .update({ team_id: teamId, is_leader: false })
    .eq('id', playerId).select().limit(1)
  const player = updatedPlayers?.[0]
  if (error || !player) throw new Error(`Failed to join team: ${error?.message}`)

  if (currentPlayer?.team_id && currentPlayer.team_id !== teamId) {
    await supabase.from('leader_votes').delete()
      .eq('team_id', currentPlayer.team_id).eq('voter_id', playerId)
  }
  return player
}

export async function leaveTeam(playerId: string): Promise<Player> {
  const { data: currentPlayers } = await supabase
    .from('players').select('team_id').eq('id', playerId).limit(1)
  const currentPlayer = currentPlayers?.[0]

  const { data: updatedPlayers, error } = await supabase
    .from('players').update({ team_id: null, is_leader: false })
    .eq('id', playerId).select().limit(1)
  const player = updatedPlayers?.[0]
  if (error || !player) throw new Error(`Failed to leave team: ${error?.message}`)

  if (currentPlayer?.team_id) {
    await supabase.from('leader_votes').delete()
      .eq('team_id', currentPlayer.team_id)
      .or(`voter_id.eq.${playerId},candidate_id.eq.${playerId}`)
  }
  return player
}

export async function voteForLeader(
  teamId: string,
  voterId: string,
  candidateId: string
): Promise<{ votes: LeaderVote[]; leaderId: string | null }> {
  const { error: voteError } = await supabase
    .from('leader_votes')
    .upsert({ team_id: teamId, voter_id: voterId, candidate_id: candidateId },
      { onConflict: 'team_id,voter_id' })
  if (voteError) throw new Error(`Failed to vote for leader: ${voteError.message}`)

  const { data: votes, error: votesError } = await supabase
    .from('leader_votes').select('*').eq('team_id', teamId)
  if (votesError) throw new Error(`Failed to fetch votes: ${votesError.message}`)

  const { data: teamMembers, error: membersError } = await supabase
    .from('players').select('id').eq('team_id', teamId)
  if (membersError) throw new Error(`Failed to fetch team members: ${membersError.message}`)

  const memberCount = teamMembers?.length || 0
  const votesNeeded = Math.floor(memberCount / 2) + 1

  const voteCounts = votes?.reduce((acc, vote) => {
    acc[vote.candidate_id] = (acc[vote.candidate_id] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  let newLeaderId: string | null = null
  for (const [candidateId, voteCount] of Object.entries(voteCounts)) {
    if (typeof voteCount === 'number' && voteCount >= votesNeeded) {
      newLeaderId = candidateId
      break
    }
  }

  if (newLeaderId) {
    await supabase.from('players').update({ is_leader: false }).eq('team_id', teamId)
    await supabase.from('players').update({ is_leader: true }).eq('id', newLeaderId)
  }

  return { votes: votes || [], leaderId: newLeaderId }
}
