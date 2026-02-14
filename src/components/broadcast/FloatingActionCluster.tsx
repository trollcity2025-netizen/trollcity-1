import React from 'react';
import { Heart, Gift, Share2, MoreVertical, Users } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FloatingActionClusterProps {
  isHost?: boolean;
  isLiked?: boolean;
  likesCount?: number;
  onLike?: () => void;
  onGift?: () => void;
  onShare?: () => void;
  onMenu?: () => void;
  onParticipants?: () => void;
  className?: string;
  compact?: boolean;
}

export default function FloatingActionCluster({
  isHost,
  isLiked,
  likesCount = 0,
  onLike,
  onGift,
  onShare,
  onMenu,
  onParticipants,
  className,
  compact = false,
}: FloatingActionClusterProps) {
  if (compact) {
    return (
      <div className={cn("flex gap-2 items-center", className)}>
        {/* Like Button */}
        <button 
          onClick={onLike}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg backdrop-blur-sm",
            isLiked ? "bg-pink-500 text-white" : "bg-black/40 text-white hover:bg-black/60"
          )}
        >
          <Heart size={18} className={cn(isLiked && "fill-current")} />
        </button>

        {/* Gift Button */}
        <button 
          onClick={onGift}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform"
        >
          <Gift size={18} />
        </button>

        {/* Menu Button */}
        <button 
          onClick={onMenu}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform hover:bg-black/60"
        >
          <MoreVertical size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3 items-center", className)}>
      
      {/* Like Button */}
      <div className="flex flex-col items-center gap-1">
        <button 
          onClick={onLike}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg backdrop-blur-sm",
            isLiked ? "bg-pink-500 text-white" : "bg-black/40 text-white hover:bg-black/60"
          )}
        >
          <Heart size={22} className={cn(isLiked && "fill-current")} />
        </button>
        {likesCount > 0 && (
          <span className="text-[10px] font-bold text-white drop-shadow-md">
            {likesCount}
          </span>
        )}
      </div>

      {/* Gift Button - Prominent */}
      <div className="flex flex-col items-center gap-1">
        <button 
          onClick={onGift}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform animate-pulse-slow"
        >
          <Gift size={24} />
        </button>
        <span className="text-[10px] font-bold text-white drop-shadow-md">Gift</span>
      </div>

      {/* Participants Button (if host) */}
      {isHost && onParticipants && (
        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={onParticipants}
            className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 shadow-lg active:scale-90 transition-transform hover:bg-purple-500/30"
          >
            <Users size={18} />
          </button>
        </div>
      )}

      {/* Share Button */}
      {onShare && (
        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={onShare}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform hover:bg-black/60"
          >
            <Share2 size={18} />
          </button>
        </div>
      )}

      {/* Menu Button */}
      <button 
        onClick={onMenu}
        className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform hover:bg-black/60"
      >
        <MoreVertical size={18} />
      </button>

    </div>
  );
}

// Horizontal action bar for landscape mode
export function HorizontalActionBar({
  onLike,
  onGift,
  onChat,
  onShare: _onShare,
  onMenu,
  likesCount = 0,
  unreadCount = 0,
}: {
  onLike?: () => void;
  onGift?: () => void;
  onChat?: () => void;
  onShare?: () => void;
  onMenu?: () => void;
  likesCount?: number;
  unreadCount?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10">
      <div className="flex items-center gap-2">
        <button 
          onClick={onLike}
          className="w-9 h-9 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400 hover:bg-pink-500/30 transition-colors"
        >
          <Heart size={18} />
        </button>
        {likesCount > 0 && (
          <span className="text-xs text-white/80">{likesCount}</span>
        )}
      </div>

      <button 
        onClick={onChat}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
      >
        <span className="text-sm text-white/60">Say something...</span>
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      <div className="flex items-center gap-2">
        <button 
          onClick={onGift}
          className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 hover:bg-yellow-500/30 transition-colors"
        >
          <Gift size={18} />
        </button>
        
        {onMenu && (
          <button 
            onClick={onMenu}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
          >
            <MoreVertical size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
