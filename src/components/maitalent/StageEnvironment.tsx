import React from 'react';

interface StageEnvironmentProps {
  children: React.ReactNode;
}

/**
 * StageEnvironment - Background theater environment with:
 * - Dark blue to black gradient
 * - Star particles / soft light bokeh
 * - Stage curtains on left and right
 * - Subtle haze / glow atmosphere
 */
export const StageEnvironment: React.FC<StageEnvironmentProps> = ({ children }) => {
  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden">
      {/* Base gradient - Deep navy to black theater background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-black" />
      
      {/* Atmospheric star particles / bokeh effect */}
      <div className="absolute inset-0 opacity-30">
        {/* Top stars */}
        <div className="absolute top-0 left-1/4 w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
        <div className="absolute top-10 left-1/3 w-0.5 h-0.5 bg-yellow-200 rounded-full animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-5 right-1/4 w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDuration: '2.5s' }} />
        <div className="absolute top-20 right-1/3 w-0.5 h-0.5 bg-yellow-100 rounded-full animate-pulse" style={{ animationDuration: '3.5s' }} />
        <div className="absolute top-8 left-1/2 w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{ animationDuration: '2s' }} />
        
        {/* Scattered bokeh lights */}
        <div className="absolute top-1/4 left-1/4 w-20 h-20 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/3 w-24 h-24 bg-yellow-500/10 rounded-full blur-3xl" />
      </div>
      
      {/* Subtle haze overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      
      {/* Floor reflection area */}
      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-slate-950/80 to-transparent" />
      
      {/* Left curtain */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-red-950 via-red-900 to-red-950/30 shadow-2xl z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
        {/* Curtain folds */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiLz48cGF0aCBkPSJNMjAgMjBoMjB2MjBIMjB6IiBmaWxsPSJub25lIiBzdHJva2U9InJlZChiOTMsIDMwLCAzNSkiIHN0cm9rZS13aWR0aD0iMiIvPjwvZz48L3N2Zz4=')] opacity-30" />
        </div>
      </div>
      
      {/* Right curtain */}
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-red-950 via-red-900 to-red-950/30 shadow-2xl z-10">
        <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-transparent to-transparent" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiLz48cGF0aCBkPSJNMjAgMjBoMjB2MjBIMjB6IiBmaWxsPSJub25lIiBzdHJva2U9InJlZChiOTMsIDMwLCAzNSkiIHN0cm9rZS13aWR0aD0iMiIvPjwvZz48L3N2Zz4=')] opacity-30" />
        </div>
      </div>
      
      {/* Main content area */}
      <div className="relative z-20 w-full h-full">
        {children}
      </div>
    </div>
  );
};

export default StageEnvironment;
