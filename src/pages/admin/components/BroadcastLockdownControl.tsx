import React, { useState } from 'react';
import { useBroadcastLockdown } from '../../../lib/hooks/useBroadcastLockdown';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function BroadcastLockdownControl() {
  const { settings, loading, updateSettings } = useBroadcastLockdown();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleLockdown = async () => {
    setIsUpdating(true);
    try {
      const success = await updateSettings({
        ...settings,
        enabled: !settings.enabled,
        admin_broadcast_room: settings.admin_broadcast_room || null
      });
      if (success) {
        toast.success(
          settings.enabled
            ? 'Broadcast Lockdown disabled - everyone can now broadcast!'
            : 'Broadcast Lockdown enabled - only admins can broadcast!'
        );
      }
    } catch (error) {
      toast.error('Failed to update broadcast lockdown settings');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-[#1a003a] border border-purple-700/40 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        {settings.enabled ? (
          <ShieldAlert className="w-6 h-6 text-red-400" />
        ) : (
          <ShieldCheck className="w-6 h-6 text-green-400" />
        )}
        <div>
          <h3 className="text-lg font-semibold text-white">Broadcast Lockdown Control</h3>
          <p className="text-sm text-gray-400">
            {settings.enabled
              ? 'Only admins can start broadcasts'
              : 'Everyone can start broadcasts'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${settings.enabled ? 'text-red-400' : 'text-green-400'}`}>
            {settings.enabled ? '🔴 Lockdown Active' : '🟢 Normal Mode'}
          </span>
        </div>

        <button
          onClick={handleToggleLockdown}
          disabled={isUpdating || loading}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            settings.enabled
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isUpdating ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Updating...
            </span>
          ) : settings.enabled ? (
            'Disable Lockdown'
          ) : (
            'Enable Lockdown'
          )}
        </button>
      </div>

      {settings.enabled && (
        <p className="text-xs text-gray-500 pt-2 border-t border-purple-700/30">
          When enabled, regular users will see a message on the Go Live page and their broadcast button will be disabled.
          They can still join and participate in the admin's broadcast.
        </p>
      )}
    </div>
  );
}
