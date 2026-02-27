import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { createTournament } from '../lib/api'
import useAuthStore from '../stores/authStore'
import useLobbyStore from '../stores/lobbyStore'
import { toast } from '../lib/toast'
import { useSwipeUp } from '../hooks/useSwipeUp'
import { SwipeHint } from '../components/ui/SwipeHint'
import { LobbyInline } from '../components/LobbyInline'

function CreateTournament() {
  const navigate = useNavigate()
  const { setTournament, setCurrentPlayer, resetLobby } = useLobbyStore()
  const { user, profile } = useAuthStore()
  
  useEffect(() => {
    resetLobby()
    document.title = 'UNCOLYMPICS - Create Tournament';
  }, []);
  
  const [numGames, setNumGames] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [lobbyReady, setLobbyReady] = useState(false)

  const isFormValid = roomCode.trim() !== '' && numGames.trim() !== ''

  const validateForm = (): string | null => {
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

    if (!user || !profile) {
      toast.error('Not signed in')
      return
    }

    setTransitioning(true)
    setLoading(true)

    try {
      const tournamentName = `${profile.name}'s Tournament`
      const games = parseInt(numGames) || 3
      
      const result = await createTournament(
        tournamentName,
        roomCode.trim().toUpperCase(),
        games,
        profile.name,
        user.id
      )

      setTournament(result.tournament)
      setCurrentPlayer(result.player)
      setLobbyReady(true)
      setTimeout(() => {
        navigate(`/lobby/${roomCode.trim().toUpperCase()}`, { replace: true })
      }, 1200)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create tournament'
      toast.error(errorMessage)
      setTransitioning(false)
    } finally {
      setLoading(false)
    }
  }

  const handleBackNavigation = () => {
    navigate('/')
  }

  const { swipeHintRef } = useSwipeUp({
    onSwipe: handleCreate,
    enabled: !loading && !transitioning && isFormValid
  })

  return (
    <div ref={swipeHintRef} className="flex flex-col items-center justify-center min-h-screen relative">
      {!transitioning && (
        <button
          onClick={handleBackNavigation}
          className="absolute top-8 left-8 text-secondary hover:text-primary transition-colors text-2xl z-10"
        >
          ←
        </button>
      )}

      {/* Show who's creating */}
      {!transitioning && profile && (
        <motion.div
          className="absolute top-8 right-8 flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {profile.avatar_url && (
            <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
          )}
          <span className="text-sm text-gray-400">{profile.name}</span>
        </motion.div>
      )}

      <AnimatePresence>
        {!transitioning && (
          <motion.div
            className="flex flex-col items-center space-y-16 px-6 w-full"
            exit={{ y: -500, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeIn' }}
          >
            {/* Number of Games */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
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
              transition={{ duration: 0.6, delay: 0.4 }}
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

            <SwipeHint 
              visible={!loading} 
              text={isFormValid ? "↑ Swipe up to create" : "Fill games & lobby code"}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <LobbyInline active={lobbyReady} />
    </div>
  )
}

export default CreateTournament
