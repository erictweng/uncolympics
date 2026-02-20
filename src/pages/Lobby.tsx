import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../stores/gameStore'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { subscribeTournament } from '../lib/sync'
import { 
  fetchLobbyState, 
  createTeam, 
  updateTeamName, 
  joinTeam, 
  leaveTeam, 
  voteForLeader, 
  startTournament 
} from '../lib/api'
import type { Player } from '../types'

function Lobby() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingTeamName, setEditingTeamName] = useState('')

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
  } = useGameStore()

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
        
        // Create default teams if none exist
        if (state.teams.length === 0) {
          const teamA = await createTeam(tournament.id, 'Team A')
          const teamB = await createTeam(tournament.id, 'Team B')
          setTeams([teamA, teamB])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lobby')
      } finally {
        setIsLoading(false)
      }
    }

    loadLobbyState()
  }, [tournament?.id])

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
  
  // Update document title
  useEffect(() => {
    document.title = `UNCOLYMPICS - Lobby ${roomCode || ''}`;
  }, [roomCode]);

  // Team helper functions
  const getTeamPlayers = (teamId: string): Player[] => {
    return players.filter(p => p.team_id === teamId)
  }

  const getSpectators = (): Player[] => {
    return players.filter(p => !p.team_id && p.role === 'spectator')
  }

  const getVoteCounts = (teamId: string) => {
    const teamVotes = votes.filter(v => v.team_id === teamId)
    const counts: Record<string, number> = {}
    teamVotes.forEach(vote => {
      counts[vote.candidate_id] = (counts[vote.candidate_id] || 0) + 1
    })
    return counts
  }

  const getMyVote = (teamId: string): string | null => {
    const myVote = votes.find(v => v.team_id === teamId && v.voter_id === currentPlayer?.id)
    return myVote?.candidate_id || null
  }

  // Action handlers
  const handleJoinTeam = async (teamId: string) => {
    if (!currentPlayer) return
    try {
      await joinTeam(currentPlayer.id, teamId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join team')
    }
  }

  const handleLeaveTeam = async () => {
    if (!currentPlayer) return
    try {
      await leaveTeam(currentPlayer.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave team')
    }
  }

  const handleVoteForLeader = async (teamId: string, candidateId: string) => {
    if (!currentPlayer || currentPlayer.team_id !== teamId) return
    try {
      await voteForLeader(teamId, currentPlayer.id, candidateId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to vote for leader')
    }
  }

  const handleUpdateTeamName = async (teamId: string, newName: string) => {
    try {
      await updateTeamName(teamId, newName)
      setEditingTeamId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update team name')
    }
  }

  const handleStartTournament = async () => {
    if (!tournament) return
    try {
      await startTournament(tournament.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start tournament')
    }
  }

  const canStartTournament = (): { canStart: boolean; reason?: string } => {
    const teamsWithPlayers = teams.filter(team => getTeamPlayers(team.id).length > 0)
    
    if (teamsWithPlayers.length < 2) {
      return { canStart: false, reason: 'Need at least 2 teams with players' }
    }
    
    for (const team of teamsWithPlayers) {
      const teamPlayers = getTeamPlayers(team.id)
      const hasLeader = teamPlayers.some(p => p.is_leader)
      if (!hasLeader) {
        return { canStart: false, reason: `Team "${team.name}" needs a leader` }
      }
    }
    
    return { canStart: true }
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading lobby..." />;
  }

  if (!tournament || !currentPlayer) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl text-red-400">Failed to load tournament</div>
      </div>
    )
  }

  const isReferee = currentPlayer.role === 'referee'
  const { canStart, reason } = canStartTournament()

  return (
    <div className="min-h-screen bg-black text-white p-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-4xl font-bold text-center flex-1">{roomCode}</h1>
          <div className={`w-3 h-3 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-400' : 
            connectionStatus === 'reconnecting' ? 'bg-yellow-400' : 'bg-red-400'
          }`} title={connectionStatus || 'unknown'} />
        </div>
        <div className="text-center text-gray-300">
          <p className="text-xl mb-1">{tournament.name}</p>
          <p>{tournament.num_games} games • ~{tournament.time_est_min} min</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded p-3 mb-6 text-red-200">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Teams */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {teams.map((team, index) => {
          const teamPlayers = getTeamPlayers(team.id)
          const voteCounts = getVoteCounts(team.id)
          const myVote = getMyVote(team.id)
          const isMyTeam = currentPlayer.team_id === team.id
          const teamColor = index === 0 ? 'border-cyan-400' : 'border-pink-400'
          
          return (
            <div key={team.id} className={`border-2 ${teamColor} rounded-lg p-4`}>
              {/* Team Header */}
              <div className="flex items-center justify-between mb-4">
                {editingTeamId === team.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editingTeamName}
                      onChange={(e) => setEditingTeamName(e.target.value)}
                      className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateTeamName(team.id, editingTeamName)
                        } else if (e.key === 'Escape') {
                          setEditingTeamId(null)
                        }
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdateTeamName(team.id, editingTeamName)}
                      className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingTeamId(null)}
                      className="bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-xl font-bold">{team.name}</h3>
                    {isReferee && (
                      <button
                        onClick={() => {
                          setEditingTeamId(team.id)
                          setEditingTeamName(team.name)
                        }}
                        className="text-gray-400 hover:text-white text-sm"
                      >
                        Edit
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Players */}
              <div className="space-y-2 mb-4">
                <AnimatePresence>
                  {teamPlayers.map((player) => {
                    const voteCount = voteCounts[player.id] || 0
                    const isVotedBy = myVote === player.id
                    
                    return (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={`flex items-center justify-between p-2 rounded ${
                          isMyTeam && currentPlayer.id !== player.id 
                            ? 'cursor-pointer hover:bg-gray-800' 
                            : ''
                        } ${isVotedBy ? 'bg-blue-900/50' : ''}`}
                        onClick={() => {
                          if (isMyTeam && currentPlayer.id !== player.id) {
                            handleVoteForLeader(team.id, player.id)
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className={currentPlayer.id === player.id ? 'font-bold' : ''}>
                            {player.name}
                          </span>
                          {player.is_leader && <span className="text-yellow-400">👑</span>}
                          {player.role === 'referee' && (
                            <span className="text-xs bg-purple-600 px-1 rounded">REF</span>
                          )}
                        </div>
                        {voteCount > 0 && (
                          <span className="text-sm text-gray-400">
                            {voteCount} vote{voteCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>

              {/* Join Team Button */}
              {!isMyTeam && currentPlayer.role !== 'referee' && (
                <button
                  onClick={() => handleJoinTeam(team.id)}
                  className={`w-full py-2 rounded border-2 border-dashed ${teamColor} hover:bg-gray-800 transition-colors`}
                >
                  Join Team
                </button>
              )}

              {isMyTeam && currentPlayer.role !== 'referee' && (
                <button
                  onClick={handleLeaveTeam}
                  className="w-full py-2 rounded bg-red-600 hover:bg-red-700 transition-colors"
                >
                  Leave Team
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Spectators */}
      {getSpectators().length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold mb-3">Spectators</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {getSpectators().map((player) => (
              <div key={player.id} className="p-2 bg-gray-800 rounded text-center">
                {player.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start Tournament Button */}
      <div className="text-center">
        {isReferee ? (
          <button
            onClick={handleStartTournament}
            disabled={!canStart}
            className={`px-8 py-3 rounded-lg font-bold text-lg transition-colors ${
              canStart
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-600 cursor-not-allowed text-gray-400'
            }`}
          >
            {canStart ? 'Start Tournament' : `Can't Start: ${reason}`}
          </button>
        ) : (
          <div className="text-gray-400 text-lg">
            Waiting for referee to start tournament...
          </div>
        )}
      </div>
    </div>
  )
}

export default Lobby