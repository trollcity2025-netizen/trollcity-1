import React from 'react';

interface LiveStatusBarProps {
  viewerCount?: number;
  round?: number;
  timer?: number; // in seconds
  showTitle?: string;
  isLive?: boolean;
}

/**
 * LiveStatusBar - Centered floating status pill above performers:
 * LIVE • viewer count • round • timer
 * Example: ❤️ LIVE • 1.2K VIEWERS • ROUND 1 • 02:31
 * Animated pulse on LIVE indicator.
 */
export const LiveStatusBar: React.FC<LiveStatusBarProps> = ({
  viewerCount = 0,
  round = 1,
  timer = 0,
  showTitle = 'Mai Talent Show',
  isLive = true,
}) => {
  // Format viewer count
  const formatViewerCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Format timer (seconds to MM:SS)
  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative z-30">
      {/* Status pill container */}
      <div className="flex items-center justify-center">
        <div className="
          inline-flex items-center gap-3 px-6 py-2.5 
          bg-slate-950/80 backdrop-blur-xl 
          border border-yellow-500/30 
          rounded-full
          shadow-[0_0_30px_rgba(255,215,0,0.15),0_4px_20px_rgba(0,0,0,0.5)]
        ">
          {/* LIVE indicator with pulse */}
          {isLive && (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <span className="text-red-500 font-bold text-sm tracking-wide">LIVE</span>
            </div>
          )}

          {/* Divider */}
          <div className="w-px h-4 bg-yellow-500/30" />

          {/* Viewer count */}
          <div className="flex items-center gap-1.5">
            <span className="text-pink-500">❤️</span>
            <span className="text-white font-medium text-sm">
              {formatViewerCount(viewerCount)} VIEWERS
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-yellow-500/30" />

          {/* Round */}
          <div className="text-white font-medium text-sm">
            ROUND {round}
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-yellow-500/30" />

          {/* Timer */}
          <div className="font-mono text-yellow-400 text-sm font-medium">
            {formatTimer(timer)}
          </div>
        </div>
      </div>

      {/* Show title below */}
      <div className="text-center mt-2">
        <h1 className="text-yellow-400/80 text-xs font-medium tracking-[0.2em] uppercase">
          {showTitle}
        </h1>
      </div>
    </div>
  );
};

export default LiveStatusBar;
