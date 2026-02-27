import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../stores/authStore'
import { reconnectPlayer, fetchLobbyState } from '../lib/api'
import { subscribeTournament } from '../lib/sync'
import useLobbyStore from '../stores/lobbyStore'

type ReconnectStatus = 'loading' | 'ready' | 'expired' | 'error'

/**
 * Universal reconnect hook. Uses auth user_id instead of device_id.
 */
export function useReconnect(shouldNavigate: boolean = true): ReconnectStatus {
  const navigate = useNavigate()
  const [status, setStatus] = useState<ReconnectStatus>('loading')
  const hasRun = useRef(false)
  const unsubRef = useRef<(() => void) | null>(null)

  const {
    tournament,
    currentPlayer,
    setTournament,
    setCurrentPlayer,
    setPlayers,
    setTeams,
    setVotes,
  } = useLobbyStore()

  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const reconnect = async () => {
      // Step 1: If we already have state, set up sync and fetch fresh data
      if (tournament?.id && currentPlayer?.id) {
        if (!unsubRef.current) {
          unsubRef.current = subscribeTournament(tournament.id)
        }

        try {
          const lobbyState = await fetchLobbyState(tournament.id)
          setPlayers(lobbyState.players)
          setTeams(lobbyState.teams)
          setVotes(lobbyState.votes)
        } catch (err) {
          console.error('Failed to fetch lobby state on fast path:', err)
        }

        // Validate tournament is still active
        const userId = user?.id
        if (!userId) {
          setStatus('expired')
          return
        }

        const result = await reconnectPlayer(userId)
        if (!result) {
          setStatus('expired')
          return
        }

        setTournament(result.tournament)
        setCurrentPlayer(result.player)

        if (shouldNavigate) {
          navigateToStatus(result.tournament, navigate)
        }
        setStatus('ready')
        return
      }

      // Step 2: No state — recovering from refresh
      const userId = user?.id
      if (!userId) {
        setStatus('expired')
        return
      }
      
      const timeout = setTimeout(() => {
        setStatus('expired')
      }, 5000)

      try {
        const result = await reconnectPlayer(userId)
        clearTimeout(timeout)

        if (!result) {
          setStatus('expired')
          return
        }

        const { tournament: t, player } = result

        setTournament(t)
        setCurrentPlayer(player)

        try {
          const lobbyState = await fetchLobbyState(t.id)
          setPlayers(lobbyState.players)
          setTeams(lobbyState.teams)
          setVotes(lobbyState.votes)
        } catch (err) {
          console.error('Failed to fetch lobby state on reconnect:', err)
        }

        unsubRef.current = subscribeTournament(t.id)

        if (shouldNavigate) {
          navigateToStatus(t, navigate)
        }

        setStatus('ready')
      } catch (err) {
        clearTimeout(timeout)
        console.error('Reconnect failed:', err)
        setStatus('error')
      }
    }

    reconnect()

    // Re-fetch state when tab becomes visible
    const handleVisibilityChange = async () => {
      if (document.hidden) return
      
      const userId = useAuthStore.getState().user?.id
      if (!userId) return

      try {
        const result = await reconnectPlayer(userId)
        if (!result) return
        
        const { setTournament: setT, setPlayers: setP, setTeams: setTe, setVotes: setV } = useLobbyStore.getState()
        setT(result.tournament)

        try {
          const lobbyState = await fetchLobbyState(result.tournament.id)
          setP(lobbyState.players)
          setTe(lobbyState.teams)
          setV(lobbyState.votes)
        } catch (err) {
          console.error('Failed to refresh lobby state on tab focus:', err)
        }

        if (shouldNavigate) {
          navigateToStatus(result.tournament, navigate)
        }
      } catch (err) {
        console.error('Visibility change reconnect failed:', err)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
      hasRun.current = false
    }
  }, [])

  return status
}

function navigateToStatus(
  tournament: { status: string; room_code: string; id: string },
  navigate: (path: string) => void
) {
  const rc = tournament.room_code
  const currentPath = window.location.pathname

  let targetPath: string

  switch (tournament.status) {
    case 'lobby':
      targetPath = `/lobby/${rc}`
      break
    case 'game_setup':
      targetPath = `/game-setup/${rc}`
      break
    case 'ceremony':
      targetPath = `/ceremony-open/${rc}`
      break
    case 'drafting':
      targetPath = `/draft/${rc}`
      break
    case 'playing':
      if (currentPath.includes('/play/') || currentPath.includes('/game-hub')) return
      targetPath = `/game-hub/${rc}`
      break
    case 'scoring':
      targetPath = `/scoreboard/${rc}`
      break
    case 'completed':
      targetPath = `/ceremony/${rc}`
      break
    default:
      targetPath = `/lobby/${rc}`
  }

  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const normalizedPath = base && currentPath.startsWith(base) 
    ? currentPath.slice(base.length) || '/' 
    : currentPath

  if (!normalizedPath.startsWith(targetPath) && normalizedPath !== targetPath) {
    navigate(targetPath)
  }
}
