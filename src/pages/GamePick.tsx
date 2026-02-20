import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../stores/gameStore'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { subscribeTournament } from '../lib/sync'
import { fetchAvailableGames, fetchPickState, pickGame } from '../lib/api'
import CustomGameCreator from '../components/game/CustomGameCreator'
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
          className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full"
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
                className="flex-1 py-2 px-4 border border-gray-600 rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2 px-4 bg-green-500 hover:bg-green-600 rounded-lg text-white font-semibold transition-colors shadow-lg shadow-green-500/20"
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
  
  const {
    tournament,
    currentPlayer,
    teams,
    availableGames,
    pickedGames,
    currentPickTeam,
    currentRound,
    setAvailableGames,
    setPickedGames,
    setCurrentPickTeam,
    setCurrentRound,
    connectionStatus
  } = useGameStore()

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

  // Subscribe to real-time updates
  useEffect(() => {
    if (!tournament?.id) return

    const unsubscribe = subscribeTournament(tournament.id)
    return unsubscribe
  }, [tournament?.id])

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

  // Update document title
  useEffect(() => {
    document.title = 'UNCOLYMPICS - Game Pick';
  }, []);
  
  if (loading) {
    return <LoadingSpinner message="Loading games..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const currentTeam = teams.find(team => team.id === currentPickTeam)
  const currentLeader = currentPlayer && useGameStore.getState().players
    .find(player => player.team_id === currentPickTeam && player.is_leader)
  
  const isCurrentLeader = currentPlayer?.id === currentLeader?.id
  const isReferee = currentPlayer?.role === 'referee'
  const totalRounds = tournament?.num_games || 0
  
  // Determine team color - first team is cyan, second is pink
  const sortedTeams = [...teams].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const teamColor = sortedTeams[0]?.id === currentPickTeam ? 'cyan' : 'pink'

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            ROUND {currentRound}/{totalRounds}
          </h1>
          
          {/* Turn indicator */}
          <div className={`text-xl font-semibold mb-2 ${
            teamColor === 'cyan' ? 'text-cyan-400' : 'text-pink-400'
          }`}>
            {currentTeam?.name}'s turn to pick
          </div>
          
          {/* Leader name */}
          {currentLeader && (
            <p className="text-gray-400">
              Leader: <span className="text-white font-medium">{currentLeader.name}</span>
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
          <div className="mb-8 p-4 bg-gray-900/50 border border-gray-700 rounded-lg text-center">
            <p className="text-gray-300">
              Waiting for <span className="text-white font-medium">{currentLeader.name}</span> to pick...
            </p>
          </div>
        )}

        {/* Available Games */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Available Games</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableGames.map((gameType) => (
              <motion.div
                key={gameType.id}
                whileHover={isCurrentLeader ? { scale: 1.02 } : {}}
                className={`p-4 bg-gray-900 border border-gray-700 rounded-lg transition-all ${
                  isCurrentLeader 
                    ? 'cursor-pointer hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-400/20' 
                    : 'cursor-not-allowed opacity-60'
                }`}
                onClick={() => isCurrentLeader && setSelectedGame(gameType)}
              >
                <div className="text-3xl mb-2">{gameType.emoji}</div>
                <h3 className="font-bold text-white mb-2">{gameType.name}</h3>
                <p className="text-gray-400 text-sm mb-2">{gameType.description}</p>
                <p className="text-xs text-gray-500">~20 min</p>
              </motion.div>
            ))}
          </div>
          
          {availableGames.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No games available to pick
            </div>
          )}

          {/* Custom Game Creator Button - Only for Referee */}
          {isReferee && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowCustomGameCreator(true)}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-purple-500/20 border border-purple-500"
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
              <div className="flex-1 h-px bg-gray-700"></div>
              <span className="text-gray-500 font-medium">Already Picked</span>
              <div className="flex-1 h-px bg-gray-700"></div>
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
                    className="p-4 bg-gray-800/50 border border-gray-600 rounded-lg opacity-60"
                  >
                    <div className="text-2xl mb-2">{gameType?.emoji}</div>
                    <h3 className="font-bold text-gray-300 mb-1">{gameType?.name}</h3>
                    <p className="text-gray-500 text-xs">
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