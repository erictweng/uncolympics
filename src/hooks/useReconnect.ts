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
      // Step 1: If we already have state (normal nav or persisted from localStorage),
      // set up sync and always fetch fresh data for non-persisted fields
      if (tournament?.id && currentPlayer?.id) {
        // Set up realtime if not already
        if (!unsubRef.current) {
          unsubRef.current = subscribeTournament(tournament.id)
        }

        // Always fetch full lobby state — players/teams/votes are never persisted
        try {
          const lobbyState = await fetchLobbyState(tournament.id)
          setPlayers(lobbyState.players)
          setTeams(lobbyState.teams)
          setVotes(lobbyState.votes)
        } catch (err) {
          console.error('Failed to fetch lobby state on fast path:', err)
          // Don't show expired — we still have persisted state, realtime will catch up
        }

        // Validate that the tournament is still active by checking Supabase
        // (persisted state may be stale if tournament was completed/deleted)
        const deviceId = getOrCreateDeviceId()
        const result = await reconnectPlayer(deviceId)
        if (!result) {
          // Tournament is actually gone — NOW show expired
          setStatus('expired')
          return
        }

        // Update tournament in case status changed since persist
        setTournament(result.tournament)
        setCurrentPlayer(result.player)

        // Still check if we need to redirect (status may have changed)
        if (shouldNavigate) {
          navigateToStatus(result.tournament, navigate)
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

    // Re-fetch state when tab becomes visible (handles missed realtime events)
    const handleVisibilityChange = async () => {
      if (document.hidden) return
      
      const deviceId = getOrCreateDeviceId()
      try {
        const result = await reconnectPlayer(deviceId)
        if (!result) return // Tournament gone — don't force expired, let user stay
        
        const { setTournament: setT, setPlayers: setP, setTeams: setTe, setVotes: setV } = useLobbyStore.getState()
        setT(result.tournament)

        // Fetch full state to catch any missed updates
        try {
          const lobbyState = await fetchLobbyState(result.tournament.id)
          setP(lobbyState.players)
          setTe(lobbyState.teams)
          setV(lobbyState.votes)
        } catch (err) {
          console.error('Failed to refresh lobby state on tab focus:', err)
        }

        // Navigate if tournament status changed while away
        if (shouldNavigate) {
          navigateToStatus(result.tournament, navigate)
        }
      } catch (err) {
        console.error('Visibility change reconnect failed:', err)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup subscription on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
      hasRun.current = false
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
    case 'game_setup':
      targetPath = `/game-setup/${rc}`
      break
    case 'drafting':
      targetPath = `/draft/${rc}`
      break
    case 'playing':
      // Phase 1: go to game-hub for predetermined game flow
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

  // Only navigate if we're not already on the right page
  // Strip BASE_URL prefix for comparison (handles GitHub Pages /uncolympics/ prefix)
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const normalizedPath = base && currentPath.startsWith(base) 
    ? currentPath.slice(base.length) || '/' 
    : currentPath

  if (!normalizedPath.startsWith(targetPath) && normalizedPath !== targetPath) {
    navigate(targetPath)
  }
}
