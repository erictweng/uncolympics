import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import useLobbyStore from '../stores/lobbyStore'
import { joinTeam, startTournament, assignRandomLeaders, fetchLobbyState, setTournamentShuffling } from '../lib/api'
import { toast } from '../lib/toast'
import { useReconnect } from '../hooks/useReconnect'

type Phase = 'choosing' | 'locked' | 'shuffling' | 'revealed'

interface DustParticle {
  id: number
  x: number
  y: number
  size: number
}

const entranceDelay = 0.3

function TeamSelection() {
  useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('choosing')
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [isLockedIn, setIsLockedIn] = useState(false)
  const [shuffleNames, setShuffleNames] = useState<Record<string, string[]>>({})
  const [revealedLeaders, setRevealedLeaders] = useState<Record<string, string>>({})
  const [dustParticles, setDustParticles] = useState<Record<string, DustParticle[]>>({})
  const [justLocked, setJustLocked] = useState(false)

  const reconnectStatus = useReconnect(true)

  const {
    tournament,
    currentPlayer,
    players,
    teams,
    setPlayers,
    updatePlayer,
    connectionStatus,
  } = useLobbyStore()

  useEffect(() => {
    if (reconnectStatus !== 'ready' || !currentPlayer?.id) return
    const { players: storePlayers } = useLobbyStore.getState()
    const me = storePlayers.find(p => p.id === currentPlayer.id)
    if (me?.team_id) {
      setSelectedTeamId(me.team_id)
      setIsLockedIn(true)
      setPhase('locked')
    }
  }, [reconnectStatus, currentPlayer?.id])

  useEffect(() => {
    document.title = `UNCOLYMPICS - Choose Your UNC`
  }, [])

  const isReferee = currentPlayer?.role === 'referee'
  const activePlayers = useMemo(
    () => players.filter(p => p.role !== 'spectator'),
    [players]
  )
  const allLockedIn = useMemo(
    () => activePlayers.length > 0 && activePlayers.every(p => p.team_id !== null),
    [activePlayers]
  )

  const teamAPlayers = useMemo(
    () => teams[0] ? activePlayers.filter(p => p.team_id === teams[0].id) : [],
    [activePlayers, teams]
  )
  const teamBPlayers = useMemo(
    () => teams[1] ? activePlayers.filter(p => p.team_id === teams[1].id) : [],
    [activePlayers, teams]
  )

  const [lockInOrder, setLockInOrder] = useState<Record<string, number>>({})

  const getSortedTeamPlayers = (teamPlayers: any[]) => {
    return [...teamPlayers].sort((a, b) => {
      const aTime = lockInOrder[a.id] || 0
      const bTime = lockInOrder[b.id] || 0
      return aTime - bTime
    })
  }

  const spawnDust = useCallback((teamId: string) => {
    const count = 5 + Math.floor(Math.random() * 4) // 5-8 particles
    const particles: DustParticle[] = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 80 + 10, // 10-90% horizontal
      y: Math.random() * 60 + 20, // 20-80% vertical
      size: Math.random() * 4 + 2, // 2-6px
    }))
    setDustParticles(prev => ({ ...prev, [teamId]: particles }))
    setTimeout(() => {
      setDustParticles(prev => ({ ...prev, [teamId]: [] }))
    }, 600)
  }, [])

  const handlePanelTap = async (teamId: string) => {
    if (isLockedIn || phase !== 'choosing' || !currentPlayer) return

    if (selectedTeamId === teamId) {
      // Second tap — LOCK IN
      try {
        setIsLockedIn(true)
        setPhase('locked')
        setJustLocked(true)
        setTimeout(() => setJustLocked(false), 800)
        setLockInOrder(prev => ({ ...prev, [currentPlayer.id]: Date.now() }))
        updatePlayer({ ...currentPlayer, team_id: teamId })
        await joinTeam(currentPlayer.id, teamId)
      } catch {
        setSelectedTeamId(null)
        setIsLockedIn(false)
        setPhase('choosing')
        setJustLocked(false)
        updatePlayer({ ...currentPlayer, team_id: null })
        toast.error('Failed to lock in')
      }
    } else {
      // First tap or switching
      setSelectedTeamId(teamId)
      spawnDust(teamId)
    }
  }

  const handleReady = async () => {
    if (!tournament) return
    try {
      // Set shuffling status so all clients see the animation
      await setTournamentShuffling(tournament.id)
      // Assign leaders in DB (triggers realtime updates to all clients)
      await assignRandomLeaders(tournament.id)

      // Referee plays animation locally too (phase set via useEffect below for all clients)
      // After shuffle + reveal animation, start the tournament
      // Total time: 2.5s shuffle + 2.5s reveal
      // Start tournament after shuffle completes — reveal continues while picking status propagates
      setTimeout(async () => {
        try {
          await startTournament(tournament.id)
        } catch {
          toast.error('Failed to start tournament')
          setPhase('locked')
        }
      }, 5000)
    } catch {
      toast.error('Failed to assign leaders')
      setPhase('locked')
    }
  }

  // Detect shuffling status from realtime tournament updates (for all clients)
  useEffect(() => {
    if (tournament?.status === 'shuffling' && phase !== 'shuffling' && phase !== 'revealed') {
      setPhase('shuffling')

      // After 2.5s of shuffling, fetch latest state and reveal leaders
      const timer = setTimeout(async () => {
        try {
          const state = await fetchLobbyState(tournament.id)
          setPlayers(state.players)

          const leaders: Record<string, string> = {}
          for (const team of state.teams) {
            const leader = state.players.find((p: any) => p.team_id === team.id && p.is_leader)
            if (leader) leaders[team.id] = leader.id
          }
          setRevealedLeaders(leaders)
          setPhase('revealed')
        } catch {
          // If fetch fails, still try to reveal from current store state
          const leaders: Record<string, string> = {}
          for (const team of teams) {
            const leader = activePlayers.find(p => p.team_id === team.id && p.is_leader)
            if (leader) leaders[team.id] = leader.id
          }
          setRevealedLeaders(leaders)
          setPhase('revealed')
        }
      }, 2500)

      return () => clearTimeout(timer)
    }
  }, [tournament?.status])

  // Navigate when tournament moves to playing (after reveal animation)
  useEffect(() => {
    if ((tournament?.status === 'picking' || tournament?.status === 'playing') && tournament?.room_code) {
      // If we already saw the reveal, navigate after a short delay
      // If we missed the animation, navigate immediately
      if (phase === 'revealed') {
        const timer = setTimeout(() => {
          navigate(`/game-hub/${tournament.room_code}`)
        }, 500)
        return () => clearTimeout(timer)
      } else if (phase !== 'shuffling') {
        // Missed animation entirely, just navigate
        navigate(`/game-hub/${tournament.room_code}`)
      }
      // If still shuffling, the revealed phase will handle navigation
    }
  }, [tournament?.status, phase])

  // Shuffle animation
  useEffect(() => {
    if (phase !== 'shuffling') return
    const interval = setInterval(() => {
      const shuffled: Record<string, string[]> = {}
      for (const team of teams) {
        const teamPlayers = activePlayers.filter(p => p.team_id === team.id)
        const names = teamPlayers.map(p => p.name)
        for (let i = names.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [names[i], names[j]] = [names[j], names[i]]
        }
        shuffled[team.id] = names
      }
      setShuffleNames(shuffled)
    }, 100)
    return () => clearInterval(interval)
  }, [phase, teams, activePlayers])

  const renderTeamNames = (teamPlayers: { id: string; name: string; is_leader: boolean }[], teamId: string) => {
    if (phase === 'shuffling') {
      const names = shuffleNames[teamId] || teamPlayers.map(p => p.name)
      return names.map((name, i) => (
        <motion.div
          key={i}
          className="text-white text-lg font-body"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 0.1, repeat: Infinity }}
          style={{ filter: 'blur(1px)' }}
        >
          {name}
        </motion.div>
      ))
    }

    if (phase === 'revealed') {
      const leaderId = revealedLeaders[teamId]
      const sorted = [...teamPlayers].sort((a, b) => {
        if (a.id === leaderId) return -1
        if (b.id === leaderId) return 1
        return 0
      })
      return sorted.map(p => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`text-lg font-body ${p.id === leaderId ? 'text-yellow-300 font-bold' : 'text-white'}`}
        >
          {p.id === leaderId ? `⭐ ${p.name} ⭐` : p.name}
        </motion.div>
      ))
    }

    // Normal choosing/locked phase
    const sortedPlayers = getSortedTeamPlayers(teamPlayers)
    const otherPlayers = sortedPlayers.filter(p => p.id !== currentPlayer?.id)
    const myNameHere = selectedTeamId === teamId && !isLockedIn

    return (
      <>
        {/* Current player's name slides in via layoutId */}
        {myNameHere && (
          <motion.div
            layoutId="my-name"
            className="text-white text-xl font-heading font-semibold"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {currentPlayer?.name}
          </motion.div>
        )}

        {/* Locked-in current player */}
        {isLockedIn && currentPlayer?.team_id === teamId && (
          <motion.div
            layoutId="my-name"
            className="text-white text-xl font-heading font-semibold relative"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {currentPlayer.name}
            {/* Glow pulse on lock */}
            {justLocked && (
              <motion.div
                className="absolute inset-0 rounded-lg"
                initial={{ boxShadow: '0 0 0px rgba(255,255,255,0)' }}
                animate={{ boxShadow: ['0 0 20px rgba(255,255,255,0.6)', '0 0 0px rgba(255,255,255,0)'] }}
                transition={{ duration: 0.8 }}
              />
            )}
          </motion.div>
        )}

        {/* Other players — visible in real-time as they lock in */}
        <AnimatePresence>
          {otherPlayers.map((p, index) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: 'easeOut' }}
              className="text-white/80 text-lg font-body"
            >
              {p.name}
            </motion.div>
          ))}
        </AnimatePresence>
      </>
    )
  }

  if (reconnectStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-400">Loading...</div>
      </div>
    )
  }

  if (reconnectStatus === 'expired' || reconnectStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <div className="text-xl text-gray-400">Session expired</div>
        <button onClick={() => navigate('/')} className="text-blue-400 underline">Back to home</button>
      </div>
    )
  }

  if (!tournament || !currentPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-400">Loading...</div>
      </div>
    )
  }

  const statusMessage = () => {
    if (phase === 'choosing') {
      if (selectedTeamId) return 'Tap again to lock in'
      return 'Tap a team to join'
    }
    if (phase === 'locked') {
      if (isReferee && allLockedIn) return ''
      if (allLockedIn) return 'Waiting for referee...'
      return 'Waiting for other players'
    }
    if (phase === 'shuffling') return 'Selecting leaders...'
    if (phase === 'revealed') return 'Leaders selected! Starting game...'
    return ''
  }

  // Is the player's name currently above panels (not yet in any panel)?
  const nameAbovePanels = !selectedTeamId && !isLockedIn && phase === 'choosing'

  return (
    <LayoutGroup>
      <div className="min-h-screen flex flex-col relative px-6 pt-8">
        {/* Connection indicator */}
        <div className={`absolute top-4 right-4 w-3 h-3 rounded-full ${
          connectionStatus === 'connected' ? 'bg-green-400' :
          connectionStatus === 'reconnecting' ? 'bg-yellow-400' : 'bg-red-400'
        }`} />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, x: 120 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: entranceDelay, ease: 'easeOut' }}
          className="mb-4"
        >
          <h1 className="font-heading text-3xl text-white leading-tight">
            CHOOSE YOUR UNC
          </h1>
        </motion.div>

        {/* Player's own name — centered above panels, moves into panel on tap */}
        <div className="flex justify-center mb-6" style={{ minHeight: '2rem' }}>
          {nameAbovePanels && (
            <motion.div
              layoutId="my-name"
              className="text-white text-2xl font-heading"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30, delay: entranceDelay + 0.3 }}
            >
              {currentPlayer.name}
            </motion.div>
          )}
        </div>

        {/* Team panels */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: entranceDelay + 0.6 }}
          className="flex gap-3 flex-1 max-h-[30vh]"
        >
          {teams.slice(0, 2).map((team, idx) => {
            const isSelected = selectedTeamId === team.id
            const teamPlayers = idx === 0 ? teamAPlayers : teamBPlayers
            const isHighlighted = isSelected && !isLockedIn
            const particles = dustParticles[team.id] || []

            return (
              <motion.div
                key={team.id}
                onClick={() => handlePanelTap(team.id)}
                className="flex-1 rounded-2xl p-4 flex flex-col items-center cursor-pointer relative overflow-hidden"
                style={{
                  background: isHighlighted
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(12px)',
                  border: isHighlighted
                    ? '2px solid rgba(255,255,255,0.5)'
                    : isSelected && isLockedIn
                      ? '2px solid rgba(255,255,255,0.4)'
                      : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: isHighlighted
                    ? '0 0 25px rgba(255,255,255,0.2), inset 0 0 15px rgba(255,255,255,0.05)'
                    : 'none',
                }}
                animate={{ scale: isHighlighted ? 1.02 : 1 }}
                transition={{ duration: 0.2 }}
              >
                {/* Dust particles */}
                <AnimatePresence>
                  {particles.map(p => (
                    <motion.div
                      key={p.id}
                      className="absolute rounded-full bg-white pointer-events-none"
                      style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: p.size,
                        height: p.size,
                      }}
                      initial={{ opacity: 0.6, scale: 1 }}
                      animate={{ opacity: 0, scale: 0.5, y: -10 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  ))}
                </AnimatePresence>

                {/* Team name */}
                <div className="font-heading text-xl text-white mb-4">
                  {team.name.toUpperCase()}
                </div>

                {/* Player names */}
                <div className="flex flex-col items-center gap-2 flex-1">
                  {renderTeamNames(teamPlayers, team.id)}
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Status / Ready button */}
        <div className="py-8 text-center">
          {isReferee && allLockedIn && phase === 'locked' ? (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleReady}
              className="px-12 py-3 rounded-xl font-heading text-xl text-black bg-white"
            >
              READY
            </motion.button>
          ) : (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-gray-500 text-sm font-body"
            >
              {statusMessage()}
            </motion.p>
          )}
        </div>
      </div>
    </LayoutGroup>
  )
}

export default TeamSelection
