import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import useLobbyStore from '../stores/lobbyStore'
import { reconnectPlayer } from '../lib/api/tournaments'
import type { Tournament, Player } from '../types'

function Home() {
  const resetLobby = useLobbyStore(s => s.resetLobby)
  const navigate = useNavigate()
  const [reconnectData, setReconnectData] = useState<{ tournament: Tournament; player: Player } | null>(null)

  useEffect(() => {
    document.title = 'UNCOLYMPICS - Home'
  }, [])

  // Check for reconnect first, then resetLobby only if no active tournament
  useEffect(() => {
    const deviceId = localStorage.getItem('uncolympics_device_id')
    if (!deviceId) {
      resetLobby()
      return
    }

    reconnectPlayer(deviceId)
      .then(result => {
        if (result) {
          setReconnectData(result)
        } else {
          resetLobby()
        }
      })
      .catch(() => {
        resetLobby()
      })
  }, [])

  function handleReconnect() {
    if (!reconnectData) return
    const { tournament } = reconnectData
    const code = tournament.room_code

    switch (tournament.status) {
      case 'lobby':
        navigate(`/lobby/${code}`)
        break
      case 'team_select':
        navigate(`/team-select/${code}`)
        break
      case 'picking':
        navigate(`/game/${code}/pick`)
        break
      case 'playing':
        navigate(`/game/${code}/play`)
        break
      case 'scoring':
        navigate(`/scoreboard/${code}`)
        break
      default:
        navigate(`/lobby/${code}`)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-12">
      {/* Title with curtain reveal */}
      <motion.h1
        className="text-6xl md:text-8xl font-heading text-primary text-center"
        initial={{ clipPath: 'inset(0 0 100% 0)' }}
        animate={{ clipPath: 'inset(0 0 0% 0)' }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      >
        UNCOLYMPICS
      </motion.h1>

      {/* Glass Panel with Buttons - fades in after title reveal */}
      <motion.div
        className="glass-panel p-8 w-full max-w-sm space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.5, ease: 'easeOut' }}
      >
        <Link to="/create" className="block">
          <button className="btn-navy w-full text-xl font-semibold">
            Create Tournament
          </button>
        </Link>

        <Link to="/join" className="block">
          <button className="btn-navy w-full text-xl font-semibold">
            Join Tournament
          </button>
        </Link>
      </motion.div>

      {/* Reconnect button */}
      {reconnectData && (
        <motion.div
          className="w-full max-w-sm text-right pr-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 2.0, ease: 'easeOut' }}
        >
          <button
            onClick={handleReconnect}
            className="text-sm text-gray-400 hover:text-white transition-colors cursor-pointer bg-transparent border-none"
          >
            Rejoin game →
          </button>
        </motion.div>
      )}
    </div>
  )
}

export default Home
