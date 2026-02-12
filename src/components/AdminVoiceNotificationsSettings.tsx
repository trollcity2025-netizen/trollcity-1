import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useAdminVoiceNotifications } from '@/hooks/useAdminVoiceNotifications';

interface AdminVoiceNotificationsSettingsProps {
  className?: string;
}

export default function AdminVoiceNotificationsSettings({ className = '' }: AdminVoiceNotificationsSettingsProps) {
  const { enabled, toggleVoiceNotifications, voiceReady, isSpeaking } = useAdminVoiceNotifications();

  if (!voiceReady) {
    return null;
  }

  return (
    <div className={`flex items-center gap-3 p-4 bg-black/30 rounded-lg border border-purple-500/20 ${className}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          {enabled ? (
            <Volume2 className="w-5 h-5 text-green-400" />
          ) : (
            <VolumeX className="w-5 h-5 text-gray-400" />
          )}
          <label className="font-semibold text-white">
            Verbal Notifications
          </label>
          {isSpeaking && (
            <span className="ml-2 px-2 py-1 text-xs bg-green-500/20 text-green-300 rounded animate-pulse">
              Speaking...
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400">
          Automatically announce notifications with British male voice
        </p>
      </div>

      <button
        onClick={() => toggleVoiceNotifications(!enabled)}
        className={`px-4 py-2 rounded-lg font-semibold transition-all ${
          enabled
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
        }`}
      >
        {enabled ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );
}
