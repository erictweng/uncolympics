import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useLobbyStore from '../stores/lobbyStore';
import useGamePlayStore from '../stores/gamePlayStore';
import { fetchGameState, submitPlayerStats, submitGameResult, endGame } from '../lib/api';
import { subscribeGame } from '../lib/sync';
import { useReconnect } from '../hooks/useReconnect';
import DynamicStatInput from '../components/game/DynamicStatInput';
import DynamicRefereeInput from '../components/game/DynamicRefereeInput';
import type { GameType } from '../types';

interface StatInputDef {
  key: string;
  label: string;
  type: 'number' | 'boolean';
  min?: number;
  max?: number;
}

interface RefereeInputDef {
  key: string;
  label: string;
  type: 'team_select' | 'player_select' | 'team_scores' | 'player_times';
}

function GamePlay() {
  const { gameId } = useParams<{ roomCode: string; gameId: string }>();
  const navigate = useNavigate();
  
  // Reconnect on refresh
  useReconnect(true);

  const { tournament, currentPlayer, players, teams } = useLobbyStore();
  const {
    currentGame,
    liveFeed,
    setGame,
    setCurrentGameStats,
    setCurrentGameResult,
    clearGameState
  } = useGamePlayStore();
  
  // Local state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [playerStatValues, setPlayerStatValues] = useState<Record<string, number>>({});
  const [refereeValues, setRefereeValues] = useState<Record<string, any>>({});
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load game state on mount
  useEffect(() => {
    if (!gameId) return;
    
    let unsubscribe: (() => void) | null = null;
    
    async function loadGameState() {
      if (!gameId) return; // Add this check for TypeScript
      
      try {
        setLoading(true);
        setError(null);
        
        const gameState = await fetchGameState(gameId);
        
        // Update store
        setGame(gameState.game);
        setCurrentGameStats(gameState.stats);
        setCurrentGameResult(gameState.result);
        setGameType(gameState.gameType);
        
        // Set up realtime subscription
        if (gameState.game.tournament_id) {
          unsubscribe = subscribeGame(gameId, gameState.game.tournament_id);
        }
        
      } catch (err) {
        console.error('Failed to load game state:', err);
        setError(err instanceof Error ? err.message : 'Failed to load game');
      } finally {
        setLoading(false);
      }
    }
    
    loadGameState();
    
    return () => {
      unsubscribe?.();
      clearGameState();
    };
  }, [gameId, setGame, setCurrentGameStats, setCurrentGameResult, clearGameState]);

  // Navigate to title reveal when game status changes to 'titles'
  useEffect(() => {
    if (currentGame?.status === 'titles' && tournament?.room_code && gameId) {
      navigate(`/game/${tournament.room_code}/reveal/${gameId}`);
    }
  }, [currentGame?.status, tournament?.room_code, gameId, navigate]);

  // Parse player and referee inputs from gameType
  const playerInputs: StatInputDef[] = useMemo(() => {
    if (!gameType?.player_inputs) return [];
    
    // Convert the JSON structure to StatInputDef array
    if (Array.isArray(gameType.player_inputs)) {
      return gameType.player_inputs as StatInputDef[];
    }
    
    // Handle object format
    return Object.entries(gameType.player_inputs).map(([key, def]: [string, any]) => ({
      key,
      label: def.label || key,
      type: def.type || 'number',
      min: def.min,
      max: def.max
    }));
  }, [gameType]);

  const refereeInputs: RefereeInputDef[] = useMemo(() => {
    if (!gameType?.referee_inputs) return [];
    
    // Convert the JSON structure to RefereeInputDef array
    if (Array.isArray(gameType.referee_inputs)) {
      return gameType.referee_inputs as RefereeInputDef[];
    }
    
    // Handle object format
    return Object.entries(gameType.referee_inputs).map(([key, def]: [string, any]) => ({
      key,
      label: def.label || key,
      type: def.type || 'team_select'
    }));
  }, [gameType]);

  // Determine user role and capabilities
  const isReferee = currentPlayer?.role === 'referee';
  const isPlayer = currentPlayer?.role === 'player';
  const hasPlayerInputs = playerInputs.length > 0;

  // Find teams for the game
  const gameTeams = teams.filter(team => 
    players.some(player => player.team_id === team.id && player.role === 'player')
  );

  const handlePlayerStatChange = (key: string, value: number) => {
    setPlayerStatValues(prev => ({ ...prev, [key]: value }));
    setSubmitSuccess(false); // Clear success message when values change
  };

  const handleRefereeValueChange = (key: string, value: any) => {
    setRefereeValues(prev => ({ ...prev, [key]: value }));
  };

  const submitPlayerStatsHandler = async () => {
    if (!gameId || !currentPlayer) return;
    
    try {
      setSubmitting(true);
      setError(null);
      
      const stats = Object.entries(playerStatValues).map(([key, value]) => ({
        key,
        value
      }));
      
      await submitPlayerStats(gameId, currentPlayer.id, stats);
      setSubmitSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);
      
    } catch (err) {
      console.error('Failed to submit stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit stats');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndGame = async () => {
    if (!gameId || !tournament) return;
    
    try {
      setSubmitting(true);
      setError(null);
      
      // Submit referee result first if there are referee values
      if (Object.keys(refereeValues).length > 0) {
        const winningTeamId = refereeValues.winner || null;
        await submitGameResult(gameId, winningTeamId, refereeValues);
      }
      
      // End the game
      await endGame(tournament.id, gameId);
      setShowEndGameModal(false);
      
    } catch (err) {
      console.error('Failed to end game:', err);
      setError(err instanceof Error ? err.message : 'Failed to end game');
    } finally {
      setSubmitting(false);
    }
  };

  // Update document title
  useEffect(() => {
    if (gameType) {
      document.title = `UNCOLYMPICS - ${gameType.name}`;
    }
  }, [gameType]);
  
  if (loading) {
    return <div className="min-h-screen" />;
  }

  if (!gameType || !currentGame) {
    return (
      <div className="min-h-screen app-container flex items-center justify-center">
        <div className="text-center glass-panel p-6">
          <p className="text-lg text-red">Game not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-container">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-2">{gameType.emoji}</div>
          <h1 className="text-3xl font-heading text-primary mb-2">{gameType.name}</h1>
          <div className="text-lg text-secondary mb-4">
            Round {currentGame.game_order} / {tournament?.num_games || '?'}
          </div>
          {gameTeams.length >= 2 && (
            <div className="text-xl font-heading text-navy">
              {gameTeams[0].name} vs {gameTeams[1].name}
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="glass-panel border-red text-red p-4 mb-6">
            {error}
          </div>
        )}

        {/* Rules Card */}
        <div className="glass-panel p-6 mb-8">
          <button
            onClick={() => setRulesExpanded(!rulesExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="text-xl font-heading text-primary">Game Rules</h2>
            <span className="text-2xl text-primary">
              {rulesExpanded ? '−' : '+'}
            </span>
          </button>
          {rulesExpanded && (
            <div className="mt-4 text-secondary whitespace-pre-wrap">
              {gameType.description}
            </div>
          )}
        </div>

        {/* Player Stats Section */}
        {isPlayer && hasPlayerInputs && (
          <div className="glass-panel p-6 mb-8">
            <h2 className="text-xl font-heading text-primary mb-6 text-center">── YOUR STATS ──</h2>
            
            <DynamicStatInput
              inputs={playerInputs}
              values={playerStatValues}
              onChange={handlePlayerStatChange}
            />
            
            <div className="mt-8 text-center">
              <button
                onClick={submitPlayerStatsHandler}
                disabled={submitting}
                className="bg-navy hover:bg-navy-alt text-primary px-8 py-3 rounded-lg text-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Stats'}
              </button>
              
              {submitSuccess && (
                <div className="mt-4 text-navy font-semibold">
                  ✅ Stats submitted!
                </div>
              )}
            </div>
          </div>
        )}

        {/* No Player Stats Message */}
        {isPlayer && !hasPlayerInputs && (
          <div className="glass-panel p-6 mb-8 text-center">
            <div className="text-4xl mb-4">📺</div>
            <p className="text-lg text-secondary">
              No stats to report for this game — enjoy watching!
            </p>
          </div>
        )}

        {/* Live Feed */}
        <div className="glass-panel p-6 mb-8">
          <h2 className="text-xl font-heading text-primary mb-6 text-center">── LIVE FEED ──</h2>
          
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {liveFeed.length === 0 ? (
              <p className="text-secondary text-center py-4">
                No activity yet...
              </p>
            ) : (
              liveFeed.map((item, index) => (
                <div key={index} className="glass-panel p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-semibold text-navy">{item.playerName}</span>
                      <span className="mx-2 text-secondary">•</span>
                      <span className="text-secondary">{item.statLabel}: </span>
                      <span className="font-bold text-primary">{item.statValue}</span>
                    </div>
                    <div className="text-xs text-secondary">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Referee Controls */}
        {isReferee && (
          <div className="glass-panel border-[var(--accent-tertiary)] p-6">
            <div className="border-b border-[var(--glass-border)] pb-4 mb-6">
              <h2 className="text-xl font-heading text-red text-center">
                ═══ REFEREE CONTROLS ═══
              </h2>
            </div>
            
            {refereeInputs.length > 0 && (
              <div className="mb-8">
                <DynamicRefereeInput
                  inputs={refereeInputs}
                  teams={gameTeams}
                  players={players}
                  values={refereeValues}
                  onChange={handleRefereeValueChange}
                />
              </div>
            )}
            
            <div className="text-center">
              <button
                onClick={() => setShowEndGameModal(true)}
                disabled={submitting}
                className="bg-red hover:scale-105 text-primary px-8 py-3 rounded-lg text-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Ending Game...' : 'END GAME'}
              </button>
            </div>
          </div>
        )}

        {/* End Game Confirmation Modal */}
        {showEndGameModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-4">
              <h3 className="text-xl font-semibold mb-4">End Game?</h3>
              <p className="text-gray-300 mb-6">
                Are you sure you want to end this game? Titles will be calculated and revealed.
              </p>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowEndGameModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndGame}
                  disabled={submitting}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Ending...' : 'End Game'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default GamePlay;