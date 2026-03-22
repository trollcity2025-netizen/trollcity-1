import React from 'react';
import { Radio, Music, X, Play, Pause, Volume2 } from 'lucide-react';
import { useTrollStationStore } from '@/stores/useTrollStationStore';

interface BroadcastRadioModeProps {
  onClose?: () => void;
}

export function BroadcastRadioMode({ onClose }: BroadcastRadioModeProps) {
  const {
    station,
    currentSong,
    audio,
    setPlaying,
    setMuted,
  } = useTrollStationStore();

  if (!station?.is_online) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-purple-900/90 to-slate-900/90 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="relative">
          <Radio className="w-5 h-5 text-purple-400" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            Troll Station
          </p>
          <p className="text-sm font-medium text-white truncate">
            {currentSong?.title || 'Live Show'}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {currentSong?.artist || station.current_mode === 'live' ? 'Live DJ' : 'Auto DJ'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setMuted(!audio.isMuted)}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            {audio.isMuted ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mini visualizer */}
      <div className="h-8 bg-black/30 flex items-center justify-center gap-0.5 px-3">
        {audio.isPlaying ? (
          Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-purple-500 rounded-full animate-pulse"
              style={{
                height: `${Math.random() * 100}%`,
                animationDelay: `${i * 30}ms`,
              }}
            />
          ))
        ) : (
          <span className="text-gray-500 text-xs">Paused</span>
        )}
      </div>
    </div>
  );
}

export default BroadcastRadioMode;
