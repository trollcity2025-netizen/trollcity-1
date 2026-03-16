import { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Particles from '@tsparticles/react';
import { Engine } from 'tsparticles-engine';
import { useAnimationStore, type CoinExplosionData } from '../../lib/animationManager';
import { Coins } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CoinExplosionProps {
  explosion: CoinExplosionData;
}

const CoinExplosion = ({ explosion }: CoinExplosionProps) => {
  const { reducedMotion, isMobile, particleDensity } = useAnimationStore();
  
  // Calculate particle count based on amount and device
  const particleCount = useMemo(() => {
    const baseAmount = Math.min(explosion.amount, 100);
    const multiplier = particleDensity === 'low' ? 0.3 : particleDensity === 'medium' ? 0.6 : 1;
    return Math.floor(baseAmount * multiplier);
  }, [explosion.amount, particleDensity]);

  // Particle configuration
  const particlesInit = useCallback(async (engine: Engine) => {
    // Load basic particle functionality
    await engine.addShape('circle');
    await engine.addShape('square');
  }, []);

  // Custom particle options for coin explosion
  const options = useMemo(() => ({
    particles: {
      color: {
        value: ['#FFD700', '#FFA500', '#FFC107', '#E6BE8A'],
      },
      shape: {
        type: 'circle' as const,
      },
      opacity: {
        value: 1,
        animation: {
          enable: true,
          minimumValue: 0,
          speed: 2,
          startValue: 'max' as const,
          destroy: 'min' as const,
        },
      },
      size: {
        value: { min: 8, max: 16 },
        animation: {
          enable: true,
          minimumValue: 4,
          speed: 3,
          startValue: 'max' as const,
          destroy: 'min' as const,
        },
      },
      move: {
        enable: true,
        speed: { min: 8, max: 20 },
        direction: 'explode' as const,
        outModes: {
          default: 'destroy' as const,
        },
        gravity: {
          enable: true,
          inverse: false,
          acceleration: 15,
        },
        trail: {
          enable: true,
          length: 8,
          color: '#FFD700',
          opacity: 0.3,
        },
      },
      number: {
        value: particleCount,
      },
      life: {
        duration: {
          value: { min: 1, max: 2 },
        },
        count: 1,
      },
      emit: {
        rate: particleCount / 0.3,
        lifeTime: 0.3,
        size: {
          value: { min: 8, max: 16 },
        },
        position: {
          x: 50,
          y: 50,
          radius: 0,
        },
        direction: 'outside' as const,
      },
    },
    fullScreen: {
      enable: false,
      zIndex: 100,
    },
    detectRetinaPixelRatio: true,
    preset: 'confetti' as const,
  }), [particleCount]);

  // Position for explosion
  const position = explosion.position || { x: 50, y: 50 };

  if (reducedMotion) {
    // Simplified version for reduced motion
    return (
      <motion.div
        className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className={cn(
          'flex items-center gap-2',
          'bg-black/80 backdrop-blur-xl px-6 py-4 rounded-2xl',
          'border border-yellow-500/30 shadow-[0_0_30px_rgba(251,191,36,0.3)]'
        )}>
          <Coins className="text-yellow-400 w-8 h-8" />
          <span className="text-2xl font-bold text-yellow-400">
            +{explosion.amount.toLocaleString()}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-40"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}
    >
      <Particles
        id={`coin-explosion-${explosion.id}`}
        options={options}
        init={particlesInit}
      />
      
      {/* Amount display overlay */}
      <motion.div
        className={cn(
          'absolute',
          `left-[${position.x}%] top-[${position.y}%]`
        )}
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ 
          opacity: 1, 
          scale: 1,
          y: [0, -30, 0],
        }}
        exit={{ opacity: 0, scale: 0.5 }}
        transition={{ duration: 1.5 }}
      >
        <div className={cn(
          'flex items-center gap-2',
          'bg-black/80 backdrop-blur-xl px-6 py-4 rounded-2xl',
          'border border-yellow-500/30 shadow-[0_0_30px_rgba(251,191,36,0.3)]',
          '-translate-x-1/2 -translate-y-1/2'
        )}>
          <Coins className="text-yellow-400 w-8 h-8 animate-pulse" />
          <span className="text-3xl font-bold text-yellow-400">
            +{explosion.amount.toLocaleString()}
          </span>
        </div>
      </motion.div>
    </div>
  );
};

// Container for all coin explosions
export function CoinExplosionsContainer() {
  const { coinExplosions } = useAnimationStore();

  return (
    <AnimatePresence>
      {coinExplosions.map((explosion) => (
        <CoinExplosion key={explosion.id} explosion={explosion} />
      ))}
    </AnimatePresence>
  );
}

export default CoinExplosion;
