import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { Trophy } from 'lucide-react';

interface BroadcastLevelBarProps {
  broadcasterId: string;
  className?: string;
}

export default function BroadcastLevelBar({ broadcasterId, className }: BroadcastLevelBarProps) {
  const [stats, setStats] = useState<{ total_gifts_all_time: number } | null>(null);

  useEffect(() => {
    if (!broadcasterId) return;

    // Fetch initial stats
    const fetchStats = async () => {
      const { data } = await supabase
        .from('broadcaster_stats')
        .select('total_gifts_all_time')
        .eq('user_id', broadcasterId)
        .single();
      
      if (data) setStats(data);
    };

    fetchStats();

    // Subscribe to changes
    const channel = supabase
      .channel(`broadcast_level_${broadcasterId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'broadcaster_stats',
          filter: `user_id=eq.${broadcasterId}`
        },
        (payload) => {
          if (payload.new) {
            setStats(payload.new as any);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [broadcasterId]);

  if (!stats) return null;

  const totalCoins = stats.total_gifts_all_time || 0;
  const level = Math.floor(totalCoins / 1000) + 1;
  const progress = (totalCoins % 1000) / 1000 * 100;

  return (
    <div className={cn("flex flex-col gap-0.5 w-32", className)}>
      <div className="flex items-center justify-between text-[10px] font-bold text-white px-1 shadow-black/50 drop-shadow-md">
        <div className="flex items-center gap-1 text-yellow-400">
          <Trophy size={10} />
          <span>Lvl {level}</span>
        </div>
        <span className="text-white/80">{Math.floor(progress)}%</span>
      </div>
      
      <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10 backdrop-blur-sm relative">
        <div 
          className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(250,204,21,0.5)]"
          style={{ width: `${progress}%` }}
        />
        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full -translate-x-full animate-[shimmer_2s_infinite]" />
      </div>
    </div>
  );
}
