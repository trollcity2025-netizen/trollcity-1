import React from 'react';

interface StageLightingProps {
  isActive?: boolean;
}

/**
 * StageLighting - Cinematic lighting overlays including:
 * - Radial gold spotlight centered between performers
 * - Moving soft beams from top corners
 * - Subtle particle shimmer animation
 * - Gradient bloom behind stage
 */
export const StageLighting: React.FC<StageLightingProps> = ({ isActive = true }) => {
  if (!isActive) return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {/* Center radial gold spotlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[800px] bg-gradient-to-b from-amber-500/20 via-yellow-500/10 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      
      {/* Secondary center glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[500px] bg-gradient-to-b from-yellow-400/15 via-amber-400/5 to-transparent blur-2xl" />
      
      {/* Moving light beams from top corners */}
      <div className="absolute -top-20 -left-20 w-[400px] h-[600px] bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent rotate-45 animate-pulse" style={{ animationDuration: '5s' }} />
      <div className="absolute -top-20 -right-20 w-[400px] h-[600px] bg-gradient-to-bl from-amber-500/10 via-yellow-500/5 to-transparent -rotate-45 animate-pulse" style={{ animationDuration: '6s' }} />
      
      {/* Soft spot beams */}
      <div className="absolute top-0 left-1/4 w-[200px] h-full bg-gradient-to-b from-yellow-500/5 to-transparent animate-pulse" style={{ animationDuration: '3s' }} />
      <div className="absolute top-0 right-1/4 w-[200px] h-full bg-gradient-to-b from-yellow-500/5 to-transparent animate-pulse" style={{ animationDuration: '4s' }} />
      
      {/* Stage floor reflection/glow */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-yellow-500/10 via-amber-500/5 to-transparent blur-xl" />
      
      {/* Subtle shimmer particles */}
      <div className="absolute inset-0">
        {/* Shimmer 1 */}
        <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-yellow-300/50 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
        {/* Shimmer 2 */}
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-amber-300/50 rounded-full animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
        {/* Shimmer 3 */}
        <div className="absolute top-1/2 left-1/2 w-0.5 h-0.5 bg-white/30 rounded-full animate-ping" style={{ animationDuration: '2.5s', animationDelay: '1s' }} />
        {/* '1s' Shimmer 4 */}
        <div className="absolute top-1/4 right-1/4 w-1 h-1 bg-yellow-200/40 rounded-full animate-ping" style={{ animationDuration: '4s', animationDelay: '0.3s' }} />
        {/* Shimmer 5 */}
        <div className="absolute top-1/3 left-1/4 w-0.5 h-0.5 bg-amber-200/40 rounded-full animate-ping" style={{ animationDuration: '3.5s', animationDelay: '1.5s' }} />
      </div>
      
      {/* Atmospheric haze */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-yellow-500/5 to-transparent opacity-50" />
      
      {/* Gold bloom overlay */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-yellow-950/20" style={{ background: 'radial-gradient(ellipse at center, transparent 0%, rgba(146, 64, 14, 0.1) 50%, rgba(0, 0, 0, 0.3) 100%)' }} />
    </div>
  );
};

export default StageLighting;
