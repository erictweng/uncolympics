import { supabase } from '../supabase'

export interface PlayerWithProfile {
  id: string
  name: string
  user_id: string | null
  avatar_url: string | null
  tier: 'wonderkid' | 'rising_prospect' | 'certified' | 'seasoned_veteran' | null
  survey_responses: Record<string, any> | null
}

export async function getPlayersWithProfiles(tournamentId: string): Promise<PlayerWithProfile[]> {
  const { data: players, error: pErr } = await supabase
    .from('players')
    .select('id, name, user_id, role')
    .eq('tournament_id', tournamentId)
    .neq('role', 'spectator')

  if (pErr || !players) throw new Error(pErr?.message || 'Failed to fetch players')

  // Get profiles for all players with user_ids
  const userIds = players.filter(p => p.user_id).map(p => p.user_id!)
  
  let profileMap: Record<string, { avatar_url: string | null; tier: string | null; survey_responses: Record<string, any> | null }> = {}
  
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, avatar_url, tier, survey_responses')
      .in('id', userIds)

    if (profiles) {
      for (const p of profiles) {
        profileMap[p.id] = { avatar_url: p.avatar_url, tier: p.tier, survey_responses: p.survey_responses }
      }
    }
  }

  return players
    .filter(p => p.role !== 'referee')
    .map(p => ({
      id: p.id,
      name: p.name,
      user_id: p.user_id,
      avatar_url: p.user_id ? profileMap[p.user_id]?.avatar_url ?? null : null,
      tier: (p.user_id ? profileMap[p.user_id]?.tier ?? null : null) as PlayerWithProfile['tier'],
      survey_responses: p.user_id ? profileMap[p.user_id]?.survey_responses ?? null : null,
    }))
}
