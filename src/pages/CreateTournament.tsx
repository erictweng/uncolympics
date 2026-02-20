import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createTournament } from '../lib/api'
import { getOrCreateDeviceId } from '../lib/device'
import useGameStore from '../stores/gameStore'

function CreateTournament() {
  const navigate = useNavigate()
  const { setTournament, setCurrentPlayer } = useGameStore()
  
  useEffect(() => {
    document.title = 'UNCOLYMPICS - Create Tournament';
  }, []);
  
  const [formData, setFormData] = useState({
    tournamentName: '',
    roomCode: '',
    numGames: 3,
    refereeName: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}min`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (mins === 0) {
      return `${hours}h`
    }
    return `${hours}h ${mins}min`
  }

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'roomCode' ? (value as string).toUpperCase() : value
    }))
    setError('') // Clear error when user types
  }

  const validateForm = (): string | null => {
    if (!formData.tournamentName.trim()) return 'Tournament name is required'
    if (!formData.roomCode.trim()) return 'Room code is required'
    if (!formData.refereeName.trim()) return 'Referee name is required'
    if (formData.roomCode.length > 5) return 'Room code must be 5 characters or less'
    if (!/^[A-Z0-9]+$/.test(formData.roomCode)) return 'Room code must be alphanumeric'
    if (formData.numGames < 1 || formData.numGames > 10) return 'Number of games must be between 1 and 10'
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
      const result = await createTournament(
        formData.tournamentName.trim(),
        formData.roomCode.trim(),
        formData.numGames,
        formData.refereeName.trim(),
        deviceId
      )

      setTournament(result.tournament)
      setCurrentPlayer(result.player)
      navigate(`/lobby/${result.tournament.room_code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament')
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
        <h1 className="text-4xl md:text-6xl font-bold text-accent-primary neon-glow-primary mb-4">
          CREATE TOURNAMENT
        </h1>
        <p className="text-lg text-secondary">Set up a new Olympic competition</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Tournament Name */}
        <div>
          <label htmlFor="tournamentName" className="block text-xl font-semibold text-accent-primary mb-3">
            Tournament Name
          </label>
          <input
            type="text"
            id="tournamentName"
            value={formData.tournamentName}
            onChange={(e) => handleInputChange('tournamentName', e.target.value)}
            className="w-full bg-primary border-2 border-accent-primary text-white text-lg px-4 py-3 rounded-lg focus:outline-none focus:border-accent-secondary transition-colors"
            placeholder="e.g., Weng Family Olympics"
            maxLength={50}
          />
        </div>

        {/* Room Code */}
        <div>
          <label htmlFor="roomCode" className="block text-xl font-semibold text-accent-primary mb-3">
            Room Code
          </label>
          <input
            type="text"
            id="roomCode"
            value={formData.roomCode}
            onChange={(e) => handleInputChange('roomCode', e.target.value)}
            className="w-full bg-primary border-2 border-accent-primary text-white text-lg px-4 py-3 rounded-lg focus:outline-none focus:border-accent-secondary transition-colors"
            placeholder="e.g., WF2025"
            maxLength={5}
            style={{ textTransform: 'uppercase' }}
          />
          <p className="text-sm text-secondary mt-2">5 characters max, letters and numbers only</p>
        </div>

        {/* Referee Name */}
        <div>
          <label htmlFor="refereeName" className="block text-xl font-semibold text-accent-primary mb-3">
            Referee Name
          </label>
          <input
            type="text"
            id="refereeName"
            value={formData.refereeName}
            onChange={(e) => handleInputChange('refereeName', e.target.value)}
            className="w-full bg-primary border-2 border-accent-primary text-white text-lg px-4 py-3 rounded-lg focus:outline-none focus:border-accent-secondary transition-colors"
            placeholder="Your name"
            maxLength={30}
          />
        </div>

        {/* Number of Games */}
        <div>
          <label htmlFor="numGames" className="block text-xl font-semibold text-accent-primary mb-3">
            Number of Games
          </label>
          <div className="flex items-center justify-center space-x-6">
            <button
              type="button"
              onClick={() => formData.numGames > 1 && handleInputChange('numGames', formData.numGames - 1)}
              className="bg-accent-primary text-black font-bold text-2xl w-14 h-14 rounded-lg hover:bg-accent-secondary transition-colors"
              disabled={formData.numGames <= 1}
            >
              -
            </button>
            <div className="min-w-20 text-center">
              <span className="text-4xl font-bold text-accent-primary">{formData.numGames}</span>
            </div>
            <button
              type="button"
              onClick={() => formData.numGames < 10 && handleInputChange('numGames', formData.numGames + 1)}
              className="bg-accent-primary text-black font-bold text-2xl w-14 h-14 rounded-lg hover:bg-accent-secondary transition-colors"
              disabled={formData.numGames >= 10}
            >
              +
            </button>
          </div>
          <p className="text-center text-lg text-accent-secondary mt-3">
            Estimated time: {formatTime(formData.numGames * 20)}
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
            className="w-full max-w-md bg-accent-primary hover:bg-accent-secondary text-black font-bold text-2xl py-4 px-8 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
          >
            {loading ? 'CREATING...' : 'CREATE TOURNAMENT'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreateTournament