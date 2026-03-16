import React, { useEffect } from 'react';
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
  }, [profile?.id, fetchXP, subscribeToXP, unsubscribe]);

  if (!profile) {
    return null; // Or a loading skeleton
  }

  return (
    <div className="bg-slate-900/50 rounded-xl p-3 border border-white/10">
      <div className="flex items-center gap-3">
        <img src={profile.avatar_url} alt={profile.username} className="w-10 h-10 rounded-full border-2 border-white/10" />
        <div>
          <h3 className="font-bold text-base text-white">{profile.username}</h3>
          <p className="text-xs text-slate-400 capitalize bg-slate-800 px-2 py-0.5 rounded-md inline-block">{getRoleDisplayName(profile.role, profile.is_admin)}</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
          <span className="font-semibold text-green-400">Level {level}</span>
          <span>{level} → {level + 1}</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div className="bg-green-600 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
        <p className="text-center text-xs text-slate-500 mt-1">
          {xpTotal === 0 ? (
            <span className="text-yellow-400">Send gifts to earn XP!</span>
          ) : (
            <span>{xpTotal.toLocaleString()} XP • {xpToNext.toLocaleString()} XP to Level {level + 1}</span>
          )}
        </p>
      </div>

      <div className="mt-3 border-t border-white/10 pt-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-yellow-400">
            <Coins size={14} />
            <span className="font-bold">Coins</span>
          </div>
                    <span className="font-mono text-yellow-400">{coinsLoading ? '...' : (troll_coins ?? 0).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-purple-400">
            <Gem size={14} />
            <span className="font-bold">Trollmonds</span>
          </div>
                    <span className="font-mono text-purple-400">{coinsLoading ? '...' : (displayTrollmonds ?? 0).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Crown size={14} />
            <span className="font-bold">Crowns</span>
          </div>
                    <span className="font-mono text-slate-300">{coinsLoading ? '...' : (crowns ?? 0).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default UserProfileWidget;
