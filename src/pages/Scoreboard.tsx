import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useLobbyStore from '../stores/lobbyStore'
import useScoreboardStore from '../stores/scoreboardStore'
import { fetchScoreboard, fetchPlayerDetail, validateRoomCode } from '../lib/api'
import { useReconnect } from '../hooks/useReconnect'

function Scoreboard() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  
  // Reconnect on refresh
  useReconnect(true)

  const { tournament, setTournament } = useLobbyStore()
  const {
    scoreboardData,
    selectedPlayer,
    setScoreboardData,
    setSelectedPlayer,
    clearSelectedPlayer
  } = useScoreboardStore()

  // Load scoreboard data on mount
  useEffect(() => {
    if (!roomCode) return

    const loadScoreboard = async () => {
      try {
        let tournamentId = tournament?.id

        // If no tournament in store, fetch by room code
        if (!tournamentId) {
          const validation = await validateRoomCode(roomCode)
          if (!validation.valid || !validation.tournament) {
            throw new Error('Tournament not found')
          }
          setTournament(validation.tournament)
          tournamentId = validation.tournament.id
        }

        // Fetch scoreboard data
        const data = await fetchScoreboard(tournamentId)
        setScoreboardData(data)
      } catch (error) {
        console.error('Failed to load scoreboard:', error)
        // Navigate back if tournament not found
        navigate(-1)
      }
    }

    loadScoreboard()
  }, [roomCode, tournament?.id, setTournament, setScoreboardData, navigate])

  // Handle player click
  const handlePlayerClick = async (playerId: string) => {
    if (!scoreboardData) return

    try {
      const detail = await fetchPlayerDetail(playerId, scoreboardData.tournament.id)
      setSelectedPlayer(detail)
    } catch (error) {
      console.error('Failed to load player detail:', error)
    }
  }

  // Update document title
  useEffect(() => {
    document.title = 'UNCOLYMPICS - Scoreboard';
  }, []);
  
  if (!scoreboardData) {
    return <div className="min-h-screen" />;
  }

  const { teams, games, titleLeaderboard, players } = scoreboardData

  // Calculate team score percentages
  const maxScore = Math.max(...teams.map(team => team.total_points), 1)
  const teamPercentages = teams.map(team => ({
    ...team,
    percentage: maxScore > 0 ? (team.total_points / maxScore) * 100 : 0
  }))

  // Get leading team for glow effect
  const leadingTeam = teams[0]

  return (
    <div className="min-h-screen px-6 pt-8 space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-5xl text-white leading-tight">
          SCOREBOARD
        </h1>
      </div>

      {/* Team Score Section */}
      <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h2 className="font-heading text-2xl text-white mb-6">Team Standings</h2>
        <div className="space-y-6">
          {teamPercentages.map((team, index) => (
            <motion.div
              key={team.id}
              className="space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex justify-between items-center">
                <span className="font-body font-medium text-white text-lg">
                  {team.name}
                </span>
                <span className="font-heading text-3xl text-white">
                  {team.total_points}
                </span>
              </div>
              <div className="bg-white/5 rounded-full h-6 overflow-hidden backdrop-blur-sm">
                <motion.div
                  className="h-full bg-white/20 backdrop-blur-sm"
                  initial={{ width: 0 }}
                  animate={{ width: `${team.percentage}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: index * 0.2 }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Title Leaderboard */}
      <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h2 className="font-heading text-2xl text-white mb-6">Title Leaderboard</h2>
        {titleLeaderboard.length > 0 ? (
          <motion.div 
            className="space-y-3"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.1 }
              }
            }}
            initial="hidden"
            animate="visible"
          >
            {titleLeaderboard.map((entry, index) => (
              <motion.div
                key={entry.playerId}
                className="flex items-center gap-4 p-4 bg-white/5 backdrop-blur-sm border border-white/5 rounded-xl"
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 }
                }}
              >
                <span className="text-2xl">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-body font-medium text-white">{entry.playerName}</span>
                    <div className="w-3 h-3 rounded-full bg-white/30"></div>
                  </div>
                  <span className="font-body text-sm text-gray-400">{entry.teamName}</span>
                </div>
                <span className="font-heading text-xl text-white">
                  {entry.titleCount}
                </span>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <p className="text-gray-400 text-center py-4 font-body">No titles yet</p>
        )}
      </section>

      {/* Game History */}
      <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h2 className="font-heading text-2xl text-white mb-6">Game History</h2>
        {games.length > 0 ? (
          <motion.div 
            className="space-y-3"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.05 }
              }
            }}
            initial="hidden"
            animate="visible"
          >
            {games.map((game) => {
              // Get key titles for this game (up to 2)
              const gameTitles = scoreboardData.titles
                .filter(title => title.game_id === game.id)
                .slice(0, 2)
                .map(title => title.title_name)

              return (
                <motion.div
                  key={game.id}
                  className="flex items-center gap-4 p-4 bg-white/5 backdrop-blur-sm border border-white/5 rounded-xl"
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0 }
                  }}
                >
                  <span className="text-gray-400 font-mono text-sm font-body">
                    {game.game_order}.
                  </span>
                  <span className="text-2xl">{game.gameType.emoji}</span>
                  <div className="flex-1">
                    <div className="font-body font-medium text-white">
                      {game.gameType.name}
                    </div>
                    {game.winnerName && (
                      <div className="font-body text-sm text-white">
                        → {game.winnerName}
                      </div>
                    )}
                    {gameTitles.length > 0 && (
                      <div className="font-body text-xs text-gray-400">
                        Key titles: {gameTitles.join(', ')}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        ) : (
          <p className="text-gray-400 text-center py-4 font-body">No games completed yet</p>
        )}
      </section>

      {/* Player Chips */}
      <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-8">
        <h2 className="font-heading text-2xl text-white mb-6">Player Details</h2>
        <div className="flex flex-wrap gap-3">
          {players.filter(p => p.team_id).map((player) => {
            const team = teams.find(t => t.id === player.team_id)
            return (
              <motion.button
                key={player.id}
                onClick={() => handlePlayerClick(player.id)}
                className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full 
                          font-body text-sm font-medium text-white transition-all
                          hover:bg-white/20 hover:border-white/30 transform hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {player.name}
              </motion.button>
            )
          })}
        </div>
      </section>

      {/* Player Detail Modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={clearSelectedPlayer}
          >
            <motion.div
              className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-heading text-3xl text-white">
                    {selectedPlayer.player.name}
                  </h3>
                  <p className="font-body text-gray-400">
                    {teams.find(t => t.id === selectedPlayer.player.team_id)?.name || 'No Team'}
                  </p>
                </div>
                <button
                  onClick={clearSelectedPlayer}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Points Contributed */}
              <div className="mb-6 p-4 bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl">
                <h4 className="font-heading text-xl text-white mb-2">Total Points Contributed</h4>
                <p className="font-heading text-4xl text-white">
                  {selectedPlayer.pointsContributed}
                </p>
              </div>

              {/* Titles */}
              {selectedPlayer.titles.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-heading text-xl text-white mb-3">Titles Earned</h4>
                  <div className="space-y-2">
                    {selectedPlayer.titles.map((title) => (
                      <div key={title.id} className="p-3 bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-body font-medium text-white">{title.title_name}</h5>
                            <p className="font-body text-sm text-gray-400">{title.title_desc}</p>
                          </div>
                          <span className="font-heading text-white text-lg">+{title.points}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-Game Stats */}
              {selectedPlayer.statsByGame.length > 0 && (
                <div>
                  <h4 className="font-heading text-xl text-white mb-3">Game Performance</h4>
                  <div className="space-y-4">
                    {selectedPlayer.statsByGame.map(({ game, stats }) => (
                      <div key={game.id} className="p-4 bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">{game.gameType.emoji}</span>
                          <div>
                            <h5 className="font-body font-medium text-white">{game.gameType.name}</h5>
                            {game.winnerName && (
                              <p className="font-body text-sm text-white">Winner: {game.winnerName}</p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {stats.map((stat) => (
                            <div key={`${stat.stat_key}-${stat.id}`} className="font-body text-sm">
                              <span className="text-gray-400 capitalize">
                                {stat.stat_key.replace('_', ' ')}:
                              </span>
                              <span className="ml-2 text-white font-medium">
                                {stat.stat_value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Scoreboard