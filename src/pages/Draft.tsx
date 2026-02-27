import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useLobbyStore from '../stores/lobbyStore'
import { selectCaptains, draftPlayer, getDraftState, finishDraft } from '../lib/api'
import { useReconnect } from '../hooks/useReconnect'

type DraftPhase = 'captain-select' | 'drafting' | 'complete'

function Draft() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const reconnectStatus = useReconnect(false)

  const { tournament, currentPlayer, players, teams } = useLobbyStore()
  const isHost = currentPlayer?.role === 'referee'

  const [phase, setPhase] = useState<DraftPhase>('captain-select')
  const [selectedCaptains, setSelectedCaptains] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justDrafted, setJustDrafted] = useState<string | null>(null)
  const [showTeams, setShowTeams] = useState<'A' | 'B' | null>(null)

  const teamA = teams[0]
  const teamB = teams[1]

  const activePlayers = useMemo(
    () => players.filter(p => p.role !== 'referee' && p.role !== 'spectator'),
    [players]
  )

  const captainA = useMemo(
    () => activePlayers.find(p => p.is_captain && p.team_id === teamA?.id),
    [activePlayers, teamA]
  )

  const captainB = useMemo(
    () => activePlayers.find(p => p.is_captain && p.team_id === teamB?.id),
    [activePlayers, teamB]
  )

  const available = useMemo(
    () => activePlayers.filter(p => !p.team_id && !p.is_captain),
    [activePlayers]
  )

  const teamAPlayers = useMemo(
    () => activePlayers.filter(p => p.team_id === teamA?.id),
    [activePlayers, teamA]
  )

  const teamBPlayers = useMemo(
    () => activePlayers.filter(p => p.team_id === teamB?.id),
    [activePlayers, teamB]
  )

  // Determine phase from data
  useEffect(() => {
    if (captainA && captainB) {
      if (available.length === 0 && activePlayers.length > 2) {
        setPhase('complete')
      } else {
        setPhase('drafting')
      }
    } else {
      setPhase('captain-select')
    }
  }, [captainA, captainB, available.length, activePlayers.length])

  // Current captain whose turn it is
  const currentTurnCaptain = useMemo(() => {
    if (!tournament?.draft_turn) return null
    return activePlayers.find(p => p.id === tournament.draft_turn) || null
  }, [tournament?.draft_turn, activePlayers])

  // Is current player the active captain?
  const isMyTurn = useMemo(() => {
    if (!currentPlayer || !tournament?.draft_turn) return false
    return currentPlayer.id === tournament.draft_turn
  }, [currentPlayer, tournament?.draft_turn])

  // Subscribe to realtime updates for draft
  useEffect(() => {
    if (!tournament?.id) return
    // Already handled by main tournament subscription in sync.ts
    // But we also want to refresh draft state periodically
    const refreshDraft = async () => {
      try {
        const state = await getDraftState(tournament.id)
        useLobbyStore.getState().setPlayers(state.players)
        useLobbyStore.getState().setTournament(state.tournament)
      } catch (err) {
        console.error('Failed to refresh draft state:', err)
      }
    }

    // Initial load
    refreshDraft()
  }, [tournament?.id])

  // Captain selection handlers
  const handleCaptainTap = (playerId: string) => {
    if (!isHost || phase !== 'captain-select') return

    setSelectedCaptains(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId)
      }
      if (prev.length >= 2) return prev
      return [...prev, playerId]
    })
  }

  const handleConfirmCaptains = async () => {
    if (!tournament?.id || selectedCaptains.length !== 2) return
    setSaving(true)
    setError(null)
    try {
      await selectCaptains(tournament.id, selectedCaptains[0], selectedCaptains[1])
    } catch (err: any) {
      setError(err.message || 'Failed to select captains')
    } finally {
      setSaving(false)
    }
  }

  // Draft handler
  const handleDraftPlayer = async (playerId: string) => {
    if (!tournament?.id || !isMyTurn || !currentTurnCaptain) return
    setSaving(true)
    setError(null)
    setJustDrafted(playerId)

    try {
      const team = currentTurnCaptain.team_id
      if (!team) throw new Error('Captain has no team')
      await draftPlayer(tournament.id, playerId, team)
    } catch (err: any) {
      setError(err.message || 'Failed to draft player')
      setJustDrafted(null)
    } finally {
      setSaving(false)
    }
  }

  // Auto-transition when draft is complete
  useEffect(() => {
    if (phase !== 'complete' || !isHost || !tournament?.id) return
    const timer = setTimeout(async () => {
      try {
        await finishDraft(tournament.id)
      } catch (err) {
        console.error('Failed to finish draft:', err)
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [phase, isHost, tournament?.id])

  // Navigate when status changes to playing
  useEffect(() => {
    if (tournament?.status === 'playing' && roomCode) {
      navigate(`/game-hub/${roomCode}`)
    }
  }, [tournament?.status, roomCode])

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
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-yellow-400 text-black font-bold rounded-xl">Back to Home</button>
      </div>
    )
  }

  // CAPTAIN SELECT PHASE
  if (phase === 'captain-select') {
    return (
      <div className="min-h-screen px-4 py-8 max-w-md mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bebas text-center text-yellow-400 mb-2 tracking-wider"
        >
          SELECT CAPTAINS
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center text-white/60 text-sm mb-8"
        >
          {isHost ? 'Tap 2 players to be team captains' : 'Waiting for host to select captains...'}
        </motion.p>

        <div className="space-y-3">
          {activePlayers.map((player, i) => {
            const captainIndex = selectedCaptains.indexOf(player.id)
            const isSelected = captainIndex !== -1

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => handleCaptainTap(player.id)}
                className={`relative p-4 rounded-2xl backdrop-blur-md border transition-all ${
                  isHost ? 'cursor-pointer active:scale-95' : 'cursor-default'
                } ${
                  isSelected
                    ? 'bg-yellow-400/20 border-yellow-400/50 shadow-lg shadow-yellow-400/10'
                    : 'bg-white/10 border-white/20 hover:bg-white/15'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isSelected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-2xl"
                    >
                      👑
                    </motion.span>
                  )}
                  <span className={`text-lg font-medium ${isSelected ? 'text-yellow-400' : 'text-white'}`}>
                    {player.name}
                  </span>
                  {isSelected && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="ml-auto text-sm font-bebas tracking-wider text-yellow-400/80"
                    >
                      {captainIndex === 0 ? 'CAPTAIN A' : 'CAPTAIN B'}
                    </motion.span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-center text-sm mt-4">
            {error}
          </motion.p>
        )}

        {isHost && selectedCaptains.length === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            <button
              onClick={handleConfirmCaptains}
              disabled={saving}
              className={`w-full py-4 rounded-2xl font-bebas text-2xl tracking-wider transition-all ${
                saving ? 'bg-white/10 text-white/30' : 'bg-yellow-400 text-black hover:bg-yellow-300 active:scale-95'
              }`}
            >
              {saving ? 'SETTING CAPTAINS...' : 'CONFIRM CAPTAINS →'}
            </button>
          </motion.div>
        )}

        <div className="mt-6 text-center">
          <span className="text-white/40 text-xs">Room: </span>
          <span className="text-yellow-400/60 text-xs font-mono">{roomCode}</span>
        </div>
      </div>
    )
  }

  // DRAFT COMPLETE PHASE
  if (phase === 'complete') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-center"
        >
          <h1 className="text-5xl font-bebas text-yellow-400 mb-4 tracking-wider">
            TEAMS ARE SET!
          </h1>
          <div className="flex gap-8 justify-center mb-8">
            <div className="text-center">
              <h2 className="text-xl font-bebas text-white/80 mb-2">{teamA?.name || 'TEAM A'}</h2>
              {teamAPlayers.map(p => (
                <div key={p.id} className={`text-sm ${p.is_captain ? 'text-yellow-400 font-bold' : 'text-white/70'}`}>
                  {p.is_captain ? `👑 ${p.name}` : p.name}
                </div>
              ))}
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bebas text-white/80 mb-2">{teamB?.name || 'TEAM B'}</h2>
              {teamBPlayers.map(p => (
                <div key={p.id} className={`text-sm ${p.is_captain ? 'text-yellow-400 font-bold' : 'text-white/70'}`}>
                  {p.is_captain ? `👑 ${p.name}` : p.name}
                </div>
              ))}
            </div>
          </div>
          <motion.p
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-white/50 text-sm"
          >
            Starting games...
          </motion.p>
        </motion.div>
      </div>
    )
  }

  // DRAFTING PHASE
  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto flex flex-col">
      {/* Turn Banner */}
      <motion.div
        key={tournament?.draft_turn}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <h1 className="text-3xl font-bebas text-yellow-400 tracking-wider mb-1">
          {currentTurnCaptain ? `${currentTurnCaptain.name.toUpperCase()}'S PICK` : 'DRAFT'}
        </h1>
        <p className="text-white/50 text-sm">
          {isMyTurn ? 'Tap a player to draft them!' : `Waiting for ${currentTurnCaptain?.name || 'captain'}...`}
        </p>
        <div className="flex justify-center gap-2 mt-2">
          <span className="text-xs text-white/40 font-mono">
            Pick #{tournament?.draft_pick_number || 1} · {available.length} remaining
          </span>
        </div>
      </motion.div>

      {/* Available Players */}
      <div className="mb-4">
        <h2 className="text-sm font-bebas text-white/40 tracking-wider mb-2 px-1">AVAILABLE PLAYERS</h2>
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {available.map((player) => (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5, y: -20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                onClick={() => handleDraftPlayer(player.id)}
                className={`p-4 rounded-2xl backdrop-blur-md border transition-all ${
                  isMyTurn && !saving
                    ? 'cursor-pointer bg-white/10 border-white/20 hover:bg-yellow-400/10 hover:border-yellow-400/30 active:scale-95'
                    : 'cursor-default bg-white/5 border-white/10'
                } ${justDrafted === player.id ? 'ring-2 ring-yellow-400' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 font-bebas">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-white text-lg font-medium">{player.name}</span>
                  {isMyTurn && !saving && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.5 }}
                      className="ml-auto text-yellow-400 text-sm"
                    >
                      TAP
                    </motion.span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {available.length === 0 && (
            <p className="text-white/30 text-center text-sm py-4">All players drafted!</p>
          )}
        </div>
      </div>

      {error && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-center text-sm mb-4">
          {error}
        </motion.p>
      )}

      {/* Team Tabs */}
      <div className="mt-auto">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setShowTeams(showTeams === 'A' ? null : 'A')}
            className={`flex-1 py-2 rounded-xl font-bebas tracking-wider text-sm transition-all ${
              showTeams === 'A' ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40' : 'bg-white/5 text-white/40 border border-white/10'
            }`}
          >
            {teamA?.name || 'TEAM A'} ({teamAPlayers.length})
          </button>
          <button
            onClick={() => setShowTeams(showTeams === 'B' ? null : 'B')}
            className={`flex-1 py-2 rounded-xl font-bebas tracking-wider text-sm transition-all ${
              showTeams === 'B' ? 'bg-red-500/30 text-red-300 border border-red-500/40' : 'bg-white/5 text-white/40 border border-white/10'
            }`}
          >
            {teamB?.name || 'TEAM B'} ({teamBPlayers.length})
          </button>
        </div>

        <AnimatePresence>
          {showTeams && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white/5 rounded-2xl border border-white/10 p-3 space-y-1">
                {(showTeams === 'A' ? teamAPlayers : teamBPlayers).map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    {p.is_captain && <span>👑</span>}
                    <span className={p.is_captain ? 'text-yellow-400 font-bold' : 'text-white/70'}>
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 text-center pb-4">
        <span className="text-white/40 text-xs">Room: </span>
        <span className="text-yellow-400/60 text-xs font-mono">{roomCode}</span>
      </div>
    </div>
  )
}

export default Draft
