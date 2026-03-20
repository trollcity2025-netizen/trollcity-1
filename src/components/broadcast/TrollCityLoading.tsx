import React, { useState, useEffect, useMemo } from 'react';

interface TrollCityLoadingProps {
  message?: string;
}

const ROTATING_MESSAGES = [
  "Entering Troll City...",
  "Connecting to the chaos...",
  "Broadcast initializing...",
  "Counting coins...",
  "Avoiding the Troll Police...",
  "Waking up the trolls...",
  "Tuning the microphones...",
  "Starting the engines...",
];

const TrollCityLoading: React.FC<TrollCityLoadingProps> = ({ 
  message 
}) => {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  
  // Generate falling coins
  const coins = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 5,
      speed: 3 + Math.random() * 3,
      rotation: Math.random() * 360,
      size: 12 + Math.random() * 8,
    }));
  }, []);

  // Generate flickering windows
  const windows = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      y: 20 + Math.random() * 60,
      delay: Math.random() * 3,
      duration: 0.5 + Math.random() * 2,
    }));
  }, []);

  // Generate fog particles
  const fogParticles = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: 60 + Math.random() * 30,
      size: 100 + Math.random() * 150,
      delay: Math.random() * 5,
      speed: 0.2 + Math.random() * 0.3,
    }));
  }, []);

  // Animate progress bar with varying speed
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        // Slow down as it gets closer to 100%
        const increment = prev > 70 ? 0.3 : prev > 40 ? 0.7 : 1.5;
        return prev >= 95 ? 95 : prev + increment;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Rotate messages every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % ROTATING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Use custom message if provided, otherwise rotate
  const displayMessage = message || ROTATING_MESSAGES[messageIndex];

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 overflow-hidden relative">
      {/* Parallax Background City */}
      <div className="absolute inset-0 pointer-events-none">
        <svg viewBox="0 0 400 200" className="w-full h-full" preserveAspectRatio="none">
          {/* Far buildings (darker) */}
          <rect x="0" y="80" width="400" height="120" fill="#0f0a1a" />
          {/* Building silhouettes */}
          <rect x="10" y="100" width="25" height="100" fill="#1a1025" />
          <rect x="40" y="70" width="35" height="130" fill="#1f132d" />
          <rect x="80" y="110" width="20" height="90" fill="#1a1025" />
          <rect x="105" y="60" width="40" height="140" fill="#251638" />
          <rect x="150" y="85" width="28" height="115" fill="#1a1025" />
          <rect x="185" y="55" width="45" height="145" fill="#2d1a40" />
          <rect x="235" y="75" width="35" height="125" fill="#1f132d" />
          <rect x="275" y="95" width="22" height="105" fill="#1a1025" />
          <rect x="300" y="50" width="50" height="150" fill="#2d1a40" />
          <rect x="355" y="80" width="30" height="120" fill="#1a1025" />
          <rect x="390" y="100" width="10" height="100" fill="#1a1025" />
          
          {/* Flickering windows */}
          {windows.map(win => (
            <rect
              key={win.id}
              x={win.x}
              y={win.y}
              width="4"
              height="6"
              fill="#fbbf24"
              opacity="0"
              style={{
                animation: `flicker ${win.duration}s ease-in-out infinite ${win.delay}s`,
              }}
            />
          ))}
        </svg>
      </div>

      {/* Fog particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {fogParticles.map(particle => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-purple-500/10 blur-xl"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size / 2,
              animation: `fogDrift ${particle.speed}s linear infinite ${particle.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Falling coins */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {coins.map(coin => (
          <div
            key={coin.id}
            className="absolute text-amber-400"
            style={{
              left: `${coin.x}%`,
              top: '-20px',
              fontSize: coin.size,
              animation: `coinFall ${coin.speed}s linear infinite ${coin.delay}s`,
              textShadow: '0 0 10px #fbbf24, 0 0 20px #f59e0b',
              transform: `rotate(${coin.rotation}deg)`,
            }}
          >
            🪙
          </div>
        ))}
      </div>

      {/* Neon TROLL CITY text with enhanced glow */}
      <div className="relative z-10 mb-16 mt-8">
        <h1 
          className="text-7xl md:text-9xl font-black tracking-wider"
          style={{
            color: '#f0abfc',
            textShadow: `
              0 0 10px #c084fc,
              0 0 20px #c084fc,
              0 0 40px #a855f7,
              0 0 80px #a855f7,
              0 0 120px #9333ea,
              0 0 160px #9333ea
            `,
            animation: 'neonPulse 2s ease-in-out infinite, neonFlicker 3s ease-in-out infinite',
          }}
        >
          TROLL CITY
        </h1>
        
        {/* Broadcasting subtitle */}
        <p 
          className="text-center text-purple-300 text-xl mt-3 tracking-[0.5em] uppercase opacity-0"
          style={{
            animation: 'fadeInOut 3s ease-in-out infinite 1s',
          }}
        >
          Broadcasting
        </p>
      </div>

      {/* Human-sized Troll Characters */}
      <div className="relative w-full max-w-4xl h-40 mb-8">
        {/* Troll Family - Left side */}
        <div className="absolute left-[10%] bottom-0 flex items-end gap-2">
          {/* Parent Troll 1 */}
          <div className="relative" style={{ animation: 'trollBob 2s ease-in-out infinite' }}>
            <svg width="70" height="100" viewBox="0 0 70 100" className="drop-shadow-lg">
              {/* Body */}
              <ellipse cx="35" cy="75" rx="22" ry="20" fill="#65a30d" />
              {/* Head */}
              <circle cx="35" cy="40" r="22" fill="#65a30d" />
              {/* Eyes */}
              <circle cx="28" cy="35" r="6" fill="white" />
              <circle cx="42" cy="35" r="6" fill="white" />
              <circle cx="28" cy="35" r="3" fill="black" />
              <circle cx="42" cy="35" r="3" fill="black" />
              {/* Horns */}
              <path d="M20 25 L15 10 L25 20 Z" fill="#a16207" />
              <path d="M50 25 L55 10 L45 20 Z" fill="#a16207" />
              {/* Nose */}
              <ellipse cx="35" cy="45" rx="4" ry="3" fill="#4d7c0f" />
              {/* Mouth - talking animation */}
              <path d="M28 52 Q35 58 42 52" stroke="#4d7c0f" strokeWidth="2" fill="none" />
              {/* Arms */}
              <line x1="13" y1="65" x2="5" y2="55" stroke="#65a30d" strokeWidth="5" strokeLinecap="round" />
              <line x1="57" y1="65" x2="65" y2="55" stroke="#65a30d" strokeWidth="5" strokeLinecap="round" />
              {/* Legs */}
              <line x1="25" y1="93" x2="20" y2="100" stroke="#65a30d" strokeWidth="5" strokeLinecap="round" />
              <line x1="45" y1="93" x2="50" y2="100" stroke="#65a30d" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Parent Troll 2 */}
          <div className="relative" style={{ animation: 'trollBob 2s ease-in-out infinite 0.3s' }}>
            <svg width="65" height="95" viewBox="0 0 65 95" className="drop-shadow-lg">
              {/* Body */}
              <ellipse cx="32" cy="70" rx="20" ry="18" fill="#7c3aed" />
              {/* Head */}
              <circle cx="32" cy="38" r="20" fill="#7c3aed" />
              {/* Eyes */}
              <circle cx="26" cy="33" r="5" fill="white" />
              <circle cx="38" cy="33" r="5" fill="white" />
              <circle cx="26" cy="33" r="2.5" fill="black" />
              <circle cx="38" cy="33" r="2.5" fill="black" />
              {/* Horns */}
              <path d="M18 23 L14 10 L24 18 Z" fill="#a16207" />
              <path d="M46 23 L50 10 L40 18 Z" fill="#a16207" />
              {/* Nose */}
              <ellipse cx="32" cy="42" rx="3" ry="2.5" fill="#5b21b6" />
              {/* Mouth - smiling */}
              <path d="M25 50 Q32 55 39 50" stroke="#5b21b6" strokeWidth="2" fill="none" />
              {/* Arms */}
              <line x1="12" y1="60" x2="5" y2="50" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" />
              <line x1="53" y1="60" x2="60" y2="50" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" />
              {/* Legs */}
              <line x1="24" y1="86" x2="20" y2="95" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" />
              <line x1="40" y1="86" x2="44" y2="95" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Kid Troll */}
          <div className="relative" style={{ animation: 'trollWave 1.5s ease-in-out infinite' }}>
            <svg width="45" height="65" viewBox="0 0 45 65" className="drop-shadow-lg">
              {/* Body */}
              <ellipse cx="22" cy="52" rx="14" ry="12" fill="#84cc16" />
              {/* Head */}
              <circle cx="22" cy="28" r="14" fill="#84cc16" />
              {/* Eyes */}
              <circle cx="18" cy="25" r="4" fill="white" />
              <circle cx="26" cy="25" r="4" fill="white" />
              <circle cx="18" cy="25" r="2" fill="black" />
              <circle cx="26" cy="25" r="2" fill="black" />
              {/* Horns */}
              <path d="M12 18 L9 8 L16 14 Z" fill="#a16207" />
              <path d="M32 18 L35 8 L28 14 Z" fill="#a16207" />
              {/* Nose */}
              <ellipse cx="22" cy="32" rx="2.5" ry="2" fill="#65a30d" />
              {/* Mouth - excited */}
              <ellipse cx="22" cy="38" rx="4" ry="3" fill="#4d7c0f" />
              {/* Arms - waving */}
              <line x1="8" y1="45" x2="0" y2="35" stroke="#84cc16" strokeWidth="4" strokeLinecap="round" style={{ animation: 'trollWave 1.5s ease-in-out infinite' }} />
              <line x1="36" y1="45" x2="45" y2="35" stroke="#84cc16" strokeWidth="4" strokeLinecap="round" />
              {/* Legs */}
              <line x1="16" y1="63" x2="14" y2="65" stroke="#84cc16" strokeWidth="4" strokeLinecap="round" />
              <line x1="28" y1="63" x2="30" y2="65" stroke="#84cc16" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Troll Cop - Right side with flashing lights */}
        <div className="absolute right-[15%] bottom-0">
          <div className="relative">
            {/* Police lights glow */}
            <div 
              className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-3 rounded-full"
              style={{
                background: 'radial-gradient(ellipse, #ef4444 0%, transparent 70%)',
                animation: 'policeFlash 0.8s ease-in-out infinite',
              }}
            />
            <svg width="75" height="110" viewBox="0 0 75 110" className="drop-shadow-lg">
              {/* Body with police vest */}
              <ellipse cx="37" cy="80" rx="24" ry="22" fill="#1e3a5f" />
              <rect x="20" y="65" width="34" height="30" fill="#ef4444" rx="2" />
              <text x="37" y="85" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">POLICE</text>
              {/* Head */}
              <circle cx="37" cy="42" r="22" fill="#65a30d" />
              {/* Police hat */}
              <rect x="20" y="15" width="34" height="12" fill="#1e3a5f" rx="2" />
              <rect x="15" y="25" width="44" height="5" fill="#1e3a5f" rx="1" />
              <circle cx="37" cy="18" r="4" fill="#fbbf24" />
              {/* Eyes */}
              <circle cx="30" cy="38" r="5" fill="white" />
              <circle cx="44" cy="38" r="5" fill="white" />
              <circle cx="30" cy="38" r="2.5" fill="black" />
              <circle cx="44" cy="38" r="2.5" fill="black" />
              {/* Stern expression */}
              <path d="M28 50 L34 52 L37 50" stroke="#4d7c0f" strokeWidth="1.5" fill="none" />
              <path d="M40 50 L44 52" stroke="#4d7c0f" strokeWidth="1.5" fill="none" />
              {/* Arms */}
              <line x1="13" y1="70" x2="5" y2="60" stroke="#65a30d" strokeWidth="5" strokeLinecap="round" />
              <line x1="61" y1="70" x2="70" y2="60" stroke="#65a30d" strokeWidth="5" strokeLinecap="round" />
              {/* Legs */}
              <line x1="25" y1="100" x2="20" y2="110" stroke="#65a30d" strokeWidth="5" strokeLinecap="round" />
              <line x1="49" y1="100" x2="54" y2="110" stroke="#65a30d" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Enhanced Progress bar */}
      <div className="w-80 h-5 bg-slate-900/80 rounded-full overflow-hidden border border-purple-500/40 shadow-lg relative">
        {/* Glow effect behind bar */}
        <div 
          className="absolute inset-0 bg-purple-500/20"
          style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}
        />
        
        {/* Animated progress bar */}
        <div 
          className="h-full rounded-full relative overflow-hidden"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #9333ea, #c084fc, #a855f7, #9333ea)',
            backgroundSize: '300% 100%',
            animation: 'shimmer 1.5s linear infinite',
          }}
        >
          {/* Traveling glow */}
          <div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            style={{
              animation: 'glowTravel 1.5s ease-in-out infinite',
            }}
          />
        </div>

        {/* Progress markers */}
        {[25, 50, 75].map(mark => (
          <div 
            key={mark}
            className="absolute top-0 bottom-0 w-px bg-white/20"
            style={{ left: `${mark}%` }}
          />
        ))}
      </div>

      {/* Status message with typewriter effect */}
      <p className="mt-6 text-purple-200 text-lg font-medium">
        {displayMessage}
      </p>

      {/* CSS Animations */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 300% 0; }
          100% { background-position: -300% 0; }
        }
        
        @keyframes glowTravel {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes neonPulse {
          0%, 100% { opacity: 1; filter: brightness(1); }
          50% { opacity: 0.9; filter: brightness(1.1); }
        }
        
        @keyframes neonFlicker {
          0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { 
            text-shadow: 
              0 0 10px #c084fc,
              0 0 20px #c084fc,
              0 0 40px #a855f7,
              0 0 80px #a855f7,
              0 0 120px #9333ea,
              0 0 160px #9333ea;
          }
          20%, 24%, 55% { 
            text-shadow: 
              0 0 5px #c084fc,
              0 0 10px #a855f7,
              0 0 20px #9333ea;
            opacity: 0.8;
          }
        }
        
        @keyframes flicker {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.7; }
        }
        
        @keyframes fogDrift {
          0% { transform: translateX(0); opacity: 0; }
          10% { opacity: 0.15; }
          90% { opacity: 0.15; }
          100% { transform: translateX(50px); opacity: 0; }
        }
        
        @keyframes coinFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
        
        @keyframes trollBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        
        @keyframes trollWave {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        
        @keyframes fadeInOut {
          0%, 100% { opacity: 0; transform: translateY(-5px); }
          50% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes policeFlash {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default TrollCityLoading;
