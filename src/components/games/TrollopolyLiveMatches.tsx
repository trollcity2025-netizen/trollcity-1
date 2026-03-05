// TrollopolyLiveMatches.tsx - Live Match Directory

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LiveTrollopolyMatch } from '@/lib/game/types/TrollopolyTypes';
import { Eye, Users, Play, Radio } from 'lucide-react';

interface TrollopolyLiveMatchesProps {
  onWatchMatch: (matchId: string) => void;
  onJoinMatch: (matchId: string) => void;
}

export const TrollopolyLiveMatches: React.FC<TrollopolyLiveMatchesProps> = ({
  onWatchMatch,
  onJoinMatch,
}) => {
  const [matches, setMatches] = useState<LiveTrollopolyMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches();

    // Subscribe to match updates
    const channel = supabase
      .channel('trollopoly_matches')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'internet_game_matches',
        filter: 'game_type=eq.trollopoly'
      }, () => {
        fetchMatches();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('internet_game_matches')
        .select(`
          id,
          status,
          game_state,
          player_ids,
          player_usernames,
          spectator_count,
          created_at
        `)
        .eq('game_type', 'trollopoly')
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedMatches: LiveTrollopolyMatch[] = (data || []).map((match: any) => ({
        id: match.id,
        status: match.status,
        players: match.player_ids?.map((id: string, idx: number) => ({
          id,
          username: match.player_usernames?.[idx] || 'Unknown',
        })) || [],
        spectatorCount: match.spectator_count || 0,
        maxPlayers: 4,
        currentPlayerUsername: match.game_state?.players?.[match.game_state?.currentPlayerIndex]?.username,
        startedAt: match.created_at,
        canJoin: match.status === 'waiting' && (match.player_ids?.length || 0) < 4,
      }));

      setMatches(formattedMatches);
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
          <p className="text-slate-400">Loading matches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl shadow-lg shadow-purple-500/20 mb-4">
            <Radio className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Live Trollopoly Matches
          </h1>
          <p className="text-slate-400">
            {matches.length} active {matches.length === 1 ? 'match' : 'matches'}
          </p>
        </div>

        {/* Matches Grid */}
        {matches.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500 text-lg mb-4">No active matches right now</p>
            <a
              href="/trollopoly/queue"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl"
            >
              <Play size={20} />
              Join Queue
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((match) => (
              <div
                key={match.id}
                className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden hover:border-purple-500/50 transition-all"
              >
                {/* Match Header */}
                <div className="p-4 border-b border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        match.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                      }`} />
                      <span className="text-white font-medium capitalize">
                        {match.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Eye size={16} />
                      <span className="text-sm">{match.spectatorCount}</span>
                    </div>
                  </div>
                  
                  {match.status === 'active' && match.currentPlayerUsername && (
                    <p className="text-slate-400 text-sm">
                      Current turn: <span className="text-white">{match.currentPlayerUsername}</span>
                    </p>
                  )}
                </div>

                {/* Players */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={18} className="text-slate-400" />
                    <span className="text-slate-400 text-sm">
                      {match.players.length} / {match.maxPlayers} players
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {match.players.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                          {player.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-white text-sm">{player.username}</span>
                      </div>
                    ))}
                    
                    {/* Empty slots */}
                    {match.canJoin && Array.from({ length: match.maxPlayers - match.players.length }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="flex items-center gap-2 p-2 border-2 border-dashed border-slate-600 rounded-lg"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                          <span className="text-slate-500 text-sm">+</span>
                        </div>
                        <span className="text-slate-500 text-sm">Open slot</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-slate-700 space-y-2">
                  <button
                    onClick={() => onWatchMatch(match.id)}
                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye size={18} />
                    Watch Match
                  </button>
                  
                  {match.canJoin && (
                    <button
                      onClick={() => onJoinMatch(match.id)}
                      className="w-full py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Play size={18} />
                      Join Match
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Queue CTA */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-4 p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
            <div>
              <h3 className="text-white font-bold mb-1">Want to play?</h3>
              <p className="text-slate-400 text-sm">Join the queue to find a match</p>
            </div>
            <a
              href="/trollopoly/queue"
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all"
            >
              Join Queue
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrollopolyLiveMatches;
