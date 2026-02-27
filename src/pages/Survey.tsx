import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import useAuthStore from '../stores/authStore'

const QUESTIONS = [
  'How competitive are you?',
  'How athletic are you?',
  'How clutch are you under pressure?',
  'How much trash talk do you bring?',
  'How often do you game (video games)?',
  'How strategic are you?',
]

const TIER_INFO: Record<string, { label: string; emoji: string }> = {
  wonderkid: { label: 'Wonderkid', emoji: '🌟' },
  rising_prospect: { label: 'Rising Prospect', emoji: '🔥' },
  certified: { label: 'Certified', emoji: '✅' },
  seasoned_veteran: { label: 'Seasoned Veteran', emoji: '👑' },
}

function calculateTier(scores: number[]): string {
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  if (avg <= 3.5) return 'wonderkid'
  if (avg <= 5.5) return 'rising_prospect'
  if (avg <= 7.5) return 'certified'
  return 'seasoned_veteran'
}

function Survey() {
  const navigate = useNavigate()
  const { user, profile, fetchProfile } = useAuthStore()
  const [scores, setScores] = useState<number[]>([5, 5, 5, 5, 5, 5])
  const [submitting, setSubmitting] = useState(false)
  const [revealTier, setRevealTier] = useState<string | null>(null)

  // Pre-fill from existing survey
  useEffect(() => {
    if (profile?.survey_responses) {
      const prev = profile.survey_responses as { scores?: number[] }
      if (prev.scores && Array.isArray(prev.scores)) {
        setScores(prev.scores)
      }
    }
  }, [profile])

  const handleSubmit = async () => {
    if (!user || submitting) return
    setSubmitting(true)

    const tier = calculateTier(scores)
    const survey_responses = { scores, questions: QUESTIONS }

    const { error } = await supabase
      .from('profiles')
      .update({ survey_responses, tier, survey_complete: true })
      .eq('id', user.id)

    if (error) {
      console.error('Survey save error:', error)
      setSubmitting(false)
      return
    }

    await fetchProfile()
    setRevealTier(tier)

    setTimeout(() => {
      navigate('/', { replace: true })
    }, 3000)
  }

  // Tier reveal overlay
  if (revealTier) {
    const info = TIER_INFO[revealTier]
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <motion.div
            className="text-8xl mb-6"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.3, 1] }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            {info.emoji}
          </motion.div>
          <motion.h2
            className="font-heading text-4xl md:text-6xl text-primary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            {info.label.toUpperCase()}
          </motion.h2>
          <motion.div
            className="mt-4 w-32 h-1 bg-primary mx-auto rounded-full"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 1.0 }}
          />
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-12 px-4">
      <motion.h1
        className="text-5xl md:text-7xl font-heading text-primary text-center mb-10"
        initial={{ clipPath: 'inset(0 0 100% 0)' }}
        animate={{ clipPath: 'inset(0 0 0% 0)' }}
        transition={{ duration: 1, ease: 'easeOut' }}
      >
        PLAYER ASSESSMENT
      </motion.h1>

      <motion.div
        className="glass-panel p-6 md:p-8 w-full max-w-md space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        {QUESTIONS.map((q, i) => (
          <div key={i}>
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-sm text-gray-300 font-medium">{q}</label>
              <span className="text-2xl font-heading text-primary ml-3">{scores[i]}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={scores[i]}
              onChange={(e) => {
                const next = [...scores]
                next[i] = parseInt(e.target.value)
                setScores(next)
              }}
              className="survey-slider w-full"
            />
          </div>
        ))}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-navy w-full text-xl font-semibold mt-4"
        >
          {submitting ? 'SUBMITTING...' : 'SUBMIT'}
        </button>
      </motion.div>
    </div>
  )
}

export default Survey
