import { supabase } from './supabase'
import type { PlayerStat } from '../types'

// Condition evaluators
function highest(stats: PlayerStat[], statKey: string): string[] {
  const relevant = stats.filter(s => s.stat_key === statKey);
  if (relevant.length === 0) return [];
  const maxVal = Math.max(...relevant.map(s => Number(s.stat_value)));
  return relevant.filter(s => Number(s.stat_value) === maxVal).map(s => s.player_id);
}

function lowest(stats: PlayerStat[], statKey: string): string[] {
  const relevant = stats.filter(s => s.stat_key === statKey);
  if (relevant.length === 0) return [];
  const minVal = Math.min(...relevant.map(s => Number(s.stat_value)));
  return relevant.filter(s => Number(s.stat_value) === minVal).map(s => s.player_id);
}

function exact(stats: PlayerStat[], statKey: string, value: number): string[] {
  return stats.filter(s => s.stat_key === statKey && Number(s.stat_value) === value).map(s => s.player_id);
}

function flag(stats: PlayerStat[], statKey: string): string[] {
  return stats.filter(s => s.stat_key === statKey && Number(s.stat_value) === 1).map(s => s.player_id);
}

function threshold(stats: PlayerStat[], statKey: string, value: number): string[] {
  return stats.filter(s => s.stat_key === statKey && Number(s.stat_value) >= value).map(s => s.player_id);
}

// Main title calculation function
export async function calculateTitles(gameId: string): Promise<{
  playerId: string;
  titleName: string;
  titleDesc: string;
  isFunny: boolean;
  points: number;
}[]> {
  // 1. Fetch all player_stats for this game from Supabase
  const { data: playerStats, error: statsError } = await supabase
    .from('player_stats')
    .select('*')
    .eq('game_id', gameId);

  if (statsError) {
    throw new Error(`Failed to fetch player stats: ${statsError.message}`);
  }

  if (!playerStats || playerStats.length === 0) {
    return []; // No stats, no titles
  }

  // 2. Fetch the game row to get game_type_id
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('game_type_id')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    throw new Error(`Failed to fetch game: ${gameError?.message}`);
  }

  // 3. Fetch the game_type to get title_definitions JSON
  const { data: gameType, error: gameTypeError } = await supabase
    .from('game_types')
    .select('title_definitions')
    .eq('id', game.game_type_id)
    .single();

  if (gameTypeError || !gameType) {
    throw new Error(`Failed to fetch game type: ${gameTypeError?.message}`);
  }

  // 4. Parse title_definitions
  const titleDefinitions = gameType.title_definitions;
  
  if (!titleDefinitions || typeof titleDefinitions !== 'object') {
    return []; // No title definitions
  }

  const titleResults: {
    playerId: string;
    titleName: string;
    titleDesc: string;
    isFunny: boolean;
    points: number;
  }[] = [];

  // 5. For each title def, call the appropriate evaluator
  // title_definitions can be an array of objects or a keyed object
  const defsArray = Array.isArray(titleDefinitions)
    ? titleDefinitions
    : Object.values(titleDefinitions);

  for (const definition of defsArray) {
    if (!definition || typeof definition !== 'object') continue;

    const def = definition as any;
    const titleName = def.name || 'Untitled';
    const titleDesc = def.desc || '';
    const isFunny = def.isFunny || def.is_funny || false;
    const condition = def.condition || {};
    
    let qualifiedPlayerIds: string[] = [];

    // Call the appropriate evaluator based on condition type
    if (condition.type === 'highest' && condition.stat) {
      qualifiedPlayerIds = highest(playerStats, condition.stat);
    } else if (condition.type === 'lowest' && condition.stat) {
      qualifiedPlayerIds = lowest(playerStats, condition.stat);
    } else if (condition.type === 'exact' && condition.stat && typeof condition.value === 'number') {
      qualifiedPlayerIds = exact(playerStats, condition.stat, condition.value);
    } else if (condition.type === 'flag' && condition.stat) {
      qualifiedPlayerIds = flag(playerStats, condition.stat);
    } else if (condition.type === 'threshold' && condition.stat && typeof condition.value === 'number') {
      qualifiedPlayerIds = threshold(playerStats, condition.stat, condition.value);
    }

    // 6. For each qualified player, create a title object
    for (const playerId of qualifiedPlayerIds) {
      titleResults.push({
        playerId,
        titleName,
        titleDesc,
        isFunny,
        points: 0.5 // Standard point value for titles
      });
    }
  }

  return titleResults;
}