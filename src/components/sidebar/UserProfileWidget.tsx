import React from 'react';
import { useAuthStore } from '@/lib/store';
import { useXPStore } from '@/stores/useXPStore';
import { useCoins } from '@/lib/hooks/useCoins';
import { Crown, Coins } from 'lucide-react';

const UserProfileWidget = () => {
  const { profile } = useAuthStore();
  const { level, progress } = useXPStore();
    const { troll_coins, crowns, loading: coinsLoading } = useCoins();

  if (!profile) {
    return null; // Or a loading skeleton
  }

  return (
    <div className="bg-slate-900/50 rounded-xl p-3 border border-white/10">
      <div className="flex items-center gap-3">
        <img src={profile.avatar_url} alt={profile.username} className="w-10 h-10 rounded-full border-2 border-white/10" />
        <div>
          <h3 className="font-bold text-base text-white">{profile.username}</h3>
          <p className="text-xs text-slate-400 capitalize bg-slate-800 px-2 py-0.5 rounded-md inline-block">{profile.role || 'User'}</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
          <span>Level Progress</span>
          <span>{level} → {level + 1}</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div className="bg-green-600 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
        <p className="text-center text-xs text-slate-500 mt-1">{progress.toFixed(0)}% to next level</p>
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
