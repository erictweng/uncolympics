import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useLobbyStore from '../stores/lobbyStore'
import { getPlayersWithProfiles } from '../lib/api'
import type { PlayerWithProfile } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useReconnect } from '../hooks/useReconnect'

const TIER_CONFIG: Record<string, { label: string; emoji: string; color: string; glow: string }> = {
  wonderkid: { label: 'Wonderkid', emoji: '🌟', color: 'text-blue-400', glow: 'shadow-blue-500/50' },
  rising_prospect: { label: 'Rising Prospect', emoji: '🔥', color: 'text-orange-400', glow: 'shadow-orange-500/50' },
  certified: { label: 'Certified', emoji: '✅', color: 'text-green-400', glow: 'shadow-green-500/50' },
  seasoned_veteran: { label: 'Seasoned Veteran', emoji: '👑', color: 'text-yellow-400', glow: 'shadow-yellow-500/50' },
}

const SURVEY_LABELS = ['Competitive', 'Athletic', 'Clutch', 'Trash Talk', 'Gaming', 'Strategic']

const INTRO_DURATION = 3000
const PLAYER_DURATION = 4000
const FINALE_DURATION = 3000

type Phase = 'tap-to-start' | 'intro' | 'player-reveal' | 'finale' | 'done'

function OpeningCeremony() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const reconnectStatus = useReconnect(false)

  const { tournament, currentPlayer } = useLobbyStore()
  const isHost = currentPlayer?.role === 'referee'

  const [phase, setPhase] = useState<Phase>('tap-to-start')
  const [playerIndex, setPlayerIndex] = useState(-1)
  const [players, setPlayers] = useState<PlayerWithProfile[]>([])
  const [loading, setLoading] = useState(true)

  // Load players with profiles
  useEffect(() => {
    if (!tournament?.id) return
    getPlayersWithProfiles(tournament.id)
      .then(p => {
        // Shuffle for dramatic effect
        const shuffled = [...p].sort(() => Math.random() - 0.5)
        setPlayers(shuffled)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load players:', err)
        setLoading(false)
      })
  }, [tournament?.id])

  // Listen for tournament status changes (to navigate when host sets drafting)
  useEffect(() => {
    if (tournament?.status === 'drafting' && roomCode) {
      navigate(`/draft/${roomCode}`)
    }
  }, [tournament?.status, roomCode, navigate])

  // Animation sequence
  useEffect(() => {
    if (phase !== 'intro' && phase !== 'player-reveal') return

    if (phase === 'intro') {
      const timer = setTimeout(() => {
        setPhase('player-reveal')
        setPlayerIndex(0)
      }, INTRO_DURATION)
      return () => clearTimeout(timer)
    }

    if (phase === 'player-reveal') {
      if (playerIndex >= players.length) {
        setPhase('finale')
        return
      }
      const timer = setTimeout(() => {
        setPlayerIndex(prev => prev + 1)
      }, PLAYER_DURATION)
      return () => clearTimeout(timer)
    }
  }, [phase, playerIndex, players.length])

  // Finale → host auto-transitions after 3s
  useEffect(() => {
    if (phase !== 'finale') return
    if (!isHost || !tournament?.id) return

    const timer = setTimeout(async () => {
      await supabase
        .from('tournaments')
        .update({ status: 'drafting' })
        .eq('id', tournament.id)
    }, FINALE_DURATION)
    return () => clearTimeout(timer)
  }, [phase, isHost, tournament?.id])

  // Check if finale playerIndex overflow triggers finale
  useEffect(() => {
    if (phase === 'player-reveal' && playerIndex >= players.length && players.length > 0) {
      setPhase('finale')
    }
  }, [phase, playerIndex, players.length])

  const startCeremony = () => {
    // TODO: Audio would start here
    setPhase('intro')
  }

  const currentPlayerData = useMemo(() => {
    if (phase !== 'player-reveal' || playerIndex < 0 || playerIndex >= players.length) return null
    return players[playerIndex]
  }, [phase, playerIndex, players])

  if (reconnectStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (reconnectStatus === 'expired') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-2xl font-bebas text-white">Session Expired</h1>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-yellow-400 text-black font-bold rounded-xl">Back to Home</button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        {/* TAP TO START */}
        {phase === 'tap-to-start' && (
          <motion.div
            key="tap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <motion.button
              onClick={startCeremony}
              className="px-10 py-6 rounded-2xl border-2 border-yellow-400/50 bg-yellow-400/10"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <span className="font-bebas text-3xl text-yellow-400 tracking-wider">
                TAP TO BEGIN CEREMONY
              </span>
            </motion.button>
            <p className="text-white/30 text-sm mt-4">{players.length} players ready</p>
          </motion.div>
        )}

        {/* INTRO SPLASH */}
        {phase === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center"
          >
            <motion.h1
              className="font-bebas text-6xl md:text-8xl text-yellow-400 tracking-widest"
              style={{ textShadow: '0 0 40px rgba(250, 204, 21, 0.6), 0 0 80px rgba(250, 204, 21, 0.3)' }}
              animate={{ textShadow: ['0 0 40px rgba(250, 204, 21, 0.6)', '0 0 80px rgba(250, 204, 21, 0.8)', '0 0 40px rgba(250, 204, 21, 0.6)'] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              UNCOLYMPICS
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-white/60 font-bebas text-2xl tracking-wider mt-4"
            >
              PLAYER INTRODUCTIONS
            </motion.p>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="w-32 h-1 bg-yellow-400 mx-auto mt-4 rounded-full"
            />
          </motion.div>
        )}

        {/* PLAYER REVEAL */}
        {phase === 'player-reveal' && currentPlayerData && (
          <motion.div
            key={`player-${playerIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center px-6 max-w-sm w-full"
          >
            {/* Avatar */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: 'spring', stiffness: 200, damping: 15 }}
              className="mx-auto mb-6"
            >
              <div
                className={`w-40 h-40 md:w-48 md:h-48 rounded-full mx-auto overflow-hidden border-4 border-white/80 ${
                  currentPlayerData.tier ? TIER_CONFIG[currentPlayerData.tier]?.glow || '' : ''
                }`}
                style={{
                  boxShadow: '0 0 30px rgba(255,255,255,0.3), 0 0 60px rgba(255,255,255,0.1)',
                }}
              >
                {currentPlayerData.avatar_url ? (
                  <img
                    src={currentPlayerData.avatar_url}
                    alt={currentPlayerData.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <span className="text-5xl font-bebas text-white/60">
                      {currentPlayerData.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Name */}
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="font-bebas text-5xl md:text-6xl text-white tracking-wider mb-3"
            >
              {currentPlayerData.name.toUpperCase()}
            </motion.h2>

            {/* Tier Badge */}
            {currentPlayerData.tier && TIER_CONFIG[currentPlayerData.tier] && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6, duration: 0.3, type: 'spring' }}
                className="mb-4"
              >
                <span className="text-3xl mr-2">
                  {TIER_CONFIG[currentPlayerData.tier].emoji}
                </span>
                <span className={`font-bebas text-2xl tracking-wider ${TIER_CONFIG[currentPlayerData.tier].color}`}>
                  {TIER_CONFIG[currentPlayerData.tier].label.toUpperCase()}
                </span>
              </motion.div>
            )}

            {/* Stat Line */}
            {currentPlayerData.survey_responses?.scores && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="text-white/40 text-sm font-mono"
              >
                {(currentPlayerData.survey_responses.scores as number[])
                  .slice(0, 3)
                  .map((score: number, i: number) => (
                    <span key={i}>
                      {i > 0 && <span className="mx-2">·</span>}
                      {SURVEY_LABELS[i]}: {score}
                    </span>
                  ))}
              </motion.div>
            )}

            {/* Player counter */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ delay: 1 }}
              className="mt-6 text-white/20 text-xs font-mono"
            >
              {playerIndex + 1} / {players.length}
            </motion.div>
          </motion.div>
        )}

        {/* FINALE */}
        {phase === 'finale' && (
          <motion.div
            key="finale"
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, type: 'spring', stiffness: 150, damping: 12 }}
            className="text-center"
          >
            <motion.h1
              className="font-bebas text-5xl md:text-7xl text-yellow-400 tracking-widest"
              style={{ textShadow: '0 0 40px rgba(250, 204, 21, 0.6), 0 0 80px rgba(250, 204, 21, 0.3)' }}
              animate={{ textShadow: ['0 0 40px rgba(250, 204, 21, 0.6)', '0 0 100px rgba(250, 204, 21, 0.9)', '0 0 40px rgba(250, 204, 21, 0.6)'] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              LET THE DRAFT BEGIN
            </motion.h1>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="w-48 h-1 bg-yellow-400 mx-auto mt-6 rounded-full"
            />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5, delay: 0.8 }}
              className="text-white/40 text-sm mt-6"
            >
              {isHost ? 'Starting draft...' : 'Waiting for host...'}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default OpeningCeremony
