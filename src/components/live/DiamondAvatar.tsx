import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDiamondForLevel } from '../../types/liveStreaming';
import type { DiamondTier } from '../../types/liveStreaming';

type SpecialType = 'top_buyer' | 'top_broadcaster' | 'mvp' | null;

interface DiamondAvatarProps {
  level: number;
  avatarUrl: string;
  username: string;
  size?: 'sm' | 'md' | 'lg';
  specialType?: SpecialType;
  isJoining?: boolean;
  onJoinComplete?: () => void;
}

const sizeMap = {
  sm: { container: 40, borderWidth: 2, fontSize: 9, badgeSize: 'text-[7px]', particleCount: 4 },
  md: { container: 64, borderWidth: 3, fontSize: 11, badgeSize: 'text-[9px]', particleCount: 6 },
  lg: { container: 96, borderWidth: 4, fontSize: 14, badgeSize: 'text-[11px]', particleCount: 8 },
};

function getSparkleKeyframes(diamondStyle: DiamondTier['diamond_style']): string {
  switch (diamondStyle) {
    case 'glowing':
      return `
        @keyframes diamond-glow-pulse {
          0%, 100% { opacity: 0.6; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `;
    case 'crystal':
      return `
        @keyframes diamond-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `;
    case 'artifact':
      return `
        @keyframes diamond-artifact-cosmic {
          0% { filter: hue-rotate(0deg) brightness(1); }
          25% { filter: hue-rotate(30deg) brightness(1.15); }
          50% { filter: hue-rotate(-20deg) brightness(1.1); }
          75% { filter: hue-rotate(10deg) brightness(1.2); }
          100% { filter: hue-rotate(0deg) brightness(1); }
        }
        @keyframes diamond-fire {
          0%, 100% { filter: hue-rotate(0deg) brightness(1); }
          25% { filter: hue-rotate(-15deg) brightness(1.1); }
          50% { filter: hue-rotate(15deg) brightness(1.2); }
          75% { filter: hue-rotate(-10deg) brightness(1.05); }
        }
      `;
    default:
      return '';
  }
}

function getDiamondAnimationStyle(
  diamondStyle: DiamondTier['diamond_style'],
  animation: string | null,
  speed: 'slow' | 'normal' | 'fast'
): React.CSSProperties {
  if (!animation) return {};

  const durationMap = { slow: '4s', normal: '2s', fast: '1s' };
  const duration = durationMap[speed];

  switch (animation) {
    case 'pulse':
      return { animation: `diamond-glow-pulse ${duration} ease-in-out infinite` };
    case 'shimmer':
      return {
        animation: `diamond-shimmer ${duration} linear infinite`,
        backgroundSize: '200% 100%',
      };
    case 'fire':
      return { animation: `diamond-fire ${duration} ease-in-out infinite` };
    case 'artifact_pulse':
      return { animation: `diamond-artifact-cosmic ${duration} ease-in-out infinite` };
    default:
      return {};
  }
}

function SparkleParticle({
  color,
  index,
  total,
  containerSize,
}: {
  color: string;
  index: number;
  total: number;
  containerSize: number;
}) {
  const angle = (index / total) * 360;
  const radius = containerSize / 2 + 8;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;
  const delay = index * 0.25;
  const duration = 1.2 + Math.random() * 0.8;

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: 3 + Math.random() * 2,
        height: 3 + Math.random() * 2,
        backgroundColor: color,
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        boxShadow: `0 0 6px ${color}`,
      }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0.5, 1.3, 0.5],
        y: [0, -6, 0],
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

function DiamondStyleRenderer({
  tier,
  size,
  animStyle,
}: {
  tier: DiamondTier;
  size: (typeof sizeMap)['sm'];
  animStyle: React.CSSProperties;
}) {
  const { border_color, border_gradient, glow_color, glow_intensity, diamond_style } = tier;
  const bw = size.borderWidth;

  const glowShadow =
    glow_color && glow_intensity > 0
      ? `0 0 ${glow_intensity * 14}px ${glow_color}, 0 0 ${glow_intensity * 28}px ${glow_color}40, inset 0 0 ${glow_intensity * 10}px ${glow_color}20`
      : 'none';

  if (diamond_style === 'flat') {
    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          border: `${bw}px solid ${border_color}`,
          boxShadow: glowShadow,
          ...animStyle,
        }}
      />
    );
  }

  if (diamond_style === 'beveled') {
    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          border: `${bw}px solid ${border_color}`,
          boxShadow: `${glowShadow}, inset 2px 2px 4px rgba(255,255,255,0.2), inset -2px -2px 4px rgba(0,0,0,0.3)`,
          ...animStyle,
        }}
      />
    );
  }

  if (diamond_style === 'glowing') {
    return (
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          border: `${bw}px solid ${border_color}`,
          boxShadow: glowShadow,
          ...animStyle,
        }}
        animate={
          glow_intensity > 0.4
            ? {
                boxShadow: [
                  glowShadow,
                  `0 0 ${glow_intensity * 20}px ${glow_color}, 0 0 ${glow_intensity * 40}px ${glow_color}60`,
                  glowShadow,
                ],
              }
            : {}
        }
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    );
  }

  if (diamond_style === 'crystal') {
    const gradient = border_gradient
      ? border_gradient
      : `linear-gradient(135deg, ${border_color}, ${border_color}88, ${border_color})`;

    return (
      <>
        <div
          className="absolute inset-0 pointer-events-none"
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
          className="absolute inset-0 pointer-events-none"
          style={{
            border: `${Math.max(1, bw - 1)}px solid transparent`,
            background: `linear-gradient(#0000, #0000) padding-box, linear-gradient(90deg, transparent, ${border_color}60, transparent) border-box`,
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            animation: 'diamond-shimmer 2s linear infinite',
            backgroundSize: '200% 100%',
          }}
        />
      </>
    );
  }

  if (diamond_style === 'artifact') {
    const gradient = border_gradient
      ? border_gradient
      : `linear-gradient(135deg, ${border_color}, ${border_color}88, ${border_color})`;

    return (
      <>
        <div
          className="absolute inset-0 pointer-events-none"
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
          className="absolute inset-0 pointer-events-none"
          style={{
            border: `${bw + 1}px solid transparent`,
            background: `linear-gradient(#0000, #0000) padding-box, linear-gradient(90deg, transparent, #fff4, transparent) border-box`,
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            animation: 'diamond-shimmer 1.5s linear infinite',
            backgroundSize: '200% 100%',
            opacity: 0.5,
          }}
        />
        <motion.div
          className="absolute pointer-events-none"
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
      className="absolute inset-0 pointer-events-none"
      style={{
        border: `${bw}px solid ${border_color}`,
        boxShadow: glowShadow,
        ...animStyle,
      }}
    />
  );
}

function StatusOverlay({ specialType, size }: { specialType: SpecialType; size: (typeof sizeMap)['sm'] }) {
  if (!specialType) return null;

  const overlayMap: Record<string, { gradient: string; label: string; animClass: string }> = {
    top_buyer: {
      gradient: 'from-yellow-400/90 to-orange-500/90',
      label: 'TOP BUYER',
      animClass: 'animate-pulse',
    },
    top_broadcaster: {
      gradient: 'from-cyan-400/90 to-purple-500/90',
      label: 'TOP BC',
      animClass: 'animate-pulse',
    },
    mvp: {
      gradient: 'from-red-500/90 to-yellow-500/90',
      label: 'MVP',
      animClass: 'animate-pulse',
    },
  };

  const overlay = overlayMap[specialType];
  if (!overlay) return null;

  return (
    <motion.div
      className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${overlay.gradient} ${overlay.animClass} pointer-events-none`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ zIndex: 3 }}
    >
      <span
        className={`font-black ${size.badgeSize} text-white drop-shadow-lg`}
        style={{ transform: 'rotate(-45deg)' }}
      >
        {overlay.label}
      </span>
    </motion.div>
  );
}

function SpecialGlow({ specialType, size }: { specialType: SpecialType; size: number }) {
  if (!specialType) return null;

  const glowMap: Record<string, { color: string; intensity: number }> = {
    top_buyer: { color: '#f59e0b', intensity: 1 },
    top_broadcaster: { color: '#06b6d4', intensity: 0.8 },
    mvp: { color: '#ef4444', intensity: 1.2 },
  };

  const glow = glowMap[specialType];
  if (!glow) return null;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      style={{
        boxShadow: `0 0 ${glow.intensity * 16}px ${glow.color}, 0 0 ${glow.intensity * 32}px ${glow.color}40`,
        zIndex: 0,
      }}
      animate={{
        opacity: [0.4, 0.8, 0.4],
      }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

function LevelBadge({
  level,
  tier,
  size,
}: {
  level: number;
  tier: DiamondTier;
  size: (typeof sizeMap)['sm'];
}) {
  return (
    <motion.div
      className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm z-10"
      style={{
        backgroundColor: `${tier.border_color}20`,
        border: `1px solid ${tier.border_color}40`,
        transform: 'rotate(0deg)',
      }}
      initial={{ y: 5, opacity: 0, scale: 0.8 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 }}
    >
      <span
        className={`font-bold ${size.badgeSize}`}
        style={{ color: tier.border_color }}
      >
        {level}
      </span>
    </motion.div>
  );
}

export default function DiamondAvatar({
  level,
  avatarUrl,
  username,
  size = 'md',
  specialType = null,
  isJoining = false,
  onJoinComplete,
}: DiamondAvatarProps) {
  const tier = getDiamondForLevel(level);
  const dims = sizeMap[size];

  const keyframes = useMemo(
    () => getSparkleKeyframes(tier.diamond_style),
    [tier.diamond_style]
  );

  const animStyle = useMemo(
    () => getDiamondAnimationStyle(tier.diamond_style, tier.animation, tier.animation_speed),
    [tier.diamond_style, tier.animation, tier.animation_speed]
  );

  const sparkles = useMemo(() => {
    if (!tier.has_sparkle || !tier.sparkle_color) return null;
    return Array.from({ length: dims.particleCount }, (_, i) => (
      <SparkleParticle
        key={i}
        color={tier.sparkle_color!}
        index={i}
        total={dims.particleCount}
        containerSize={dims.container}
      />
    ));
  }, [tier.has_sparkle, tier.sparkle_color, dims.particleCount, dims.container]);

  const innerSize = dims.container - dims.borderWidth * 2;
  const diamondRotation = 45;

  return (
    <div className="relative inline-flex items-center justify-center">
      <style>{keyframes}</style>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${level}-${specialType}`}
          className="relative flex items-center justify-center"
          style={{ width: dims.container, height: dims.container }}
          initial={isJoining ? { scale: 0, rotate: -180, opacity: 0 } : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={
            isJoining
              ? { type: 'spring', stiffness: 260, damping: 20 }
              : { duration: 0.3, ease: 'easeOut' }
          }
          onAnimationComplete={() => {
            if (isJoining && onJoinComplete) {
              onJoinComplete();
            }
          }}
        >
          {sparkles}

          <SpecialGlow specialType={specialType} size={dims.container} />

          <motion.div
            className="relative overflow-hidden"
            style={{
              width: innerSize,
              height: innerSize,
              transform: `rotate(${diamondRotation}deg)`,
              zIndex: 1,
            }}
          >
            <img
              src={avatarUrl}
              alt={username}
              className="w-full h-full object-cover"
              style={{ transform: `rotate(-${diamondRotation}deg) scale(1.42)` }}
              draggable={false}
            />

            <DiamondStyleRenderer tier={tier} size={dims} animStyle={animStyle} />
            <StatusOverlay specialType={specialType} size={dims} />
          </motion.div>

          <LevelBadge level={level} tier={tier} size={dims} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
