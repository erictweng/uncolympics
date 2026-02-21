import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useLobbyStore from '../stores/lobbyStore'
import useGamePlayStore from '../stores/gamePlayStore'
import { fetchAvailableGames, fetchPickState, pickGame } from '../lib/api'
import { useReconnect } from '../hooks/useReconnect'
import CustomGameCreator from '../components/game/CustomGameCreator'
import DiceRoll from '../components/game/DiceRoll'
import type { GameType, Game } from '../types'

interface ConfirmModalProps {
  game: GameType | null
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmModal({ game, onConfirm, onCancel }: ConfirmModalProps) {
  if (!game) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="glass-panel p-6 max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="text-4xl mb-4">{game.emoji}</div>
            <h3 className="text-xl font-bold mb-2 text-white">
              Pick {game.name}?
            </h3>
            <p className="text-gray-400 mb-6">{game.description}</p>
            
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2 px-4 glass-panel text-secondary hover:text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2 px-4 bg-navy hover:bg-navy-alt rounded-lg text-primary font-semibold transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function GamePick() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCustomGameCreator, setShowCustomGameCreator] = useState(false)
  const [diceRollDone, setDiceRollDone] = useState(false)
  
  // Reconnect on refresh — handles state recovery + realtime + redirect
  const reconnectStatus = useReconnect(true)

  const { tournament, currentPlayer, teams, connectionStatus, players } = useLobbyStore()
  const {
    availableGames,
    pickedGames,
    currentPickTeam,
    currentRound,
    setAvailableGames,
    setPickedGames,
    setCurrentPickTeam,
    setCurrentRound
  } = useGamePlayStore()

  // Update document title
  useEffect(() => {
    document.title = 'UNCOLYMPICS - Game Pick';
  }, []);

  // Load initial data
  useEffect(() => {
    if (!tournament?.id) return

    const loadPickState = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch available games and pick state
        const [gamesData, pickStateData] = await Promise.all([
          fetchAvailableGames(tournament.id),
          fetchPickState(tournament.id)
        ])

        // Update store
        setAvailableGames(gamesData.available)
        setPickedGames(gamesData.picked)
        setCurrentPickTeam(pickStateData.currentPickTeam.id)
        setCurrentRound(pickStateData.roundNumber)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pick state')
      } finally {
        setLoading(false)
      }
    }

    loadPickState()
  }, [tournament?.id, setAvailableGames, setPickedGames, setCurrentPickTeam, setCurrentRound])

  // Real-time subscription is handled by useReconnect

  // Navigation effect - when game status changes to playing, navigate to game
  useEffect(() => {
    if (tournament?.status === 'playing' && pickedGames.length > 0) {
      const latestGame = pickedGames[pickedGames.length - 1]
      if (latestGame?.status === 'active') {
        navigate(`/game/${roomCode}/play/${latestGame.id}`)
      }
    }
  }, [tournament?.status, pickedGames, navigate, roomCode])

  // Handle game pick
  const handleGamePick = async (gameType: GameType) => {
    if (!tournament?.id || !currentPlayer?.id || !currentPickTeam) {
      return
    }

    try {
      setError(null)
      await pickGame(tournament.id, currentPickTeam, gameType.id, currentPlayer.id)
      setSelectedGame(null)
      // The real-time subscription will handle updating the store
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pick game')
    }
  }

  // Handle custom game creation
  const handleCustomGameCreated = async () => {
    setShowCustomGameCreator(false)
    // Refresh available games to include the new custom game
    if (tournament?.id) {
      try {
        const gamesData = await fetchAvailableGames(tournament.id)
        setAvailableGames(gamesData.available)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh games')
      }
    }
  }

  if (reconnectStatus === 'expired' || reconnectStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <div className="text-xl text-gray-400">Session expired</div>
        <button onClick={() => navigate('/')} className="text-blue-400 underline">Back to home</button>
      </div>
    )
  }

  if (loading || reconnectStatus === 'loading') {
    return <div className="min-h-screen" />;
  }

  if (error) {
    return (
      <div className="min-h-screen app-container flex items-center justify-center">
        <div className="text-center max-w-md glass-panel p-6">
          <p className="text-red mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 glass-panel hover:bg-navy text-primary transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const currentTeam = teams.find(team => team.id === currentPickTeam)
  const currentLeader = currentPlayer && players
    .find(player => player.team_id === currentPickTeam && player.is_leader)
  
  const isCurrentLeader = currentPlayer?.id === currentLeader?.id
  const isReferee = currentPlayer?.role === 'referee'
  const totalRounds = tournament?.num_games || 0

  // Show dice roll on first round if no games picked yet and roll not complete
  const needsDiceRoll = currentRound === 1 
    && pickedGames.length === 0 
    && !diceRollDone 
    && !tournament?.dice_roll_data?.winnerId

  if (needsDiceRoll) {
    return (
      <div className="min-h-screen app-container">
        <DiceRoll onComplete={() => setDiceRollDone(true)} />
      </div>
    )
  }
  
  return (
    <div className="min-h-screen app-container">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-heading text-primary mb-2">
            ROUND {currentRound}/{totalRounds}
          </h1>
          
          {/* Turn indicator */}
          <div className="text-xl font-heading text-navy mb-2">
            {currentTeam?.name}'s turn to pick
          </div>
          
          {/* Leader name */}
          {currentLeader && (
            <p className="text-secondary">
              Leader: <span className="text-primary font-medium">{currentLeader.name}</span>
            </p>
          )}
          
          {/* Connection status */}
          {connectionStatus !== 'connected' && (
            <div className="mt-2 px-3 py-1 bg-yellow-900/20 border border-yellow-700 rounded-full inline-block">
              <span className="text-yellow-400 text-sm">
                {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
              </span>
            </div>
          )}
        </div>

        {/* Waiting message for non-leaders */}
        {!isCurrentLeader && currentLeader && (
          <div className="mb-8 p-4 glass-panel text-center">
            <p className="text-secondary">
              Waiting for <span className="text-primary font-medium">{currentLeader.name}</span> to pick...
            </p>
          </div>
        )}

        {/* Available Games */}
        <div className="mb-8">
          <h2 className="text-xl font-heading text-primary mb-4">Available Games</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableGames.map((gameType) => (
              <motion.div
                key={gameType.id}
                whileHover={isCurrentLeader ? { scale: 1.02 } : {}}
                className={`p-4 glass-panel transition-all ${
                  isCurrentLeader 
                    ? 'cursor-pointer hover:border-[var(--accent-secondary)] hover:shadow-lg hover:shadow-blue-900/20' 
                    : 'cursor-not-allowed opacity-60'
                }`}
                onClick={() => isCurrentLeader && setSelectedGame(gameType)}
              >
                <div className="text-3xl mb-2">{gameType.emoji}</div>
                <h3 className="font-heading text-primary mb-2">{gameType.name}</h3>
                <p className="text-secondary text-sm mb-2">{gameType.description}</p>
                <p className="text-xs text-secondary">~20 min</p>
              </motion.div>
            ))}
          </div>
          
          {availableGames.length === 0 && (
            <div className="text-center py-8 text-secondary">
              No games available to pick
            </div>
          )}

          {/* Custom Game Creator Button - Only for Referee */}
          {isReferee && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowCustomGameCreator(true)}
                className="px-6 py-3 bg-navy hover:bg-navy-alt text-primary font-medium rounded-lg transition-colors"
              >
                + Create Custom Game
              </button>
            </div>
          )}
        </div>

        {/* Already Picked Games */}
        {pickedGames.length > 0 && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 h-px bg-[var(--glass-border)]"></div>
              <span className="text-secondary font-heading">Already Picked</span>
              <div className="flex-1 h-px bg-[var(--glass-border)]"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pickedGames.map((game) => {
                // Type assertion for the populated game_type relation
                const gameWithType = game as Game & { game_type: GameType }
                const gameType = gameWithType.game_type
                const pickingTeam = teams.find(team => team.id === game.picked_by_team)
                
                return (
                  <div
                    key={game.id}
                    className="p-4 glass-panel opacity-60"
                  >
                    <div className="text-2xl mb-2">{gameType?.emoji}</div>
                    <h3 className="font-heading text-secondary mb-1">{gameType?.name}</h3>
                    <p className="text-secondary text-xs">
                      Picked by {pickingTeam?.name}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        game={selectedGame}
        onConfirm={() => selectedGame && handleGamePick(selectedGame)}
        onCancel={() => setSelectedGame(null)}
      />

      {/* Custom Game Creator Modal */}
      {tournament?.id && (
        <CustomGameCreator
          isOpen={showCustomGameCreator}
          tournamentId={tournament.id}
          onClose={() => setShowCustomGameCreator(false)}
          onGameCreated={handleCustomGameCreated}
        />
      )}
    </div>
  )
}

export default GamePick