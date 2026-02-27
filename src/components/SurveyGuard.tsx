import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../stores/authStore'

export function SurveyGuard({ children }: { children: React.ReactNode }) {
  const { profile, isLoading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && profile && !profile.survey_complete) {
      navigate('/survey', { replace: true })
    }
  }, [isLoading, profile, navigate])

  if (isLoading || !profile) return null
  if (!profile.survey_complete) return null

  return <>{children}</>
}
