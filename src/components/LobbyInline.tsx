import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useLobbyStore from '../stores/lobbyStore'
import { subscribeTournament } from '../lib/sync'
import { fetchLobbyState } from '../lib/api'

interface LobbyInlineProps {
  /** When true, start rendering lobby content */
  active: boolean
}

/**
 * Renders lobby content (player names + lobby code) inline,
 * used during the seamless create/join → lobby transition.
 * Sets up realtime subscription and fetches players.
 */
export function LobbyInline({ active }: LobbyInlineProps) {
  const { tournament, currentPlayer, players, setPlayers, setTeams, setVotes } = useLobbyStore()
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!active || !tournament?.id) return

    // Fetch lobby state
    fetchLobbyState(tournament.id)
      .then((state) => {
        setPlayers(state.players)
        setTeams(state.teams)
        setVotes(state.votes)
      })
      .catch(console.error)

    // Subscribe to realtime
    unsubRef.current = subscribeTournament(tournament.id)

    // Update URL without hard nav
    const roomCode = tournament.room_code
    window.history.replaceState(null, '', `/lobby/${roomCode}`)
    document.title = `UNCOLYMPICS - Lobby ${roomCode}`

    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
    }
  }, [active, tournament?.id])

  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const handleExit = () => setExiting(true)
    window.addEventListener('lobby-exit', handleExit)
    return () => window.removeEventListener('lobby-exit', handleExit)
  }, [])

  if (!active || !tournament) return null

  const roomCode = tournament.room_code
  const playerCount = players.length
  const baseSizeVh = 16.67
  const fontSize = playerCount <= 1
    ? baseSizeVh
    : Math.max(2, baseSizeVh / (playerCount * 0.6))

  return (
    <div className="flex flex-col items-start w-full px-6 pt-8">
      {/* Lobby code — fades in after names load */}
      <AnimatePresence>
        {players.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-4"
          >
            <div className="font-heading text-3xl text-gray-500 leading-tight">
              LOBBY {roomCode?.toUpperCase()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player names — slide in from below, staggered exit up */}
      <motion.div
        className="flex flex-col items-start space-y-2 w-full"
        initial="visible"
        animate={exiting ? 'exit' : 'visible'}
      >
        <AnimatePresence>
          {players.map((player, index) => {
            const isMe = player.id === currentPlayer?.id
            const isRefereePlayer = player.role === 'referee'

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 60 }}
                animate={exiting
                  ? { opacity: 0, y: -40, transition: { duration: 0.35, delay: index * 0.1, ease: 'easeIn' } }
                  : { opacity: 1, y: 0 }
                }
                exit={{ opacity: 0, y: 60 }}
                transition={{
                  duration: 0.5,
                  delay: isRefereePlayer ? 0.1 : 0.15 * index,
                  ease: 'easeOut',
                }}
              >
                <div
                  className="font-heading leading-tight"
                  style={{
                    fontSize: `${fontSize}vh`,
                    color: isMe ? '#ffffff' : '#9ca3af',
                  }}
                >
                  {player.name}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
