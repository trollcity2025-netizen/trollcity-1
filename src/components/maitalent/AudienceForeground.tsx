import React from 'react';

interface AudienceForegroundProps {
  children?: React.ReactNode;
}

/**
 * AudienceForeground - Foreground elements that create depth:
 * - Stage platform with gold rim lighting
 * - Soft reflections on floor
 * - Warm golden light bloom around performers area
 * - Cinematic shadows
 */
export const AudienceForeground: React.FC<AudienceForegroundProps> = ({ children }) => {
  return (
    <div className="relative w-full h-full">
      {/* Stage platform with gold rim */}
      <div className="absolute bottom-0 left-0 right-0">
        {/* Gold rim light */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 shadow-[0_0_20px_rgba(255,215,0,0.5)]" />
        
        {/* Stage platform */}
        <div className="h-32 bg-gradient-to-t from-slate-950 to-slate-900" />
        
        {/* Floor reflection */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent" />
        
        {/* Soft glow from stage */}
        <div className="absolute bottom-0 left-1/4 right-1/4 h-20 bg-gradient-to-t from-yellow-500/10 to-transparent blur-xl" />
      </div>

      {/* Content layer */}
      <div className="relative z-10 h-full pb-32">
        {children}
      </div>
      
      {/* Foreground vignette */}
      <div className="absolute inset-0 pointer-events-none z-20" style={{
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)'
      }} />
      
      {/* Bottom dark gradient for depth */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-15" />
    </div>
  );
};

export default AudienceForeground;
