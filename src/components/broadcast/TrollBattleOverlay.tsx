import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { Clock } from 'lucide-react';

interface BattlePlayer {
  id: string;
  username: string;
  avatar_url: string | null;
  score: number;
}

interface TrollBattleOverlayProps {
  battleId: string;
  broadcasterId: string; // The ID of the broadcaster whose stream this is
  initialBattleData?: any;
  onBattleEnd?: (winnerId: string) => void;
}

const TrollBattleOverlay: React.FC<TrollBattleOverlayProps> = ({ 
  battleId, 
  broadcasterId,
  initialBattleData,
  onBattleEnd 
}) => {
  const { user } = useAuthStore();
  const [battle, setBattle] = useState<any>(initialBattleData);
  const [player1, setPlayer1] = useState<BattlePlayer | null>(null);
  const [player2, setPlayer2] = useState<BattlePlayer | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('00:00');
  const [progress, setProgress] = useState(50);
  const [loading, setLoading] = useState(true);

  // Fetch battle details and profiles
  useEffect(() => {
    const fetchBattleData = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('officer-actions', {
          body: {
            action: 'get_battle',
            battleId
          }
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to load battle');

        setBattle(data.battle);
        setPlayer1(data.player1);
        setPlayer2(data.player2);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load battle data:', err);
      }
    };

    fetchBattleData();
  }, [battleId]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`battle-${battleId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'troll_battles',
          filter: `id=eq.${battleId}`
        },
        (payload) => {
          const newBattle = payload.new;
          setBattle(newBattle);
          
          setPlayer1(prev => prev ? ({ ...prev, score: newBattle.host_score }) : null);
          setPlayer2(prev => prev ? ({ ...prev, score: newBattle.challenger_score }) : null);

          if (newBattle.status === 'completed' && onBattleEnd) {
             onBattleEnd(newBattle.winner_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [battleId, onBattleEnd]);

  // Timer logic
  useEffect(() => {
    if (!battle?.end_time) return;

    const interval = setInterval(() => {
      const end = new Date(battle.end_time).getTime();
      const now = new Date().getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('00:00');
        clearInterval(interval);
        
        if (battle.status === 'active' && user?.id === broadcasterId) {
             supabase.functions.invoke('officer-actions', {
                 body: { action: 'finalize_troll_battle', battleId }
             }).then(({ error }) => {
                 if (error) console.error('Finalize battle error', error);
             });
        }
        return;
      }

      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [battle?.end_time, battle?.status, battleId, broadcasterId, user?.id]);

  // Progress bar calculation
  useEffect(() => {
    if (!player1 || !player2) return;
    const total = player1.score + player2.score;
    if (total === 0) {
      setProgress(50);
    } else {
      // Calculate percentage for Player 1
      const p1Pct = (player1.score / total) * 100;
      setProgress(p1Pct);
    }
  }, [player1, player2]);

  if (loading || !player1 || !player2) return null;

  return (
    <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-[90%] max-w-2xl z-40 pointer-events-none">
      {/* Timer & VS Badge */}
      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
         <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
            <Clock className="w-3 h-3 text-yellow-400" />
            <span className="font-mono font-bold text-yellow-400 text-sm">{timeLeft}</span>
         </div>
      </div>

      {/* Main Bar Container */}
      <div className="relative h-12 bg-black/40 backdrop-blur-sm rounded-full border-2 border-white/10 overflow-hidden shadow-2xl flex items-center">
        
        {/* Progress Fill (Player 1 is Left/Blue, Player 2 is Right/Red) */}
        <div 
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 ease-out flex items-center justify-end pr-2"
            style={{ width: `${progress}%` }}
        >
             {progress > 10 && <div className="h-full w-2 bg-white/20 skew-x-12 animate-shimmer" />}
        </div>
        <div 
            className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-red-600 to-pink-500 transition-all duration-500 ease-out"
            style={{ width: `${100 - progress}%` }}
        />

        {/* Center Divider/VS */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-10 h-10 bg-[#0c0a16] rounded-full border-2 border-white/20 flex items-center justify-center shadow-lg">
                <span className="font-black italic text-white text-xs">VS</span>
            </div>
        </div>

        {/* Player 1 Info (Left) */}
        <div className="absolute left-2 flex items-center gap-2 z-10">
            <div className="relative">
                <img 
                    src={player1.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=p1'} 
                    alt={player1.username}
                    className="w-8 h-8 rounded-full border-2 border-cyan-400" 
                />
                <div className="absolute -bottom-1 -right-1 bg-blue-600 text-[9px] px-1 rounded text-white font-bold">
                    P1
                </div>
            </div>
            <div className="flex flex-col">
                <span className="text-xs font-bold text-white drop-shadow-md truncate max-w-[80px]">{player1.username}</span>
                <span className="text-sm font-black text-cyan-300 drop-shadow-lg tabular-nums">{player1.score.toLocaleString()}</span>
            </div>
        </div>

        {/* Player 2 Info (Right) */}
        <div className="absolute right-2 flex items-center gap-2 flex-row-reverse z-10">
             <div className="relative">
                <img 
                    src={player2.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=p2'} 
                    alt={player2.username}
                    className="w-8 h-8 rounded-full border-2 border-pink-500" 
                />
                <div className="absolute -bottom-1 -left-1 bg-red-600 text-[9px] px-1 rounded text-white font-bold">
                    P2
                </div>
            </div>
            <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-white drop-shadow-md truncate max-w-[80px]">{player2.username}</span>
                <span className="text-sm font-black text-pink-300 drop-shadow-lg tabular-nums">{player2.score.toLocaleString()}</span>
            </div>
        </div>

      </div>

      {/* Dynamic Status Text */}
      <div className="absolute -bottom-6 left-0 right-0 text-center">
         {battle.status === 'active' && (
             <span className="text-[10px] text-white/60 uppercase tracking-widest font-semibold animate-pulse">
                Battle Active • Send Gifts to Score
             </span>
         )}
         {battle.status === 'completed' && (
             <span className="text-xs text-yellow-400 font-bold uppercase tracking-widest">
                Battle Ended! Winner: {battle.winner_id === player1.id ? player1.username : player2.username}
             </span>
         )}
      </div>
    </div>
  );
};

export default TrollBattleOverlay;
