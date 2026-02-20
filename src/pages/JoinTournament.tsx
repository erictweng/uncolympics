import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { joinTournament } from '../lib/api'
import { getOrCreateDeviceId } from '../lib/device'
import useGameStore from '../stores/gameStore'

function JoinTournament() {
  const navigate = useNavigate()
  const { setTournament, setCurrentPlayer } = useGameStore()
  
  useEffect(() => {
    document.title = 'UNCOLYMPICS - Join Tournament';
  }, []);
  
  const [formData, setFormData] = useState({
    roomCode: '',
    playerName: '',
    role: 'player' as 'player' | 'spectator'
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'roomCode' ? value.toUpperCase() : value
    }))
    setError('') // Clear error when user types
  }

  const validateForm = (): string | null => {
    if (!formData.roomCode.trim()) return 'Room code is required'
    if (!formData.playerName.trim()) return 'Player name is required'
    if (formData.roomCode.length > 5) return 'Room code must be 5 characters or less'
    if (!/^[A-Z0-9]+$/.test(formData.roomCode)) return 'Room code must be alphanumeric'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError('')

    try {
      const deviceId = getOrCreateDeviceId()
      const result = await joinTournament(
        formData.roomCode.trim(),
        formData.playerName.trim(),
        deviceId,
        formData.role
      )

      setTournament(result.tournament)
      setCurrentPlayer(result.player)
      navigate(`/lobby/${result.tournament.room_code}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join tournament'
      
      // Map API errors to user-friendly messages
      if (errorMessage.includes('Room not found') || errorMessage.includes('Invalid room code')) {
        setError('Room not found. Check your room code.')
      } else if (errorMessage.includes('already started')) {
        setError('Tournament has already started.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link to="/" className="text-accent-secondary hover:text-accent-primary transition-colors">
          ← Back to Home
        </Link>
      </div>

      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-bold text-accent-secondary neon-glow-secondary mb-4">
          JOIN TOURNAMENT
        </h1>
        <p className="text-lg text-secondary">Enter the competition</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Room Code */}
        <div>
          <label htmlFor="roomCode" className="block text-xl font-semibold text-accent-secondary mb-3">
            Room Code
          </label>
          <input
            type="text"
            id="roomCode"
            value={formData.roomCode}
            onChange={(e) => handleInputChange('roomCode', e.target.value)}
            className="w-full bg-primary border-2 border-accent-secondary text-white text-2xl px-6 py-4 rounded-lg focus:outline-none focus:border-accent-primary transition-colors text-center font-bold tracking-widest"
            placeholder="Enter room code"
            maxLength={5}
            style={{ textTransform: 'uppercase' }}
          />
          <p className="text-sm text-secondary mt-2 text-center">Ask the referee for this code</p>
        </div>

        {/* Player Name */}
        <div>
          <label htmlFor="playerName" className="block text-xl font-semibold text-accent-secondary mb-3">
            Your Name
          </label>
          <input
            type="text"
            id="playerName"
            value={formData.playerName}
            onChange={(e) => handleInputChange('playerName', e.target.value)}
            className="w-full bg-primary border-2 border-accent-secondary text-white text-lg px-4 py-3 rounded-lg focus:outline-none focus:border-accent-primary transition-colors"
            placeholder="Enter your name"
            maxLength={30}
          />
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-xl font-semibold text-accent-secondary mb-3">
            Join as
          </label>
          <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4">
            <button
              type="button"
              onClick={() => handleInputChange('role', 'player')}
              className={`flex-1 py-3 px-6 rounded-lg font-bold text-lg transition-all ${
                formData.role === 'player'
                  ? 'bg-accent-secondary text-black'
                  : 'bg-secondary border-2 border-accent-secondary text-accent-secondary hover:bg-accent-secondary hover:text-black'
              }`}
            >
              PLAYER
            </button>
            <button
              type="button"
              onClick={() => handleInputChange('role', 'spectator')}
              className={`flex-1 py-3 px-6 rounded-lg font-bold text-lg transition-all ${
                formData.role === 'spectator'
                  ? 'bg-accent-secondary text-black'
                  : 'bg-secondary border-2 border-accent-secondary text-accent-secondary hover:bg-accent-secondary hover:text-black'
              }`}
            >
              SPECTATOR
            </button>
          </div>
          <p className="text-sm text-secondary mt-2 text-center">
            {formData.role === 'player' ? 'Compete in games and score points' : 'Watch and cheer from the sidelines'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/50 border-2 border-red-500 text-red-200 p-4 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="text-center pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full max-w-md bg-accent-secondary hover:bg-accent-primary text-black font-bold text-2xl py-4 px-8 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
          >
            {loading ? 'JOINING...' : 'JOIN TOURNAMENT'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default JoinTournament