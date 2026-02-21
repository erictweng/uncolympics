import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrCreateDeviceId } from '../lib/device'
import { reconnectPlayer, fetchLobbyState } from '../lib/api'
import { subscribeTournament } from '../lib/sync'
import useLobbyStore from '../stores/lobbyStore'

type ReconnectStatus = 'loading' | 'ready' | 'expired' | 'error'

/**
 * Universal reconnect hook. Every page that needs tournament state should use this.
 * 
 * Handles:
 * 1. Check lobbyStore — if state exists (normal nav), skip fetch
 * 2. If empty (refresh), fetch from Supabase via device_id
 * 3. Redirect to correct page based on tournament.status
 * 4. Set up realtime subscription
 * 5. Timeout after 5s → show expired state
 * 
 * @param navigate - whether to redirect to the correct page for current status (default true)
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

  useEffect(() => {
    // Prevent double-run in StrictMode
    if (hasRun.current) return
    hasRun.current = true

    const reconnect = async () => {
      // Step 1: If we already have state, set up sync and fetch full state if needed
      if (tournament?.id && currentPlayer?.id) {
        // Set up realtime if not already
        if (!unsubRef.current) {
          unsubRef.current = subscribeTournament(tournament.id)
        }

        // Fetch full lobby state if players list is empty (first visit from create/join)
        const { players } = useLobbyStore.getState()
        if (players.length === 0) {
          try {
            const lobbyState = await fetchLobbyState(tournament.id)
            setPlayers(lobbyState.players)
            setTeams(lobbyState.teams)
            setVotes(lobbyState.votes)
          } catch (err) {
            console.error('Failed to fetch lobby state on first visit:', err)
          }
        }

        // Still check if we need to redirect (status may have changed)
        if (shouldNavigate) {
          navigateToStatus(tournament, navigate)
        }
        setStatus('ready')
        return
      }

      // Step 2: No state — we're recovering from a refresh
      const deviceId = getOrCreateDeviceId()
      
      // Set a 5s timeout
      const timeout = setTimeout(() => {
        setStatus('expired')
      }, 5000)

      try {
        const result = await reconnectPlayer(deviceId)
        clearTimeout(timeout)

        if (!result) {
          // No active tournament for this device
          setStatus('expired')
          return
        }

        const { tournament: t, player } = result

        // Step 3: Populate stores
        setTournament(t)
        setCurrentPlayer(player)

        // Fetch full state (players, teams, votes)
        try {
          const lobbyState = await fetchLobbyState(t.id)
          setPlayers(lobbyState.players)
          setTeams(lobbyState.teams)
          setVotes(lobbyState.votes)
        } catch (err) {
          console.error('Failed to fetch lobby state on reconnect:', err)
        }

        // Step 4: Set up realtime subscription
        unsubRef.current = subscribeTournament(t.id)

        // Step 5: Navigate to correct page based on tournament status
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

    // Cleanup subscription on unmount
    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
    }
  }, []) // Empty deps — run once on mount

  return status
}

/**
 * Navigate to the correct page based on tournament status.
 * This is the single source of truth for status → URL mapping.
 */
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
    case 'team_select':
      targetPath = `/team-select/${rc}`
      break
    case 'picking':
      targetPath = `/game/${rc}/pick`
      break
    case 'playing':
      // For playing status, we'd need the current game ID
      // If we're already on a play page, stay there
      if (currentPath.includes('/play/')) return
      targetPath = `/game/${rc}/pick`
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

  // Only navigate if we're not already on the right page
  if (!currentPath.startsWith(targetPath.split('/:')[0]) && currentPath !== targetPath) {
    navigate(targetPath)
  }
}
