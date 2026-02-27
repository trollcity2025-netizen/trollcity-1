import React, { useEffect, useState } from 'react';
import { Rarity } from '../useTrollEngine';

interface TrollJumpScareProps {
  rarity: Rarity;
}

const TrollJumpScare: React.FC<TrollJumpScareProps> = ({ rarity }) => {
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  useEffect(() => {
    // Start animation after a short delay to ensure the overlay is visible
    const timer = setTimeout(() => {
      setIsAnimating(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Determine the size and intensity of the jumpscare based on rarity
  const getJumpScareStyle = () => {
    switch (rarity) {
      case 'COMMON':
        return 'w-64 h-64';
      case 'RARE':
        return 'w-80 h-80';
      case 'EPIC':
        return 'w-96 h-96';
      case 'LEGENDARY':
        return 'w-[80vh] h-[80vh]';
      default:
        return 'w-64 h-64';
    }
  };

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black z-[1001] flex items-center justify-center">
      <div 
        className={`relative transition-all duration-300 ease-out ${
          isAnimating ? getJumpScareStyle() : 'w-0 h-0'
        }`}
      >
        {/* Troll face image - this should be replaced with a real image */}
        <img 
          src="https://picsum.photos/400/400" 
          alt="Troll Jumpscare" 
          className="object-cover rounded-full shadow-2xl animate-pulse"
          style={{ filter: 'brightness(1.2) saturate(1.5)' }}
        />
        
        {/* Neon border effect based on rarity */}
        <div 
          className={`absolute inset-0 rounded-full border-4 ${
            rarity === 'COMMON' ? 'border-green-500' :
            rarity === 'RARE' ? 'border-blue-500' :
            rarity === 'EPIC' ? 'border-purple-500' : 'border-yellow-500'
          } animate-pulse`}
          style={{ 
            animationDuration: rarity === 'LEGENDARY' ? '0.5s' : '1s',
            boxShadow: `0 0 ${rarity === 'LEGENDARY' ? '50' : '20'}px ${
              rarity === 'COMMON' ? 'rgba(0, 255, 0, 0.8)' :
              rarity === 'RARE' ? 'rgba(0, 0, 255, 0.8)' :
              rarity === 'EPIC' ? 'rgba(128, 0, 128, 0.8)' : 'rgba(255, 255, 0, 0.8)'
            }`
          }}
        />

        {/* Random text based on rarity */}
        <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 text-white text-center">
          <p className={`text-xl font-bold ${
            rarity === 'COMMON' ? 'text-green-400' :
            rarity === 'RARE' ? 'text-blue-400' :
            rarity === 'EPIC' ? 'text-purple-400' : 'text-yellow-400'
          }`}>
            {rarity === 'COMMON' ? 'BOO!' :
             rarity === 'RARE' ? 'Gotcha!' :
             rarity === 'EPIC' ? 'Mwahahaha!' : 'SURPRISE!'
            }
          </p>
          {rarity === 'LEGENDARY' && (
            <p className="text-sm text-yellow-300 mt-1">You&apos;ve been trolled!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrollJumpScare;
