import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import useLobbyStore from '../stores/lobbyStore'
import { subscribeTournament } from '../lib/sync'
import { fetchLobbyState, joinTeam, startTournament, assignRandomLeaders } from '../lib/api'
import { toast } from '../lib/toast'

type Phase = 'choosing' | 'locked' | 'shuffling' | 'revealed'

function TeamSelection() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('choosing')
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [isLockedIn, setIsLockedIn] = useState(false)
  const [shuffleNames, setShuffleNames] = useState<Record<string, string[]>>({})
  const [revealedLeaders, setRevealedLeaders] = useState<Record<string, string>>({}) // teamId -> playerId

  const {
    tournament,
    currentPlayer,
    players,
    teams,
    setTournament,
    setPlayers,
    setTeams,
    setVotes,
    updatePlayer,
    connectionStatus,
  } = useLobbyStore()

  // Load state on mount
  useEffect(() => {
    if (!tournament?.id) return
    const load = async () => {
      try {
        const state = await fetchLobbyState(tournament.id)
        setTournament(state.tournament)
        setPlayers(state.players)
        setTeams(state.teams)
        setVotes(state.votes)

        // Check if current player already has a team (reconnect case)
        const me = state.players.find(p => p.id === currentPlayer?.id)
        if (me?.team_id) {
          setSelectedTeamId(me.team_id)
          setIsLockedIn(true)
          setPhase('locked')
        }
      } catch (err) {
        toast.error('Failed to load team selection')
      }
    }
    load()
  }, [tournament?.id])

  // Real-time sync
  useEffect(() => {
    if (!tournament?.id) return
    return subscribeTournament(tournament.id)
  }, [tournament?.id])

  // Navigate when tournament goes to 'picking'
  useEffect(() => {
    if (tournament?.status === 'picking' && roomCode) {
      navigate(`/game/${roomCode}/pick`)
    }
  }, [tournament?.status, roomCode])

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

  const handlePanelTap = async (teamId: string) => {
    if (isLockedIn || phase !== 'choosing' || !currentPlayer) return

    if (selectedTeamId === teamId) {
      // Second tap — lock in
      try {
        await joinTeam(currentPlayer.id, teamId)
        setIsLockedIn(true)
        setPhase('locked')
        // Update local player state
        updatePlayer({ ...currentPlayer, team_id: teamId })
      } catch (err) {
        toast.error('Failed to lock in')
      }
    } else {
      // First tap — select
      setSelectedTeamId(teamId)
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
          const leader = state.players.find(p => p.team_id === team.id && p.is_leader)
          if (leader) leaders[team.id] = leader.id
        }
        setRevealedLeaders(leaders)
        setPhase('revealed')

        // After showing result, start tournament
        setTimeout(async () => {
          try {
            await startTournament(tournament.id)
          } catch (err) {
            toast.error('Failed to start tournament')
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

    // Normal locked-in display
    return teamPlayers.map(p => (
      <motion.div
        key={p.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-white text-lg font-body"
      >
        {p.name}
      </motion.div>
    ))
  }

  if (!tournament || !currentPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-300">Failed to load team selection</div>
      </div>
    )
  }

  const statusMessage = () => {
    if (phase === 'choosing') {
      if (!selectedTeamId) return 'Tap a panel to join'
      return 'Tap again to confirm'
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

      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="mb-6"
      >
        <h1 className="font-heading text-3xl text-white leading-tight">
          CHOOSE YOUR UNC
        </h1>
      </motion.div>

      {/* Player name above panels (only when not locked in) */}
      {phase === 'choosing' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-center mb-6"
        >
          <span className="text-white text-2xl font-heading">
            {currentPlayer.name}
          </span>
        </motion.div>
      )}

      {/* Team panels */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="flex gap-3 flex-1 max-h-[60vh]"
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
                border: isSelected && !isLockedIn
                  ? '1px solid rgba(255,255,255,0.4)'
                  : '1px solid rgba(255,255,255,0.1)',
                boxShadow: isSelected && !isLockedIn
                  ? '0 0 20px rgba(255,255,255,0.15)'
                  : 'none',
              }}
              animate={{
                scale: isSelected && !isLockedIn ? 1.02 : 1,
              }}
              transition={{ duration: 0.2 }}
            >
              {/* Team name */}
              <div className="font-heading text-xl text-white mb-4">
                {team.name.toUpperCase()}
              </div>

              {/* Lock in prompt */}
              {isSelected && !isLockedIn && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-white/70 text-sm font-body mb-4"
                >
                  Lock in?
                </motion.div>
              )}

              {/* Player names in this team */}
              <div className="flex flex-col items-center gap-2 flex-1">
                {renderTeamNames(teamPlayers, team.id)}
              </div>

              {/* Dust particles when selected */}
              {isSelected && !isLockedIn && (
                <>
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1 h-1 rounded-full bg-white/30"
                      initial={{
                        x: '50%',
                        y: '50%',
                        opacity: 0.6,
                      }}
                      animate={{
                        x: `${20 + Math.random() * 60}%`,
                        y: `${20 + Math.random() * 60}%`,
                        opacity: 0,
                      }}
                      transition={{
                        duration: 1.5 + Math.random(),
                        repeat: Infinity,
                        delay: Math.random() * 0.5,
                      }}
                    />
                  ))}
                </>
              )}
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
