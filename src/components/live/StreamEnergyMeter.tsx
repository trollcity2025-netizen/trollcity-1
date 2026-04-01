import React, { useMemo, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Flame, TrendingUp } from 'lucide-react';

interface EnergyAction {
  id: string;
  type: 'gift' | 'follow' | 'share' | 'superchat' | 'boost';
  label: string;
  energy: number;
  timestamp: number;
}

interface StreamEnergyMeterProps {
  streamId: string;
  className?: string;
}

interface EnergyLevel {
  name: string;
  min: number;
  max: number;
  gradient: [string, string, string];
  glowColor: string;
  particleColor: string;
  ringGlow: string;
}

const ENERGY_LEVELS: EnergyLevel[] = [
  { name: 'Calm', min: 0, max: 200, gradient: ['#22c55e', '#4ade80', '#86efac'], glowColor: '#22c55e', particleColor: '#4ade80', ringGlow: '0 0 12px #22c55e40' },
  { name: 'Warming', min: 200, max: 400, gradient: ['#eab308', '#facc15', '#fde047'], glowColor: '#eab308', particleColor: '#facc15', ringGlow: '0 0 16px #eab30860' },
  { name: 'Hot', min: 400, max: 600, gradient: ['#f97316', '#fb923c', '#fdba74'], glowColor: '#f97316', particleColor: '#fb923c', ringGlow: '0 0 20px #f9731680' },
  { name: 'Fire', min: 600, max: 800, gradient: ['#ef4444', '#f97316', '#fbbf24'], glowColor: '#ef4444', particleColor: '#f97316', ringGlow: '0 0 28px #ef4444a0' },
  { name: 'Inferno', min: 800, max: 1000, gradient: ['#dc143c', '#ff4500', '#fffacd'], glowColor: '#dc143c', particleColor: '#ff6347', ringGlow: '0 0 40px #dc143cc0, 0 0 80px #ff450060' },
];

const ACTION_ICONS: Record<EnergyAction['type'], React.ReactNode> = {
  gift: <Zap size={10} />,
  follow: <TrendingUp size={10} />,
  share: <Zap size={10} />,
  superchat: <Flame size={10} />,
  boost: <Flame size={10} />,
};

function getEnergyLevel(energy: number): EnergyLevel {
  for (let i = ENERGY_LEVELS.length - 1; i >= 0; i--) {
    if (energy >= ENERGY_LEVELS[i].min) return ENERGY_LEVELS[i];
  }
  return ENERGY_LEVELS[0];
}

function getProgress(energy: number): number {
  return Math.min(energy / 1000, 1);
}

function ParticleOrb({
  index,
  total,
  radius,
  color,
  size,
  speed,
}: {
  index: number;
  total: number;
  radius: number;
  color: string;
  size: number;
  speed: number;
}) {
  const angle = (index / total) * 360;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}, ${color}00)`,
        boxShadow: `0 0 ${size * 2}px ${color}`,
      }}
      animate={{
        x: Array.from({ length: 12 }, (_, i) =>
          Math.cos(((angle + i * 30) * Math.PI) / 180) * radius
        ),
        y: Array.from({ length: 12 }, (_, i) =>
          Math.sin(((angle + i * 30) * Math.PI) / 180) * radius
        ),
        opacity: [0.3, 0.9, 0.3],
        scale: [0.6, 1.2, 0.6],
      }}
      transition={{
        duration: speed,
        delay: index * (speed / total),
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

function LightningBolt({
  x,
  y,
  delay,
}: {
  x: number;
  y: number;
  delay: number;
}) {
  return (
    <motion.svg
      className="absolute pointer-events-none"
      style={{ left: x, top: y, width: 14, height: 20 }}
      viewBox="0 0 14 20"
      initial={{ opacity: 0, scale: 0, rotate: Math.random() * 60 - 30 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0.3, 1.1, 0.9, 0.2],
        y: [0, -12, -20, -30],
      }}
      transition={{
        duration: 0.7,
        delay,
        repeat: Infinity,
        repeatDelay: 0.5 + Math.random() * 1.5,
        ease: 'easeOut',
      }}
    >
      <path
        d="M8 0L3 9H6L2 20L12 8H8L12 0H8Z"
        fill="#fde047"
        stroke="#fbbf24"
        strokeWidth="0.5"
      />
    </motion.svg>
  );
}

function FireParticle({
  index,
  radius,
  centerX,
  centerY,
}: {
  index: number;
  radius: number;
  centerX: number;
  centerY: number;
}) {
  const angle = (index / 8) * 360 + Math.random() * 20;
  const dist = radius + Math.random() * 16;
  const startX = Math.cos((angle * Math.PI) / 180) * dist;
  const startY = Math.sin((angle * Math.PI) / 180) * dist;

  return (
    <motion.div
      className="absolute pointer-events-none rounded-full"
      style={{
        width: 2 + Math.random() * 3,
        height: 2 + Math.random() * 3,
        background: `radial-gradient(circle, #fde047, #f9731600)`,
        left: centerX,
        top: centerY,
      }}
      animate={{
        x: [startX, startX + (Math.random() * 20 - 10)],
        y: [startY, startY - 20 - Math.random() * 30],
        opacity: [0, 0.8, 0],
        scale: [0.5, 1, 0.3],
      }}
      transition={{
        duration: 1 + Math.random() * 0.8,
        delay: index * 0.15 + Math.random() * 0.5,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

function ActionFeedItem({ action, index }: { action: EnergyAction; index: number }) {
  return (
    <motion.div
      key={action.id}
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
      style={{
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'rgba(255,255,255,0.9)',
      }}
      initial={{ opacity: 0, x: 20, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.8 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <span className="text-yellow-400">{ACTION_ICONS[action.type]}</span>
      <span className="opacity-80">{action.label}</span>
      <span className="text-green-400 font-bold">+{action.energy}</span>
    </motion.div>
  );
}

const SVG_SIZE = 160;
const STROKE_WIDTH = 8;
const RADIUS = (SVG_SIZE - STROKE_WIDTH * 2) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function StreamEnergyMeter({ streamId, className = '' }: StreamEnergyMeterProps) {
  const [currentEnergy, setCurrentEnergy] = useState(350);
  const [actions, setActions] = useState<EnergyAction[]>([]);
  const animFrameRef = useRef<number>(0);
  const targetEnergyRef = useRef(350);
  const displayEnergyRef = useRef(350);

  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      displayEnergyRef.current += (targetEnergyRef.current - displayEnergyRef.current) * 0.08;
      setCurrentEnergy(Math.round(displayEnergyRef.current));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const types: EnergyAction['type'][] = ['gift', 'follow', 'share', 'superchat', 'boost'];
      const labels = ['Gift sent', 'New follow', 'Shared stream', 'Superchat', 'Energy boost'];
      const typeIdx = Math.floor(Math.random() * types.length);
      const energyGain = [50, 20, 30, 80, 100][typeIdx] + Math.floor(Math.random() * 30);
      const newAction: EnergyAction = {
        id: `${Date.now()}-${Math.random()}`,
        type: types[typeIdx],
        label: labels[typeIdx],
        energy: energyGain,
        timestamp: Date.now(),
      };
      setActions((prev) => [newAction, ...prev].slice(0, 5));
      targetEnergyRef.current = Math.min(targetEnergyRef.current + energyGain, 1000);
      setTimeout(() => {
        targetEnergyRef.current = Math.max(targetEnergyRef.current - energyGain * 0.3, 0);
      }, 4000);
    }, 2500 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  const level = useMemo(() => getEnergyLevel(currentEnergy), [currentEnergy]);
  const progress = useMemo(() => getProgress(currentEnergy), [currentEnergy]);
  const isFire = currentEnergy >= 600;
  const isInferno = currentEnergy >= 800;
  const isHot = currentEnergy >= 400;

  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const gradientId = `energy-gradient-${streamId}`;
  const glowFilterId = `energy-glow-${streamId}`;

  const particles = useMemo(() => {
    if (currentEnergy < 200) return null;
    const count = isFire ? 10 : isHot ? 6 : 4;
    const speed = isFire ? 3 : isHot ? 4 : 5;
    return Array.from({ length: count }, (_, i) => (
      <ParticleOrb
        key={i}
        index={i}
        total={count}
        radius={SVG_SIZE / 2 + 4}
        color={level.particleColor}
        size={isFire ? 4 + Math.random() * 3 : 3 + Math.random() * 2}
        speed={speed}
      />
    ));
  }, [currentEnergy, level.particleColor, isFire, isHot]);

  const lightnings = useMemo(() => {
    if (!isFire) return null;
    const count = isInferno ? 5 : 3;
    return Array.from({ length: count }, (_, i) => (
      <LightningBolt
        key={i}
        x={SVG_SIZE / 2 + Math.cos((i / count) * Math.PI * 2) * (SVG_SIZE / 2 + 10) - 7}
        y={SVG_SIZE / 2 + Math.sin((i / count) * Math.PI * 2) * (SVG_SIZE / 2 + 10) - 10}
        delay={i * 0.4 + Math.random() * 0.3}
      />
    ));
  }, [isFire, isInferno]);

  const fireParticles = useMemo(() => {
    if (!isFire) return null;
    return Array.from({ length: 12 }, (_, i) => (
      <FireParticle
        key={i}
        index={i}
        radius={SVG_SIZE / 2 - 4}
        centerX={SVG_SIZE / 2}
        centerY={SVG_SIZE / 2}
      />
    ));
  }, [isFire]);

  const glowIntensity = isInferno ? 1 : isFire ? 0.7 : isHot ? 0.4 : currentEnergy >= 200 ? 0.2 : 0;

  return (
    <motion.div
      className={`relative flex flex-col items-center gap-2 ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <style>{`
        @keyframes energy-ring-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes energy-shimmer {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 20; }
        }
        @keyframes inferno-pulse {
          0%, 100% { box-shadow: 0 0 30px #dc143c60, 0 0 60px #ff450030; }
          50% { box-shadow: 0 0 50px #dc143c90, 0 0 100px #ff450050, 0 0 140px #dc143c20; }
        }
      `}</style>

      <motion.div
        className="relative glass-panel-premium rounded-2xl p-4"
        style={{
          background: 'rgba(10, 10, 20, 0.75)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${level.glowColor}30`,
          boxShadow: isInferno
            ? undefined
            : glowIntensity > 0
              ? `0 0 ${30 * glowIntensity}px ${level.glowColor}40, 0 0 ${60 * glowIntensity}px ${level.glowColor}20`
              : '0 4px 24px rgba(0,0,0,0.3)',
          animation: isInferno ? 'inferno-pulse 1.2s ease-in-out infinite' : undefined,
        }}
        animate={
          isInferno
            ? {
                borderColor: [`${level.glowColor}40`, `${level.glowColor}80`, `${level.glowColor}40`],
              }
            : {}
        }
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{ width: SVG_SIZE, height: SVG_SIZE }}
        >
          {particles}
          {lightnings}
          {fireParticles}

          <svg
            width={SVG_SIZE}
            height={SVG_SIZE}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className="absolute inset-0"
            style={{ transform: 'rotate(-90deg)' }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={level.gradient[0]} />
                <stop offset="50%" stopColor={level.gradient[1]} />
                <stop offset="100%" stopColor={level.gradient[2]} />
              </linearGradient>
              <filter id={glowFilterId}>
                <feGaussianBlur stdDeviation={isInferno ? 4 : isFire ? 3 : 2} result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <circle
              cx={SVG_SIZE / 2}
              cy={SVG_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={STROKE_WIDTH}
            />

            <motion.circle
              cx={SVG_SIZE / 2}
              cy={SVG_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              filter={`url(#${glowFilterId})`}
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />

            {progress > 0.02 && (
              <motion.circle
                cx={SVG_SIZE / 2}
                cy={SVG_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={1}
                strokeDasharray="4 12"
                strokeLinecap="round"
                strokeDashoffset={CIRCUMFERENCE}
                style={{
                  transformOrigin: 'center',
                  animation: `energy-ring-rotate ${isFire ? '2s' : '4s'} linear infinite`,
                }}
                initial={{ strokeDashoffset: CIRCUMFERENCE }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            )}
          </svg>

          <motion.div
            className="relative z-10 flex flex-col items-center justify-center"
            style={{
              width: SVG_SIZE - STROKE_WIDTH * 4,
              height: SVG_SIZE - STROKE_WIDTH * 4,
            }}
          >
            <motion.div
              className="flex items-center gap-0.5"
              key={currentEnergy}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <Zap
                size={14}
                className="text-yellow-400"
                style={{
                  filter: `drop-shadow(0 0 4px ${level.glowColor})`,
                }}
              />
              <span
                className="text-2xl font-black tabular-nums"
                style={{
                  color: level.gradient[1],
                  textShadow: `0 0 12px ${level.glowColor}80`,
                }}
              >
                {currentEnergy}
              </span>
            </motion.div>
            <motion.span
              className="text-[10px] font-bold uppercase tracking-widest mt-0.5"
              style={{
                color: level.gradient[2],
                textShadow: `0 0 8px ${level.glowColor}60`,
              }}
              animate={
                isInferno
                  ? { opacity: [0.7, 1, 0.7] }
                  : {}
              }
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              {level.name}
            </motion.span>
          </motion.div>
        </div>

        <motion.div
          className="mt-1 h-1 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${level.gradient[0]}, ${level.gradient[1]}, ${level.gradient[2]})`,
              boxShadow: `0 0 8px ${level.glowColor}80`,
            }}
            initial={{ width: '0%' }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </motion.div>
      </motion.div>

      <div className="flex flex-col items-center gap-1 w-full" style={{ maxWidth: SVG_SIZE + 32 }}>
        <AnimatePresence mode="popLayout">
          {actions.map((action, i) => (
            <ActionFeedItem key={action.id} action={action} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
