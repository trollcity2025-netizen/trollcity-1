// TrollopolyQueue.tsx - Match Queue System

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { Users, Clock, Play, Loader2 } from 'lucide-react';

interface QueueState {
  id: string;
  players: { userId: string; username: string; avatarUrl?: string; joinedAt: string }[];
  status: 'waiting' | 'countdown' | 'starting';
  countdownRemaining: number;
  matchId?: string;
}

interface TrollopolyQueueProps {
  onMatchStart: (matchId: string) => void;
}

export const TrollopolyQueue: React.FC<TrollopolyQueueProps> = ({ onMatchStart }) => {
  const { user, profile } = useAuthStore();
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [inQueue, setInQueue] = useState(false);

  // Subscribe to queue updates
  useEffect(() => {
    if (!user) return;

    // Fetch initial queue state
    fetchQueueState();

    // Subscribe to queue changes
    const channel = supabase
      .channel('trollopoly_queue')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trollopoly_queue'
      }, (payload) => {
        if (payload.new) {
          const newState = payload.new as any;
          setQueueState({
            id: newState.id,
            players: newState.players || [],
            status: newState.status,
            countdownRemaining: newState.countdown_remaining || 0,
            matchId: newState.match_id,
          });

          // Check if match started
          if (newState.status === 'starting' && newState.match_id) {
            const isInMatch = newState.players.some((p: any) => p.userId === user.id);
            if (isInMatch) {
              onMatchStart(newState.match_id);
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Check if user is in queue
  useEffect(() => {
    if (queueState && user) {
      const isIn = queueState.players.some(p => p.userId === user.id);
      setInQueue(isIn);
    }
  }, [queueState, user]);

  const fetchQueueState = async () => {
    const { data, error } = await supabase
      .from('trollopoly_queue')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setQueueState({
        id: data.id,
        players: data.players || [],
        status: data.status,
        countdownRemaining: data.countdown_remaining || 0,
        matchId: data.match_id,
      });
    }
  };

  const handleJoinQueue = async () => {
    if (!user || !profile) {
      toast.error('Please log in to join');
      return;
    }

    setIsJoining(true);
    try {
      const { error } = await supabase.rpc('join_trollopoly_queue', {
        p_user_id: user.id,
        p_username: profile.username,
        p_avatar_url: profile.avatar_url
      });

      if (error) throw error;

      toast.success('Joined queue! Waiting for players...');
    } catch (err: any) {
      toast.error(err.message || 'Failed to join queue');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (!user) return;

    try {
      await supabase.rpc('leave_trollopoly_queue', {
        p_user_id: user.id
      });
      toast.info('Left queue');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getStatusMessage = () => {
    if (!queueState) return 'Click to join a match';
    
    const playerCount = queueState.players.length;
    
    if (queueState.status === 'countdown') {
      return `Match starting in ${queueState.countdownRemaining}s...`;
    }
    
    if (playerCount === 0) return 'Waiting for players...';
    if (playerCount === 1) return '1 player waiting...';
    if (playerCount === 2) return '2 players ready! Waiting for more...';
    if (playerCount === 3) return '3 players! Almost ready...';
    return '4 players ready! Starting...';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-lg shadow-green-500/20 mb-4">
            <Users className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Trollopoly Queue</h1>
          <p className="text-slate-400">Join a 3D board game match</p>
        </div>

        {/* Queue Card */}
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 mb-6">
          {/* Status */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${queueState?.status === 'countdown' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
              <span className="text-white font-medium">{getStatusMessage()}</span>
            </div>
            {queueState?.status === 'countdown' && (
              <div className="flex items-center gap-1 text-yellow-400">
                <Clock size={16} />
                <span className="font-bold">{queueState.countdownRemaining}s</span>
              </div>
            )}
          </div>

          {/* Players in Queue */}
          <div className="space-y-3 mb-6">
            {queueState?.players.map((player, index) => (
              <div
                key={player.userId}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  player.userId === user?.id 
                    ? 'bg-green-500/20 border border-green-500/30' 
                    : 'bg-slate-700/50'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {player.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{player.username}</p>
                  <p className="text-slate-400 text-sm">Player {index + 1}</p>
                </div>
                {player.userId === user?.id && (
                  <span className="text-green-400 text-sm">You</span>
                )}
              </div>
            ))}
            
            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 4 - (queueState?.players.length || 0)) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-slate-600"
              >
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                  <span className="text-slate-500">?</span>
                </div>
                <p className="text-slate-500">Waiting for player...</p>
              </div>
            ))}
          </div>

          {/* Queue Rules */}
          <div className="bg-slate-700/30 rounded-xl p-4 mb-6">
            <h3 className="text-white font-medium mb-2 flex items-center gap-2">
              <Play size={16} className="text-green-400" />
              How it works
            </h3>
            <ul className="text-slate-400 text-sm space-y-1">
              <li>• Minimum 2 players to start</li>
              <li>• 15 second countdown at 2+ players</li>
              <li>• Maximum 4 players per match</li>
              <li>• Game auto-starts when full</li>
            </ul>
          </div>

          {/* Action Button */}
          {inQueue ? (
            <button
              onClick={handleLeaveQueue}
              className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              Leave Queue
            </button>
          ) : (
            <button
              onClick={handleJoinQueue}
              disabled={isJoining || !user}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isJoining ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Joining...
                </>
              ) : (
                <>
                  <Play size={20} />
                  Join Trollopoly Match
                </>
              )}
            </button>
          )}
        </div>

        {/* Live Matches Link */}
        <div className="text-center">
          <a
            href="/trollopoly/live"
            className="text-slate-400 hover:text-white transition-colors"
          >
            View Live Matches →
          </a>
        </div>
      </div>
    </div>
  );
};

export default TrollopolyQueue;
