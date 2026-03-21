import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useBroadcastLockdown } from '@/hooks/useBroadcastLockdown';
import { Lock, Unlock, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function BroadcastLockdownControl() {
  const { isLocked: locked, loading, toggleLockdown } = useBroadcastLockdown();
  const [updating, setUpdating] = useState(false);

  // The useBroadcastLockdown hook already handles fetching and real-time updates

  const handleToggleLockdown = async () => {
    setUpdating(true);
    const newState = !locked;

    try {
      const success = await toggleLockdown(newState);

      if (!success) throw new Error('Failed to update');

      toast.success(newState ? 'Broadcasting Disabled' : 'Broadcasting Enabled');
    } catch (error) {
      console.error('Error toggling lockdown:', error);
      toast.error('Failed to update lockdown status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 bg-slate-900/50 rounded-xl border border-white/10">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-400">Loading broadcast status...</span>
      </div>
    );
  }

  return (
    <div className={`
      relative overflow-hidden rounded-xl border transition-all duration-300
      ${locked 
        ? 'bg-red-500/10 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]' 
        : 'bg-green-500/10 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
      }
    `}>
      <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${locked ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
            {locked ? (
              <Lock className={`w-6 h-6 ${locked ? 'text-red-400' : 'text-green-400'}`} />
            ) : (
              <Unlock className={`w-6 h-6 ${locked ? 'text-red-400' : 'text-green-400'}`} />
            )}
          </div>
          <div>
            <h3 className={`text-lg font-bold ${locked ? 'text-red-400' : 'text-green-400'}`}>
              Broadcast Lockdown: {locked ? 'ACTIVE' : 'INACTIVE'}
            </h3>
            <p className="text-sm text-slate-400">
              {locked 
                ? 'All broadcasting is disabled. No one can go live.' 
                : 'All users can go live and stream normally.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggleLockdown}
          disabled={updating || loading}
          className={`
            px-6 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all
            ${locked
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
              : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20'
            }
            ${updating ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}
          `}
        >
          {updating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : locked ? (
            <Unlock className="w-4 h-4" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
          {locked ? 'Enable Broadcasting' : 'Disable Broadcasting'}
        </button>
      </div>

      {locked && (
        <div className="px-6 pb-4 flex items-center gap-2 text-xs text-red-300/70">
          <AlertTriangle className="w-3 h-3" />
          Note: Existing streams may not be immediately terminated, but new ones cannot start.
        </div>
      )}
    </div>
  );
}
