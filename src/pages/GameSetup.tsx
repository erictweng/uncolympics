import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useLobbyStore from '../stores/lobbyStore'
import { createGamesV2, getGamesV2, deleteGamesV2 } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useReconnect } from '../hooks/useReconnect'
import type { GameV2 } from '../types'

interface GameSlot {
  name: string
  type: 'physical' | 'video'
}

const EMPTY_SLOTS: GameSlot[] = Array.from({ length: 5 }, () => ({ name: '', type: 'physical' }))

function GameSetup() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const reconnectStatus = useReconnect(false)
  
  const { tournament, currentPlayer } = useLobbyStore()
  const isHost = currentPlayer?.role === 'referee'
  
  const [slots, setSlots] = useState<GameSlot[]>([...EMPTY_SLOTS])
  const [, setSavedGames] = useState<GameV2[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing games
  useEffect(() => {
    if (!tournament?.id) return
    getGamesV2(tournament.id).then(games => {
      setSavedGames(games)
      if (games.length > 0) {
        const newSlots = [...EMPTY_SLOTS]
        games.forEach(g => {
          if (g.index >= 1 && g.index <= 5) {
            newSlots[g.index - 1] = { name: g.name, type: g.type }
          }
        })
        setSlots(newSlots)
      }
    }).catch(console.error)
  }, [tournament?.id])

  // Subscribe to games_v2 changes for real-time updates (non-host)
  useEffect(() => {
    if (!tournament?.id) return
    
    const channel = supabase.channel(`games_v2:${tournament.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games_v2',
        filter: `tournament_id=eq.${tournament.id}`
      }, () => {
        // Re-fetch all games on any change
        getGamesV2(tournament.id).then(games => {
          setSavedGames(games)
          if (!isHost) {
            const newSlots = [...EMPTY_SLOTS]
            games.forEach(g => {
              if (g.index >= 1 && g.index <= 5) {
                newSlots[g.index - 1] = { name: g.name, type: g.type }
              }
            })
            setSlots(newSlots)
          }
        }).catch(console.error)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tournament?.id, isHost])

  const updateSlot = useCallback((index: number, field: keyof GameSlot, value: string) => {
    setSlots(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }, [])

  const handleSaveAndStart = async () => {
    if (!tournament?.id) return
    
    const allFilled = slots.every(s => s.name.trim().length > 0)
    if (!allFilled) {
      setError('Name all 5 games before starting!')
      return
    }

    setSaving(true)
    setError(null)
    
    try {
      // Delete existing games and recreate
      await deleteGamesV2(tournament.id)
      await createGamesV2(tournament.id, slots.map(s => ({ name: s.name.trim(), type: s.type })))
      
      // Advance tournament to drafting
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({ status: 'drafting' })
        .eq('id', tournament.id)
      
      if (updateError) throw new Error(updateError.message)
    } catch (err: any) {
      setError(err.message || 'Failed to save games')
    } finally {
      setSaving(false)
    }
  }

  // Auto-save individual game names as host types (debounced via realtime)
  const handleSaveGames = async () => {
    if (!tournament?.id || !isHost) return
    const filled = slots.filter(s => s.name.trim().length > 0)
    if (filled.length === 0) return
    
    try {
      await deleteGamesV2(tournament.id)
      if (filled.length > 0) {
        const gamesToCreate = slots
          .map((s, i) => ({ name: s.name.trim() || `Game ${i + 1}`, type: s.type, index: i }))
          .filter(s => slots[s.index].name.trim().length > 0)
        
        if (gamesToCreate.length > 0) {
          await createGamesV2(tournament.id, gamesToCreate.map(g => ({ name: g.name, type: g.type })))
        }
      }
    } catch (err) {
      console.error('Auto-save failed:', err)
    }
  }

  if (reconnectStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (reconnectStatus === 'expired') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-2xl font-bebas text-white">Session Expired</h1>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-yellow-400 text-black font-bold rounded-xl">
          Back to Home
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-md mx-auto">
      {/* Header */}
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-bebas text-center text-yellow-400 mb-2 tracking-wider"
      >
        SET UP THE GAMES
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center text-white/60 text-sm mb-8"
      >
        {isHost ? 'Name your 5 games below' : 'Waiting for host to set up games...'}
      </motion.p>

      {/* Game Slots */}
      <div className="space-y-3">
        <AnimatePresence>
          {slots.map((slot, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="relative bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4"
            >
              <div className="flex items-center gap-3">
                {/* Number */}
                <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center text-yellow-400 font-bebas text-lg shrink-0">
                  {i + 1}
                </div>

                {/* Game Name Input */}
                {isHost ? (
                  <input
                    type="text"
                    value={slot.name}
                    onChange={e => updateSlot(i, 'name', e.target.value)}
                    onBlur={handleSaveGames}
                    placeholder={`Game ${i + 1} name...`}
                    maxLength={40}
                    className="flex-1 bg-transparent text-white placeholder-white/30 outline-none text-lg font-medium"
                  />
                ) : (
                  <span className={`flex-1 text-lg font-medium ${slot.name ? 'text-white' : 'text-white/30'}`}>
                    {slot.name || 'Waiting...'}
                  </span>
                )}

                {/* Type Toggle */}
                {isHost ? (
                  <button
                    onClick={() => updateSlot(i, 'type', slot.type === 'physical' ? 'video' : 'physical')}
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                      slot.type === 'physical'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    }`}
                  >
                    {slot.type === 'physical' ? '🏃 IRL' : '🎮 VID'}
                  </button>
                ) : (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    slot.type === 'physical'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  }`}>
                    {slot.type === 'physical' ? '🏃 IRL' : '🎮 VID'}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Error */}
      {error && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-center text-sm mt-4">
          {error}
        </motion.p>
      )}

      {/* Start Button (host only) */}
      {isHost && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8"
        >
          <button
            onClick={handleSaveAndStart}
            disabled={saving || slots.some(s => !s.name.trim())}
            className={`w-full py-4 rounded-2xl font-bebas text-2xl tracking-wider transition-all ${
              saving || slots.some(s => !s.name.trim())
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-yellow-400 text-black hover:bg-yellow-300 active:scale-95'
            }`}
          >
            {saving ? 'SAVING...' : 'START TOURNAMENT →'}
          </button>
        </motion.div>
      )}

      {/* Room Code */}
      <div className="mt-6 text-center">
        <span className="text-white/40 text-xs">Room: </span>
        <span className="text-yellow-400/60 text-xs font-mono">{roomCode}</span>
      </div>
    </div>
  )
}

export default GameSetup
