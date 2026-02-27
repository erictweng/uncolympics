import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import useAuthStore from '../stores/authStore'

const SECTIONS = [
  {
    title: 'UNC QUALIFIERS 👴',
    questions: [
      'Says "I\'m tired" before 11 PM',
      'Falls asleep during movies',
      'Says "I can\'t drink like I used to"',
      'Talks about protein intake',
      'Says "I\'m not trying to be out that late"',
      'Birthday 2001 or before',
      'Makes a noise when standing up',
      'Uses "back in my day" unironically',
      'Uses Facebook unironically',
      'Says "these kids nowadays"',
      'Talks about sleep quality',
      'Gets excited about kitchen appliances',
      'Has a favorite grocery store',
    ],
  },
  {
    title: 'UNCETTE QUALIFIERS 👵',
    questions: [
      'Brings Tupperware "just in case"',
      'Falls asleep during movies',
      'Asks about your job 4 times',
      'Knows everyone\'s relationship status',
      'Says "aiyahhh" or equivalent',
      'Wears house slippers everywhere',
      'Sends Instagram reels instead of texting',
      'Sends voice notes',
      'Has a skincare routine longer than 5 steps',
      'Talks about "energy" and "boundaries"',
      'Has a Pinterest board for future apartment',
      'Owns at least one Stanley cup or Owala',
      'Knows which restaurants are "aesthetic"',
    ],
  },
  {
    title: 'BONUS QUALIFIERS ⭐',
    questions: [
      'Brings snacks to gatherings "just in case"',
      'Says "I used to be way better"',
      'Lower rank in a video game than they used to be',
      'Drinks hot water/tea',
      'Says "my social battery is low"',
      'Stretches before pickleball',
      'Watches home organization videos',
    ],
  },
]

const ALL_QUESTIONS = SECTIONS.flatMap((s) => s.questions)
const TOTAL = ALL_QUESTIONS.length // 33

const TIER_INFO: Record<string, { label: string; emoji: string }> = {
  wonderkid: { label: 'Wonderkid', emoji: '🌟' },
  rising_prospect: { label: 'Rising Prospect', emoji: '🔥' },
  certified: { label: 'Certified', emoji: '✅' },
  seasoned_veteran: { label: 'Seasoned Veteran', emoji: '👑' },
}

function calculateTier(totalChecks: number): string {
  if (totalChecks <= 7) return 'wonderkid'
  if (totalChecks <= 14) return 'rising_prospect'
  if (totalChecks <= 21) return 'certified'
  return 'seasoned_veteran'
}

function Survey() {
  const navigate = useNavigate()
  const { user, profile, fetchProfile } = useAuthStore()
  const [answers, setAnswers] = useState<boolean[]>(new Array(TOTAL).fill(false))
  const [submitting, setSubmitting] = useState(false)
  const [revealTier, setRevealTier] = useState<string | null>(null)

  // Pre-fill from existing survey
  useEffect(() => {
    if (profile?.survey_responses) {
      const prev = profile.survey_responses as { answers?: boolean[] }
      if (prev.answers && Array.isArray(prev.answers) && prev.answers.length === TOTAL) {
        setAnswers(prev.answers)
      }
    }
  }, [profile])

  const totalChecks = useMemo(() => answers.filter(Boolean).length, [answers])
  const projectedTier = calculateTier(totalChecks)
  const projectedInfo = TIER_INFO[projectedTier]

  const toggle = (index: number) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  const handleSubmit = async () => {
    if (!user || submitting) return
    setSubmitting(true)

    const tier = calculateTier(totalChecks)
    const survey_responses = { answers, totalChecks }

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

  let questionIndex = 0

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
        className="w-full max-w-md space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        {SECTIONS.map((section) => {
          const startIdx = questionIndex
          const sectionItems = section.questions.map((q, qi) => {
            const idx = startIdx + qi
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggle(idx)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200 text-left ${
                  answers[idx]
                    ? 'bg-green-500/15 border-green-500/40 shadow-[0_0_12px_rgba(34,197,94,0.15)]'
                    : 'bg-white/5 border-white/10 opacity-60 hover:opacity-80'
                }`}
              >
                <span className="text-sm text-gray-200 pr-3">{q}</span>
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold transition-all ${
                    answers[idx]
                      ? 'bg-green-500 text-white'
                      : 'bg-white/10 text-white/30'
                  }`}
                >
                  {answers[idx] ? '✓' : ''}
                </span>
              </button>
            )
          })
          questionIndex += section.questions.length
          return (
            <div key={section.title}>
              <h2 className="font-heading text-2xl text-primary mb-3">{section.title}</h2>
              <div className="space-y-2">{sectionItems}</div>
            </div>
          )
        })}

        {/* Running count + projected tier */}
        <div className="glass-panel p-4 text-center sticky bottom-4">
          <div className="text-lg text-gray-300">
            <span className="font-heading text-2xl text-primary">{totalChecks}</span>
            <span className="text-gray-400">/{TOTAL} checked</span>
          </div>
          <div className="text-sm text-gray-400 mt-1">
            Current tier: <span className="text-primary font-semibold">{projectedInfo.emoji} {projectedInfo.label}</span>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-navy w-full text-xl font-heading mt-2 mb-8"
        >
          {submitting ? 'SUBMITTING...' : 'LOCK IT IN'}
        </button>
      </motion.div>
    </div>
  )
}

export default Survey
