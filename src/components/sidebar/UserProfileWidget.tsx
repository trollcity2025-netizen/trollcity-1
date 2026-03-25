import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import { useXPStore } from '@/stores/useXPStore';
import { useCoins } from '@/lib/hooks/useCoins';
import { getRoleDisplayName } from '@/lib/supabase';
import { Crown, Coins, Gem } from 'lucide-react';

const UserProfileWidget = () => {
  const { profile } = useAuthStore();
  const { level, progress, xpTotal, xpToNext, fetchXP, subscribeToXP, unsubscribe } = useXPStore();
  const { troll_coins, crowns, loading: coinsLoading } = useCoins();
  // Get trollmonds from profile (not returned by useCoins hook)
  const displayTrollmonds = profile?.trollmonds ?? 0;
  const prevXPData = useRef({ level: 0, xpTotal: 0, progress: 0 });

  // Subscribe to XP updates when profile is available
  useEffect(() => {
    if (profile?.id) {
      console.log('[UserProfileWidget] Setting up XP subscription for user:', profile.id);
      
      // Fetch initial XP data
      fetchXP(profile.id);
      
      // Subscribe to realtime updates
      subscribeToXP(profile.id);
      
      // Cleanup subscription on unmount
      return () => {
        console.log('[UserProfileWidget] Cleaning up XP subscription');
        unsubscribe();
      };
    }
  }, [profile?.id]);

  // Force re-render when XP data changes
  useEffect(() => {
    if (prevXPData.current.level !== level || 
        prevXPData.current.xpTotal !== xpTotal || 
        prevXPData.current.progress !== progress) {
      prevXPData.current = { level, xpTotal, progress };
      // Force update by using a state or letting the store trigger re-render
    }
  }, [level, xpTotal, progress]);

  if (!profile) {
    return null; // Or a loading skeleton
  }

  return (
    <div className="bg-slate-900/50 rounded-lg p-2 border border-white/10">
      <div className="flex items-center gap-2">
        <img src={profile.avatar_url} alt={profile.username} className="w-8 h-8 rounded-full border border-white/10" />
        <div className="min-w-0">
          <h3 className="font-bold text-sm text-white truncate">{profile.username}</h3>
          <p className="text-[10px] text-slate-400 capitalize bg-slate-800 px-1.5 py-0.5 rounded inline-block">{getRoleDisplayName(profile.role, profile.is_admin)}</p>
        </div>
      </div>

      <div className="mt-2">
        <div className="flex justify-between items-center text-[10px] text-slate-400 mb-0.5">
          <span className="font-semibold text-green-400">Lvl {level}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5">
          <div className="bg-green-600 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="mt-2 border-t border-white/10 pt-2 space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5 text-yellow-400">
            <Coins size={11} />
            <span className="font-bold">Coins</span>
          </div>
                    <span className="font-mono text-yellow-400">{coinsLoading ? '...' : (troll_coins ?? 0).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5 text-purple-400">
            <Gem size={11} />
            <span className="font-bold">Trollmonds</span>
          </div>
                    <span className="font-mono text-purple-400">{coinsLoading ? '...' : (displayTrollmonds ?? 0).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Crown size={11} />
            <span className="font-bold">Crowns</span>
          </div>
                    <span className="font-mono text-slate-300">{coinsLoading ? '...' : (crowns ?? 0).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default UserProfileWidget;
