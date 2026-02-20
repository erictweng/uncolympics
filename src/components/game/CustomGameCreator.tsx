import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createCustomGameType } from '../../lib/api'
import type { GameType } from '../../types'

interface PlayerStatInput {
  key: string
  label: string
  type: 'number' | 'boolean'
  min?: number
  max?: number
}

interface RefereeInput {
  key: string
  label: string
  type: 'team_select' | 'player_select' | 'team_scores' | 'player_times'
}

interface TitleDefinition {
  name: string
  desc: string
  isFunny: boolean
  condition: {
    type: 'highest' | 'lowest' | 'exact' | 'flag' | 'threshold'
    stat: string
    value?: number
  }
}

interface Props {
  isOpen: boolean
  tournamentId: string
  onClose: () => void
  onGameCreated: (game: GameType) => void
}

function CustomGameCreator({ isOpen, tournamentId, onClose, onGameCreated }: Props) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [description, setDescription] = useState('')
  const [playerStats, setPlayerStats] = useState<PlayerStatInput[]>([])
  const [refereeInputs, setRefereeInputs] = useState<RefereeInput[]>([])
  const [titleDefinitions, setTitleDefinitions] = useState<TitleDefinition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateKey = (label: string) => {
    return label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  }

  const handleAddPlayerStat = () => {
    setPlayerStats([...playerStats, {
      key: '',
      label: '',
      type: 'number'
    }])
  }

  const handleUpdatePlayerStat = (index: number, field: keyof PlayerStatInput, value: any) => {
    const updated = [...playerStats]
    updated[index] = { ...updated[index], [field]: value }
    
    // Auto-generate key when label changes
    if (field === 'label') {
      updated[index].key = generateKey(value)
    }
    
    setPlayerStats(updated)
  }

  const handleRemovePlayerStat = (index: number) => {
    setPlayerStats(playerStats.filter((_, i) => i !== index))
  }

  const handleAddTitle = () => {
    setTitleDefinitions([...titleDefinitions, {
      name: '',
      desc: '',
      isFunny: false,
      condition: {
        type: 'highest',
        stat: '',
        value: undefined
      }
    }])
  }

  const handleUpdateTitle = (index: number, field: string, value: any) => {
    const updated = [...titleDefinitions]
    if (field.startsWith('condition.')) {
      const conditionField = field.split('.')[1]
      updated[index] = {
        ...updated[index],
        condition: { ...updated[index].condition, [conditionField]: value }
      }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    setTitleDefinitions(updated)
  }

  const handleRemoveTitle = (index: number) => {
    setTitleDefinitions(titleDefinitions.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!name.trim() || !emoji.trim() || !description.trim()) {
        throw new Error('Name, emoji, and description are required')
      }

      if (playerStats.length === 0) {
        throw new Error('At least one player stat is required')
      }

      // Validate all player stats have labels
      for (const stat of playerStats) {
        if (!stat.label.trim()) {
          throw new Error('All player stats must have labels')
        }
      }

      const gameData = {
        name: name.trim(),
        emoji: emoji.trim(),
        description: description.trim(),
        playerInputs: playerStats,
        refereeInputs,
        titleDefinitions
      }

      const newGame = await createCustomGameType(tournamentId, gameData)
      onGameCreated(newGame)
      handleCancel() // Reset form
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setName('')
    setEmoji('')
    setDescription('')
    setPlayerStats([])
    setRefereeInputs([])
    setTitleDefinitions([])
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 flex items-start justify-center p-4 z-50 overflow-y-auto"
        onClick={handleCancel}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-2xl w-full my-8"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-2xl font-bold text-white mb-6">Create Custom Game</h2>

          {error && (
            <div className="mb-6 p-3 bg-red-900/20 border border-red-700 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Basic Info</h3>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Game Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 focus:border-cyan-400 outline-none"
                  placeholder="e.g. Epic Challenges"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Emoji</label>
                <input
                  type="text"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  className="w-24 px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 focus:border-cyan-400 outline-none text-center"
                  placeholder="🎲"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 focus:border-cyan-400 outline-none"
                  rows={3}
                  placeholder="Describe how this game works..."
                />
              </div>
            </div>

            {/* Player Stats */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Player Stats</h3>
                <button
                  onClick={handleAddPlayerStat}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded transition-colors"
                >
                  + Add Player Stat
                </button>
              </div>

              {playerStats.map((stat, index) => (
                <div key={index} className="p-4 bg-gray-800 rounded border border-gray-600">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={stat.label}
                        onChange={(e) => handleUpdatePlayerStat(index, 'label', e.target.value)}
                        className="w-full px-2 py-1 bg-gray-700 text-white rounded border border-gray-500 focus:border-cyan-400 outline-none"
                        placeholder="Stat label (e.g. Points Scored)"
                      />
                      <div className="text-xs text-gray-500">Key: {stat.key || 'auto-generated'}</div>
                    </div>
                    <button
                      onClick={() => handleRemovePlayerStat(index)}
                      className="ml-3 text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex items-center space-x-4">
                    <select
                      value={stat.type}
                      onChange={(e) => handleUpdatePlayerStat(index, 'type', e.target.value)}
                      className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-500"
                    >
                      <option value="number">Number</option>
                      <option value="boolean">True/False</option>
                    </select>

                    {stat.type === 'number' && (
                      <>
                        <input
                          type="number"
                          value={stat.min ?? ''}
                          onChange={(e) => handleUpdatePlayerStat(index, 'min', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-20 px-2 py-1 bg-gray-700 text-white rounded border border-gray-500"
                          placeholder="Min"
                        />
                        <input
                          type="number"
                          value={stat.max ?? ''}
                          onChange={(e) => handleUpdatePlayerStat(index, 'max', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-20 px-2 py-1 bg-gray-700 text-white rounded border border-gray-500"
                          placeholder="Max"
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}

              {playerStats.length === 0 && (
                <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-600 rounded">
                  No player stats defined. Add at least one stat that players will input.
                </div>
              )}
            </div>

            {/* Title Conditions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Title Conditions</h3>
                <button
                  onClick={handleAddTitle}
                  className="px-3 py-1 bg-pink-600 hover:bg-pink-500 text-white text-sm rounded transition-colors"
                >
                  + Add Title
                </button>
              </div>

              {titleDefinitions.map((title, index) => (
                <div key={index} className="p-4 bg-gray-800 rounded border border-gray-600">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={title.name}
                        onChange={(e) => handleUpdateTitle(index, 'name', e.target.value)}
                        className="w-full px-2 py-1 bg-gray-700 text-white rounded border border-gray-500 focus:border-cyan-400 outline-none"
                        placeholder="Title name (e.g. Top Scorer)"
                      />
                      <input
                        type="text"
                        value={title.desc}
                        onChange={(e) => handleUpdateTitle(index, 'desc', e.target.value)}
                        className="w-full px-2 py-1 bg-gray-700 text-white rounded border border-gray-500 focus:border-cyan-400 outline-none"
                        placeholder="Description (e.g. Scored the most points)"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveTitle(index)}
                      className="ml-3 text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      value={title.condition.type}
                      onChange={(e) => handleUpdateTitle(index, 'condition.type', e.target.value)}
                      className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-500"
                    >
                      <option value="highest">Highest</option>
                      <option value="lowest">Lowest</option>
                      <option value="exact">Exact Value</option>
                      <option value="flag">Has Flag (true)</option>
                      <option value="threshold">Above Threshold</option>
                    </select>

                    <select
                      value={title.condition.stat}
                      onChange={(e) => handleUpdateTitle(index, 'condition.stat', e.target.value)}
                      className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-500"
                    >
                      <option value="">Select stat...</option>
                      {playerStats.map(stat => (
                        <option key={stat.key} value={stat.key}>{stat.label}</option>
                      ))}
                    </select>

                    {(title.condition.type === 'exact' || title.condition.type === 'threshold') && (
                      <input
                        type="number"
                        value={title.condition.value ?? ''}
                        onChange={(e) => handleUpdateTitle(index, 'condition.value', e.target.value ? Number(e.target.value) : undefined)}
                        className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-500"
                        placeholder="Value"
                      />
                    )}
                  </div>

                  <div className="mt-3">
                    <label className="flex items-center text-sm text-gray-400">
                      <input
                        type="checkbox"
                        checked={title.isFunny}
                        onChange={(e) => handleUpdateTitle(index, 'isFunny', e.target.checked)}
                        className="mr-2"
                      />
                      Funny title (not serious achievement)
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* Preview */}
            {name && emoji && description && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Preview</h3>
                <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg">
                  <div className="text-3xl mb-2">{emoji}</div>
                  <h3 className="font-bold text-white mb-2">{name}</h3>
                  <p className="text-gray-400 text-sm mb-2">{description}</p>
                  <div className="text-xs text-gray-500">
                    {playerStats.length} stat{playerStats.length !== 1 ? 's' : ''} • {titleDefinitions.length} title{titleDefinitions.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 py-3 px-4 border border-gray-600 rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !name.trim() || !emoji.trim() || !description.trim() || playerStats.length === 0}
                className="flex-1 py-3 px-4 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-semibold transition-colors shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Game'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default CustomGameCreator