import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { joinTournament } from '../lib/api'
import { getOrCreateDeviceId } from '../lib/device'
import useLobbyStore from '../stores/lobbyStore'
import { toast } from '../lib/toast'
import { useSwipeUp } from '../hooks/useSwipeUp'
import { SwipeHint } from '../components/ui/SwipeHint'

function JoinTournament() {
  const navigate = useNavigate()
  const { setTournament, setCurrentPlayer } = useLobbyStore()
  
  useEffect(() => {
    document.title = 'UNCOLYMPICS - Join Tournament';
  }, []);
  
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)

  const isFormValid = playerName.trim() !== '' && roomCode.trim() !== ''

  const validateForm = (): string | null => {
    if (!roomCode.trim()) return 'Lobby code is required'
    if (!playerName.trim()) return 'Name is required'
    if (roomCode.length > 5) return 'Lobby code must be 5 characters or less'
    if (!/^[A-Z0-9]+$/i.test(roomCode)) return 'Lobby code must be alphanumeric'
    return null
  }

  const handleJoin = async () => {
    const validationError = validateForm()
    if (validationError) {
      toast.error(validationError)
      return
    }

    setLoading(true)

    try {
      const deviceId = getOrCreateDeviceId()
      const result = await joinTournament(
        roomCode.trim().toUpperCase(),
        playerName.trim(),
        deviceId,
        'player'
      )

      setTournament(result.tournament)
      setCurrentPlayer(result.player)
      toast.success('Joined tournament!')
      navigate(`/lobby/${result.tournament.room_code}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join tournament'
      
      if (errorMessage.includes('Room not found') || errorMessage.includes('Invalid room code')) {
        toast.error('Room not found. Check your lobby code.')
      } else if (errorMessage.includes('already started')) {
        toast.error('Tournament has already started.')
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBackNavigation = () => {
    navigate('/')
  }

  // Swipe-up to join — only enabled when form is valid
  const { swipeHintRef } = useSwipeUp({
    onSwipe: handleJoin,
    enabled: !loading && isFormValid
  })

  return (
    <div ref={swipeHintRef} className="flex flex-col items-center justify-center min-h-screen relative px-6">
      {/* Back navigation */}
      <button
        onClick={handleBackNavigation}
        className="absolute top-8 left-8 text-secondary hover:text-primary transition-colors text-2xl"
      >
        ←
      </button>

      {/* Name */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mb-12 w-full max-w-md"
      >
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Name"
          className="seamless-input text-6xl md:text-7xl font-heading text-primary text-center w-full"
          autoComplete="off"
        />
      </motion.div>

      {/* Lobby Code */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="mb-12 w-full max-w-md"
      >
        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
          placeholder="Lobby #"
          maxLength={5}
          className="seamless-input text-6xl md:text-7xl font-heading text-primary text-center w-full tracking-wider uppercase"
          autoComplete="off"
        />
      </motion.div>

      {/* Swipe hint */}
      <SwipeHint 
        visible={!loading} 
        text={isFormValid ? "↑ Swipe up to join" : "Fill name & lobby code"}
      />
    </div>
  )
}

export default JoinTournament
