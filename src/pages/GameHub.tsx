import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useLobbyStore from '../stores/lobbyStore'
import { getGamesV2, startGameV2, endGameV2 } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useReconnect } from '../hooks/useReconnect'
import type { GameV2 } from '../types'

function GameHub() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const reconnectStatus = useReconnect(false)
  
  const { tournament, currentPlayer } = useLobbyStore()
  const isHost = currentPlayer?.role === 'referee'
  
  const [games, setGames] = useState<GameV2[]>([])
  const [loading, setLoading] = useState(true)
  const [endGameModal, setEndGameModal] = useState<GameV2 | null>(null)
  const [selectedWinner, setSelectedWinner] = useState<'A' | 'B' | null>(null)
  const [pointsA, setPointsA] = useState(1)
  const [pointsB, setPointsB] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Load games
  useEffect(() => {
    if (!tournament?.id) return
    getGamesV2(tournament.id).then(g => {
      setGames(g)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [tournament?.id])

  // Subscribe to games_v2 realtime
  useEffect(() => {
    if (!tournament?.id) return
    const channel = supabase.channel(`gamehub:${tournament.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games_v2',
        filter: `tournament_id=eq.${tournament.id}`
      }, () => {
        getGamesV2(tournament.id).then(setGames).catch(console.error)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournament?.id])

  // Check if all games completed → navigate to ceremony
  useEffect(() => {
    if (games.length === 5 && games.every(g => g.status === 'completed')) {
      // Update tournament to completed
      if (tournament?.id) {
        supabase.from('tournaments').update({ status: 'completed' }).eq('id', tournament.id).then(() => {
          setTimeout(() => navigate(`/ceremony/${roomCode}`), 1500)
        })
      }
    }
  }, [games, tournament?.id, roomCode, navigate])

  const totalA = games.reduce((sum, g) => sum + (g.points_a || 0), 0)
  const totalB = games.reduce((sum, g) => sum + (g.points_b || 0), 0)
  const winsA = games.filter(g => g.winner_team === 'A').length
  const winsB = games.filter(g => g.winner_team === 'B').length

  const nextUpcoming = games.find(g => g.status === 'upcoming')
  const activeGame = games.find(g => g.status === 'active')

  const handleStartGame = async (game: GameV2) => {
    if (!tournament?.id) return
    try {
      await startGameV2(game.id, game.index, tournament.id)
    } catch (err: any) {
      console.error('Failed to start game:', err)
    }
  }

  const handleEndGame = async () => {
    if (!endGameModal || !selectedWinner) return
    setSubmitting(true)
    try {
      const pA = selectedWinner === 'A' ? pointsA : pointsB
      const pB = selectedWinner === 'B' ? pointsA : pointsB
      await endGameV2(endGameModal.id, selectedWinner, pA, pB)
      setEndGameModal(null)
      setSelectedWinner(null)
      setPointsA(1)
      setPointsB(0)
    } catch (err: any) {
      console.error('Failed to end game:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const openEndModal = (game: GameV2) => {
    setEndGameModal(game)
    setSelectedWinner(null)
    setPointsA(1)
    setPointsB(0)
  }

  if (reconnectStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (reconnectStatus === 'expired') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-2xl font-heading text-white">Session Expired</h1>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-yellow-400 text-black font-bold rounded-xl">
          Back to Home
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto">
      {/* Header */}
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-heading text-center text-yellow-400 mb-4 tracking-wider"
      >
        GAME HUB
      </motion.h1>

      {/* Scoreboard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-5 mb-6"
      >
        <div className="flex items-center justify-between">
          {/* Team A */}
          <div className="text-center flex-1">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Team A</div>
            <div className="text-4xl font-heading text-blue-400">{winsA}</div>
            <div className="text-xs text-white/40">{totalA} pts</div>
          </div>

          {/* Divider */}
          <div className="text-white/20 text-2xl font-heading px-4">VS</div>

          {/* Team B */}
          <div className="text-center flex-1">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Team B</div>
            <div className="text-4xl font-heading text-red-400">{winsB}</div>
            <div className="text-xs text-white/40">{totalB} pts</div>
          </div>
        </div>
      </motion.div>

      {/* Game Cards */}
      <div className="space-y-3">
        {games.map((game, i) => {
          const isActive = game.status === 'active'
          const isCompleted = game.status === 'completed'
          const isUpcoming = game.status === 'upcoming'
          const isNext = isUpcoming && game.id === nextUpcoming?.id

          return (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`relative rounded-2xl p-4 transition-all ${
                isActive
                  ? 'bg-yellow-400/15 border-2 border-yellow-400/60 shadow-lg shadow-yellow-400/10'
                  : isCompleted
                    ? 'bg-white/5 border border-white/10'
                    : 'bg-white/5 border border-white/10 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Game Number */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-heading text-lg shrink-0 ${
                  isActive ? 'bg-yellow-400 text-black' :
                  isCompleted ? 'bg-green-500/20 text-green-400' :
                  'bg-white/10 text-white/40'
                }`}>
                  {isCompleted ? '✓' : game.index}
                </div>

                {/* Game Info */}
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-lg truncate ${isActive ? 'text-yellow-400' : isCompleted ? 'text-white/80' : 'text-white/50'}`}>
                    {game.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      game.type === 'physical'
                        ? 'bg-green-500/15 text-green-400'
                        : 'bg-purple-500/15 text-purple-400'
                    }`}>
                      {game.type === 'physical' ? '🏃 IRL' : '🎮 Video'}
                    </span>
                    {isActive && (
                      <motion.span
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="text-xs text-yellow-400 font-bold"
                      >
                        IN PROGRESS
                      </motion.span>
                    )}
                    {isCompleted && game.winner_team && (
                      <span className={`text-xs font-bold ${game.winner_team === 'A' ? 'text-blue-400' : 'text-red-400'}`}>
                        Team {game.winner_team} won • {game.points_a}-{game.points_b}
                      </span>
                    )}
                  </div>
                </div>

                {/* Host Actions */}
                {isHost && isNext && !activeGame && (
                  <button
                    onClick={() => handleStartGame(game)}
                    className="px-4 py-2 bg-yellow-400 text-black font-bold text-sm rounded-xl hover:bg-yellow-300 active:scale-95 transition-all shrink-0"
                  >
                    START
                  </button>
                )}
                {isHost && isActive && (
                  <button
                    onClick={() => openEndModal(game)}
                    className="px-4 py-2 bg-red-500 text-white font-bold text-sm rounded-xl hover:bg-red-400 active:scale-95 transition-all shrink-0"
                  >
                    END
                  </button>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* All Complete Banner */}
      {games.length === 5 && games.every(g => g.status === 'completed') && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 bg-yellow-400/20 border border-yellow-400/40 rounded-2xl p-6 text-center"
        >
          <div className="text-3xl mb-2">🏆</div>
          <div className="font-heading text-2xl text-yellow-400">ALL GAMES COMPLETE!</div>
          <div className="text-white/60 text-sm mt-1">Heading to final results...</div>
        </motion.div>
      )}

      {/* Room Code */}
      <div className="mt-6 text-center">
        <span className="text-white/40 text-xs">Room: </span>
        <span className="text-yellow-400/60 text-xs font-mono">{roomCode}</span>
      </div>

      {/* End Game Modal */}
      <AnimatePresence>
        {endGameModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setEndGameModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 border border-white/20 rounded-2xl p-6 w-full max-w-sm"
            >
              <h2 className="font-heading text-2xl text-yellow-400 text-center mb-1">END GAME</h2>
              <p className="text-white/60 text-sm text-center mb-6">{endGameModal.name}</p>

              {/* Winner Selection */}
              <div className="text-white/50 text-xs uppercase tracking-wider mb-2 text-center">Who won?</div>
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => { setSelectedWinner('A'); setPointsA(1); setPointsB(0) }}
                  className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                    selectedWinner === 'A'
                      ? 'bg-blue-500 text-white border-2 border-blue-400'
                      : 'bg-white/10 text-white/50 border border-white/20'
                  }`}
                >
                  Team A
                </button>
                <button
                  onClick={() => { setSelectedWinner('B'); setPointsA(0); setPointsB(1) }}
                  className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                    selectedWinner === 'B'
                      ? 'bg-red-500 text-white border-2 border-red-400'
                      : 'bg-white/10 text-white/50 border border-white/20'
                  }`}
                >
                  Team B
                </button>
              </div>

              {/* Points (optional) */}
              {selectedWinner && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-2 text-center">Points (optional)</div>
                  <div className="flex gap-3 mb-6">
                    <div className="flex-1">
                      <label className="text-xs text-blue-400 block mb-1 text-center">Team A</label>
                      <input
                        type="number"
                        min={0}
                        value={pointsA}
                        onChange={e => setPointsA(parseInt(e.target.value) || 0)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl py-2 px-3 text-white text-center text-lg"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-red-400 block mb-1 text-center">Team B</label>
                      <input
                        type="number"
                        min={0}
                        value={pointsB}
                        onChange={e => setPointsB(parseInt(e.target.value) || 0)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl py-2 px-3 text-white text-center text-lg"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Confirm / Cancel */}
              <div className="flex gap-3">
                <button
                  onClick={() => setEndGameModal(null)}
                  className="flex-1 py-3 bg-white/10 text-white/60 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndGame}
                  disabled={!selectedWinner || submitting}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    selectedWinner && !submitting
                      ? 'bg-yellow-400 text-black hover:bg-yellow-300'
                      : 'bg-white/10 text-white/30 cursor-not-allowed'
                  }`}
                >
                  {submitting ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default GameHub
