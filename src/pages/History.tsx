import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchTournamentHistory, fetchTournamentDetail } from '../lib/api'
import type { Tournament, Team, Player, GameWithType, TitleWithPlayer } from '../types'

interface TournamentHistoryEntry {
  tournament: Tournament
  teams: { name: string; total_points: number }[]
  winningTeam: { name: string; total_points: number } | null
  isTied: boolean
}

interface TournamentDetail {
  tournament: Tournament
  teams: Team[]
  players: Player[]
  games: GameWithType[]
  titles: TitleWithPlayer[]
  winningTeam: Team | null
  isTied: boolean
}

function History() {
  const [tournaments, setTournaments] = useState<TournamentHistoryEntry[]>([])
  const [selectedTournament, setSelectedTournament] = useState<TournamentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true)
        setError(null)
        const history = await fetchTournamentHistory()
        setTournaments(history)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history')
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [])

  const handleTournamentClick = async (tournament: Tournament) => {
    try {
      setDetailLoading(true)
      const detail = await fetchTournamentDetail(tournament.id)
      setSelectedTournament(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournament details')
    } finally {
      setDetailLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatScore = (teams: { name: string; total_points: number }[]) => {
    if (teams.length === 0) return 'No teams'
    if (teams.length === 1) return `${teams[0].name}: ${teams[0].total_points}`
    if (teams.length === 2) return `${teams[0].total_points} - ${teams[1].total_points}`
    return `${teams[0].name}: ${teams[0].total_points} (winner)`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading tournament history...</p>
        </div>
      </div>
    )
  }

  if (error && tournaments.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {selectedTournament ? (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Back button */}
              <button
                onClick={() => setSelectedTournament(null)}
                className="flex items-center text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                ← Back to History
              </button>

              {/* Tournament header */}
              <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold text-white">
                  {selectedTournament.tournament.name}
                </h1>
                <p className="text-gray-400">
                  {formatDate(selectedTournament.tournament.created_at)} • Room: {selectedTournament.tournament.room_code}
                </p>
                
                {/* Winner announcement */}
                <div className="text-xl font-semibold">
                  {selectedTournament.isTied ? (
                    <span className="text-yellow-400">🤝 Tie Game!</span>
                  ) : selectedTournament.winningTeam ? (
                    <span className="text-green-400">
                      🏆 Winner: {selectedTournament.winningTeam.name}
                    </span>
                  ) : (
                    <span className="text-gray-400">No winner determined</span>
                  )}
                </div>
              </div>

              {/* Final scores */}
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Final Scores</h2>
                <div className="space-y-3">
                  {selectedTournament.teams.map((team, index) => (
                    <div key={team.id} className="flex justify-between items-center">
                      <span className={`font-medium ${
                        index === 0 && selectedTournament.winningTeam?.id === team.id
                          ? 'text-green-400'
                          : 'text-white'
                      }`}>
                        {index + 1}. {team.name}
                      </span>
                      <span className={`text-lg font-bold ${
                        index === 0 && selectedTournament.winningTeam?.id === team.id
                          ? 'text-green-400'
                          : 'text-gray-300'
                      }`}>
                        {team.total_points} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Game results */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white">Game Results</h2>
                {selectedTournament.games.map((game, index) => (
                  <div key={game.id} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{game.gameType.emoji}</span>
                        <div>
                          <h3 className="font-semibold text-white">
                            Round {index + 1}: {game.gameType.name}
                          </h3>
                          {game.winnerName && (
                            <p className="text-sm text-green-400">Winner: {game.winnerName}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Titles for this game */}
                    {selectedTournament.titles.filter(t => t.game_id === game.id).length > 0 && (
                      <div className="mt-3 space-y-2">
                        <h4 className="text-sm font-medium text-gray-300">Titles Awarded:</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedTournament.titles
                            .filter(t => t.game_id === game.id)
                            .map(title => (
                              <span
                                key={title.id}
                                className={`px-2 py-1 rounded text-xs ${
                                  title.is_funny
                                    ? 'bg-pink-900/30 border border-pink-700 text-pink-300'
                                    : 'bg-blue-900/30 border border-blue-700 text-blue-300'
                                }`}
                              >
                                {title.playerName}: {title.title_name} (+{title.points}pts)
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Global titles */}
              {selectedTournament.titles.filter(t => !t.game_id).length > 0 && (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Tournament Awards</h2>
                  <div className="space-y-2">
                    {selectedTournament.titles
                      .filter(t => !t.game_id)
                      .map(title => (
                        <div key={title.id} className="flex justify-between items-center">
                          <span className="text-gray-300">
                            <span className="font-medium text-white">{title.playerName}</span>
                            <span className="mx-2">•</span>
                            {title.title_name}
                          </span>
                          <span className="text-cyan-400 font-semibold">+{title.points}pts</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Header */}
              <div className="text-center">
                <h1 className="text-4xl font-bold text-white mb-2">Tournament History</h1>
                <p className="text-gray-400">Past tournaments and results</p>
              </div>

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-700 rounded text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Tournament list */}
              {tournaments.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">🏆</div>
                  <h2 className="text-2xl font-semibold text-white mb-2">No Past Tournaments</h2>
                  <p className="text-gray-400 mb-6">
                    No tournaments have been completed yet. Create one to get started!
                  </p>
                  <a
                    href="/"
                    className="inline-block px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors"
                  >
                    Go Create Tournament
                  </a>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {tournaments.map((entry) => (
                    <motion.div
                      key={entry.tournament.id}
                      whileHover={{ scale: 1.02 }}
                      className="p-6 bg-gray-900 border border-gray-700 rounded-lg cursor-pointer transition-all hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-400/10"
                      onClick={() => handleTournamentClick(entry.tournament)}
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <h3 className="text-xl font-semibold text-white">
                            {entry.tournament.name}
                          </h3>
                          <span className="text-sm text-gray-500">
                            {entry.tournament.room_code}
                          </span>
                        </div>

                        <p className="text-sm text-gray-400">
                          {formatDate(entry.tournament.created_at)}
                        </p>

                        <div className="flex justify-between items-center">
                          <div className="text-sm text-gray-400">
                            {formatScore(entry.teams)}
                          </div>
                          <div className="font-medium">
                            {entry.isTied ? (
                              <span className="text-yellow-400">🤝 Tie</span>
                            ) : entry.winningTeam ? (
                              <span className="text-green-400">
                                🏆 {entry.winningTeam.name}
                              </span>
                            ) : (
                              <span className="text-gray-400">No winner</span>
                            )}
                          </div>
                        </div>

                        <div className="text-xs text-gray-500">
                          {entry.tournament.num_games} games • {entry.teams.length} teams
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {detailLoading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading tournament details...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default History