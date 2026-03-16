import { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Particles from '@tsparticles/react';
import { Engine } from 'tsparticles-engine';
import { useAnimationStore, type DiamondRainData } from '../../lib/animationManager';
import { Gem } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DiamondRainProps {
  rain: DiamondRainData;
}

const DiamondRain = ({ rain }: DiamondRainProps) => {
  const { reducedMotion, isMobile, particleDensity } = useAnimationStore();
  
  // Calculate particle count based on amount and device
  const particleCount = useMemo(() => {
    const baseAmount = Math.min(rain.amount, 50);
    const multiplier = particleDensity === 'low' ? 0.3 : particleDensity === 'medium' ? 0.6 : 1;
    return Math.floor(baseAmount * multiplier);
  }, [rain.amount, particleDensity]);

  // Particle configuration for diamond rain
  const particlesInit = useCallback(async (engine: Engine) => {
    await engine.addShape('star');
  }, []);

  // Custom particle options for diamond rain
  const options = useMemo(() => ({
    particles: {
      color: {
        value: ['#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc', '#ffffff'],
      },
      shape: {
        type: 'star' as const,
        options: {
          star: {
            points: 5,
            innerRadius: 0.3,
          },
        },
      },
      opacity: {
        value: 1,
        animation: {
          enable: true,
          minimumValue: 0.3,
          speed: 1,
        },
      },
      size: {
        value: { min: 8, max: 20 },
        animation: {
          enable: true,
          minimumValue: 4,
          speed: 2,
        },
      },
      move: {
        enable: true,
        speed: { min: 5, max: 15 },
        direction: 'bottom' as const,
        outModes: {
          default: 'destroy' as const,
        },
        gravity: {
          enable: true,
          inverse: false,
          acceleration: 8,
        },
        trail: {
          enable: true,
          length: 12,
          color: '#06b6d4',
          opacity: 0.4,
        },
      },
      number: {
        value: particleCount,
      },
      life: {
        duration: {
          value: { min: 2, max: 4 },
        },
        count: 1,
      },
      emit: {
        rate: particleCount / 2,
        lifeTime: 2,
        size: {
          value: { min: 8, max: 16 },
        },
        position: {
          x: { min: 0, max: 100 },
          y: -10,
        },
        direction: 'bottom' as const,
      },
    },
    fullScreen: {
      enable: false,
      zIndex: 100,
    },
    detectRetinaPixelRatio: true,
  }), [particleCount]);

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
          'border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.3)]'
        )}>
          <Gem className="text-cyan-400 w-8 h-8" />
          <span className="text-2xl font-bold text-cyan-400">
            +{rain.amount.toLocaleString()} Diamonds!
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
        id={`diamond-rain-${rain.id}`}
        options={options}
        init={particlesInit}
      />
      
      {/* Amount display overlay at top */}
      <motion.div
        className="absolute top-10 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, y: -50 }}
        animate={{ 
          opacity: 1, 
          y: 0,
        }}
        exit={{ opacity: 0, y: -50 }}
        transition={{ duration: 1 }}
      >
        <div className={cn(
          'flex items-center gap-2',
          'bg-black/80 backdrop-blur-xl px-6 py-4 rounded-2xl',
          'border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.3)]'
        )}>
          <motion.div
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          >
            <Gem className="text-cyan-400 w-8 h-8" />
          </motion.div>
          <span className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            +{rain.amount.toLocaleString()}
          </span>
        </div>
      </motion.div>
    </div>
  );
};

// Container for all diamond rains
export function DiamondRainsContainer() {
  const { diamondRains } = useAnimationStore();

  return (
    <AnimatePresence>
      {diamondRains.map((rain) => (
        <DiamondRain key={rain.id} rain={rain} />
      ))}
    </AnimatePresence>
  );
}

export default DiamondRain;
