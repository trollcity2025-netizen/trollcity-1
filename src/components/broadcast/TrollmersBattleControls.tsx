import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Stream } from '../../types/broadcast';
import { Swords, Loader2, Crown, Users, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface OnlineUser {
  id: string;
  username: string;
  avatar_url?: string;
  role?: string;
  stream_id?: string;
}

interface BattleControlsProps {
  currentStream: Stream;
  onBattleAccepted?: () => void;
}

export default function TrollmersBattleControls({ currentStream, onBattleAccepted }: BattleControlsProps) {
  const [loading, setLoading] = useState(false);
  const [battleStatus, setBattleStatus] = useState<'idle' | 'waiting' | 'battling'>('idle');
  const [battleId, setBattleId] = useState<string | null>(null);
  const [opponentInfo, setOpponentInfo] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  // Poll for battle status
  useEffect(() => {
    const checkBattleStatus = async () => {
      const { data, error } = await supabase.rpc('get_battle_status', {
        p_stream_id: currentStream.id
      });
      
      if (error) {
        console.error('Error checking battle status:', error);
        return;
      }
      
      if (data?.in_battle && data?.battle_id) {
        setBattleStatus('battling');
        setBattleId(data.battle_id);
        
        // Fetch opponent info if we don't have it
        if (!opponentInfo && data.opponent_stream_id) {
          const { data: opponentData } = await supabase
            .from('streams')
            .select('id, user_id, title')
            .eq('id', data.opponent_stream_id)
            .single();
            
          if (opponentData) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('username, avatar_url')
              .eq('id', opponentData.user_id)
              .single();
              
            setOpponentInfo({
              ...opponentData,
              ...profile
            });
          }
        }
        
        // Trigger battle mode if not already active
        if (onBattleAccepted && battleStatus !== 'battling') {
          onBattleAccepted();
        }
      } else if (data?.in_queue) {
        setBattleStatus('waiting');
      } else {
        setBattleStatus('idle');
        setBattleId(null);
        setOpponentInfo(null);
      }
    };
    
    // Check immediately and then every 3 seconds
    checkBattleStatus();
    const interval = setInterval(checkBattleStatus, 3000);
    
    return () => clearInterval(interval);
  }, [currentStream.id, battleStatus, onBattleAccepted]);

  // Fetch online users
  useEffect(() => {
    const fetchOnlineUsers = async () => {
      const { data: liveStreams } = await supabase
        .from('streams')
        .select('id, user_id, title, category')
        .eq('status', 'live')
        .eq('category', 'trollmers')
        .neq('user_id', currentStream.user_id);
      
      if (liveStreams && liveStreams.length > 0) {
        const userIds = liveStreams.map(s => s.user_id);
        
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, role')
          .in('id', userIds);
        
        const users: OnlineUser[] = liveStreams.map(stream => {
          const profile = profiles?.find(p => p.id === stream.user_id);
          return {
            id: stream.user_id,
            username: profile?.username || 'Unknown',
            avatar_url: profile?.avatar_url,
            role: profile?.role,
            stream_id: stream.id,
          };
        });
        
        setOnlineUsers(users);
      } else {
        setOnlineUsers([]);
      }
    };
    
    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 10000);
    return () => clearInterval(interval);
  }, [currentStream.user_id]);

  // Start or join battle
  const handleStartBattle = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('start_instant_battle', {
        p_stream_id: currentStream.id,
        p_category: 'trollmers'
      });
      
      if (error) throw error;
      
      if (data?.success) {
        if (data?.status === 'active') {
          toast.success('Battle started! Merging broadcasts...');
          setBattleStatus('battling');
          setBattleId(data.battle_id);
          
          // IMPORTANT: Update the stream to mark it as a battle
          // This triggers the BattleView to render in BroadcastPage
          const { error: updateError } = await supabase
            .from('streams')
            .update({ 
              is_battle: true, 
              battle_id: data.battle_id 
            })
            .eq('id', currentStream.id);
          
          if (updateError) {
            console.error('Failed to update stream battle status:', updateError);
          }
          
          // Also update opponent stream
          if (data.opponent_stream_id) {
            await supabase
              .from('streams')
              .update({ 
                is_battle: true, 
                battle_id: data.battle_id 
              })
              .eq('id', data.opponent_stream_id);
          }
          
          if (onBattleAccepted) onBattleAccepted();
        } else {
          toast.info('Waiting for another broadcaster...');
          setBattleStatus('waiting');
        }
      } else {
        toast.error(data?.error || 'Failed to start battle');
      }
    } catch (e: any) {
      console.error('Battle error:', e);
      toast.error(e.message || 'Failed to start battle');
    } finally {
      setLoading(false);
    }
  };

  // Leave queue or end battle
  const handleStopBattle = async () => {
    if (battleStatus === 'waiting') {
      // Just leave queue
      const { error } = await supabase.rpc('leave_battle_queue', {
        p_stream_id: currentStream.id
      });
      
      if (!error) {
        toast.success('Left queue');
        setBattleStatus('idle');
      }
    } else if (battleStatus === 'battling' && battleId) {
      // End battle with no winner (draw)
      const { data, error } = await supabase.rpc('end_battle_with_rewards', {
        p_battle_id: battleId,
        p_winner_stream_id: null  // No winner = draw
      });
      
      if (!error && data?.success) {
        toast.success('Battle ended');
        setBattleStatus('idle');
        setBattleId(null);
        setOpponentInfo(null);
      }
    }
  };

  // Declare winner and end battle
  const handleEndBattleWithWinner = async (winnerStreamId: string) => {
    if (!battleId) return;
    
    const { data, error } = await supabase.rpc('end_battle_with_rewards', {
      p_battle_id: battleId,
      p_winner_stream_id: winnerStreamId
    });
    
    if (error) {
      toast.error('Failed to end battle');
      return;
    }
    
    if (data?.success) {
      if (data?.crowns_awarded > 0) {
        toast.success(`Battle ended! Winner received ${data.crowns_awarded} crowns!`);
      } else {
        toast.success('Battle ended');
      }
      setBattleStatus('idle');
      setBattleId(null);
      setOpponentInfo(null);
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3 text-amber-500">
        <Swords size={18} />
        <h3 className="font-bold">Trollmers Head to Head</h3>
        <Crown size={14} className="text-yellow-400 animate-pulse" />
      </div>

      {battleStatus === 'idle' && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">
            Battle other Trollmers broadcasters! Winner earns 10 crowns.
          </p>
          
          <button 
            onClick={handleStartBattle}
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                <Swords size={18} />
                START BATTLE
              </>
            )}
          </button>
          
          {onlineUsers.length > 0 && (
            <p className="text-xs text-green-400 text-center">
              {onlineUsers.length} broadcaster{onlineUsers.length !== 1 ? 's' : ''} available
            </p>
          )}
        </div>
      )}

      {battleStatus === 'waiting' && (
        <div className="space-y-3">
          <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
            <p className="text-amber-200 text-sm text-center">
              Waiting for another broadcaster...
            </p>
            <div className="flex justify-center mt-2">
              <Loader2 className="animate-spin text-amber-500" size={20} />
            </div>
          </div>
          
          <button 
            onClick={handleStopBattle}
            className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <LogOut size={16} />
            Cancel
          </button>
        </div>
      )}

      {battleStatus === 'battling' && (
        <div className="space-y-3">
          <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg">
            <p className="text-green-400 font-bold text-center">
              Battle Active!
            </p>
            {opponentInfo && (
              <p className="text-zinc-300 text-xs text-center mt-1">
                vs {opponentInfo.username}
              </p>
            )}
          </div>
          
          {/* End Battle Controls */}
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => handleEndBattleWithWinner(currentStream.id)}
              className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-3 rounded-lg text-xs transition"
            >
              I Won
            </button>
            <button 
              onClick={() => opponentInfo && handleEndBattleWithWinner(opponentInfo.id)}
              className="bg-zinc-600 hover:bg-zinc-500 text-white font-bold py-2 px-3 rounded-lg text-xs transition"
            >
              They Won
            </button>
          </div>
          
          <button 
            onClick={handleStopBattle}
            className="w-full bg-red-900/50 hover:bg-red-800 text-red-200 font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition text-sm"
          >
            <LogOut size={14} />
            End Battle (Draw)
          </button>
        </div>
      )}

      {/* Online Users */}
      <div className="mt-4 pt-3 border-t border-white/10">
        <h4 className="text-zinc-400 font-bold text-xs uppercase mb-2 flex items-center gap-2">
          <Users size={12} className="text-green-500" />
          Online Trollmers ({onlineUsers.length})
        </h4>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {onlineUsers.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-2">
              No other live Trollmers streams
            </p>
          ) : (
            onlineUsers.map((user) => (
              <div 
                key={user.id} 
                className="flex items-center justify-between bg-black/20 p-2 rounded text-xs"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-zinc-300 truncate">{user.username}</span>
                </div>
                {user.role && (
                  <span className="text-[10px] bg-purple-500/20 px-1 py-0.5 rounded text-zinc-400">
                    {user.role}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
