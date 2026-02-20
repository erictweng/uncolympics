import { supabase } from './supabase'

export interface GlobalTitleResult {
  playerId: string
  titleName: string
  titleDesc: string
  isFunny: boolean
  points: number
}

/**
 * Calculate tournament-wide global titles based on Sprint 7 requirements.
 * These are awarded at the ceremony after all games are complete.
 * Global titles have game_id = null in the titles table.
 */
export async function calculateGlobalTitles(tournamentId: string): Promise<GlobalTitleResult[]> {
  // 1. Fetch ALL titles for this tournament (per-game titles)
  const { data: titles, error: titlesError } = await supabase
    .from('titles')
    .select('*')
    .eq('tournament_id', tournamentId)
    .not('game_id', 'is', null) // Only game-level titles

  if (titlesError) throw new Error(`Failed to fetch titles: ${titlesError.message}`)

  // 2. Fetch all games for this tournament (to know game order, first/second half)
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('status', 'completed')
    .order('game_order')

  if (gamesError) throw new Error(`Failed to fetch games: ${gamesError.message}`)

  // 3. Fetch all players
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', tournamentId)
    .not('team_id', 'is', null)

  if (playersError) throw new Error(`Failed to fetch players: ${playersError.message}`)

  const titleList = titles || []
  const gameList = games || []
  const playerList = players || []
  const results: GlobalTitleResult[] = []

  if (playerList.length === 0 || gameList.length === 0) return results

  // --- 🏆 MVP — most total titles across all games ---
  const titleCountByPlayer = new Map<string, number>()
  for (const t of titleList) {
    titleCountByPlayer.set(t.player_id, (titleCountByPlayer.get(t.player_id) || 0) + 1)
  }
  if (titleCountByPlayer.size > 0) {
    const maxTitles = Math.max(...titleCountByPlayer.values())
    if (maxTitles > 0) {
      for (const [playerId, count] of titleCountByPlayer) {
        if (count === maxTitles) {
          results.push({
            playerId,
            titleName: 'MVP',
            titleDesc: `Earned the most titles across all games (${count})`,
            isFunny: false,
            points: 0.5
          })
        }
      }
    }
  }

  // --- 🎯 Title Hoarder — titles across the most different games ---
  const gamesWithTitlesByPlayer = new Map<string, Set<string>>()
  for (const t of titleList) {
    if (!t.game_id) continue
    if (!gamesWithTitlesByPlayer.has(t.player_id)) {
      gamesWithTitlesByPlayer.set(t.player_id, new Set())
    }
    gamesWithTitlesByPlayer.get(t.player_id)!.add(t.game_id)
  }
  if (gamesWithTitlesByPlayer.size > 0) {
    const maxGames = Math.max(...[...gamesWithTitlesByPlayer.values()].map(s => s.size))
    if (maxGames >= 2) { // Only award if they have titles in 2+ games
      for (const [playerId, gameSet] of gamesWithTitlesByPlayer) {
        if (gameSet.size === maxGames) {
          results.push({
            playerId,
            titleName: 'Title Hoarder',
            titleDesc: `Earned titles across the most different games (${maxGames} games)`,
            isFunny: false,
            points: 0.5
          })
        }
      }
    }
  }

  // --- 📈 Late Bloomer — more titles in 2nd half of games than 1st half ---
  if (gameList.length >= 2) { // Only award if there were at least 2 games
    const totalGames = gameList.length
    const firstHalfEnd = Math.floor(totalGames / 2)
    
    // Split games by game_order: first half = order <= firstHalfEnd, second half = rest
    const firstHalfGames = gameList.filter(g => g.game_order <= firstHalfEnd)
    const secondHalfGames = gameList.filter(g => g.game_order > firstHalfEnd)
    
    const firstHalfGameIds = new Set(firstHalfGames.map(g => g.id))
    const secondHalfGameIds = new Set(secondHalfGames.map(g => g.id))
    
    for (const player of playerList) {
      const firstHalfTitles = titleList.filter(t => t.player_id === player.id && firstHalfGameIds.has(t.game_id!))
      const secondHalfTitles = titleList.filter(t => t.player_id === player.id && secondHalfGameIds.has(t.game_id!))
      
      if (secondHalfTitles.length > firstHalfTitles.length && firstHalfTitles.length >= 0) {
        results.push({
          playerId: player.id,
          titleName: 'Late Bloomer',
          titleDesc: `More titles in 2nd half (${secondHalfTitles.length}) than 1st half (${firstHalfTitles.length})`,
          isFunny: false,
          points: 0.5
        })
      }
    }
  }

  // --- 🔄 Consistent — earned the same title name in multiple games ---
  const titleNamesByPlayer = new Map<string, Map<string, number>>()
  for (const t of titleList) {
    if (!titleNamesByPlayer.has(t.player_id)) {
      titleNamesByPlayer.set(t.player_id, new Map())
    }
    const playerTitleNames = titleNamesByPlayer.get(t.player_id)!
    playerTitleNames.set(t.title_name, (playerTitleNames.get(t.title_name) || 0) + 1)
  }
  
  for (const [playerId, titleNames] of titleNamesByPlayer) {
    for (const [titleName, count] of titleNames) {
      if (count >= 2) { // Same title name in 2+ different games
        results.push({
          playerId,
          titleName: 'Consistent',
          titleDesc: `Earned "${titleName}" ${count} times across different games`,
          isFunny: false,
          points: 0.5
        })
        break // Only give one Consistent award per player
      }
    }
  }

  // --- 😂 Comic Relief — most funny titles (is_funny=true) ---
  const funnyTitleCount = new Map<string, number>()
  for (const t of titleList) {
    if (t.is_funny) {
      funnyTitleCount.set(t.player_id, (funnyTitleCount.get(t.player_id) || 0) + 1)
    }
  }
  if (funnyTitleCount.size > 0) {
    const maxFunny = Math.max(...funnyTitleCount.values())
    if (maxFunny >= 1) { // Only award if count >= 1
      for (const [playerId, count] of funnyTitleCount) {
        if (count === maxFunny) {
          results.push({
            playerId,
            titleName: 'Comic Relief',
            titleDesc: `Earned the most funny titles (${count})`,
            isFunny: true, // Comic Relief is funny
            points: 0.5
          })
        }
      }
    }
  }

  return results
}