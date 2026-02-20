import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../stores/gameStore'
import { fetchCeremonyData, saveGlobalTitles, updateTeamPoints, validateRoomCode } from '../lib/api'
import { calculateGlobalTitles } from '../lib/globalTitles'
import Confetti from '../components/animation/Confetti'

function Ceremony() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()

  const { 
    currentPlayer, 
    tournament, 
    setTournament,
    globalTitles,
    winningTeam,
    isTied,
    ceremonyPhase,
    ceremonyRevealIndex,
    setGlobalTitles,
    setWinningTeam,
    setIsTied,
    setCeremonyPhase,
    nextCeremonyReveal,
    reset
  } = useGameStore()

  const [ceremonyData, setCeremonyData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoAdvancing, setAutoAdvancing] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)

  // Initialize ceremony
  useEffect(() => {
    if (!roomCode) return

    const init = async () => {
      try {
        // Get roomCode from params, get tournament from store
        let tournamentId = tournament?.id
        if (!tournamentId) {
          const validation = await validateRoomCode(roomCode)
          if (!validation.valid || !validation.tournament) {
            setError('Tournament not found')
            return
          }
          tournamentId = validation.tournament.id
          setTournament(validation.tournament)
        }

        // Call fetchCeremonyData(tournamentId)
        const data = await fetchCeremonyData(tournamentId)
        setCeremonyData(data)

        // If no global titles exist AND currentPlayer.role === 'referee':
        if (data.globalTitles.length === 0 && currentPlayer?.role === 'referee') {
          // Calculate global titles: calculateGlobalTitles(tournamentId)
          const globalResults = await calculateGlobalTitles(tournamentId)
          
          // Save: saveGlobalTitles(tournamentId, titles)
          if (globalResults.length > 0) {
            await saveGlobalTitles(tournamentId, globalResults)
            await updateTeamPoints(tournamentId)
            
            // Refetch data with global titles included
            const updatedData = await fetchCeremonyData(tournamentId)
            setCeremonyData(updatedData)
            setGlobalTitles(updatedData.globalTitles)
          }
        } else {
          // If global titles exist: populate store, start ceremony
          setGlobalTitles(data.globalTitles)
        }

        // Set winning team data
        setWinningTeam(data.winningTeam)
        setIsTied(data.isTied)

        // Start ceremony phase
        if (data.globalTitles.length > 0) {
          setCeremonyPhase('global_titles')
        } else {
          setCeremonyPhase('winner')
        }
      } catch (err: any) {
        console.error('Ceremony init error:', err)
        setError(err.message || 'Failed to load ceremony')
      }
    }

    init()
  }, [roomCode, tournament, currentPlayer])

  // Auto-advance global titles (5-6 seconds per title vs 4 in TitleReveal)
  useEffect(() => {
    if (ceremonyPhase !== 'global_titles' || !autoAdvancing) return
    if (ceremonyRevealIndex >= globalTitles.length) return

    const timer = setTimeout(() => {
      nextCeremonyReveal()
    }, 6000) // 6 seconds per title

    return () => clearTimeout(timer)
  }, [ceremonyPhase, ceremonyRevealIndex, autoAdvancing, globalTitles.length])

  // When all global titles revealed, move to winner
  useEffect(() => {
    if (ceremonyPhase !== 'global_titles') return
    if (ceremonyRevealIndex >= globalTitles.length) {
      const timer = setTimeout(() => {
        setCeremonyPhase('winner')
        setShowConfetti(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [ceremonyRevealIndex, globalTitles.length, ceremonyPhase])

  // Tap to advance or auto-advance after 6 seconds
  const handleTap = () => {
    if (ceremonyPhase === 'global_titles') {
      setAutoAdvancing(false)
      if (ceremonyRevealIndex < globalTitles.length) {
        nextCeremonyReveal()
      }
    }
  }

  // LOADING: "Preparing ceremony..." (referee calculating)
  if (ceremonyPhase === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white flex items-center justify-center">
        <div className="text-center">
          <motion.div
            className="text-7xl mb-6"
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🏆
          </motion.div>
          <h1 className="text-3xl font-black mb-2 text-yellow-400">Preparing ceremony...</h1>
          <p className="text-gray-400">Referee calculating global awards</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p className="text-gray-300 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!ceremonyData) return null

  const currentGlobalTitle = globalTitles[ceremonyRevealIndex]

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white relative overflow-hidden" 
      onClick={handleTap}
    >
      {/* Confetti effect */}
      <Confetti show={showConfetti} />

      <AnimatePresence mode="wait">
        {/* GLOBAL_TITLES: revealing global titles one-by-one (slower, grander) */}
        {ceremonyPhase === 'global_titles' && (
          <motion.div
            key="global-titles"
            className="min-h-screen flex flex-col items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* "Global Award 1/5" counter */}
            <motion.div
              className="absolute top-4 left-4 right-4 flex justify-between items-center"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-lg font-bold text-yellow-400">🏆 Tournament Awards</h2>
              <span className="bg-black/30 border border-yellow-500/30 px-3 py-1 rounded-lg text-sm text-yellow-300">
                Global Award {Math.min(ceremonyRevealIndex + 1, globalTitles.length)}/{globalTitles.length}
              </span>
            </motion.div>

            {ceremonyRevealIndex < globalTitles.length && currentGlobalTitle ? (
              <GlobalTitleCard title={currentGlobalTitle} index={ceremonyRevealIndex} />
            ) : (
              <motion.div className="text-center" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <div className="text-6xl mb-4">✨</div>
                <h2 className="text-3xl font-bold text-yellow-400">All Awards Revealed!</h2>
                <p className="text-gray-300 mt-2">Now for the moment you've been waiting for...</p>
              </motion.div>
            )}

            {/* Tap to advance or auto-advance after 6 seconds */}
            <motion.p
              className="absolute bottom-6 text-gray-400 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
            >
              Tap to advance or auto-advance after 6 seconds
            </motion.p>
          </motion.div>
        )}

        {/* WINNER: dramatic team winner reveal + confetti */}
        {ceremonyPhase === 'winner' && (
          <motion.div
            key="winner"
            className="min-h-screen flex flex-col items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Dramatic pause: screen goes dark for 1 second */}
            <motion.div
              className="absolute inset-0 bg-black z-10"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ delay: 1, duration: 0.5 }}
            />

            {/* "AND THE WINNER IS..." text fades in slowly */}
            <motion.h2
              className="text-2xl font-bold text-gray-300 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 1 }}
            >
              AND THE WINNER IS...
            </motion.h2>

            {/* 2 second pause, then team name EXPLODES */}
            {isTied ? (
              <motion.div className="text-center">
                <motion.div
                  className="text-8xl mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.5, 1] }}
                  transition={{ delay: 3.5, duration: 1, type: 'spring', stiffness: 400, damping: 15 }}
                >
                  🤝
                </motion.div>
                <motion.h1
                  className="text-5xl md:text-7xl font-black mb-4 text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.6)]"
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.5, 1] }}
                  transition={{ delay: 3.5, duration: 1, type: 'spring', stiffness: 400, damping: 15 }}
                >
                  IT'S A TIE!
                </motion.h1>
                <motion.div
                  className="flex gap-8 mt-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 4.5 }}
                >
                  {ceremonyData.teams.map((team: any) => (
                    <div key={team.id} className="text-center">
                      <div className="text-2xl font-bold">{team.name}</div>
                      <div className="text-4xl text-yellow-400 font-black">{team.total_points.toFixed(1)} pts</div>
                    </div>
                  ))}
                </motion.div>
              </motion.div>
            ) : winningTeam ? (
              <motion.div className="text-center">
                <motion.div
                  className="text-8xl mb-6"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: [0, 1.5, 1], rotate: 0 }}
                  transition={{ delay: 3.5, duration: 1, type: 'spring', stiffness: 400, damping: 15 }}
                >
                  🏆
                </motion.div>
                <motion.h1
                  className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(250,204,21,0.6)]"
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.5, 1] }}
                  transition={{ delay: 3.5, duration: 1, type: 'spring', stiffness: 400, damping: 15 }}
                >
                  {winningTeam.name} WINS!
                </motion.h1>
                {/* Final score displayed large below team name */}
                <motion.div
                  className="text-6xl font-black text-yellow-400 mb-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 4.5 }}
                >
                  {winningTeam.total_points.toFixed(1)} pts
                </motion.div>
              </motion.div>
            ) : null}

            {/* (tap to continue) */}
            <motion.button
              className="mt-12 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 px-8 py-4 rounded-lg font-bold text-xl text-black shadow-lg"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 5.5 }}
              onClick={(e) => { e.stopPropagation(); setCeremonyPhase('summary'); }}
            >
              View Tournament Summary →
            </motion.button>
          </motion.div>
        )}

        {/* SUMMARY: tournament summary card + navigation buttons */}
        {ceremonyPhase === 'summary' && (
          <motion.div
            key="summary"
            className="min-h-screen p-4 pt-8 pb-24"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Clean, bordered card (screenshot-friendly) */}
            <div className="max-w-lg mx-auto bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-yellow-500/30 shadow-2xl overflow-hidden">
              {/* Tournament name + date */}
              <div className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 p-6 text-center border-b border-yellow-500/20">
                <div className="text-4xl mb-2">🏆</div>
                <h1 className="text-2xl font-black text-yellow-400">{ceremonyData.tournament.name}</h1>
                <p className="text-gray-400 text-sm mt-1">
                  {new Date(ceremonyData.tournament.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* "🏆 Winner: [Team Name] — [score] pts" (or "🤝 Tie: [score] - [score]") */}
              <div className="p-6 text-center border-b border-gray-700">
                {isTied ? (
                  <div>
                    <div className="text-xl font-bold text-yellow-400">🤝 TIE GAME</div>
                    <div className="text-lg text-gray-300 mt-1">
                      {ceremonyData.teams.map((t: any) => t.total_points.toFixed(1)).join(' - ')} pts
                    </div>
                  </div>
                ) : winningTeam ? (
                  <>
                    <div className="text-sm text-gray-400 uppercase tracking-wider">Champion</div>
                    <div className="text-3xl font-black text-yellow-400 mt-1">🏆 Winner: {winningTeam.name}</div>
                    <div className="text-lg text-gray-300">{winningTeam.total_points.toFixed(1)} pts</div>
                  </>
                ) : null}
              </div>

              {/* All global titles listed: "MVP: [player]", "Title Hoarder: [player]", etc. */}
              {globalTitles.length > 0 && (
                <div className="p-4 border-b border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Tournament Awards</h3>
                  <div className="space-y-2">
                    {globalTitles.map((title, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className={title.is_funny ? 'text-pink-400' : 'text-yellow-400'}>
                          {title.title_name}: {title.playerName}
                        </span>
                        <span className={title.is_funny ? 'text-pink-300' : 'text-yellow-300'}>
                          {title.is_funny ? '😂' : '🏆'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Game results: 1. 🍺 Beer Pong → Team A, 2. 🏎️ Mario Kart → Team B, etc. */}
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Game Results</h3>
                <div className="space-y-1">
                  {ceremonyData.games.map((game: any, i: number) => (
                    <div key={game.id} className="text-sm flex items-center justify-between">
                      <span>{i + 1}. {game.gameType.emoji} {game.gameType.name}</span>
                      <span className="text-cyan-400">{game.winnerName || 'No Winner'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total titles per team */}
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Final Standings</h3>
                <div className="space-y-2">
                  {ceremonyData.teams.map((team: any, i: number) => (
                    <div key={team.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                        <span className="font-bold">{team.name}</span>
                      </div>
                      <span className="font-black text-yellow-400">{team.total_points.toFixed(1)} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="max-w-lg mx-auto mt-6 space-y-3">
              <button
                onClick={() => { reset(); navigate('/'); }}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 px-6 py-4 rounded-lg font-bold text-lg"
              >
                🎮 New Tournament
              </button>
              <button
                onClick={() => navigate('/history')}
                className="w-full bg-white/10 hover:bg-white/20 px-6 py-4 rounded-lg font-bold text-lg"
              >
                📜 View History
              </button>
              <button
                onClick={() => navigate(`/scoreboard/${roomCode}`)}
                className="w-full bg-white/10 hover:bg-white/20 px-6 py-4 rounded-lg font-bold text-lg"
              >
                📊 Full Scoreboard
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Global Title Reveal (phase: global_titles) — Same structure as TitleReveal but GRANDER
function GlobalTitleCard({ title, index }: { title: any; index: number }) {
  return (
    <motion.div
      key={`global-${index}`}
      className="text-center max-w-2xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Larger text sizes */}
      <motion.div
        className="text-8xl mb-8"
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: [0, 1.3, 1], rotate: 0 }}
        // Spring animation with higher stiffness: { type: "spring", stiffness: 400, damping: 15 }
        transition={{ duration: 1, type: 'spring', stiffness: 400, damping: 15 }}
      >
        {/* Achievement: gold glow, Funny (Comic Relief): pink glow */}
        <span className={title.is_funny ? 'drop-shadow-[0_0_30px_rgba(244,114,182,0.7)]' : 'drop-shadow-[0_0_30px_rgba(250,204,21,0.7)]'}>
          {title.is_funny ? '😂' : '🏆'}
        </span>
      </motion.div>

      {/* Title Name - larger */}
      <motion.h1
        className={`text-6xl md:text-8xl font-black mb-6 ${
          title.is_funny
            ? 'text-pink-400 drop-shadow-[0_0_40px_rgba(244,114,182,0.8)]'
            : 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(250,204,21,0.8)]'
        }`}
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.15, 1] }}
        transition={{ duration: 1, delay: 0.3, type: 'spring', stiffness: 400, damping: 15 }}
      >
        {title.title_name}
      </motion.h1>

      {/* Player Name - larger */}
      <motion.div
        className="text-4xl md:text-5xl font-bold mb-8 text-white"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.8 }}
      >
        {title.playerName}
      </motion.div>

      {/* Description - larger */}
      <motion.p
        className="text-xl md:text-3xl text-gray-300 mb-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.7 }}
      >
        {title.title_desc}
      </motion.p>

      {/* Points Badge - larger */}
      <motion.div
        className={`inline-block px-10 py-5 rounded-full text-3xl font-black ${
          title.is_funny
            ? 'bg-pink-600/30 border-2 border-pink-400 text-pink-200'
            : 'bg-yellow-600/30 border-2 border-yellow-400 text-yellow-200'
        }`}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.6, duration: 0.6 }}
      >
        +{title.points} points
      </motion.div>
    </motion.div>
  )
}

export default Ceremony