import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useLobbyStore from '../stores/lobbyStore'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { subscribeTournament } from '../lib/sync'
import { 
  fetchLobbyState, 
  createTeam, 
  joinTeam, 
  voteForLeader, 
  startTournament 
} from '../lib/api'
import { toast } from '../lib/toast'
import { useSwipeUp } from '../hooks/useSwipeUp'
import { SwipeHint } from '../components/ui/SwipeHint'

function Lobby() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const {
    tournament,
    currentPlayer,
    players,
    teams,
    votes,
    connectionStatus,
    setTournament,
    setPlayers,
    setTeams,
    setVotes
  } = useLobbyStore()

  // Load lobby state on mount
  useEffect(() => {
    if (!tournament?.id) return

    const loadLobbyState = async () => {
      try {
        setIsLoading(true)
        const state = await fetchLobbyState(tournament.id)
        setTournament(state.tournament)
        setPlayers(state.players)
        setTeams(state.teams)
        setVotes(state.votes)
        
        if (state.teams.length === 0) {
          const teamA = await createTeam(tournament.id, 'Team A')
          const teamB = await createTeam(tournament.id, 'Team B')
          setTeams([teamA, teamB])
          
          if (currentPlayer && currentPlayer.role !== 'spectator' && !currentPlayer.team_id) {
            await joinTeam(currentPlayer.id, teamA.id)
          }
        } else if (currentPlayer && currentPlayer.role !== 'spectator' && !currentPlayer.team_id) {
          const firstTeam = state.teams[0]
          if (firstTeam) {
            await joinTeam(currentPlayer.id, firstTeam.id)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lobby')
      } finally {
        setIsLoading(false)
      }
    }

    loadLobbyState()
  }, [tournament?.id, currentPlayer?.id])

  // Setup real-time sync
  useEffect(() => {
    if (!tournament?.id) return
    const unsubscribe = subscribeTournament(tournament.id)
    return unsubscribe
  }, [tournament?.id])

  // Navigate when tournament status changes to 'picking'
  useEffect(() => {
    if (tournament?.status === 'picking' && roomCode) {
      navigate(`/game/${roomCode}/pick`)
    }
  }, [tournament?.status, roomCode, navigate])
  
  useEffect(() => {
    document.title = `UNCOLYMPICS - Lobby ${roomCode || ''}`;
  }, [roomCode]);

  // Auto-vote for leader
  useEffect(() => {
    if (!currentPlayer || !teams.length || votes.length > 0) return
    
    const myTeam = teams.find(t => 
      players.some(p => p.team_id === t.id && p.id === currentPlayer.id)
    )
    
    if (myTeam && currentPlayer.role !== 'spectator') {
      voteForLeader(myTeam.id, currentPlayer.id, currentPlayer.id).catch(() => {})
    }
  }, [currentPlayer, teams, players, votes.length])

  const handleStartTournament = async () => {
    if (!tournament) return
    try {
      await startTournament(tournament.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start tournament')
    }
  }

  const canStartTournament = (): boolean => {
    const activePlayers = players.filter(p => p.role !== 'spectator')
    return activePlayers.length >= 2
  }

  // Dynamic font sizing: 1 name = 1/6th of viewport, shrinks as more join
  const playerCount = players.length
  const baseSizeVh = 16.67 // 1/6th of viewport height
  const fontSize = playerCount <= 1
    ? baseSizeVh
    : Math.max(2, baseSizeVh / (playerCount * 0.6))

  const isReferee = currentPlayer?.role === 'referee'

  // Add swipe-up functionality for referees
  const { swipeHintRef } = useSwipeUp({
    onSwipe: handleStartTournament,
    enabled: isReferee && canStartTournament()
  })

  if (isLoading) {
    return <div className="min-h-screen" />;
  }

  if (!tournament || !currentPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-300">Failed to load tournament</div>
      </div>
    )
  }

  return (
    <div ref={swipeHintRef} className="min-h-screen flex flex-col relative px-6 pt-8">
      {/* Connection status indicator */}
      <div className={`absolute top-4 right-4 w-3 h-3 rounded-full ${
        connectionStatus === 'connected' ? 'bg-green-400' : 
        connectionStatus === 'reconnecting' ? 'bg-yellow-400' : 'bg-red-400'
      }`} title={connectionStatus || 'unknown'} />

      {/* Player Names — top-left aligned, bottom-to-top slide-in */}
      <div className="flex flex-col items-start space-y-2 w-full">
        <AnimatePresence>
          {players.map((player, index) => {
            const isMe = player.id === currentPlayer.id
            const isRefereePlayer = player.role === 'referee'
            
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 60 }}
                transition={{ 
                  duration: 0.5,
                  delay: isRefereePlayer ? 0.1 : 0.15 * index,
                  ease: 'easeOut'
                }}
              >
                <div
                  className="font-heading leading-tight"
                  style={{ 
                    fontSize: `${fontSize}vh`,
                    color: isMe ? '#ffffff' : '#9ca3af' // white for self, light gray for others
                  }}
                >
                  {player.name}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Waiting message for non-referees */}
      {!isReferee && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          className="absolute bottom-8 left-6 text-gray-500 text-sm"
        >
          <p>Waiting for referee...</p>
        </motion.div>
      )}

      {/* Swipe hint for referee */}
      <SwipeHint 
        visible={isReferee && canStartTournament()} 
        text="↑ Swipe up to start"
      />

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-16 left-6 right-6"
        >
          <div className="glass-panel p-3 bg-red-500/20 border-red-500/30">
            <p className="text-red-300 text-sm">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="mt-1 text-red-200 hover:text-red-100 underline text-xs"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default Lobby
