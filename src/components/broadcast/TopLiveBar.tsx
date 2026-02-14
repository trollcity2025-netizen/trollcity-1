import React from 'react';
import { Stream } from '../../types/broadcast';
import { User, Plus, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import BroadcastLevelBar from './BroadcastLevelBar';
import { getGlowingTextStyle } from '../../lib/perkEffects';
import MobileHUD from '../mobile/MobileHUD';

interface TopLiveBarProps {
  stream: Stream;
  hostName?: string;
  hostAvatar?: string;
  hostGlowingColor?: string;
  isFollowing?: boolean;
  onFollow?: () => void;
  onClose?: () => void;
  className?: string;
  compact?: boolean;
}

export default function TopLiveBar({
  stream,
  hostName = 'Unknown Host',
  hostAvatar,
  hostGlowingColor,
  isFollowing = false,
  onFollow,
  onClose,
  className,
  compact = false,
}: TopLiveBarProps) {
  if (compact) {
    return (
      <div className={cn("flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/60 to-transparent", className)}>
        {/* Left: Host Info */}
        <div className="flex items-center gap-2">
          <div className="relative">
            {hostAvatar ? (
              <img src={hostAvatar} alt={hostName} className="w-8 h-8 rounded-full border border-pink-500" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-600">
                <User size={14} className="text-zinc-400" />
              </div>
            )}
          </div>
          <span 
            className="text-xs font-bold text-white truncate max-w-[80px]"
            style={hostGlowingColor ? getGlowingTextStyle(hostGlowingColor) : undefined}
          >
            {hostName}
          </span>
        </div>

        {/* Right: HUD */}
        <MobileHUD compact />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between px-4 pt-12 pb-4 bg-gradient-to-b from-black/60 to-transparent", className)}>
      
      {/* Left: Host Info Pill */}
      <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full p-1 pr-4">
        <div className="relative">
          {hostAvatar ? (
            <img src={hostAvatar} alt={hostName} className="w-9 h-9 rounded-full border border-pink-500" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-600">
              <User size={16} className="text-zinc-400" />
            </div>
          )}
        </div>
        
        <div className="flex flex-col">
          <span 
            className="text-xs font-bold text-white max-w-[80px] truncate"
            style={hostGlowingColor ? getGlowingTextStyle(hostGlowingColor) : undefined}
          >
            {hostName}
          </span>
          <span className="text-[10px] text-zinc-300 flex items-center gap-1">
            {(stream.current_viewers || stream.viewer_count || 0).toLocaleString()} Viewers
          </span>
        </div>

        {!isFollowing && onFollow && (
          <button 
            onClick={onFollow}
            className="ml-2 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-white hover:bg-pink-600 transition-colors"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Center: Level Bar (only on larger screens) */}
      <div className="hidden md:block">
        <BroadcastLevelBar broadcasterId={stream.user_id} />
      </div>

      {/* Right: HUD + Close */}
      <div className="flex items-center gap-3">
        <MobileHUD compact />
        
        <button 
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
