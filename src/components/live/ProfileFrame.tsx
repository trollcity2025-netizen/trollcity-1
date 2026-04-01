import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getFrameForLevel } from '../../types/liveStreaming';
import type { AnimationType } from '../../types/liveStreaming';

interface ProfileFrameProps {
  level: number;
  avatarUrl: string;
  size: 'sm' | 'md' | 'lg' | 'xl';
  username: string;
  showLevel: boolean;
}

const sizeMap = {
  sm: { container: 48, borderWidth: 2, fontSize: 10, badgeSize: 'text-[8px]', particleCount: 3 },
  md: { container: 72, borderWidth: 3, fontSize: 12, badgeSize: 'text-[10px]', particleCount: 5 },
  lg: { container: 96, borderWidth: 4, fontSize: 14, badgeSize: 'text-xs', particleCount: 7 },
  xl: { container: 128, borderWidth: 5, fontSize: 16, badgeSize: 'text-sm', particleCount: 9 },
};

const rarityColors: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
  mythic: '#ec4899',
  exclusive: '#06b6d4',
  ultimate: '#ffd700',
};

function getAnimationKeyframes(type: AnimationType): string {
  switch (type) {
    case 'pulse':
      return `
        @keyframes frame-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `;
    case 'rotate':
      return `
        @keyframes frame-rotate {
          0% { --angle: 0deg; }
          100% { --angle: 360deg; }
        }
      `;
    case 'shimmer':
      return `
        @keyframes frame-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `;
    case 'fire':
      return `
        @keyframes frame-fire {
          0%, 100% { filter: hue-rotate(0deg) brightness(1); }
          25% { filter: hue-rotate(-15deg) brightness(1.1); }
          50% { filter: hue-rotate(15deg) brightness(1.2); }
          75% { filter: hue-rotate(-10deg) brightness(1.05); }
        }
      `;
    case 'electric':
      return `
        @keyframes frame-electric {
          0%, 100% { opacity: 1; }
          5% { opacity: 0.8; }
          10% { opacity: 1; }
          15% { opacity: 0.6; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          85% { opacity: 0.7; }
          90% { opacity: 1; }
        }
      `;
    case 'cosmic':
      return `
        @keyframes frame-cosmic {
          0% { filter: hue-rotate(0deg); }
          33% { filter: hue-rotate(60deg); }
          66% { filter: hue-rotate(-60deg); }
          100% { filter: hue-rotate(0deg); }
        }
      `;
    default:
      return '';
  }
}

function getAnimationStyle(
  type: AnimationType,
  speed: 'slow' | 'normal' | 'fast'
): React.CSSProperties {
  if (!type) return {};

  const durationMap = { slow: '4s', normal: '2s', fast: '1s' };
  const duration = durationMap[speed];

  switch (type) {
    case 'pulse':
      return { animation: `frame-pulse ${duration} ease-in-out infinite` };
    case 'rotate':
      return { animation: `frame-rotate ${duration} linear infinite` };
    case 'shimmer':
      return {
        animation: `frame-shimmer ${duration} linear infinite`,
        backgroundSize: '200% 100%',
      };
    case 'fire':
      return { animation: `frame-fire ${duration} ease-in-out infinite` };
    case 'electric':
      return { animation: `frame-electric ${duration} steps(1) infinite` };
    case 'cosmic':
      return { animation: `frame-cosmic ${duration} ease-in-out infinite` };
    default:
      return {};
  }
}

function Particle({
  color,
  index,
  total,
  size,
}: {
  color: string;
  index: number;
  total: number;
  size: number;
}) {
  const angle = (index / total) * 360;
  const radius = size / 2 + 6;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;
  const delay = index * 0.3;
  const duration = 1.5 + Math.random() * 1;

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: 3 + Math.random() * 3,
        height: 3 + Math.random() * 3,
        backgroundColor: color,
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        boxShadow: `0 0 6px ${color}`,
      }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0.5, 1.2, 0.5],
        y: [0, -8, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

function FrameStyleRenderer({
  tier,
  size,
  animStyle,
}: {
  tier: ReturnType<typeof getFrameForLevel>;
  size: (typeof sizeMap)['sm'];
  animStyle: React.CSSProperties;
}) {
  const { border_color, border_gradient, glow_color, glow_intensity, frame_style } = tier;
  const boxSize = size.container;
  const bw = size.borderWidth;

  const glowShadow =
    glow_color && glow_intensity > 0
      ? `0 0 ${glow_intensity * 12}px ${glow_color}, 0 0 ${glow_intensity * 24}px ${glow_color}40, inset 0 0 ${glow_intensity * 8}px ${glow_color}20`
      : 'none';

  const gradientBorder = border_gradient
    ? {
        borderImage: border_gradient,
        borderImageSlice: 1,
      }
    : {};

  if (frame_style === 'flat') {
    return (
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          border: `${bw}px solid ${border_color}`,
          ...gradientBorder,
          boxShadow: glowShadow,
          ...animStyle,
        }}
      />
    );
  }

  if (frame_style === 'beveled') {
    return (
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          border: `${bw}px solid ${border_color}`,
          ...gradientBorder,
          boxShadow: `${glowShadow}, inset 2px 2px 4px rgba(255,255,255,0.2), inset -2px -2px 4px rgba(0,0,0,0.3)`,
          ...animStyle,
        }}
      />
    );
  }

  if (frame_style === 'glowing') {
    return (
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          border: `${bw}px solid ${border_color}`,
          ...gradientBorder,
          boxShadow: glowShadow,
          ...animStyle,
        }}
        animate={
          glow_intensity > 0.4
            ? {
                boxShadow: [
                  glowShadow,
                  `0 0 ${glow_intensity * 18}px ${glow_color}, 0 0 ${glow_intensity * 36}px ${glow_color}60`,
                  glowShadow,
                ],
              }
            : {}
        }
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    );
  }

  if (frame_style === 'animated') {
    return (
      <>
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: `${bw}px solid transparent`,
            background: border_gradient
              ? `linear-gradient(#000, #000) padding-box, ${border_gradient} border-box`
              : `linear-gradient(#000, #000) padding-box, linear-gradient(135deg, ${border_color}, ${border_color}88) border-box`,
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            boxShadow: glowShadow,
            ...animStyle,
          }}
        />
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: `${Math.max(1, bw - 1)}px solid transparent`,
            background: `linear-gradient(#0000, #0000) padding-box, linear-gradient(90deg, transparent, ${border_color}60, transparent) border-box`,
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            animation: 'frame-shimmer 2s linear infinite',
            backgroundSize: '200% 100%',
          }}
        />
      </>
    );
  }

  if (frame_style === 'premium') {
    const gradient = border_gradient
      ? border_gradient
      : `linear-gradient(135deg, ${border_color}, ${border_color}88, ${border_color})`;

    return (
      <>
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: `${bw}px solid transparent`,
            background: `linear-gradient(#000, #000) padding-box, ${gradient} border-box`,
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            boxShadow: glowShadow,
            ...animStyle,
          }}
        />
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: `${bw + 1}px solid transparent`,
            background: `linear-gradient(#0000, #0000) padding-box, linear-gradient(90deg, transparent, #fff4, transparent) border-box`,
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            animation: 'frame-shimmer 1.5s linear infinite',
            backgroundSize: '200% 100%',
            opacity: 0.5,
          }}
        />
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: -bw - 4,
            border: `1px solid ${border_color}30`,
            boxShadow: `0 0 ${glow_intensity * 20}px ${glow_color}30`,
          }}
          animate={{
            opacity: [0.3, 0.7, 0.3],
            scale: [1, 1.02, 1],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </>
    );
  }

  return (
    <div
      className="absolute inset-0 rounded-full pointer-events-none"
      style={{
        border: `${bw}px solid ${border_color}`,
        boxShadow: glowShadow,
        ...animStyle,
      }}
    />
  );
}

export default function ProfileFrame({
  level,
  avatarUrl,
  size = 'md',
  username,
  showLevel = true,
}: ProfileFrameProps) {
  const tier = getFrameForLevel(level);
  const dims = sizeMap[size];

  const animationKeyframes = useMemo(
    () => getAnimationKeyframes(tier.animation_type),
    [tier.animation_type]
  );

  const animStyle = useMemo(
    () => getAnimationStyle(tier.animation_type, tier.animation_speed),
    [tier.animation_type, tier.animation_speed]
  );

  const particles = useMemo(() => {
    if (!tier.has_particles || !tier.particle_color) return null;
    return Array.from({ length: dims.particleCount }, (_, i) => (
      <Particle
        key={i}
        color={tier.particle_color!}
        index={i}
        total={dims.particleCount}
        size={dims.container}
      />
    ));
  }, [tier.has_particles, tier.particle_color, dims.particleCount, dims.container]);

  const rarityColor = rarityColors[tier.rarity] || '#9ca3af';

  return (
    <div className="flex flex-col items-center gap-1">
      <style>{animationKeyframes}</style>

      <div
        className="relative flex items-center justify-center"
        style={{ width: dims.container, height: dims.container }}
      >
        {particles}

        <motion.div
          className="relative rounded-full overflow-hidden"
          style={{
            width: dims.container - dims.borderWidth * 2,
            height: dims.container - dims.borderWidth * 2,
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <img
            src={avatarUrl}
            alt={username}
            className="w-full h-full object-cover rounded-full"
            draggable={false}
          />

          <FrameStyleRenderer tier={tier} size={dims} animStyle={animStyle} />
        </motion.div>
      </div>

      {showLevel && (
        <motion.div
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: `${rarityColor}20`,
            border: `1px solid ${rarityColor}40`,
          }}
          initial={{ y: 5, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <span
            className={`font-bold ${dims.badgeSize}`}
            style={{ color: rarityColor }}
          >
            Lvl {level}
          </span>
          <span
            className={`${dims.badgeSize} opacity-70 capitalize`}
            style={{ color: rarityColor }}
          >
            {tier.tier_name}
          </span>
        </motion.div>
      )}
    </div>
  );
}
