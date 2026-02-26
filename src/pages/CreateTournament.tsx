import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { createTournament } from '../lib/api'
import { getOrCreateDeviceId } from '../lib/device'
import useLobbyStore from '../stores/lobbyStore'
import { toast } from '../lib/toast'
import { useSwipeUp } from '../hooks/useSwipeUp'
import { SwipeHint } from '../components/ui/SwipeHint'
import { LobbyInline } from '../components/LobbyInline'

function CreateTournament() {
  const navigate = useNavigate()
  const { setTournament, setCurrentPlayer, resetLobby } = useLobbyStore()
  
  useEffect(() => {
    resetLobby()
    document.title = 'UNCOLYMPICS - Create Tournament';
  }, []);
  
  const [refereeName, setRefereeName] = useState('')
  const [numGames, setNumGames] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [lobbyReady, setLobbyReady] = useState(false)

  const isFormValid = refereeName.trim() !== '' && roomCode.trim() !== '' && numGames.trim() !== ''

  const validateForm = (): string | null => {
    if (!refereeName.trim()) return 'Ref name is required'
    if (!roomCode.trim()) return 'Lobby code is required'
    if (roomCode.length > 5) return 'Lobby code must be 5 characters or less'
    if (!/^[A-Z0-9]+$/i.test(roomCode)) return 'Lobby code must be alphanumeric'
    if (!numGames.trim()) return 'Number of games is required'
    const games = parseInt(numGames)
    if (isNaN(games) || games < 1 || games > 10) return 'Games must be between 1 and 10'
    return null
  }

  const handleCreate = async () => {
    const validationError = validateForm()
    if (validationError) {
      toast.error(validationError)
      return
    }

    // Start transition — animate form out
    setTransitioning(true)
    setLoading(true)

    try {
      const deviceId = getOrCreateDeviceId()
      const tournamentName = `${refereeName.trim()}'s Tournament`
      const games = parseInt(numGames) || 3
      
      const result = await createTournament(
        tournamentName,
        roomCode.trim().toUpperCase(),
        games,
        refereeName.trim(),
        deviceId
      )

      setTournament(result.tournament)
      setCurrentPlayer(result.player)
      // Show lobby content inline for seamless transition
      setLobbyReady(true)
      // After transition animation settles, navigate to real Lobby page
      // (which has swipe-up-to-start, swipe-down-to-leave, etc.)
      setTimeout(() => {
        navigate(`/lobby/${roomCode.trim().toUpperCase()}`, { replace: true })
      }, 1200)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create tournament'
      toast.error(errorMessage)
      // Revert transition on error
      setTransitioning(false)
    } finally {
      setLoading(false)
    }
  }

  const handleBackNavigation = () => {
    navigate('/')
  }

  // Swipe-up to create — only enabled when form is valid
  const { swipeHintRef } = useSwipeUp({
    onSwipe: handleCreate,
    enabled: !loading && !transitioning && isFormValid
  })

  return (
    <div ref={swipeHintRef} className="flex flex-col items-center justify-center min-h-screen relative">
      {/* Back navigation - disappears instantly when transitioning */}
      {!transitioning && (
        <button
          onClick={handleBackNavigation}
          className="absolute top-8 left-8 text-secondary hover:text-primary transition-colors text-2xl z-10"
        >
          ←
        </button>
      )}

      {/* Form fields — animate out on transition */}
      <AnimatePresence>
        {!transitioning && (
          <motion.div
            className="flex flex-col items-center space-y-16 px-6 w-full"
            exit={{ y: -500, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeIn' }}
          >

            {/* Ref Name */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-full max-w-md"
            >
              <input
                type="text"
                value={refereeName}
                onChange={(e) => setRefereeName(e.target.value)}
                placeholder="Ref Name"
                className="seamless-input text-4xl md:text-5xl font-heading text-primary text-center w-full"
                autoComplete="off"
              />
            </motion.div>

            {/* Number of Games */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="w-full max-w-md"
            >
              <input
                type="number"
                value={numGames}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || (parseInt(v) >= 1 && parseInt(v) <= 10)) {
                    setNumGames(v)
                  }
                }}
                placeholder="Games"
                min={1}
                max={10}
                className="seamless-input text-4xl md:text-5xl font-heading text-primary text-center w-full"
                autoComplete="off"
              />
            </motion.div>

            {/* Lobby Code */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="w-full max-w-md"
            >
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
                placeholder="Lobby #"
                maxLength={5}
                className="seamless-input text-4xl md:text-5xl font-heading text-primary text-center w-full tracking-wider uppercase"
                autoComplete="off"
              />
            </motion.div>

            {/* Swipe hint */}
            <SwipeHint 
              visible={!loading} 
              text={isFormValid ? "↑ Swipe up to create" : "Fill ref name, games & lobby code"}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lobby content — rendered inline after successful create */}
      <LobbyInline active={lobbyReady} />
    </div>
  )
}

export default CreateTournament
