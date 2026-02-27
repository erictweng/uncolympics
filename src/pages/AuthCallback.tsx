import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../stores/authStore'

function AuthCallback() {
  const navigate = useNavigate()
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    // Supabase client auto-detects tokens in the URL hash
    // Just re-initialize the auth store to pick up the session
    initialize().then(() => {
      navigate('/', { replace: true })
    })
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg text-gray-400">Signing in...</div>
    </div>
  )
}

export default AuthCallback
