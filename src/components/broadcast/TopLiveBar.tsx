import React from 'react';
import { Stream } from '../../types/broadcast';
import { User, Plus, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import BroadcastLevelBar from './BroadcastLevelBar';

interface TopLiveBarProps {
  stream: Stream;
  hostName?: string;
  hostAvatar?: string;
  isFollowing?: boolean;
  onFollow?: () => void;
  onClose?: () => void;
  className?: string;
}

export default function TopLiveBar({
  stream,
  hostName = 'Unknown Host',
  hostAvatar,
  isFollowing = false,
  onFollow,
  onClose,
  className
}: TopLiveBarProps) {
  // We'll assume the timer hook is available or we'll implement a simple one if not
  // For now let's just use a static timer or the hook if I create it.
  // The plan said "useLiveTimer" is in "hooks", so I should probably create that hook too.
  
  return (
    <div className={cn("fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pt-12 pb-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none", className)}>
      
      {/* Left: Host Info Pill */}
      <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full p-1 pr-4 pointer-events-auto">
        <div className="relative">
          {hostAvatar ? (
            <img src={hostAvatar} alt={hostName} className="w-9 h-9 rounded-full border border-pink-500" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-600">
              <User size={16} className="text-zinc-400" />
            </div>
          )}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-pink-600 text-[10px] font-bold px-1.5 rounded-sm leading-tight text-white">
            LIVE
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white max-w-[80px] truncate">{hostName}</span>
          <span className="text-[10px] text-zinc-300 flex items-center gap-1">
             {stream.viewer_count.toLocaleString()} Viewers
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

      {/* Center: Level Bar */}
      <div className="absolute left-1/2 -translate-x-1/2 top-14 pointer-events-auto">
        <BroadcastLevelBar broadcasterId={stream.user_id} />
      </div>

      {/* Right: Close / Viewer List */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="flex -space-x-2 overflow-hidden">
           {/* Placeholder for top viewers - in real app pass these as props */}
           {[1,2,3].map(i => (
             <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-zinc-800" />
           ))}
        </div>
        
        <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors"
        >
            <X size={18} />
        </button>
      </div>
    </div>
  );
}
