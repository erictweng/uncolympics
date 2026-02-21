import { supabase } from './supabase';
import { appNavigate } from './navigation';
import useGameStore from '../stores/gameStore';
import useLobbyStore from '../stores/lobbyStore';
import type { Tournament, Player, Team, LeaderVote, Game, PlayerStat, GameResult, Title } from '../types';

export function subscribeTournament(tournamentId: string) {
  const channel = supabase.channel(`tournament:${tournamentId}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'players', 
      filter: `tournament_id=eq.${tournamentId}` 
    }, (payload) => {
      const store = useGameStore.getState();
      
      if (payload.eventType === 'INSERT') {
        // Add new player to store
        store.addPlayer(payload.new as Player);
      } else if (payload.eventType === 'UPDATE') {
        // Update existing player in store (team change, leader change)
        store.updatePlayer(payload.new as Player);
      } else if (payload.eventType === 'DELETE') {
        // Remove player from store
        store.removePlayer(payload.old.id);
      }
    })
    .on('postgres_changes', {
      event: '*', 
      schema: 'public', 
      table: 'teams',
      filter: `tournament_id=eq.${tournamentId}`
    }, (payload) => {
      const store = useGameStore.getState();
      
      if (payload.eventType === 'INSERT') {
        // Add new team to store
        store.addTeam(payload.new as Team);
      } else if (payload.eventType === 'UPDATE') {
        // Update existing team in store
        store.updateTeam(payload.new as Team);
      } else if (payload.eventType === 'DELETE') {
        // Remove team from store
        store.removeTeam(payload.old.id);
      }
    })
    .on('postgres_changes', {
      event: '*', 
      schema: 'public', 
      table: 'tournaments',
      filter: `id=eq.${tournamentId}`
    }, (payload) => {
      const store = useGameStore.getState();
      
      if (payload.eventType === 'UPDATE') {
        // Handle status changes (lobby→picking) and other tournament updates
        const tournament = payload.new as Tournament;
        console.log('[SYNC] Tournament UPDATE received:', tournament.status, tournament.room_code);
        
        store.setTournament(tournament);
        
        // Also update lobbyStore directly
        console.log('[SYNC] Updating lobbyStore with tournament:', tournament.status);
        useLobbyStore.getState().setTournament(tournament);

        // Handle navigation based on tournament status changes
        if (tournament.status === 'team_select') {
          const currentUrl = window.location.pathname;
          console.log('[SYNC] Tournament status is team_select, current URL:', currentUrl);
          if (!currentUrl.includes('/team-select')) {
            console.log('[SYNC] Navigating to team-select:', `/team-select/${tournament.room_code}`);
            appNavigate(`/team-select/${tournament.room_code}`);
          } else {
            console.log('[SYNC] Already on team-select page, skipping navigation');
          }
        } else if (tournament.status === 'picking') {
          // Navigate to pick page
          const currentUrl = window.location.pathname;
          if (!currentUrl.includes('/pick')) {
            appNavigate(`/game/${tournament.room_code}/pick`);
          }
        } else if (tournament.status === 'completed') {
          // Navigate to ceremony
          const currentUrl = window.location.pathname;
          if (!currentUrl.includes('/ceremony')) {
            appNavigate(`/ceremony/${tournament.room_code}`);
          }
        }
      }
    })
    .on('postgres_changes', {
      event: '*', 
      schema: 'public', 
      table: 'leader_votes'
    }, (payload) => {
      const store = useGameStore.getState();
      const teamIds = new Set(store.teams.map(t => t.id));
      
      // Filter: only process votes for teams in this tournament
      const vote = (payload.eventType === 'DELETE' ? payload.old : payload.new) as LeaderVote;
      if (!teamIds.has(vote.team_id)) return;
      
      if (payload.eventType === 'INSERT') {
        store.addVote(payload.new as LeaderVote);
      } else if (payload.eventType === 'UPDATE') {
        store.updateVote(payload.new as LeaderVote);
      } else if (payload.eventType === 'DELETE') {
        store.removeVote(payload.old.id);
      }
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public', 
      table: 'games',
      filter: `tournament_id=eq.${tournamentId}`
    }, (payload) => {
      const store = useGameStore.getState();
      // When a new game is picked, add it to the store
      store.addPickedGame(payload.new as Game);
    })
    .subscribe((status) => {
      const store = useGameStore.getState();
      if (status === 'SUBSCRIBED') {
        store.setConnectionStatus('connected');
      } else if (status === 'CLOSED') {
        store.setConnectionStatus('disconnected');
      } else if (status === 'CHANNEL_ERROR') {
        store.setConnectionStatus('reconnecting');
      }
    });
    
  return () => {
    supabase.removeChannel(channel);
  };
}

// Sprint 4: Game-specific subscription
export function subscribeGame(gameId: string, tournamentId: string) {
  const channel = supabase.channel(`game:${gameId}`)
    .on('postgres_changes', {
      event: '*', 
      schema: 'public', 
      table: 'player_stats', 
      filter: `game_id=eq.${gameId}`
    }, (payload) => {
      const store = useGameStore.getState();
      
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const stat = payload.new as PlayerStat;
        store.addGameStat(stat);
        
        // Find player name for live feed
        const player = store.players.find(p => p.id === stat.player_id);
        if (player) {
          store.addFeedItem({
            playerName: player.name,
            statKey: stat.stat_key,
            statValue: stat.stat_value,
            statLabel: stat.stat_key, // Could be enhanced to map to human-readable labels
            timestamp: new Date().toISOString()
          });
        }
      }
    })
    .on('postgres_changes', {
      event: '*', 
      schema: 'public', 
      table: 'game_results', 
      filter: `game_id=eq.${gameId}`
    }, (payload) => {
      const store = useGameStore.getState();
      
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        store.setCurrentGameResult(payload.new as GameResult);
      }
    })
    .on('postgres_changes', {
      event: '*', 
      schema: 'public', 
      table: 'games', 
      filter: `id=eq.${gameId}`
    }, (payload) => {
      const store = useGameStore.getState();
      
      if (payload.eventType === 'UPDATE') {
        const game = payload.new as Game;
        store.setGame(game);
        
        // Navigate to title reveal when status changes to 'titles'
        if (game.status === 'titles') {
          const tournament = store.tournament;
          if (tournament) {
            appNavigate(`/game/${tournament.room_code}/reveal/${gameId}`);
          }
        }
      }
    })
    .on('postgres_changes', {
      event: 'INSERT', 
      schema: 'public', 
      table: 'titles',
      filter: `tournament_id=eq.${tournamentId}`
    }, (payload) => {
      const store = useGameStore.getState();
      const title = payload.new as Title;
      
      // Check if this title belongs to the current game
      if (title.game_id === gameId) {
        // Find player name for the title
        const player = store.players.find(p => p.id === title.player_id);
        const titleWithPlayerName = {
          ...title,
          playerName: player?.name || 'Unknown Player'
        };
        
        // Add to gameTitles array
        const updatedTitles = [...store.gameTitles, titleWithPlayerName];
        store.setGameTitles(updatedTitles);
      }
    })
    .on('postgres_changes', {
      event: 'UPDATE', 
      schema: 'public', 
      table: 'teams',
      filter: `tournament_id=eq.${tournamentId}`
    }, (payload) => {
      const store = useGameStore.getState();
      const updatedTeam = payload.new as Team;
      
      // Update team in store (this will update total_points)
      store.updateTeam(updatedTeam);
    })
    .subscribe();
    
  return () => supabase.removeChannel(channel);
}