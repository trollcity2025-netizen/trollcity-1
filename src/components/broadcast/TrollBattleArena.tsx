import React, { useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';

interface TrollCharacter {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  speed: number;
  direction: number;
  isJumping: boolean;
  jumpHeight: number;
  type: 'walker' | 'jumper' | 'runner';
}

interface TrollBattleArenaProps {
  isActive?: boolean;
  intensity?: 'low' | 'medium' | 'high';
}

const TROLL_COLORS = [
  '#8B4513', // Saddle Brown
  '#D2691E', // Chocolate
  '#CD853F', // Peru
  '#A0522D', // Sienna
  '#DEB887', // Burlywood
  '#F4A460', // Sandy Brown
  '#228B22', // Forest Green
  '#4169E1', // Royal Blue
  '#DC143C', // Crimson
  '#9932CC', // Dark Orchid
];

const generateTrolls = (count: number, intensity: 'low' | 'medium' | 'high'): TrollCharacter[] => {
  const speeds = {
    low: { min: 0.2, max: 0.5 },
    medium: { min: 0.5, max: 1.0 },
    high: { min: 1.0, max: 2.0 },
  };

  const sizes = {
    low: { min: 20, max: 35 },
    medium: { min: 25, max: 45 },
    high: { min: 30, max: 55 },
  };

  const speedRange = speeds[intensity];
  const sizeRange = sizes[intensity];

  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: 85 + Math.random() * 10,
    size: sizeRange.min + Math.random() * (sizeRange.max - sizeRange.min),
    color: TROLL_COLORS[Math.floor(Math.random() * TROLL_COLORS.length)],
    speed: speedRange.min + Math.random() * (speedRange.max - speedRange.min),
    direction: Math.random() > 0.5 ? 1 : -1,
    isJumping: false,
    jumpHeight: 0,
    type: Math.random() > 0.7 ? 'jumper' : Math.random() > 0.5 ? 'runner' : 'walker',
  }));
};

const TrollSVG: React.FC<{ 
  color: string; 
  size: number; 
  isJumping: boolean; 
  jumpHeight: number;
  type: 'walker' | 'jumper' | 'runner';
}> = ({ color, size, isJumping, jumpHeight, type }) => {
  const getBodyShape = () => {
    switch (type) {
      case 'runner':
        return (
          <>
            {/* Body - leaned forward */}
            <ellipse cx="50" cy="55" rx="25" ry="30" fill={color} />
            {/* Head */}
            <circle cx="55" cy="25" r="20" fill={color} />
            {/* Eyes */}
            <circle cx="60" cy="20" r="5" fill="white" />
            <circle cx="62" cy="20" r="2" fill="black" />
            <circle cx="50" cy="20" r="5" fill="white" />
            <circle cx="52" cy="20" r="2" fill="black" />
            {/* Running legs */}
            <ellipse cx="35" cy="80" rx="8" ry="15" fill={color} transform="rotate(-30 35 80)" />
            <ellipse cx="65" cy="75" rx="8" ry="15" fill={color} transform="rotate(20 65 75)" />
            {/* Arms */}
            <ellipse cx="25" cy="45" rx="15" ry="6" fill={color} transform="rotate(-20 25 45)" />
            <ellipse cx="75" cy="50" rx="15" ry="6" fill={color} transform="rotate(30 75 50)" />
          </>
        );
      case 'jumper':
        return (
          <>
            {/* Body */}
            <ellipse cx="50" cy="55" rx="22" ry="28" fill={color} />
            {/* Head */}
            <circle cx="50" cy="25" r="18" fill={color} />
            {/* Excited eyes */}
            <circle cx="55" cy="22" r="6" fill="white" />
            <circle cx="57" cy="22" r="2" fill="black" />
            <circle cx="45" cy="22" r="6" fill="white" />
            <circle cx="47" cy="22" r="2" fill="black" />
            {/* Mouth - happy */}
            <path d="M 40 35 Q 50 42 60 35" stroke="#333" strokeWidth="2" fill="none" />
            {/* Arms up */}
            <ellipse cx="25" cy="40" rx="6" ry="15" fill={color} transform="rotate(-40 25 40)" />
            <ellipse cx="75" cy="40" rx="6" ry="15" fill={color} transform="rotate(40 75 40)" />
            {/* Legs bent */}
            <ellipse cx="40" cy="80" rx="7" ry="12" fill={color} transform="rotate(-15 40 80)" />
            <ellipse cx="60" cy="80" rx="7" ry="12" fill={color} transform="rotate(15 60 80)" />
          </>
        );
      default: // walker
        return (
          <>
            {/* Body */}
            <ellipse cx="50" cy="55" rx="25" ry="32" fill={color} />
            {/* Head */}
            <circle cx="50" cy="22" r="20" fill={color} />
            {/* Eyes */}
            <circle cx="55" cy="18" r="5" fill="white" />
            <circle cx="57" cy="18" r="2" fill="black" />
            <circle cx="45" cy="18" r="5" fill="white" />
            <circle cx="47" cy="18" r="2" fill="black" />
            {/* Mouth */}
            <path d="M 42 28 Q 50 33 58 28" stroke="#333" strokeWidth="2" fill="none" />
            {/* Arms */}
            <ellipse cx="28" cy="50" rx="6" ry="14" fill={color} />
            <ellipse cx="72" cy="50" rx="6" ry="14" fill={color} />
            {/* Legs */}
            <ellipse cx="40" cy="82" rx="8" ry="14" fill={color} />
            <ellipse cx="60" cy="82" rx="8" ry="14" fill={color} />
          </>
        );
    }
  };

  return (
    <svg
      width={size}
      height={size * 1.2}
      viewBox="0 0 100 100"
      style={{
        transform: `translateY(-${jumpHeight}px)`,
        transition: 'transform 0.1s ease-out',
      }}
    >
      {getBodyShape()}
    </svg>
  );
};

export const TrollBattleArena: React.FC<TrollBattleArenaProps> = ({ 
  isActive = true, 
  intensity = 'medium' 
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [trolls, setTrolls] = React.useState<TrollCharacter[]>([]);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const trollCount = useMemo(() => {
    switch (intensity) {
      case 'low': return 8;
      case 'medium': return 12;
      case 'high': return 18;
    }
  }, [intensity]);

  useEffect(() => {
    setTrolls(generateTrolls(trollCount, intensity));
  }, [trollCount, intensity]);

  useEffect(() => {
    if (!isActive) return;

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      setTrolls(prevTrolls => 
        prevTrolls.map(troll => {
          let newX = troll.x + (troll.speed * troll.direction * deltaTime * 0.05);
          let newDirection = troll.direction;
          let newIsJumping = troll.isJumping;
          let newJumpHeight = troll.jumpHeight;

          // Boundary check and direction change
          if (newX <= -10) {
            newX = -10;
            newDirection = 1;
          } else if (newX >= 110) {
            newX = 110;
            newDirection = -1;
          }

          // Random direction change
          if (Math.random() < 0.002) {
            newDirection *= -1;
          }

          // Jump logic for jumpers
          if (troll.type === 'jumper') {
            if (!newIsJumping && Math.random() < 0.01) {
              newIsJumping = true;
              newJumpHeight = 0;
            }
            
            if (newIsJumping) {
              newJumpHeight += 2;
              if (newJumpHeight > 30) {
                newIsJumping = false;
              }
            } else if (newJumpHeight > 0) {
              newJumpHeight -= 2;
            }
          }

          // Random jump for runners
          if (troll.type === 'runner' && !newIsJumping && Math.random() < 0.005) {
            newIsJumping = true;
            newJumpHeight = 0;
          }
          
          if (troll.type === 'runner' && newIsJumping) {
            newJumpHeight += 1.5;
            if (newJumpHeight > 15) {
              newIsJumping = false;
            }
          } else if (troll.type === 'runner' && newJumpHeight > 0) {
            newJumpHeight -= 1.5;
          }

          return {
            ...troll,
            x: newX,
            direction: newDirection,
            isJumping: newIsJumping,
            jumpHeight: Math.max(0, newJumpHeight),
          };
        })
      );

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  return (
    <div 
      ref={canvasRef}
      className="absolute inset-0 overflow-hidden pointer-events-none z-0"
      style={{
        background: `
          radial-gradient(ellipse at 50% 100%, rgba(139, 69, 19, 0.3) 0%, transparent 60%),
          radial-gradient(ellipse at 20% 100%, rgba(34, 139, 34, 0.2) 0%, transparent 40%),
          radial-gradient(ellipse at 80% 100%, rgba(34, 139, 34, 0.2) 0%, transparent 40%),
          linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.4) 100%)
        `,
      }}
    >
      {/* Ground texture */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-32 opacity-30"
        style={{
          background: `
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 50px,
              rgba(139, 69, 19, 0.1) 50px,
              rgba(139, 69, 19, 0.1) 100px
            )
          `,
        }}
      />

      {/* Arena floor glow */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-48"
        style={{
          background: 'radial-gradient(ellipse at 50% 100%, rgba(255, 140, 0, 0.15) 0%, transparent 70%)',
        }}
      />

      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute w-1 h-1 rounded-full bg-amber-400/30"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${60 + Math.random() * 40}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 3,
          }}
        />
      ))}

      {/* Troll characters */}
      {trolls.map(troll => (
        <div
          key={troll.id}
          className="absolute transition-transform"
          style={{
            left: `${troll.x}%`,
            top: `${troll.y}%`,
            transform: `scaleX(${troll.direction})`,
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
          }}
        >
          <TrollSVG 
            color={troll.color} 
            size={troll.size}
            isJumping={troll.isJumping}
            jumpHeight={troll.jumpHeight}
            type={troll.type}
          />
        </div>
      ))}

      {/* Arena border effects */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      
      {/* Side pillars */}
      <div className="absolute left-0 bottom-0 w-16 h-64 bg-gradient-to-r from-amber-900/40 to-transparent" />
      <div className="absolute right-0 bottom-0 w-16 h-64 bg-gradient-to-l from-amber-900/40 to-transparent" />
    </div>
  );
};

export default TrollBattleArena;