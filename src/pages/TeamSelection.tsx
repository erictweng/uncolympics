import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useLobbyStore from '../stores/lobbyStore'
import { joinTeam, startTournament, assignRandomLeaders, fetchLobbyState } from '../lib/api'
import { toast } from '../lib/toast'
import { useReconnect } from '../hooks/useReconnect'

type Phase = 'choosing' | 'locked' | 'shuffling' | 'revealed'

const entranceDelay = 0.3 // base delay after page load

function TeamSelection() {
  useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('choosing')
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [isLockedIn, setIsLockedIn] = useState(false)
  const [shuffleNames, setShuffleNames] = useState<Record<string, string[]>>({})
  const [revealedLeaders, setRevealedLeaders] = useState<Record<string, string>>({}) // teamId -> playerId

  // Single reconnect hook — handles fetch, realtime, and redirect
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

  // After reconnect, check if current player already picked a team
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

  // Track lock-in timestamps for ordering
  const [lockInOrder, setLockInOrder] = useState<Record<string, number>>({})

  // Get players sorted by lock-in order for each team
  const getSortedTeamPlayers = (teamPlayers: any[]) => {
    return teamPlayers.sort((a, b) => {
      const aTime = lockInOrder[a.id] || 0
      const bTime = lockInOrder[b.id] || 0
      return aTime - bTime // Earlier timestamps first
    })
  }

  const handlePanelTap = async (teamId: string) => {
    if (isLockedIn || phase !== 'choosing' || !currentPlayer) return

    // Single tap — immediately lock in
    try {
      setSelectedTeamId(teamId)
      setIsLockedIn(true)
      setPhase('locked')
      setLockInOrder(prev => ({
        ...prev,
        [currentPlayer.id]: Date.now()
      }))
      updatePlayer({ ...currentPlayer, team_id: teamId })
      await joinTeam(currentPlayer.id, teamId)
    } catch (err) {
      // Revert on failure
      setSelectedTeamId(null)
      setIsLockedIn(false)
      setPhase('choosing')
      updatePlayer({ ...currentPlayer, team_id: null })
      toast.error('Failed to lock in')
    }
  }

  const handleReady = async () => {
    if (!tournament) return
    try {
      // Assign random leaders
      await assignRandomLeaders(tournament.id)
      
      // Start shuffle animation
      setPhase('shuffling')

      // Animate for 2.5s then reveal
      setTimeout(async () => {
        // Refetch players to get leader assignments
        const state = await fetchLobbyState(tournament.id)
        setPlayers(state.players)

        // Build revealed leaders map
        const leaders: Record<string, string> = {}
        for (const team of state.teams) {
          const leader = state.players.find((p: any) => p.team_id === team.id && p.is_leader)
          if (leader) leaders[team.id] = leader.id
        }
        setRevealedLeaders(leaders)
        setPhase('revealed')

        // After showing result, start tournament
        setTimeout(async () => {
          try {
            await startTournament(tournament.id)
            // Safety: navigate directly in case realtime is slow
            navigate(`/game/${tournament.room_code}/pick`)
          } catch (err) {
            console.error('startTournament failed:', err)
            toast.error('Failed to start tournament')
            setPhase('locked')
          }
        }, 2500)
      }, 2500)
    } catch (err) {
      toast.error('Failed to assign leaders')
      setPhase('locked')
    }
  }

  // Shuffle animation effect
  useEffect(() => {
    if (phase !== 'shuffling') return
    const interval = setInterval(() => {
      // Randomly reorder names for visual shuffle
      const shuffled: Record<string, string[]> = {}
      for (const team of teams) {
        const teamPlayers = activePlayers.filter(p => p.team_id === team.id)
        const names = teamPlayers.map(p => p.name)
        // Fisher-Yates shuffle
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
      // Sort leader to top
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

    // Show players who have locked in, sorted by lock-in order
    const sortedPlayers = getSortedTeamPlayers(teamPlayers)
    const otherPlayers = sortedPlayers.filter(p => p.id !== currentPlayer?.id)
    
    return (
      <>
        {/* Current player's name (if locked in this team) */}
        {currentPlayer?.team_id === teamId && isLockedIn && (
          <motion.div
            layoutId="current-player-name"
            className="text-white text-lg font-body font-semibold"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {currentPlayer.name}
          </motion.div>
        )}
        
        {/* Other locked-in players — fade+slide from bottom, invisible until they lock in */}
        <AnimatePresence>
          {isLockedIn && otherPlayers.map((p, index) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.5, 
                delay: index * 0.1,
                ease: 'easeOut'
              }}
              className="text-white text-lg font-body"
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
      return 'Tap a team to lock in'
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

  return (
    <div className="min-h-screen flex flex-col relative px-6 pt-8">
      {/* Connection indicator */}
      <div className={`absolute top-4 right-4 w-3 h-3 rounded-full ${
        connectionStatus === 'connected' ? 'bg-green-400' :
        connectionStatus === 'reconnecting' ? 'bg-yellow-400' : 'bg-red-400'
      }`} />

      {/* Header — slides in from right */}
      <motion.div
        initial={{ opacity: 0, x: 120 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: entranceDelay, ease: 'easeOut' }}
        className="mb-6"
      >
        <h1 className="font-heading text-3xl text-white leading-tight">
          CHOOSE YOUR UNC
        </h1>
      </motion.div>

      {/* Player name — slides in from bottom */}
      {phase === 'choosing' && !isLockedIn && (
        <motion.div className="text-center mb-6">
          <motion.div
            layoutId="current-player-name"
            className="text-white text-2xl font-heading"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: entranceDelay + 0.3, ease: 'easeOut' }}
          >
            {currentPlayer.name}
          </motion.div>
        </motion.div>
      )}

      {/* Team panels — fade in after header + name */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: entranceDelay + 0.6 }}
        className="flex gap-3 flex-1 max-h-[30vh]"
      >
        {teams.slice(0, 2).map((team, idx) => {
          const isSelected = selectedTeamId === team.id
          const teamPlayers = idx === 0 ? teamAPlayers : teamBPlayers

          return (
            <motion.div
              key={team.id}
              onClick={() => handlePanelTap(team.id)}
              className="flex-1 rounded-2xl p-4 flex flex-col items-center cursor-pointer relative overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(12px)',
                border: isSelected && isLockedIn
                  ? '2px solid rgba(255,255,255,0.4)'
                  : '1px solid rgba(255,255,255,0.1)',
              }}
              animate={{
                scale: 1,
              }}
              transition={{ duration: 0.2 }}
            >
              {/* Team name */}
              <div className="font-heading text-xl text-white mb-4">
                {team.name.toUpperCase()}
              </div>

              {/* Player names in this team */}
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
  )
}

export default TeamSelection
