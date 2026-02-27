import { supabase } from './supabase';
import { appNavigate } from './navigation';
import useLobbyStore from '../stores/lobbyStore';
import useGamePlayStore from '../stores/gamePlayStore';
import useTitleStore from '../stores/titleStore';
import type { Tournament, Player, Team, LeaderVote, Game, PlayerStat, GameResult, Title } from '../types';

export function subscribeTournament(tournamentId: string) {
  const channel = supabase.channel(`tournament:${tournamentId}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'players', 
      filter: `tournament_id=eq.${tournamentId}` 
    }, (payload) => {
      const lobby = useLobbyStore.getState();
      
      if (payload.eventType === 'INSERT') {
        lobby.addPlayer(payload.new as Player);
      } else if (payload.eventType === 'UPDATE') {
        lobby.updatePlayer(payload.new as Player);
      } else if (payload.eventType === 'DELETE') {
        lobby.removePlayer(payload.old.id);
      }
    })
    .on('postgres_changes', {
      event: '*', 
      schema: 'public', 
      table: 'teams',
      filter: `tournament_id=eq.${tournamentId}`
    }, (payload) => {
      const lobby = useLobbyStore.getState();
      
      if (payload.eventType === 'INSERT') {
        lobby.addTeam(payload.new as Team);
      } else if (payload.eventType === 'UPDATE') {
        lobby.updateTeam(payload.new as Team);
      } else if (payload.eventType === 'DELETE') {
        lobby.removeTeam(payload.old.id);
      }
    })
    .on('postgres_changes', {
      event: '*', 
      schema: 'public', 
      table: 'tournaments',
      filter: `id=eq.${tournamentId}`
    }, (payload) => {
      if (payload.eventType === 'UPDATE') {
        const tournament = payload.new as Tournament;
        useLobbyStore.getState().setTournament(tournament);

        // Handle navigation based on tournament status changes
        const currentUrl = window.location.pathname;
        const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
        const normalizedUrl = base && currentUrl.startsWith(base)
          ? currentUrl.slice(base.length) || '/'
          : currentUrl;
        if (tournament.status === 'game_setup') {
          if (!normalizedUrl.includes('/game-setup')) {
            appNavigate(`/game-setup/${tournament.room_code}`);
          }
        } else if (tournament.status === 'team_select') {
          if (!normalizedUrl.includes('/team-select')) {
            // Trigger lobby exit animation before navigating
            const lobbyExitEvent = new CustomEvent('lobby-exit');
            window.dispatchEvent(lobbyExitEvent);
            const playerCount = useLobbyStore.getState().players.length;
            const exitDelay = playerCount * 100 + 400;
            setTimeout(() => {
              appNavigate(`/team-select/${tournament.room_code}`);
            }, exitDelay);
          }
        } else if (tournament.status === 'shuffling') {
          // Stay on team-select page — the shuffle animation plays there
        } else if (tournament.status === 'picking') {
          if (!normalizedUrl.includes('/pick') && !normalizedUrl.includes('/team-select')) {
            appNavigate(`/game/${tournament.room_code}/pick`);
          }
        } else if (tournament.status === 'playing') {
          if (!normalizedUrl.includes('/game-hub') && !normalizedUrl.includes('/play/')) {
            appNavigate(`/game-hub/${tournament.room_code}`);
          }
        } else if (tournament.status === 'scoring') {
          if (!normalizedUrl.includes('/scoreboard')) {
            appNavigate(`/scoreboard/${tournament.room_code}`);
          }
        } else if (tournament.status === 'completed') {
          if (!normalizedUrl.includes('/ceremony')) {
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
      const lobby = useLobbyStore.getState();
      const teamIds = new Set(lobby.teams.map(t => t.id));
      
      // Filter: only process votes for teams in this tournament
      const vote = (payload.eventType === 'DELETE' ? payload.old : payload.new) as LeaderVote;
      if (!teamIds.has(vote.team_id)) return;
      
      if (payload.eventType === 'INSERT') {
        lobby.addVote(payload.new as LeaderVote);
      } else if (payload.eventType === 'UPDATE') {
        lobby.updateVote(payload.new as LeaderVote);
      } else if (payload.eventType === 'DELETE') {
        lobby.removeVote(payload.old.id);
      }
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public', 
      table: 'games',
      filter: `tournament_id=eq.${tournamentId}`
    }, (payload) => {
      useGamePlayStore.getState().addPickedGame(payload.new as Game);
    })
    .subscribe((status) => {
      const connStatus = status === 'SUBSCRIBED' ? 'connected' 
        : status === 'CLOSED' ? 'disconnected' 
        : status === 'CHANNEL_ERROR' ? 'reconnecting' 
        : null;
      if (connStatus) {
        useLobbyStore.getState().setConnectionStatus(connStatus);
      }
    });
    
  return () => {
    supabase.removeChannel(channel);
  };
}

// Game-specific subscription
export function subscribeGame(gameId: string, tournamentId: string) {
  const channel = supabase.channel(`game:${gameId}`)
    .on('postgres_changes', {
      event: '*', 
      schema: 'public', 
      table: 'player_stats', 
      filter: `game_id=eq.${gameId}`
    }, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const stat = payload.new as PlayerStat;
        const gameplay = useGamePlayStore.getState();
        gameplay.addGameStat(stat);
        
        const player = useLobbyStore.getState().players.find(p => p.id === stat.player_id);
        if (player) {
          gameplay.addFeedItem({
            playerName: player.name,
            statKey: stat.stat_key,
            statValue: stat.stat_value,
            statLabel: stat.stat_key,
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
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        useGamePlayStore.getState().setCurrentGameResult(payload.new as GameResult);
      }
    })
    .on('postgres_changes', {
      event: '*', 
      schema: 'public', 
      table: 'games', 
      filter: `id=eq.${gameId}`
    }, (payload) => {
      if (payload.eventType === 'UPDATE') {
        const game = payload.new as Game;
        useGamePlayStore.getState().setGame(game);
        
        if (game.status === 'titles') {
          const tournament = useLobbyStore.getState().tournament;
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
      const title = payload.new as Title;
      
      if (title.game_id === gameId) {
        const player = useLobbyStore.getState().players.find(p => p.id === title.player_id);
        const titleStore = useTitleStore.getState();
        titleStore.setGameTitles([...titleStore.gameTitles, {
          ...title,
          playerName: player?.name || 'Unknown Player'
        }]);
      }
    })
    .on('postgres_changes', {
      event: 'UPDATE', 
      schema: 'public', 
      table: 'teams',
      filter: `tournament_id=eq.${tournamentId}`
    }, (payload) => {
      useLobbyStore.getState().updateTeam(payload.new as Team);
    })
    .subscribe((status) => {
      const connStatus = status === 'SUBSCRIBED' ? 'connected' 
        : status === 'CLOSED' ? 'disconnected' 
        : status === 'CHANNEL_ERROR' ? 'reconnecting' 
        : null;
      if (connStatus) {
        useLobbyStore.getState().setConnectionStatus(connStatus);
        useGamePlayStore.getState().setConnectionStatus(connStatus);
      }
    });
    
  return () => supabase.removeChannel(channel);
}
