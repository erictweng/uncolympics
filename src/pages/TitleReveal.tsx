import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useLobbyStore from '../stores/lobbyStore'
import useTitleStore from '../stores/titleStore'
import { fetchTitlesForGame, saveTitles, updateTeamPoints, advanceToNextRound } from '../lib/api'
import { calculateTitles } from '../lib/titles'
import { subscribeGame, subscribeTournament } from '../lib/sync'
import { useReconnect } from '../hooks/useReconnect'

function TitleReveal() {
  const { roomCode, gameId } = useParams<{ roomCode: string; gameId: string }>()
  
  // Reconnect on refresh
  useReconnect(true)

  const { tournament, currentPlayer, teams } = useLobbyStore()
  const {
    gameTitles,
    revealIndex,
    revealComplete,
    isLastGame,
    setGameTitles,
    nextReveal,
    setIsLastGame
  } = useTitleStore()
  
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [autoAdvancing, setAutoAdvancing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Auto-advance timer
  useEffect(() => {
    if (!revealComplete && gameTitles.length > 0 && autoAdvancing) {
      const timer = setTimeout(() => {
        nextReveal()
      }, 4000)
      
      return () => clearTimeout(timer)
    }
  }, [revealIndex, revealComplete, gameTitles.length, autoAdvancing, nextReveal])
  
  // Initialize component
  useEffect(() => {
    if (!gameId || !roomCode || !tournament || !currentPlayer) return
    
    let gameCleanup: (() => void) | undefined
    let tournamentCleanup: (() => void) | undefined
    
    const initialize = async () => {
      try {
        setError(null)
        
        // Set up subscriptions
        gameCleanup = subscribeGame(gameId, tournament.id)
        tournamentCleanup = subscribeTournament(tournament.id)
        
        // Fetch existing titles
        const existingTitles = await fetchTitlesForGame(gameId)
        
        if (existingTitles.length > 0) {
          // Titles exist, go to reveal mode
          setGameTitles(existingTitles)
          setLoading(false)
        } else {
          // No titles exist
          if (currentPlayer.role === 'referee') {
            // Referee calculates titles
            setCalculating(true)
            
            try {
              const titleResults = await calculateTitles(gameId)
              
              if (titleResults.length === 0) {
                // No titles earned
                setGameTitles([])
                setLoading(false)
                setCalculating(false)
              } else {
                // Save titles and update team points
                await saveTitles(tournament.id, gameId, titleResults)
                await updateTeamPoints(tournament.id)
                
                // Titles will appear via realtime subscription
                setCalculating(false)
              }
            } catch (err) {
              console.error('Error calculating titles:', err)
              setError('Failed to calculate titles')
              setCalculating(false)
              setLoading(false)
            }
          } else {
            // Non-referee waits for realtime
            setLoading(false)
          }
        }
      } catch (err) {
        console.error('Error initializing title reveal:', err)
        setError('Failed to load title data')
        setLoading(false)
      }
    }
    
    initialize()
    
    return () => {
      gameCleanup?.()
      tournamentCleanup?.()
    }
  }, [gameId, roomCode, tournament, currentPlayer, setGameTitles])
  
  // Handle manual tap to advance
  const handleTapToAdvance = () => {
    if (!revealComplete && gameTitles.length > 0) {
      setAutoAdvancing(false) // Stop auto-advance once user interacts
      nextReveal()
    }
  }
  
  // Handle advance to next round
  const handleAdvanceToNextRound = async () => {
    if (!tournament || !gameId) return
    
    try {
      const result = await advanceToNextRound(tournament.id, gameId)
      setIsLastGame(result.isLastGame)
      
      // Navigation will be handled by realtime subscription
    } catch (err) {
      console.error('Error advancing to next round:', err)
      setError('Failed to advance to next round')
    }
  }
  
  // Calculate running team scores up to current reveal index
  const calculateRunningScores = () => {
    if (!teams.length || !gameTitles.length) return []
    
    const teamScores = new Map<string, number>()
    teams.forEach(team => {
      teamScores.set(team.id, team.total_points || 0)
    })
    
    // Add points from revealed titles
    // const revealedTitles = gameTitles.slice(0, revealIndex + (revealComplete ? 0 : 1))
    // TODO: Re-implement proper team score calculation with correct player data lookup
    
    return teams.map(team => ({
      ...team,
      currentScore: teamScores.get(team.id) || 0
    }))
  }
  
  const teamScores = calculateRunningScores()
  const currentTitle = gameTitles[revealIndex]
  
  // Update document title
  useEffect(() => {
    document.title = 'UNCOLYMPICS - Title Reveal';
  }, []);
  
  // Loading state
  if (loading || calculating) {
    return <div className="min-h-screen" />;
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 to-purple-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p className="text-gray-300 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }
  
  // No titles case
  if (gameTitles.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🤷‍♂️</div>
          <h1 className="text-3xl font-bold mb-2">No Titles Earned</h1>
          <p className="text-gray-300">No one met the conditions for any titles this round!</p>
        </div>
        
        {/* Mini Scoreboard */}
        {teamScores.length > 0 && (
          <div className="mb-8 bg-black/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2 text-center">Current Standings</h3>
            <div className="flex gap-4">
              {teamScores.map(team => (
                <div key={team.id} className="text-center">
                  <div className="font-bold">{team.name}</div>
                  <div className="text-2xl text-yellow-400">{team.currentScore.toFixed(1)} pts</div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Advance Button */}
        {currentPlayer?.role === 'referee' ? (
          <button
            onClick={handleAdvanceToNextRound}
            className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-lg font-bold text-xl"
          >
            {isLastGame ? '🏆 Final Ceremony' : 'Next Round →'}
          </button>
        ) : (
          <p className="text-gray-400">Waiting for referee to continue...</p>
        )}
      </div>
    )
  }
  
  // Main reveal UI
  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white flex flex-col relative"
      onClick={handleTapToAdvance}
    >
      {/* Title Counter */}
      <div className="absolute top-4 right-4 bg-black/30 rounded-lg px-3 py-2">
        <span className="text-sm font-semibold">
          {Math.min(revealIndex + 1, gameTitles.length)}/{gameTitles.length}
        </span>
      </div>
      
      {/* Mini Scoreboard */}
      {teamScores.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/20 rounded-lg p-3">
          <div className="flex justify-center gap-6">
            {teamScores.map(team => (
              <div key={team.id} className="text-center">
                <div className="font-semibold text-sm">{team.name}</div>
                <div className="text-lg text-yellow-400 font-bold">
                  {team.currentScore.toFixed(1)} pts
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {!revealComplete && currentTitle ? (
            // Current Title Reveal
            <motion.div
              key={`title-${revealIndex}`}
              className="text-center max-w-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Dark pause overlay between titles */}
              <motion.div
                className="absolute inset-0 bg-black z-10"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              />
              
              {/* Screen shake container */}
              <motion.div
                animate={{ 
                  x: [0, -3, 3, -2, 2, 0],
                }}
                transition={{ 
                  duration: 0.2, 
                  delay: 1.0,
                  ease: "easeInOut"
                }}
              >
                {/* Title Name */}
                <motion.h1
                  className={`text-4xl md:text-6xl font-black mb-4 ${
                    currentTitle.is_funny 
                      ? 'text-pink-400 drop-shadow-[0_0_20px_rgba(244,114,182,0.7)]' 
                      : 'text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.7)]'
                  }`}
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.3, 1] }}
                  transition={{ 
                    duration: 0.8, 
                    type: 'spring', 
                    stiffness: 400, 
                    damping: 15,
                    delay: 0.6
                  }}
                >
                  {currentTitle.is_funny ? '😂' : '✨'} {currentTitle.title_name}
                </motion.h1>
              
                {/* Player Name */}
                <motion.div
                  className="text-2xl md:text-3xl font-bold mb-6 text-white"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    delay: 1.1, 
                    duration: 0.8,
                    type: 'spring',
                    stiffness: 300,
                    damping: 20
                  }}
                >
                  {currentTitle.playerName}
                </motion.div>
              
              {/* Description */}
              <motion.p
                className="text-lg md:text-xl text-gray-300 mb-6 leading-relaxed"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                {currentTitle.title_desc}
              </motion.p>
              
                {/* Points */}
                <motion.div
                  className={`inline-block px-6 py-3 rounded-full text-xl font-bold ${
                    currentTitle.is_funny 
                      ? 'bg-pink-600/30 border-2 border-pink-400 text-pink-200' 
                      : 'bg-yellow-600/30 border-2 border-yellow-400 text-yellow-200'
                  }`}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0.8, 1], 
                    scale: 1,
                    textShadow: currentTitle.is_funny 
                      ? ['0 0 0px rgba(244,114,182,0)', '0 0 20px rgba(244,114,182,0.8)', '0 0 10px rgba(244,114,182,0.4)', '0 0 15px rgba(244,114,182,0.6)']
                      : ['0 0 0px rgba(250,204,21,0)', '0 0 20px rgba(250,204,21,0.8)', '0 0 10px rgba(250,204,21,0.4)', '0 0 15px rgba(250,204,21,0.6)'],
                    boxShadow: currentTitle.is_funny 
                      ? ['0 0 0px rgba(244,114,182,0)', '0 0 40px rgba(244,114,182,0.6)', '0 0 20px rgba(244,114,182,0.3)', '0 0 30px rgba(244,114,182,0.4)']
                      : ['0 0 0px rgba(250,204,21,0)', '0 0 40px rgba(250,204,21,0.6)', '0 0 20px rgba(250,204,21,0.3)', '0 0 30px rgba(250,204,21,0.4)']
                  }}
                  transition={{ 
                    delay: 1.6, 
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                >
                  +{currentTitle.points} points
                </motion.div>
              
                {/* Pulsing tap to continue */}
                <motion.p
                  className="absolute bottom-20 left-4 right-4 text-center text-gray-300 text-lg font-semibold"
                  initial={{ opacity: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0.4, 1],
                    scale: [1, 1.05, 0.95, 1]
                  }}
                  transition={{ 
                    delay: 2.5,
                    duration: 2,
                    repeat: Infinity,
                    repeatType: "loop"
                  }}
                >
                  ✨ Tap to continue ✨
                </motion.p>
              </motion.div>
            </motion.div>
          ) : (
            // All titles revealed
            <motion.div
              key="complete"
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-6xl mb-6">🎉</div>
              <h1 className="text-4xl font-bold mb-4">All titles revealed!</h1>
              
              {/* Final Score */}
              {teamScores.length > 0 && (
                <div className="mb-8 bg-black/20 rounded-lg p-6">
                  <h3 className="text-2xl font-semibold mb-4">Round Results</h3>
                  <div className="flex justify-center gap-8">
                    {teamScores.map(team => (
                      <div key={team.id} className="text-center">
                        <div className="font-bold text-xl">{team.name}</div>
                        <div className="text-3xl text-yellow-400 font-black">
                          {team.currentScore.toFixed(1)} pts
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Advance Button */}
              {currentPlayer?.role === 'referee' ? (
                <button
                  onClick={handleAdvanceToNextRound}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 px-8 py-4 rounded-lg font-bold text-xl shadow-lg transform hover:scale-105 transition-all"
                >
                  {isLastGame ? '🏆 Final Ceremony' : 'Next Round →'}
                </button>
              ) : (
                <p className="text-gray-400 text-lg">Waiting for referee to continue...</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default TitleReveal