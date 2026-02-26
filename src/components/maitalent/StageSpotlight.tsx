
import React from 'react';
const StageSpotlight = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Top Spotlight */}
      <div 
        className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-purple-500/30 to-transparent rounded-full blur-3xl"
      />
      {/* Bottom Glow */}
      <div 
        className="absolute -bottom-1/2 left-1/2 -translate-x-1/2 w-2/3 h-1/2 bg-gradient-to-t from-blue-800/20 to-transparent rounded-full blur-3xl"
      />
    </div>
  );
};

export default StageSpotlight;
