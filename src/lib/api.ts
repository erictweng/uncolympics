import { supabase } from './supabase'
import type { Tournament, Player, Team, LeaderVote, GameType, Game, PlayerStat, GameResult, Title, ScoreboardData, GameWithType, TitleWithPlayer, LeaderboardEntry, PlayerDetail, CeremonyData, TournamentSummary, TournamentRecap } from '../types'

// API Functions

export async function createTournament(
  name: string,
  roomCode: string,
  numGames: number,
  refereeName: string,
  deviceId: string
): Promise<{ tournament: Tournament; player: Player }> {
  // Validate room code
  if (!roomCode || roomCode.length > 5 || !/^[A-Z0-9]+$/.test(roomCode)) {
    throw new Error('Room code must be 1-5 characters, alphanumeric, and uppercase');
  }

  // Check uniqueness
  const { data: existing } = await supabase
    .from('tournaments')
    .select('id')
    .eq('room_code', roomCode)
    .neq('status', 'completed')
    .single();

  if (existing) {
    throw new Error('Room code already exists');
  }

  // Insert tournament
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
    .single();

  if (tournamentError || !tournament) {
    throw new Error(`Failed to create tournament: ${tournamentError?.message}`);
  }

  // Insert referee player
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
    .single();

  if (playerError || !player) {
    throw new Error(`Failed to create referee: ${playerError?.message}`);
  }

  // Update tournament with referee_id
  const { error: updateError } = await supabase
    .from('tournaments')
    .update({ referee_id: player.id })
    .eq('id', tournament.id);

  if (updateError) {
    throw new Error(`Failed to set referee: ${updateError.message}`);
  }

  return {
    tournament: { ...tournament, referee_id: player.id },
    player
  };
}

export async function validateRoomCode(
  roomCode: string
): Promise<{ valid: boolean; error?: string; tournament?: Tournament }> {
  if (!roomCode || roomCode.length > 5 || !/^[A-Z0-9]+$/.test(roomCode)) {
    return { valid: false, error: 'Invalid room code format' };
  }

  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('room_code', roomCode)
    .neq('status', 'completed')
    .single();

  if (error || !tournament) {
    return { valid: false, error: 'Room not found' };
  }

  return { valid: true, tournament };
}

export async function joinTournament(
  roomCode: string,
  playerName: string,
  deviceId: string,
  role: 'player' | 'spectator'
): Promise<{ tournament: Tournament; player: Player }> {
  // Validate room code and get tournament
  const validation = await validateRoomCode(roomCode);
  if (!validation.valid || !validation.tournament) {
    throw new Error(validation.error || 'Room not found');
  }

  const tournament = validation.tournament;

  // Check tournament status
  if (tournament.status !== 'lobby') {
    throw new Error('Tournament has already started');
  }

  // Check for existing player with same device_id (reconnection)
  const { data: existingPlayer } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', tournament.id)
    .eq('device_id', deviceId)
    .single();

  if (existingPlayer) {
    return { tournament, player: existingPlayer };
  }

  // Insert new player
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
    .single();

  if (error || !player) {
    throw new Error(`Failed to join tournament: ${error?.message}`);
  }

  return { tournament, player };
}

export async function reconnectPlayer(
  deviceId: string
): Promise<{ tournament: Tournament; player: Player } | null> {
  const { data, error } = await supabase
    .from('players')
    .select(`
      *,
      tournament:tournaments!inner(*)
    `)
    .eq('device_id', deviceId)
    .neq('tournament.status', 'completed')
    .single();

  if (error || !data) {
    return null;
  }

  return {
    tournament: data.tournament as Tournament,
    player: data as Player
  };
}

// Sprint 2: Team and Lobby Management

export async function fetchLobbyState(
  tournamentId: string
): Promise<{ tournament: Tournament; players: Player[]; teams: Team[]; votes: LeaderVote[] }> {
  // Fetch tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    throw new Error(`Failed to fetch tournament: ${tournamentError?.message}`);
  }

  // Fetch all players in tournament
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at');

  if (playersError) {
    throw new Error(`Failed to fetch players: ${playersError.message}`);
  }

  // Fetch all teams in tournament
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at');

  if (teamsError) {
    throw new Error(`Failed to fetch teams: ${teamsError.message}`);
  }

  // Fetch all leader votes for teams in this tournament
  let votes: LeaderVote[] = [];
  if (teams && teams.length > 0) {
    const teamIds = teams.map(team => team.id);
    const { data: votesData, error: votesError } = await supabase
      .from('leader_votes')
      .select('*')
      .in('team_id', teamIds);

    if (votesError) {
      throw new Error(`Failed to fetch votes: ${votesError.message}`);
    }
    
    votes = votesData || [];
  }

  return {
    tournament,
    players: players || [],
    teams: teams || [],
    votes
  };
}

export async function createTeam(
  tournamentId: string,
  name: string
): Promise<Team> {
  const { data: team, error } = await supabase
    .from('teams')
    .insert({
      tournament_id: tournamentId,
      name,
      total_points: 0
    })
    .select()
    .single();

  if (error || !team) {
    throw new Error(`Failed to create team: ${error?.message}`);
  }

  return team;
}

export async function updateTeamName(
  teamId: string,
  name: string
): Promise<Team> {
  const { data: team, error } = await supabase
    .from('teams')
    .update({ name })
    .eq('id', teamId)
    .select()
    .single();

  if (error || !team) {
    throw new Error(`Failed to update team name: ${error?.message}`);
  }

  return team;
}

export async function joinTeam(
  playerId: string,
  teamId: string
): Promise<Player> {
  // First get the player's current team_id to clean up votes from old team
  const { data: currentPlayer } = await supabase
    .from('players')
    .select('team_id')
    .eq('id', playerId)
    .single();

  // Update player's team_id
  const { data: player, error } = await supabase
    .from('players')
    .update({ 
      team_id: teamId,
      is_leader: false // Reset leader status when joining new team
    })
    .eq('id', playerId)
    .select()
    .single();

  if (error || !player) {
    throw new Error(`Failed to join team: ${error?.message}`);
  }

  // Delete any leader_votes where voter_id = playerId from old team
  if (currentPlayer?.team_id && currentPlayer.team_id !== teamId) {
    await supabase
      .from('leader_votes')
      .delete()
      .eq('team_id', currentPlayer.team_id)
      .eq('voter_id', playerId);
  }

  return player;
}

export async function leaveTeam(
  playerId: string
): Promise<Player> {
  // Get current player info to know which team they're leaving
  const { data: currentPlayer } = await supabase
    .from('players')
    .select('team_id')
    .eq('id', playerId)
    .single();

  // Update player to remove team
  const { data: player, error } = await supabase
    .from('players')
    .update({ 
      team_id: null,
      is_leader: false
    })
    .eq('id', playerId)
    .select()
    .single();

  if (error || !player) {
    throw new Error(`Failed to leave team: ${error?.message}`);
  }

  // Delete votes they cast or received from their old team
  if (currentPlayer?.team_id) {
    await supabase
      .from('leader_votes')
      .delete()
      .eq('team_id', currentPlayer.team_id)
      .or(`voter_id.eq.${playerId},candidate_id.eq.${playerId}`);
  }

  return player;
}

export async function voteForLeader(
  teamId: string,
  voterId: string,
  candidateId: string
): Promise<{ votes: LeaderVote[]; leaderId: string | null }> {
  // Upsert the vote
  const { error: voteError } = await supabase
    .from('leader_votes')
    .upsert({
      team_id: teamId,
      voter_id: voterId,
      candidate_id: candidateId
    }, {
      onConflict: 'team_id,voter_id'
    });

  if (voteError) {
    throw new Error(`Failed to vote for leader: ${voteError.message}`);
  }

  // Get all votes for this team
  const { data: votes, error: votesError } = await supabase
    .from('leader_votes')
    .select('*')
    .eq('team_id', teamId);

  if (votesError) {
    throw new Error(`Failed to fetch votes: ${votesError.message}`);
  }

  // Get team member count
  const { data: teamMembers, error: membersError } = await supabase
    .from('players')
    .select('id')
    .eq('team_id', teamId);

  if (membersError) {
    throw new Error(`Failed to fetch team members: ${membersError.message}`);
  }

  const memberCount = teamMembers?.length || 0;
  const votesNeeded = Math.floor(memberCount / 2) + 1;

  // Count votes per candidate
  const voteCounts = votes?.reduce((acc, vote) => {
    acc[vote.candidate_id] = (acc[vote.candidate_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Check if any candidate has majority
  let newLeaderId: string | null = null;
  for (const [candidateId, voteCount] of Object.entries(voteCounts)) {
    if (typeof voteCount === 'number' && voteCount >= votesNeeded) {
      newLeaderId = candidateId;
      break;
    }
  }

  // Update leader status if there's a new leader
  if (newLeaderId) {
    // Set all team members to not leader
    await supabase
      .from('players')
      .update({ is_leader: false })
      .eq('team_id', teamId);

    // Set the new leader
    await supabase
      .from('players')
      .update({ is_leader: true })
      .eq('id', newLeaderId);
  }

  return {
    votes: votes || [],
    leaderId: newLeaderId
  };
}

export async function startTournament(
  tournamentId: string
): Promise<Tournament> {
  // Get tournament with teams and players for validation
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select(`
      *,
      players(*)
    `)
    .eq('tournament_id', tournamentId);

  if (teamsError) {
    throw new Error(`Failed to fetch teams: ${teamsError.message}`);
  }

  // Validate: ≥2 teams with ≥1 player each, each team has a leader
  const validTeams = teams?.filter(team => 
    team.players && team.players.length > 0
  ) || [];

  if (validTeams.length < 2) {
    throw new Error('Need at least 2 teams with players to start tournament');
  }

  // Check each team has a leader
  for (const team of validTeams) {
    const hasLeader = team.players.some((player: Player) => player.is_leader);
    if (!hasLeader) {
      throw new Error(`Team "${team.name}" needs a leader before starting`);
    }
  }

  // Set current_pick_team to first team (by created_at)
  const firstTeam = validTeams.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )[0];

  // Update tournament status to 'picking'
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .update({
      status: 'picking',
      current_pick_team: firstTeam.id
    })
    .eq('id', tournamentId)
    .select()
    .single();

  if (error || !tournament) {
    throw new Error(`Failed to start tournament: ${error?.message}`);
  }

  return tournament;
}

// Sprint 3: Game Pick Functions

export async function fetchAvailableGames(
  tournamentId: string
): Promise<{ available: GameType[]; picked: Game[] }> {
  // Get all game_types where tournament_id IS NULL (built-ins) OR tournament_id = tournamentId (custom)
  const { data: gameTypes, error: gameTypesError } = await supabase
    .from('game_types')
    .select('*')
    .or(`tournament_id.is.null,tournament_id.eq.${tournamentId}`)
    .order('created_at');

  if (gameTypesError) {
    throw new Error(`Failed to fetch game types: ${gameTypesError.message}`);
  }

  // Get all games where tournament_id = tournamentId (already picked)
  const { data: pickedGames, error: pickedGamesError } = await supabase
    .from('games')
    .select(`
      *,
      game_type:game_types(*)
    `)
    .eq('tournament_id', tournamentId)
    .order('game_order');

  if (pickedGamesError) {
    throw new Error(`Failed to fetch picked games: ${pickedGamesError.message}`);
  }

  // Filter: remove game_types whose id matches any picked game's game_type_id
  const pickedGameTypeIds = new Set((pickedGames || []).map(game => game.game_type_id));
  const availableGameTypes = (gameTypes || []).filter(gameType => 
    !pickedGameTypeIds.has(gameType.id)
  );

  return {
    available: availableGameTypes,
    picked: pickedGames || []
  };
}

export async function fetchPickState(
  tournamentId: string
): Promise<{
  tournament: Tournament;
  currentPickTeam: Team;
  currentLeader: Player;
  roundNumber: number;
  totalRounds: number;
  teams: Team[];
  gamesPlayed: Game[];
}> {
  // Get tournament (current_pick_team, num_games, status)
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    throw new Error(`Failed to fetch tournament: ${tournamentError?.message}`);
  }

  // Get all games for tournament (count = round number)
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select(`
      *,
      game_type:game_types(*)
    `)
    .eq('tournament_id', tournamentId)
    .order('game_order');

  if (gamesError) {
    throw new Error(`Failed to fetch games: ${gamesError.message}`);
  }

  // Get teams + their players (to find leader names)
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select(`
      *,
      players(*)
    `)
    .eq('tournament_id', tournamentId)
    .order('created_at');

  if (teamsError) {
    throw new Error(`Failed to fetch teams: ${teamsError.message}`);
  }

  // Find current pick team
  const currentPickTeam = teams?.find(team => team.id === tournament.current_pick_team);
  if (!currentPickTeam) {
    throw new Error('Current pick team not found');
  }

  // Find current leader
  const currentLeader = currentPickTeam.players.find((player: Player) => player.is_leader);
  if (!currentLeader) {
    throw new Error('Current team has no leader');
  }

  const roundNumber = (games || []).length + 1;
  const totalRounds = tournament.num_games;

  return {
    tournament,
    currentPickTeam,
    currentLeader,
    roundNumber,
    totalRounds,
    teams: teams || [],
    gamesPlayed: games || []
  };
}

export async function pickGame(
  tournamentId: string,
  teamId: string,
  gameTypeId: string,
  playerId: string
): Promise<{ game: Game; tournament: Tournament }> {
  // Validate: tournament.status = 'picking'
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    throw new Error(`Failed to fetch tournament: ${tournamentError?.message}`);
  }

  if (tournament.status !== 'picking') {
    throw new Error('Tournament is not in picking phase');
  }

  // Validate: teamId = tournament.current_pick_team
  if (teamId !== tournament.current_pick_team) {
    throw new Error('It is not this team\'s turn to pick');
  }

  // Validate: player with playerId has is_leader = true on that team
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .eq('team_id', teamId)
    .single();

  if (playerError || !player) {
    throw new Error(`Failed to fetch player: ${playerError?.message}`);
  }

  if (!player.is_leader) {
    throw new Error('Only team leaders can pick games');
  }

  // Validate: gameTypeId not already in games for this tournament
  const { data: existingGame, error: existingGameError } = await supabase
    .from('games')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('game_type_id', gameTypeId)
    .single();

  if (existingGame) {
    throw new Error('This game has already been picked');
  }

  if (existingGameError && existingGameError.code !== 'PGRST116') { // PGRST116 = no rows found
    throw new Error(`Failed to check existing games: ${existingGameError.message}`);
  }

  // Calculate game_order = count of existing games for tournament + 1
  const { count: gameCount, error: countError } = await supabase
    .from('games')
    .select('id', { count: 'exact' })
    .eq('tournament_id', tournamentId);

  if (countError) {
    throw new Error(`Failed to count games: ${countError.message}`);
  }

  const gameOrder = (gameCount || 0) + 1;

  // Insert into games
  const { data: newGame, error: gameInsertError } = await supabase
    .from('games')
    .insert({
      tournament_id: tournamentId,
      game_type_id: gameTypeId,
      status: 'active',
      picked_by_team: teamId,
      game_order: gameOrder
    })
    .select(`
      *,
      game_type:game_types(*)
    `)
    .single();

  if (gameInsertError || !newGame) {
    throw new Error(`Failed to create game: ${gameInsertError?.message}`);
  }

  // Get other team: query teams where tournament_id = tournamentId AND id != teamId
  const { data: otherTeam, error: otherTeamError } = await supabase
    .from('teams')
    .select('id')
    .eq('tournament_id', tournamentId)
    .neq('id', teamId)
    .single();

  if (otherTeamError || !otherTeam) {
    throw new Error(`Failed to find other team: ${otherTeamError?.message}`);
  }

  // Update tournament: set current_pick_team to other team's id, set status to 'playing'
  const { data: updatedTournament, error: updateError } = await supabase
    .from('tournaments')
    .update({
      current_pick_team: otherTeam.id,
      status: 'playing'
    })
    .eq('id', tournamentId)
    .select()
    .single();

  if (updateError || !updatedTournament) {
    throw new Error(`Failed to update tournament: ${updateError?.message}`);
  }

  return {
    game: newGame,
    tournament: updatedTournament
  };
}

// Sprint 4: Game Play Functions

export async function fetchGameState(gameId: string): Promise<{
  game: Game;
  gameType: GameType;
  stats: PlayerStat[];
  result: GameResult | null;
  players: Player[];
}> {
  // Get game row with game_type join
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select(`
      *,
      game_type:game_types(*)
    `)
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    throw new Error(`Failed to fetch game: ${gameError?.message}`);
  }

  // Get all player_stats for this game
  const { data: stats, error: statsError } = await supabase
    .from('player_stats')
    .select('*')
    .eq('game_id', gameId)
    .order('submitted_at');

  if (statsError) {
    throw new Error(`Failed to fetch stats: ${statsError.message}`);
  }

  // Get game_results for this game (may be null)
  const { data: result, error: resultError } = await supabase
    .from('game_results')
    .select('*')
    .eq('game_id', gameId)
    .single();

  // resultError is expected if no result exists yet
  if (resultError && resultError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch result: ${resultError.message}`);
  }

  // Get all players in the tournament
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', game.tournament_id)
    .order('name');

  if (playersError) {
    throw new Error(`Failed to fetch players: ${playersError.message}`);
  }

  return {
    game,
    gameType: game.game_type as GameType,
    stats: stats || [],
    result: result || null,
    players: players || []
  };
}

export async function submitPlayerStats(
  gameId: string,
  playerId: string,
  stats: { key: string; value: number }[]
): Promise<PlayerStat[]> {
  const statRecords = stats.map(stat => ({
    game_id: gameId,
    player_id: playerId,
    stat_key: stat.key,
    stat_value: stat.value
  }));

  // Upsert each stat with onConflict handling
  const { data: upsertedStats, error } = await supabase
    .from('player_stats')
    .upsert(statRecords, {
      onConflict: 'game_id,player_id,stat_key'
    })
    .select();

  if (error || !upsertedStats) {
    throw new Error(`Failed to submit stats: ${error?.message}`);
  }

  return upsertedStats;
}

export async function submitGameResult(
  gameId: string,
  winningTeamId: string | null,
  resultData: Record<string, any>
): Promise<GameResult> {
  const { data: result, error } = await supabase
    .from('game_results')
    .insert({
      game_id: gameId,
      winning_team_id: winningTeamId,
      result_data: resultData
    })
    .select()
    .single();

  if (error || !result) {
    throw new Error(`Failed to submit result: ${error?.message}`);
  }

  return result;
}

export async function endGame(
  tournamentId: string,
  gameId: string
): Promise<{ game: Game; tournament: Tournament }> {
  // Update game status to 'titles'
  const { data: game, error: gameError } = await supabase
    .from('games')
    .update({ status: 'titles' })
    .eq('id', gameId)
    .select()
    .single();

  if (gameError || !game) {
    throw new Error(`Failed to update game status: ${gameError?.message}`);
  }

  // Update tournament status to 'scoring'
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .update({ status: 'scoring' })
    .eq('id', tournamentId)
    .select()
    .single();

  if (tournamentError || !tournament) {
    throw new Error(`Failed to update tournament status: ${tournamentError?.message}`);
  }

  return { game, tournament };
}

// Sprint 5: Title System Functions

export async function saveTitles(
  tournamentId: string,
  gameId: string,
  titles: {
    playerId: string;
    titleName: string;
    titleDesc: string;
    isFunny: boolean;
    points: number;
  }[]
): Promise<any[]> {
  if (titles.length === 0) {
    return [];
  }

  const titleRecords = titles.map(title => ({
    tournament_id: tournamentId,
    game_id: gameId,
    player_id: title.playerId,
    title_name: title.titleName,
    title_desc: title.titleDesc,
    is_funny: title.isFunny,
    points: title.points
  }));

  const { data: insertedTitles, error } = await supabase
    .from('titles')
    .insert(titleRecords)
    .select();

  if (error || !insertedTitles) {
    throw new Error(`Failed to save titles: ${error?.message}`);
  }

  return insertedTitles;
}

export async function updateTeamPoints(tournamentId: string): Promise<Team[]> {
  // Query ALL titles for this tournament
  const { data: titles, error: titlesError } = await supabase
    .from('titles')
    .select('player_id, points')
    .eq('tournament_id', tournamentId);

  if (titlesError) {
    throw new Error(`Failed to fetch titles: ${titlesError.message}`);
  }

  if (!titles || titles.length === 0) {
    // No titles, just return current teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentId);

    if (teamsError) {
      throw new Error(`Failed to fetch teams: ${teamsError.message}`);
    }

    return teams || [];
  }

  // For each title, find the player's team_id
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, team_id')
    .eq('tournament_id', tournamentId)
    .not('team_id', 'is', null);

  if (playersError) {
    throw new Error(`Failed to fetch players: ${playersError.message}`);
  }

  // Create player_id -> team_id mapping
  const playerToTeam = new Map<string, string>();
  (players || []).forEach(player => {
    if (player.team_id) {
      playerToTeam.set(player.id, player.team_id);
    }
  });

  // Sum points per team
  const teamPoints = new Map<string, number>();
  titles.forEach(title => {
    const teamId = playerToTeam.get(title.player_id);
    if (teamId) {
      teamPoints.set(teamId, (teamPoints.get(teamId) || 0) + title.points);
    }
  });

  // Update each team's total_points
  const updatedTeams = [];
  for (const [teamId, totalPoints] of teamPoints) {
    const { data: team, error: updateError } = await supabase
      .from('teams')
      .update({ total_points: totalPoints })
      .eq('id', teamId)
      .select()
      .single();

    if (updateError || !team) {
      throw new Error(`Failed to update team points: ${updateError?.message}`);
    }

    updatedTeams.push(team);
  }

  // Also fetch teams that didn't get any new points (to return complete list)
  const { data: allTeams, error: allTeamsError } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId);

  if (allTeamsError) {
    throw new Error(`Failed to fetch all teams: ${allTeamsError.message}`);
  }

  return allTeams || [];
}

export async function fetchTitlesForGame(gameId: string): Promise<(Title & { playerName: string })[]> {
  // Get all titles where game_id = gameId
  const { data: titles, error: titlesError } = await supabase
    .from('titles')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at');

  if (titlesError) {
    throw new Error(`Failed to fetch titles: ${titlesError.message}`);
  }

  if (!titles || titles.length === 0) {
    return [];
  }

  // Also fetch player names (separate query for simplicity)
  const playerIds = [...new Set(titles.map(t => t.player_id))];
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name')
    .in('id', playerIds);

  if (playersError) {
    throw new Error(`Failed to fetch player names: ${playersError.message}`);
  }

  // Create player_id -> name mapping
  const playerNames = new Map<string, string>();
  (players || []).forEach(player => {
    playerNames.set(player.id, player.name);
  });

  // Return titles with player names attached
  return titles.map(title => ({
    ...title,
    playerName: playerNames.get(title.player_id) || 'Unknown Player'
  }));
}

export async function advanceToNextRound(tournamentId: string, gameId: string): Promise<{ tournament: Tournament; isLastGame: boolean }> {
  // Update game status to 'completed'
  const { data: game, error: gameError } = await supabase
    .from('games')
    .update({ status: 'completed' })
    .eq('id', gameId)
    .select()
    .single();

  if (gameError || !game) {
    throw new Error(`Failed to update game status: ${gameError?.message}`);
  }

  // Count total games played (status='completed') for this tournament
  const { count: completedGames, error: countError } = await supabase
    .from('games')
    .select('id', { count: 'exact' })
    .eq('tournament_id', tournamentId)
    .eq('status', 'completed');

  if (countError) {
    throw new Error(`Failed to count completed games: ${countError.message}`);
  }

  // Get tournament.num_games
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    throw new Error(`Failed to fetch tournament: ${tournamentError?.message}`);
  }

  const totalGamesCompleted = completedGames || 0;
  const numGames = tournament.num_games;

  let updatedTournament: Tournament;

  if (totalGamesCompleted < numGames) {
    // If completed < num_games: Set tournament status = 'picking'
    // Get current_pick_team, find the other team, set current_pick_team to other team
    const { data: otherTeam, error: otherTeamError } = await supabase
      .from('teams')
      .select('id')
      .eq('tournament_id', tournamentId)
      .neq('id', tournament.current_pick_team)
      .single();

    if (otherTeamError || !otherTeam) {
      throw new Error(`Failed to find other team: ${otherTeamError?.message}`);
    }

    const { data: updatedTournamentData, error: updateError } = await supabase
      .from('tournaments')
      .update({
        status: 'picking',
        current_pick_team: otherTeam.id
      })
      .eq('id', tournamentId)
      .select()
      .single();

    if (updateError || !updatedTournamentData) {
      throw new Error(`Failed to update tournament: ${updateError?.message}`);
    }

    updatedTournament = updatedTournamentData;
    return { tournament: updatedTournament, isLastGame: false };
  } else {
    // If completed >= num_games: Set tournament status = 'completed'
    const { data: updatedTournamentData, error: updateError } = await supabase
      .from('tournaments')
      .update({ status: 'completed' })
      .eq('id', tournamentId)
      .select()
      .single();

    if (updateError || !updatedTournamentData) {
      throw new Error(`Failed to complete tournament: ${updateError?.message}`);
    }

    updatedTournament = updatedTournamentData;
    return { tournament: updatedTournament, isLastGame: true };
  }
}

// Sprint 6: Scoreboard Functions

export async function fetchScoreboard(tournamentId: string): Promise<ScoreboardData> {
  // Get tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    throw new Error(`Failed to fetch tournament: ${tournamentError?.message}`);
  }

  // Get all teams (with total_points) ORDER BY total_points DESC
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('total_points', { ascending: false });

  if (teamsError) {
    throw new Error(`Failed to fetch teams: ${teamsError.message}`);
  }

  // Get all players with team_id
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('name');

  if (playersError) {
    throw new Error(`Failed to fetch players: ${playersError.message}`);
  }

  // Get all games where status='completed' for this tournament, join with game_types for emoji/name
  const { data: completedGames, error: gamesError } = await supabase
    .from('games')
    .select(`
      *,
      game_type:game_types(*)
    `)
    .eq('tournament_id', tournamentId)
    .eq('status', 'completed')
    .order('game_order');

  if (gamesError) {
    throw new Error(`Failed to fetch games: ${gamesError.message}`);
  }

  // Get game results to find winning teams
  const gameIds = (completedGames || []).map(game => game.id);
  let gameResults: GameResult[] = [];
  if (gameIds.length > 0) {
    const { data: results, error: resultsError } = await supabase
      .from('game_results')
      .select('*')
      .in('game_id', gameIds);

    if (resultsError) {
      throw new Error(`Failed to fetch game results: ${resultsError.message}`);
    }
    gameResults = results || [];
  }

  // Get all titles for this tournament, join with players for names
  const { data: titles, error: titlesError } = await supabase
    .from('titles')
    .select(`
      *,
      player:players(name, team_id),
      team:teams(name)
    `)
    .eq('tournament_id', tournamentId)
    .order('created_at');

  if (titlesError) {
    throw new Error(`Failed to fetch titles: ${titlesError.message}`);
  }

  // Get all player_stats for games in this tournament
  const { data: playerStats, error: statsError } = await supabase
    .from('player_stats')
    .select('*')
    .in('game_id', gameIds)
    .order('submitted_at');

  if (statsError && gameIds.length > 0) {
    throw new Error(`Failed to fetch player stats: ${statsError.message}`);
  }

  // Build games with type info and winner names
  const games: GameWithType[] = (completedGames || []).map(game => {
    const result = gameResults.find(r => r.game_id === game.id);
    let winnerName = undefined;
    
    if (result?.winning_team_id) {
      const winningTeam = (teams || []).find(t => t.id === result.winning_team_id);
      winnerName = winningTeam?.name;
    }
    
    return {
      ...game,
      gameType: game.game_type as GameType,
      winnerName
    };
  });

  // Build titles with player and team names
  const titlesWithPlayer: TitleWithPlayer[] = (titles || []).map(title => ({
    ...title,
    playerName: (title.player as any)?.name || 'Unknown Player',
    teamName: (title.team as any)?.name || 'Unknown Team'
  }));

  // Compute title leaderboard: group titles by player_id, count, sort DESC
  const titleCounts = new Map<string, { count: number; playerName: string; teamName: string }>();
  
  (titles || []).forEach(title => {
    const playerId = title.player_id;
    const playerName = (title.player as any)?.name || 'Unknown Player';
    
    // Find team name from player's team_id
    const player = (players || []).find(p => p.id === playerId);
    const team = (teams || []).find(t => t.id === player?.team_id);
    const teamName = team?.name || 'No Team';
    
    if (titleCounts.has(playerId)) {
      titleCounts.get(playerId)!.count += 1;
    } else {
      titleCounts.set(playerId, { count: 1, playerName, teamName });
    }
  });

  const titleLeaderboard: LeaderboardEntry[] = Array.from(titleCounts.entries())
    .map(([playerId, data]) => ({
      playerId,
      playerName: data.playerName,
      teamName: data.teamName,
      titleCount: data.count
    }))
    .sort((a, b) => b.titleCount - a.titleCount);

  return {
    tournament,
    teams: teams || [],
    players: players || [],
    games,
    titles: titlesWithPlayer,
    playerStats: playerStats || [],
    titleLeaderboard
  };
}

export async function fetchPlayerDetail(playerId: string, tournamentId: string): Promise<PlayerDetail> {
  // Get player
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single();

  if (playerError || !player) {
    throw new Error(`Failed to fetch player: ${playerError?.message}`);
  }

  // Get all games in tournament for context
  const { data: allGames, error: gamesError } = await supabase
    .from('games')
    .select(`
      *,
      game_type:game_types(*)
    `)
    .eq('tournament_id', tournamentId)
    .order('game_order');

  if (gamesError) {
    throw new Error(`Failed to fetch games: ${gamesError.message}`);
  }

  // Get game results to find winners
  const gameIds = (allGames || []).map(game => game.id);
  let gameResults: GameResult[] = [];
  if (gameIds.length > 0) {
    const { data: results, error: resultsError } = await supabase
      .from('game_results')
      .select('*')
      .in('game_id', gameIds);

    if (resultsError) {
      throw new Error(`Failed to fetch game results: ${resultsError.message}`);
    }
    gameResults = results || [];
  }

  // Get teams for winner names
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId);

  if (teamsError) {
    throw new Error(`Failed to fetch teams: ${teamsError.message}`);
  }

  // Get all player_stats for this player across all games in tournament
  const { data: playerStats, error: statsError } = await supabase
    .from('player_stats')
    .select('*')
    .eq('player_id', playerId)
    .in('game_id', gameIds)
    .order('submitted_at');

  if (statsError && gameIds.length > 0) {
    throw new Error(`Failed to fetch player stats: ${statsError.message}`);
  }

  // Get all titles for this player in tournament
  const { data: titles, error: titlesError } = await supabase
    .from('titles')
    .select('*')
    .eq('player_id', playerId)
    .eq('tournament_id', tournamentId)
    .order('created_at');

  if (titlesError) {
    throw new Error(`Failed to fetch titles: ${titlesError.message}`);
  }

  // Build games with type info and winner names
  const gamesWithType: GameWithType[] = (allGames || []).map(game => {
    const result = gameResults.find(r => r.game_id === game.id);
    let winnerName = undefined;
    
    if (result?.winning_team_id) {
      const winningTeam = (teams || []).find(t => t.id === result.winning_team_id);
      winnerName = winningTeam?.name;
    }
    
    return {
      ...game,
      gameType: game.game_type as GameType,
      winnerName
    };
  });

  // Group stats by game
  const statsByGame = gamesWithType
    .map(game => ({
      game,
      stats: (playerStats || []).filter(stat => stat.game_id === game.id)
    }))
    .filter(entry => entry.stats.length > 0); // Only include games where player has stats

  // Calculate points contributed = sum of title points
  const pointsContributed = (titles || []).reduce((sum, title) => sum + title.points, 0);

  return {
    player,
    statsByGame,
    titles: titles || [],
    pointsContributed
  };
}

// Sprint 7: Ceremony Functions

export async function fetchCeremonyData(tournamentId: string): Promise<CeremonyData> {
  // Get tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    throw new Error(`Failed to fetch tournament: ${tournamentError?.message}`);
  }

  // Get teams sorted by points
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('total_points', { ascending: false });

  if (teamsError) throw new Error(`Failed to fetch teams: ${teamsError.message}`);

  // Get all players
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('name');

  if (playersError) throw new Error(`Failed to fetch players: ${playersError.message}`);

  // Get completed games with types
  const { data: completedGames, error: gamesError } = await supabase
    .from('games')
    .select('*, game_type:game_types(*)')
    .eq('tournament_id', tournamentId)
    .eq('status', 'completed')
    .order('game_order');

  if (gamesError) throw new Error(`Failed to fetch games: ${gamesError.message}`);

  // Get game results
  const gameIds = (completedGames || []).map(g => g.id);
  let gameResults: GameResult[] = [];
  if (gameIds.length > 0) {
    const { data: results, error } = await supabase
      .from('game_results')
      .select('*')
      .in('game_id', gameIds);
    if (error) throw new Error(`Failed to fetch results: ${error.message}`);
    gameResults = results || [];
  }

  // Get all titles (game + global)
  const { data: allTitlesRaw, error: titlesError } = await supabase
    .from('titles')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at');

  if (titlesError) throw new Error(`Failed to fetch titles: ${titlesError.message}`);

  // Build player name map
  const playerNameMap = new Map<string, string>();
  (players || []).forEach(p => playerNameMap.set(p.id, p.name));

  // Build team name map from player->team
  const playerTeamMap = new Map<string, string>();
  (players || []).forEach(p => {
    if (p.team_id) {
      const team = (teams || []).find(t => t.id === p.team_id);
      playerTeamMap.set(p.id, team?.name || 'No Team');
    }
  });

  const allTitles: TitleWithPlayer[] = (allTitlesRaw || []).map(t => ({
    ...t,
    playerName: playerNameMap.get(t.player_id) || 'Unknown',
    teamName: playerTeamMap.get(t.player_id) || 'No Team'
  }));

  const globalTitles = allTitles.filter(t => !t.game_id);

  // Build games with types
  const games: GameWithType[] = (completedGames || []).map(game => {
    const result = gameResults.find(r => r.game_id === game.id);
    const winningTeam = result?.winning_team_id
      ? (teams || []).find(t => t.id === result.winning_team_id)
      : null;
    return {
      ...game,
      gameType: game.game_type as GameType,
      winnerName: winningTeam?.name
    };
  });

  // Determine winner
  const teamList = teams || [];
  let winningTeam: Team | null = null;
  let isTied = false;
  if (teamList.length >= 2) {
    if (teamList[0].total_points > teamList[1].total_points) {
      winningTeam = teamList[0];
    } else if (teamList[0].total_points === teamList[1].total_points) {
      isTied = true;
    }
  } else if (teamList.length === 1) {
    winningTeam = teamList[0];
  }

  // Title leaderboard
  const titleCounts = new Map<string, { count: number; playerName: string; teamName: string }>();
  allTitles.forEach(t => {
    if (titleCounts.has(t.player_id)) {
      titleCounts.get(t.player_id)!.count += 1;
    } else {
      titleCounts.set(t.player_id, {
        count: 1,
        playerName: t.playerName,
        teamName: t.teamName
      });
    }
  });

  const titleLeaderboard: LeaderboardEntry[] = Array.from(titleCounts.entries())
    .map(([playerId, data]) => ({
      playerId,
      playerName: data.playerName,
      teamName: data.teamName,
      titleCount: data.count
    }))
    .sort((a, b) => b.titleCount - a.titleCount);

  return {
    tournament,
    teams: teamList,
    players: players || [],
    games,
    allTitles,
    globalTitles,
    winningTeam,
    isTied,
    titleLeaderboard
  };
}

export async function saveGlobalTitles(
  tournamentId: string,
  titles: {
    playerId: string;
    titleName: string;
    titleDesc: string;
    isFunny: boolean;
    points: number;
  }[]
): Promise<any[]> {
  if (titles.length === 0) return [];

  const records = titles.map(t => ({
    tournament_id: tournamentId,
    game_id: null,
    player_id: t.playerId,
    title_name: t.titleName,
    title_desc: t.titleDesc,
    is_funny: t.isFunny,
    points: t.points
  }));

  const { data, error } = await supabase
    .from('titles')
    .insert(records)
    .select();

  if (error) throw new Error(`Failed to save global titles: ${error.message}`);
  return data || [];
}

// Sprint 8: History Functions

export async function fetchTournamentHistory(): Promise<{
  tournament: Tournament;
  teams: { name: string; total_points: number }[];
  winningTeam: { name: string; total_points: number } | null;
  isTied: boolean;
}[]> {
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch tournament history: ${error.message}`);
  if (!tournaments || tournaments.length === 0) return [];

  const results = [];

  for (const tournament of tournaments) {
    // Get teams with total_points
    const { data: teams } = await supabase
      .from('teams')
      .select('name, total_points')
      .eq('tournament_id', tournament.id)
      .order('total_points', { ascending: false });

    const teamList = teams || [];
    
    // Determine winner (highest total_points team, or tie)
    let winningTeam: { name: string; total_points: number } | null = null;
    let isTied = false;
    
    if (teamList.length >= 2) {
      if (teamList[0].total_points > teamList[1].total_points) {
        winningTeam = teamList[0];
      } else if (teamList[0].total_points === teamList[1].total_points) {
        isTied = true;
      }
    } else if (teamList.length === 1) {
      winningTeam = teamList[0];
    }

    results.push({
      tournament,
      teams: teamList,
      winningTeam,
      isTied
    });
  }

  return results;
}

export async function fetchTournamentDetail(tournamentId: string): Promise<{
  tournament: Tournament;
  teams: Team[];
  players: Player[];
  games: GameWithType[];
  titles: TitleWithPlayer[];
  winningTeam: Team | null;
  isTied: boolean;
}> {
  // Use the same comprehensive data as fetchCeremonyData
  const ceremonyData = await fetchCeremonyData(tournamentId);
  
  return {
    tournament: ceremonyData.tournament,
    teams: ceremonyData.teams,
    players: ceremonyData.players,
    games: ceremonyData.games,
    titles: ceremonyData.allTitles,
    winningTeam: ceremonyData.winningTeam,
    isTied: ceremonyData.isTied
  };
}

export async function fetchHistory(): Promise<TournamentSummary[]> {
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch history: ${error.message}`);
  if (!tournaments || tournaments.length === 0) return [];

  const summaries: TournamentSummary[] = [];

  for (const t of tournaments) {
    // Get teams
    const { data: teams } = await supabase
      .from('teams')
      .select('name, total_points')
      .eq('tournament_id', t.id)
      .order('total_points', { ascending: false });

    // Get player count
    const { count: playerCount } = await supabase
      .from('players')
      .select('id', { count: 'exact' })
      .eq('tournament_id', t.id)
      .neq('role', 'spectator');

    summaries.push({
      id: t.id,
      name: t.name,
      room_code: t.room_code,
      status: t.status,
      num_games: t.num_games,
      created_at: t.created_at,
      teams: (teams || []).map(team => ({ name: team.name, total_points: team.total_points })),
      playerCount: playerCount || 0
    });
  }

  return summaries;
}

export async function fetchTournamentRecap(tournamentId: string): Promise<TournamentRecap> {
  const ceremony = await fetchCeremonyData(tournamentId);
  return {
    tournament: ceremony.tournament,
    teams: ceremony.teams,
    players: ceremony.players,
    games: ceremony.games,
    titles: ceremony.allTitles.filter(t => t.game_id !== null),
    globalTitles: ceremony.globalTitles,
    winningTeam: ceremony.winningTeam
  };
}

export async function createCustomGameType(tournamentId: string, gameData: {
  name: string;
  emoji: string;
  description: string;
  playerInputs: { key: string; label: string; type: 'number' | 'boolean'; min?: number; max?: number }[];
  refereeInputs: { key: string; label: string; type: 'team_select' | 'player_select' | 'team_scores' | 'player_times' }[];
  titleDefinitions: { name: string; desc: string; isFunny: boolean; condition: { type: string; stat: string; value?: number } }[];
}): Promise<GameType> {
  const { data, error } = await supabase
    .from('game_types')
    .insert({
      tournament_id: tournamentId,
      name: gameData.name,
      emoji: gameData.emoji,
      description: gameData.description,
      player_inputs: gameData.playerInputs,
      referee_inputs: gameData.refereeInputs,
      title_definitions: gameData.titleDefinitions
    })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to create custom game: ${error?.message}`);
  return data;
}