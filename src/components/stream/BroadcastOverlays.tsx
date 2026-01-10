import React from 'react';
import { Share2, MoreVertical, Mic, MicOff, Camera, CameraOff, MessageCircle, Gift, Heart } from 'lucide-react';

interface BroadcastOverlaysProps {
  title?: string;
  viewerCount?: number;
  isLive?: boolean;
  isBroadcaster?: boolean;
  micOn?: boolean;
  cameraOn?: boolean;
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  onOpenChat?: () => void;
  onOpenGifts?: () => void;
  onOpenSettings?: () => void;
  onInviteFollowers?: () => void;
  onShareStream?: () => void;
  className?: string;
  totalCoins?: number;
  startTime?: string | null;
}

export default function BroadcastOverlays({
  title = 'Live Stream',
  viewerCount = 0,
  isLive = false,
  isBroadcaster = false,
  micOn = true,
  cameraOn = true,
  onToggleMic,
  onToggleCamera,
  onOpenChat,
  onOpenGifts,
  onOpenSettings,
  onInviteFollowers,
  onShareStream,
  className = '',
  totalCoins = 0,
  startTime
}: BroadcastOverlaysProps) {
  const [elapsed, setElapsed] = React.useState('00:00:00');

  React.useEffect(() => {
    if (!startTime || !isLive) return;
    
    const interval = setInterval(() => {
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((now - start) / 1000));
      
      const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const seconds = (diff % 60).toString().padStart(2, '0');
      
      setElapsed(`${hours}:${minutes}:${seconds}`);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime, isLive]);

  return (
    <div className={`absolute inset-0 pointer-events-none z-20 flex flex-col justify-between safe-area-inset ${className}`}>
      {/* Top Overlay */}
      <div className="flex items-start justify-between p-4 bg-gradient-to-b from-black/60 to-transparent pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="bg-black/40 backdrop-blur-md rounded-full px-1 py-1 pr-4 flex items-center gap-3 border border-white/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center border border-white/20">
              <span className="font-bold text-xs">TC</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white max-w-[120px] truncate">{title}</span>
              <div className="flex items-center gap-2">
                {isLive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                {isLive && startTime && <span className="text-[10px] text-red-400 font-mono">{elapsed}</span>}
                <span className="text-[10px] text-white/70">{viewerCount.toLocaleString()} viewers</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={onShareStream}
            className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-white/20 transition-colors"
          >
            <Share2 size={14} />
          </button>
          {isBroadcaster && onInviteFollowers && (
            <button
              onClick={onInviteFollowers}
              className="w-8 h-8 rounded-full bg-purple-600/80 backdrop-blur-md flex items-center justify-center text-white border border-purple-500/50 hover:bg-purple-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
           {/* Additional Top Right Controls */}
           <button 
             onClick={onOpenSettings}
             className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10"
           >
             <MoreVertical size={14} />
           </button>
        </div>
      </div>

      {/* Right Overlay (Gifts, Reactions) */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-end gap-4 px-4 pointer-events-auto">
        {/* Only show on mobile/tablet or when requested */}
      </div>

      {/* Bottom Overlay */}
      <div className="flex flex-col gap-2 p-4 bg-gradient-to-t from-black/80 to-transparent pb-[env(safe-area-inset-bottom)]">
        {/* Quick Chat / Messages Area (Placeholder) */}
        <div className="flex-1 min-h-[100px] flex flex-col justify-end items-start mb-2 pointer-events-none">
           <div className="bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white/70 mb-1 border border-white/5">
              Welcome to the stream!
           </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-3">
             <button 
               onClick={onOpenChat}
               className="bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-full text-white/70 text-sm flex items-center gap-2 border border-white/10 hover:bg-black/60 transition-colors"
             >
               <MessageCircle size={16} />
               <span className="hidden sm:inline">Say something...</span>
             </button>
          </div>

          <div className="flex items-center gap-3">
            {isBroadcaster && (
              <>
                <button 
                  onClick={onToggleMic}
                  className={`p-2.5 rounded-full backdrop-blur-md border transition-all ${micOn ? 'bg-white/10 border-white/10 text-white' : 'bg-red-500/80 border-red-500 text-white'}`}
                >
                  {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                <button 
                  onClick={onToggleCamera}
                  className={`p-2.5 rounded-full backdrop-blur-md border transition-all ${cameraOn ? 'bg-white/10 border-white/10 text-white' : 'bg-red-500/80 border-red-500 text-white'}`}
                >
                  {cameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
                </button>
              </>
            )}
            
            <button 
              onClick={onOpenGifts}
              className="p-2.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-purple-500/20 hover:scale-105 transition-transform"
            >
              <Gift size={20} />
            </button>

            <button className="p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-colors">
              <Heart size={20} />
            </button>

            {/* Coin Counter */}
            <div className="bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-full border border-yellow-500/30 flex items-center gap-2 shadow-lg">
               <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold text-[10px]">C</div>
               <span className="text-yellow-400 font-bold text-sm">{totalCoins.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
