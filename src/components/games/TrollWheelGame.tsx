// TrollWheelGame.tsx - Enhanced Troll Wheel with Bankruptcy, Special Items, Ghost Mode, and Broadcast Abilities
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Gem, RotateCw, Ghost, Star, Package, Zap, Shield, Sparkles } from 'lucide-react';
import { BROADCAST_ABILITIES, getAbilityById, getRarityColor, getRarityGlow, AbilityId } from '@/types/broadcastAbilities';

// Sound effects using Web Audio API for generating sounds
const playSpinSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) { console.warn('Sound not available'); }
};

const playWinSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a pleasant win sound (arpeggio)
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.1);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + i * 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.1 + 0.3);
      
      oscillator.start(audioContext.currentTime + i * 0.1);
      oscillator.stop(audioContext.currentTime + i * 0.1 + 0.3);
    });
  } catch (e) { console.warn('Sound not available'); }
};

const playBankruptSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a descending sad sound
    [400, 350, 300, 250, 200].forEach((freq, i) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.15);
      oscillator.type = 'sawtooth';
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + i * 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.2);
      
      oscillator.start(audioContext.currentTime + i * 0.15);
      oscillator.stop(audioContext.currentTime + i * 0.15 + 0.2);
    });
  } catch (e) { console.warn('Sound not available'); }
};

const playTrolledSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create an ominous troll sound
    [150, 100, 80, 60].forEach((freq, i) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.2);
      oscillator.type = 'square';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + i * 0.2);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.2 + 0.25);
      
      oscillator.start(audioContext.currentTime + i * 0.2);
      oscillator.stop(audioContext.currentTime + i * 0.2 + 0.25);
    });
  } catch (e) { console.warn('Sound not available'); }
};

interface TrollWheelProps {
  userBalance: number;
  trollmondBalance?: number;
  onBalanceChange: (newBalance: number) => void;
  onTrollmondChange?: (newBalance: number) => void;
}

interface WheelReward {
  id: number;
  type: 'trollmonds' | 'bankrupt' | 'trolled' | 'free_perk' | 'free_insurance' | 'free_entrance' | 'ghost_mode' | 'featured_broadcaster' | 'broadcast_ability';
  coins: number;
  label: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'special';
  color: string;
  glowColor: string;
  icon: string;
  abilityId?: AbilityId;
}

// Enhanced wheel rewards: 14 trollmond amounts + 1 bankrupt + 1 troll (24hr lock)
const WHEEL_REWARDS: WheelReward[] = [
  // Trollmond rewards (14 segments)
  { id: 0, type: 'trollmonds', coins: 1, label: '+1', description: '+1 Trollmond', rarity: 'common', color: '#22c55e', glowColor: '#4ade80', icon: '💎' },
  { id: 1, type: 'trollmonds', coins: 5, label: '+5', description: '+5 Trollmonds', rarity: 'common', color: '#22c55e', glowColor: '#4ade80', icon: '💎' },
  { id: 2, type: 'trollmonds', coins: 10, label: '+10', description: '+10 Trollmonds', rarity: 'common', color: '#22c55e', glowColor: '#4ade80', icon: '💎' },
  { id: 3, type: 'trollmonds', coins: 50, label: '+50', description: '+50 Trollmonds', rarity: 'uncommon', color: '#3b82f6', glowColor: '#60a5fa', icon: '💎' },
  { id: 4, type: 'trollmonds', coins: 100, label: '+100', description: '+100 Trollmonds', rarity: 'uncommon', color: '#3b82f6', glowColor: '#60a5fa', icon: '💎' },
  { id: 5, type: 'trollmonds', coins: 150, label: '+150', description: '+150 Trollmonds', rarity: 'rare', color: '#8b5cf6', glowColor: '#a78bfa', icon: '💎' },
  { id: 6, type: 'trollmonds', coins: 200, label: '+200', description: '+200 Trollmonds', rarity: 'rare', color: '#8b5cf6', glowColor: '#a78bfa', icon: '💎' },
  { id: 7, type: 'trollmonds', coins: 250, label: '+250', description: '+250 Trollmonds', rarity: 'epic', color: '#f59e0b', glowColor: '#fbbf24', icon: '💎' },
  { id: 8, type: 'trollmonds', coins: 300, label: '+300', description: '+300 Trollmonds', rarity: 'epic', color: '#f59e0b', glowColor: '#fbbf24', icon: '💎' },
  { id: 9, type: 'trollmonds', coins: 350, label: '+350', description: '+350 Trollmonds', rarity: 'epic', color: '#f59e0b', glowColor: '#fbbf24', icon: '💎' },
  { id: 10, type: 'trollmonds', coins: 400, label: '+400', description: '+400 Trollmonds', rarity: 'legendary', color: '#ef4444', glowColor: '#f87171', icon: '💎' },
  { id: 11, type: 'trollmonds', coins: 450, label: '+450', description: '+450 Trollmonds', rarity: 'legendary', color: '#ef4444', glowColor: '#f87171', icon: '💎' },
  { id: 12, type: 'trollmonds', coins: 500, label: '+500', description: '+500 Trollmonds', rarity: 'legendary', color: '#ef4444', glowColor: '#f87171', icon: '💎' },
  { id: 13, type: 'trollmonds', coins: 550, label: '+550', description: '+550 Trollmonds', rarity: 'legendary', color: '#ef4444', glowColor: '#f87171', icon: '💎' },
  // Special rewards
  { id: 14, type: 'bankrupt', coins: 0, label: 'BANKRUPT', description: 'Lose ALL your Trollmonds!', rarity: 'special', color: '#1a1a1a', glowColor: '#000000', icon: '💀' },
  { id: 15, type: 'trolled', coins: 0, label: 'TROLLED!', description: 'No spins for 24 hours!', rarity: 'special', color: '#dc2626', glowColor: '#ef4444', icon: '🤡' },
];

// Additional special items that can be won (weighted lower)
const SPECIAL_REWARDS: WheelReward[] = [
  { id: 16, type: 'ghost_mode', coins: 0, label: 'GHOST MODE', description: 'Hide from broadcast for 24 hours!', rarity: 'special', color: '#6b7280', glowColor: '#9ca3af', icon: '👻' },
  { id: 17, type: 'free_perk', coins: 0, label: 'FREE PERK', description: 'Get a free perk from Coin Store!', rarity: 'special', color: '#14b8a6', glowColor: '#2dd4bf', icon: '✨' },
  { id: 18, type: 'free_insurance', coins: 0, label: 'FREE INSURANCE', description: 'Get free insurance for 7 days!', rarity: 'special', color: '#0ea5e9', glowColor: '#38bdf8', icon: '🛡️' },
  { id: 19, type: 'free_entrance', coins: 0, label: 'FREE ENTRANCE', description: 'Get a free entrance effect!', rarity: 'special', color: '#a855f7', glowColor: '#c084fc', icon: '🎆' },
];

// Broadcast Ability rewards - very rare wheel prizes
const ABILITY_REWARDS: WheelReward[] = BROADCAST_ABILITIES.map((ability, i) => ({
  id: 20 + i,
  type: 'broadcast_ability' as const,
  coins: 0,
  label: `${ability.icon} ${ability.name.toUpperCase()}`,
  description: ability.description,
  rarity: ability.rarity as 'rare' | 'epic' | 'legendary',
  color: ability.color,
  glowColor: ability.glowColor,
  icon: ability.icon,
  abilityId: ability.id,
}));

const SPIN_COST = 10;
const FREE_SPINS_PER_DAY = 5;
const SEGMENT_ANGLE = 360 / WHEEL_REWARDS.length;


// Dynamic bid multipliers - cost scales with bid amount
// Formula: cost = bid * SPIN_COST (e.g., 10x bid costs 1250)
// MAX option will use user's entire balance
const BID_MULTIPLIERS = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 5, label: '5x' },
  { value: 10, label: '10x' },
  { value: 25, label: '25x' },
  { value: 50, label: '50x' },
  { value: 0, label: 'MAX' }, // 0 indicates use full balance
];

// Tire Ring Component
const TireRing = ({ size }: { size: number }) => {
  const thickness = 60;
  const outerRadius = size / 2;
  const innerRadius = outerRadius - thickness;
  
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="rubberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="50%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
        <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4a4a4a" />
          <stop offset="30%" stopColor="#7a7a7a" />
          <stop offset="50%" stopColor="#9a9a9a" />
          <stop offset="70%" stopColor="#7a7a7a" />
          <stop offset="100%" stopColor="#4a4a4a" />
        </linearGradient>
        <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      <circle cx={outerRadius} cy={outerRadius} r={outerRadius - 2} fill="url(#rubberGrad)" stroke="#111" strokeWidth="4" />
      <circle cx={outerRadius} cy={outerRadius} r={outerRadius - thickness / 2} fill="none" stroke="#1a1a1a" strokeWidth={thickness - 10} strokeDasharray="8 4" opacity="0.5" />
      <circle cx={outerRadius} cy={outerRadius} r={innerRadius + 5} fill="none" stroke="#333" strokeWidth="2" />
      <circle cx={outerRadius} cy={outerRadius} r={innerRadius - 5} fill="url(#rimGrad)" stroke="#666" strokeWidth="2" />
      <circle cx={outerRadius} cy={outerRadius} r={outerRadius + 15} fill="none" stroke="#a855f7" strokeWidth="6" opacity="0.4" filter="url(#neonGlow)" />
      
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 45) * (Math.PI / 180);
        const x1 = outerRadius + Math.cos(angle) * (innerRadius - 40);
        const y1 = outerRadius + Math.sin(angle) * (innerRadius - 40);
        const x2 = outerRadius + Math.cos(angle) * (innerRadius - 10);
        const y2 = outerRadius + Math.sin(angle) * (innerRadius - 10);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#555" strokeWidth="3" />;
      })}
    </svg>
  );
};

// Wheel Segments Component - Renders the colored segments with labels
const WheelSegments = ({ size, rewards }: { size: number; rewards: WheelReward[] }) => {
  const centerX = size / 2;
  const centerY = size / 2;
  const outerRadius = size / 2 - 35; // Inside the tire ring
  const innerRadius = outerRadius * 0.35; // Leave space for center hub
  const segmentAngle = 360 / rewards.length;
  
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${size} ${size}`}>
      {rewards.map((reward, index) => {
        const startAngle = index * segmentAngle - 90; // Start from top
        const endAngle = startAngle + segmentAngle;
        
        // Calculate segment path
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        
        const x1 = centerX + Math.cos(startRad) * outerRadius;
        const y1 = centerY + Math.sin(startRad) * outerRadius;
        const x2 = centerX + Math.cos(endRad) * outerRadius;
        const y2 = centerY + Math.sin(endRad) * outerRadius;
        const x3 = centerX + Math.cos(endRad) * innerRadius;
        const y3 = centerY + Math.sin(endRad) * innerRadius;
        const x4 = centerX + Math.cos(startRad) * innerRadius;
        const y4 = centerY + Math.sin(startRad) * innerRadius;
        
        const largeArc = segmentAngle > 180 ? 1 : 0;
        
        const pathD = `
          M ${x1} ${y1}
          A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}
          L ${x3} ${y3}
          A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
          Z
        `;
        
        // Calculate text position (middle of segment)
        const textAngle = startAngle + segmentAngle / 2;
        const textRad = (textAngle * Math.PI) / 180;
        const textRadius = (outerRadius + innerRadius) / 2;
        const textX = centerX + Math.cos(textRad) * textRadius;
        const textY = centerY + Math.sin(textRad) * textRadius;
        
        // Determine text color based on background brightness
        const isDark = reward.color === '#1a1a1a' || reward.color === '#dc2626';
        const textColor = isDark ? '#ffffff' : '#000000';
        
        return (
          <g key={reward.id}>
            {/* Segment fill */}
            <path 
              d={pathD} 
              fill={reward.color}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="1"
            />
            {/* Label text */}
            <text
              x={textX}
              y={textY}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={textColor}
              fontSize={reward.label.length > 8 ? "10" : "12"}
              fontWeight="bold"
              transform={`rotate(${textAngle + 90}, ${textX}, ${textY})`}
              style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
            >
              {reward.label}
            </text>
          </g>
        );
      })}
      
      {/* Segment divider lines */}
      {rewards.map((_, index) => {
        const angle = (index * segmentAngle - 90) * (Math.PI / 180);
        const x = centerX + Math.cos(angle) * outerRadius;
        const y = centerY + Math.sin(angle) * outerRadius;
        const x2 = centerX + Math.cos(angle) * innerRadius;
        const y2 = centerY + Math.sin(angle) * innerRadius;
        
        return (
          <line
            key={`divider-${index}`}
            x1={x}
            y1={y}
            x2={x2}
            y2={y2}
            stroke="rgba(0,0,0,0.4)"
            strokeWidth="2"
          />
        );
      })}
    </svg>
  );
};
const TireTreadPattern = ({ size }: { size: number }) => (
  <svg className="absolute inset-0 pointer-events-none" style={{ width: size, height: size }}>
    <defs>
      <pattern id="treadPattern" patternUnits="userSpaceOnUse" width="15" height="15" patternTransform="rotate(45)">
        <rect width="8" height="15" fill="#1a1a1a" />
        <rect x="8" width="2" height="15" fill="#0a0a0a" />
      </pattern>
    </defs>
    <circle cx={size/2} cy={size/2} r={size/2 - 5} fill="none" stroke="url(#treadPattern)" strokeWidth="25" opacity="0.4" />
  </svg>
);

// Center Hub Component
const CenterHub = ({ size, onSpin, disabled, isSpinning, isFreeSpin }: { 
  size: number; 
  onSpin: () => void; 
  disabled: boolean;
  isSpinning: boolean;
  isFreeSpin?: boolean;
}) => {
  const hubSize = size * 0.25;
  
  return (
    <motion.button
      className="absolute rounded-full flex flex-col items-center justify-center z-20"
      style={{
        left: '50%',
        top: '50%',
        width: hubSize,
        height: hubSize,
        marginLeft: -hubSize / 2,
        marginTop: -hubSize / 2,
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)',
        boxShadow: '0 0 30px rgba(168, 85, 247, 0.6), inset 0 2px 10px rgba(255,255,255,0.3)',
      }}
      onClick={onSpin}
      disabled={disabled || isSpinning}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
    >
      <div className="absolute inset-1 rounded-full border-4 border-gray-400 bg-gradient-to-br from-gray-600 to-gray-800" />
      
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = i * 60;
        const boltRadius = hubSize / 2 - 15;
        return (
          <div
            key={i}
            className="absolute w-3 h-3 bg-gray-300 rounded-full border border-gray-500"
            style={{
              left: '50%',
              top: '50%',
              marginLeft: -6,
              marginTop: -6,
              transform: `rotate(${angle}deg) translateY(-${boltRadius})`,
            }}
          />
        );
      })}
      
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 flex flex-col items-center justify-center shadow-lg">
        {isSpinning ? (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <RotateCw className="w-8 h-8 text-white" />
          </motion.div>
        ) : (
          <>
            <span className="text-lg font-black text-white drop-shadow-lg">SPIN</span>
            <span className="text-[10px] text-purple-200 font-bold">{disabled ? 'LOW BAL' : isFreeSpin ? 'FREE' : 'PLAY'}</span>
          </>
        )}
      </div>
    </motion.button>
  );
};

// Gold Pointer - Fixed at top
const WheelPointer = () => {
  return (
    <motion.div
      className="absolute z-30"
      style={{ left: '50%', top: -20, marginLeft: -15 }}
      initial={{ y: -5 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
    >
      <svg width="30" height="50" viewBox="0 0 30 50">
        <defs>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <filter id="pointerGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d="M15 55 L3 10 L15 0 L27 10 Z" fill="rgba(0,0,0,0.5)" transform="translate(2, 2)" />
        <path d="M15 55 L3 10 L15 0 L27 10 Z" fill="url(#goldGrad)" stroke="#b45309" strokeWidth="2" filter="url(#pointerGlow)" />
        <path d="M15 50 L7 15 L15 8 L23 15 Z" fill="rgba(255,255,255,0.3)" />
      </svg>
    </motion.div>
  );
};

// Spark Effects
const TireSparks = () => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-cyan-400 rounded-full"
          style={{ left: '50%', top: '50%' }}
          animate={{
            x: Math.cos(i * 30 * Math.PI / 180) * 200,
            y: Math.sin(i * 30 * Math.PI / 180) * 200,
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
};

// Coin Particles
const CoinParticles = ({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-4 h-4"
          style={{ left: '50%', top: '50%' }}
          initial={{ x: 0, y: 0, scale: 0 }}
          animate={{ 
            x: (Math.random() - 0.5) * 400,
            y: (Math.random() - 0.5) * 400,
            scale: [0, 1, 0],
            rotate: Math.random() * 360,
          }}
          transition={{ duration: 1 + Math.random() * 0.5, ease: 'easeOut' }}
        >
          <Coins className="w-4 h-4 text-yellow-400" />
        </motion.div>
      ))}
    </div>
  );
};

interface WheelInventoryItem {
  id: string;
  item_type: string;
  item_name: string;
  item_description: string;
  is_active: boolean;
  won_at: string;
  expires_at: string | null;
  activated_at: string | null;
}

export default function TrollWheelGame({ 
  userBalance, 
  trollmondBalance = 0, 
  onBalanceChange,
  onTrollmondChange,
}: TrollWheelProps) {
  const { profile } = useAuthStore();
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinKey, setSpinKey] = useState(0); // Force re-render after spin
  const [rotation, setRotation] = useState(0);
  const [selectedMultiplier, setSelectedMultiplier] = useState(1);
  const [winningIndex, setWinningIndex] = useState<number | null>(null);
  
  // Wheel balance state (separate from user's trollmonds)
  const [wheelBalance, setWheelBalance] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<{ bankrupt_landed: boolean; total_spins: number } | null>(null);
  const [freeSpinsUsed, setFreeSpinsUsed] = useState(0);
  
  const freeSpinsRemaining = Math.max(0, FREE_SPINS_PER_DAY - freeSpinsUsed);
  const isFreeSpin = freeSpinsRemaining > 0;
  
  // Check if user is currently locked from the wheel
  const isWheelLocked = profile?.wheel_troll_locked_until 
    ? new Date(profile.wheel_troll_locked_until) > new Date()
    : false;
  
  // Calculate remaining lock time if locked
  const getLockTimeRemaining = (): string => {
    if (!profile?.wheel_troll_locked_until) return '';
    const lockUntil = new Date(profile.wheel_troll_locked_until);
    const now = new Date();
    if (lockUntil <= now) return '';
    
    const diff = lockUntil.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };
  
  // Inventory state
  const [inventory, setInventory] = useState<WheelInventoryItem[]>([]);
  const [showInventory, setShowInventory] = useState(false);
  
  const wheelRef = useRef<HTMLDivElement>(null);
  const size = 400;
  
  // Dynamic cost calculation: bid * base_cost
  // MAX (value 0) uses user's entire balance
  const getBidCost = (multiplier: number, balance: number): number => {
    if (multiplier === 0) {
      // MAX - use entire balance, minimum 125
      return Math.max(balance, SPIN_COST);
    }
    return multiplier * SPIN_COST;
  };
  
  const currentBidCost = getBidCost(selectedMultiplier, userBalance);
  
  // Load wheel balance and session on mount
  useEffect(() => {
    if (profile?.id) {
      loadWheelData();
    }
  }, [profile?.id]);
  
  const loadWheelData = async () => {
    if (!profile?.id) return;
    
    try {
      // Get wheel balance from profile
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('wheel_balance')
        .eq('id', profile.id)
        .single();
      
      if (profileData?.wheel_balance) {
        setWheelBalance(profileData.wheel_balance);
      }
      
      // Load today's free spins used from DB
      try {
        const { data: spinsUsed } = await supabase
          .rpc('get_daily_free_spins', { p_user_id: profile.id });
        setFreeSpinsUsed(spinsUsed || 0);
      } catch (e) {
        // Fallback: query the table directly
        try {
          const { data: record } = await supabase
            .from('daily_free_spins')
            .select('spins_used')
            .eq('user_id', profile.id)
            .eq('spins_date', new Date().toISOString().split('T')[0])
            .single();
          setFreeSpinsUsed(record?.spins_used || 0);
        } catch (e2) {
          console.warn('[TrollWheel] Failed to load free spins:', e2);
        }
      }
      
      // Get or create today's session
      try {
        const { data: session } = await supabase
          .rpc('get_or_create_wheel_session');
        
        if (session && session.length > 0) {
          setSessionId(session[0].id);
          setSessionData({
            bankrupt_landed: session[0].bankrupt_landed,
            total_spins: session[0].total_spins
          });
        }
      } catch (e) {
        console.warn('[TrollWheel] Session load failed:', e);
      }
      
      // Load inventory
      loadInventory();
    } catch (err) {
      console.warn('[TrollWheel] Failed to load wheel data:', err);
    }
  };
  
  const loadInventory = async () => {
    if (!profile?.id) return;
    
    try {
      const { data } = await supabase
        .from('wheel_inventory')
        .select('*')
        .eq('user_id', profile.id)
        .order('won_at', { ascending: false });
      
      if (data) {
        setInventory(data);
      }
    } catch (err) {
      console.warn('[TrollWheel] Failed to load inventory:', err);
    }
  };
  
  const MIN_BALANCE_TO_SPIN = 10;
  
  const handleSpin = async () => {
    if (!profile?.id) {
      toast.error('Please log in to play');
      return;
    }
    
    if (isSpinning) return;
    
    // Check if user is locked (trolled penalty)
    if (profile.wheel_troll_locked_until) {
      const lockUntil = new Date(profile.wheel_troll_locked_until);
      const now = new Date();
      if (lockUntil > now) {
        const hoursLeft = Math.ceil((lockUntil.getTime() - now.getTime()) / (1000 * 60 * 60));
        toast.error(`You're trolled! No spins for ${hoursLeft} more hours.`);
        return;
      }
    }
    
    // Calculate cost (free if within daily free spins)
    const bidCost = isFreeSpin ? 0 : getBidCost(selectedMultiplier, userBalance);
    
    // Only check balance if not a free spin
    if (!isFreeSpin) {
      if (userBalance < MIN_BALANCE_TO_SPIN) {
        toast.error(`Need at least ${MIN_BALANCE_TO_SPIN.toLocaleString()} Trollmonds to spin!`);
        return;
      }
      
      if (userBalance < bidCost) {
        const bidLabel = selectedMultiplier === 0 ? 'MAX' : `${selectedMultiplier}x`;
        toast.error(`Not enough Trollmonds! Need ${bidCost.toLocaleString()} for ${bidLabel} bid.`);
        return;
      }
    }
    
    // Play spin sound
    playSpinSound();
    
    // Deduct cost only if not a free spin
    let newBalance = userBalance;
    if (bidCost > 0) {
      newBalance = userBalance - bidCost;
      onBalanceChange(newBalance);
      // Save cost deduction to database
      try {
        await supabase
          .from('user_profiles')
          .update({ trollmonds: newBalance })
          .eq('id', profile.id);
      } catch (e) {
        console.warn('Failed to save spin cost:', e);
      }
    }
    
    // Increment free spins used - persist to DB
    setFreeSpinsUsed(prev => prev + 1);
    try {
      await supabase.rpc('use_daily_free_spin', { p_user_id: profile.id });
    } catch (e) {
      // Fallback: direct upsert
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase
          .from('daily_free_spins')
          .select('id, spins_used')
          .eq('user_id', profile.id)
          .eq('spins_date', today)
          .single();
        if (existing) {
          await supabase
            .from('daily_free_spins')
            .update({ spins_used: existing.spins_used + 1, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('daily_free_spins')
            .insert({ user_id: profile.id, spins_date: today, spins_used: 1 });
        }
      } catch (e2) {
        console.warn('[TrollWheel] Failed to persist free spin:', e2);
      }
    }
    
    setIsSpinning(true);
    setWinningIndex(null);
    
    // === RANDOM SPIN WITH SPECIAL CHANCES ===
    let resultIndex: number;
    let abilityResult: WheelReward | null = null;
    
    // Check if user is admin/ceo (bypass session bankrupt limit)
    const isAdmin = profile?.is_admin || profile?.is_ceo;
    
    // Rolls
    const specialRoll = Math.random() * 15;
    const abilityRoll = Math.random() * 30; // 1 in 30 chance for ability
    const canGetBankrupt = isAdmin || !sessionData?.bankrupt_landed;
    
    if (specialRoll < 1 && canGetBankrupt) {
      // Special result - either bankrupt (50%) or trolled (50%)
      resultIndex = Math.random() < 0.5 ? 14 : 15; // 14 = bankrupt, 15 = trolled
    } else if (abilityRoll < 1) {
      // Rare ability reward - pick a random ability weighted by wheelWeight
      const totalWeight = ABILITY_REWARDS.reduce((sum, a) => sum + (a.abilityId ? (getAbilityById(a.abilityId)?.wheelWeight || 4) : 4), 0);
      let pick = Math.random() * totalWeight;
      for (const ability of ABILITY_REWARDS) {
        const weight = ability.abilityId ? (getAbilityById(ability.abilityId)?.wheelWeight || 4) : 4;
        pick -= weight;
        if (pick <= 0) {
          abilityResult = ability;
          break;
        }
      }
      if (!abilityResult) abilityResult = ABILITY_REWARDS[ABILITY_REWARDS.length - 1];
      // Still spin to a random visual position (abilities don't have wheel segments)
      resultIndex = Math.floor(Math.random() * 14);
    } else {
      // Regular result - random trollmond reward
      resultIndex = Math.floor(Math.random() * 14); // 0-13 = trollmond rewards
    }
    
    // Get the result - ability overrides the wheel segment result
    const result = abilityResult || WHEEL_REWARDS[resultIndex];
    
    // Calculate segment angle
    const segmentAngle = 360 / WHEEL_REWARDS.length;
    
    // Calculate the center of the winning segment
    const segmentCenter = resultIndex * segmentAngle + segmentAngle / 2;
    
    // Rotate wheel to align segment center with pointer (at top/0°)
    const targetAngle = 360 - segmentCenter;
    
    // Add extra spins (6 + random 0-2)
    const extraSpins = 6 + Math.floor(Math.random() * 3);
    
    // Calculate final rotation
    const finalRotation = rotation + (extraSpins * 360) + targetAngle;
    
    // Store winning index BEFORE spinning
    setWinningIndex(resultIndex);
    setRotation(finalRotation);
    
    // Wait for spin animation to finish, then show result
    // Use setTimeout with a callback to ensure it runs
    setTimeout(() => {
      finishSpin(result, newBalance);
    }, 4000);
  };
  
  // Separate function to handle spin completion - ensures it always runs
  const finishSpin = async (result: WheelReward, newBalance: number) => {
    if (!profile?.id) {
      setIsSpinning(false);
      setSpinKey(k => k + 1);
      return;
    }
    
    try {
      let finalCoins = 0;
      let message = '';
      
      if (result.type === 'trollmonds') {
        finalCoins = result.coins * selectedMultiplier;
        const finalBalance = newBalance + finalCoins;
        // Update balance via callback
        onBalanceChange(finalBalance);
        // Save to database - set the correct final balance
        try {
          await supabase
            .from('user_profiles')
            .update({ trollmonds: finalBalance })
            .eq('id', profile.id);
        } catch (e) {
          console.warn('Failed to update trollmonds:', e);
        }
        playWinSound();
        message = `💎 WIN! x${selectedMultiplier}: +${finalCoins} Trollmonds`;
       } else if (result.type === 'bankrupt') {
           // Lose ALL trollmonds
           const trollmondsLost = newBalance;
           const finalBalance = 0;
           
           // Update balance to 0
           onBalanceChange(finalBalance);
           playBankruptSound();
           try {
             await supabase
               .from('user_profiles')
               .update({ 
                 trollmonds: 0
               })
               .eq('id', profile.id);
           } catch (e) { /* ignore */ }
           message = `💸 BANKRUPT! Lost ALL Trollmonds (-${trollmondsLost.toLocaleString()})!`;
        } else if (result.type === 'trolled') {
        playTrolledSound();
        const trollLockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('user_profiles').update({ wheel_troll_locked_until: trollLockUntil }).eq('id', profile.id);
        // Refresh profile so the lock takes effect immediately
        useAuthStore.getState().refreshProfile();
        message = '🤡 TROLLED! No spins for 24 hours!';
      } else if (result.type === 'featured_broadcaster') {
        playWinSound();
        message = '⭐ FEATURED! 30 minutes on Live Now!';
        await addToInventory('featured_broadcaster', 'Featured Broadcaster', 'Get featured on Live Now page for 30 minutes');
        await supabase.from('user_profiles').update({ featured_broadcaster_until: new Date(Date.now() + 30 * 60 * 1000).toISOString() }).eq('id', profile.id);
      } else if (result.type === 'ghost_mode') {
        playWinSound();
        message = '👻 GHOST MODE! Hidden for 24 hours!';
        await addToInventory('ghost_mode', 'Ghost Mode', 'Hide from broadcast for 24 hours');
        await supabase.from('user_profiles').update({ ghost_mode_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }).eq('id', profile.id);
      } else if (result.type === 'free_perk') {
        playWinSound();
        message = '✨ FREE PERK! Visit Coin Store!';
        await addToInventory('free_perk', 'Free Perk', 'Get any perk for free');
      } else if (result.type === 'free_insurance') {
        playWinSound();
        message = '🛡️ FREE INSURANCE! 7 days!';
        await addToInventory('free_insurance', 'Free Insurance', 'Free insurance for 7 days');
      } else if (result.type === 'free_entrance') {
        playWinSound();
        message = '🎆 FREE ENTRANCE! Free entrance effect!';
        await addToInventory('free_entrance', 'Free Entrance Effect', 'Get any entrance effect for free');
      } else if (result.type === 'broadcast_ability' && result.abilityId) {
        const abilityDef = getAbilityById(result.abilityId);
        if (abilityDef) {
          playWinSound();
          message = `${abilityDef.icon} RARE ABILITY: ${abilityDef.name}!`;
          // Add to user's ability inventory
          try {
            await supabase.rpc('add_ability_to_inventory', {
              p_user_id: profile.id,
              p_ability_id: result.abilityId,
            });
          } catch (e) {
            // Fallback: direct insert/upsert
            try {
              const { data: existing } = await supabase
                .from('user_abilities')
                .select('id, quantity')
                .eq('user_id', profile.id)
                .eq('ability_id', result.abilityId)
                .single();
              if (existing) {
                await supabase
                  .from('user_abilities')
                  .update({ quantity: existing.quantity + 1 })
                  .eq('id', existing.id);
              } else {
                await supabase
                  .from('user_abilities')
                  .insert({ user_id: profile.id, ability_id: result.abilityId, quantity: 1 });
              }
            } catch (e2) {
              console.warn('Failed to add ability:', e2);
            }
          }
        }
      }
      
      // Show toast based on result type
      if (result.type === 'bankrupt' || result.type === 'trolled') {
        toast.error(message);
      } else {
        toast.success(message);
      }
      
      // Record spin
      try {
        supabase.from('troll_wheel_wins').insert({
          user_id: profile.id,
          spin_cost: currentBidCost,
          reward_value: finalCoins,
          coins_awarded: finalCoins,
          multiplier_used: selectedMultiplier,
        });
      } catch (e) { console.warn('Failed to record spin'); }
    } catch (err) {
      console.error('[TrollWheel] Error in finishSpin:', err);
    } finally {
      // ALWAYS reset spinning state - this is critical!
      setIsSpinning(false);
      setSpinKey(k => k + 1);
      loadInventory();
    }
  };
  
  const addToInventory = async (itemType: string, itemName: string, itemDesc: string) => {
    if (!profile?.id) return;
    
    try {
      await supabase
        .from('wheel_inventory')
        .insert({
          user_id: profile.id,
          item_type: itemType,
          item_name: itemName,
          item_description: itemDesc,
        });
    } catch (err) {
      console.warn('[TrollWheel] Failed to add inventory item:', err);
    }
  };
  
  const activateItem = async (itemId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('activate_wheel_inventory_item', { p_item_id: itemId });
      
      if (error) throw error;
      
      if (data) {
        toast.success('Item activated!');
        loadInventory();
        
        // Refresh the global auth profile instead of reloading the page
        useAuthStore.getState().refreshProfile();
      } else {
        toast.error('Failed to activate item');
      }
    } catch (err) {
      console.error('[TrollWheel] Failed to activate item:', err);
      toast.error('Failed to activate item');
    }
  };
  
  const collectWheelBalance = async () => {
    if (wheelBalance <= 0) return;
    
    try {
      // Transfer wheel balance to actual balance
      const newUserBalance = userBalance + wheelBalance;
      onBalanceChange(newUserBalance);
      
      // Reset wheel balance
      await supabase
        .from('user_profiles')
        .update({ wheel_balance: 0 })
        .eq('id', profile?.id);
      
      setWheelBalance(0);
      toast.success(`Collected ${wheelBalance} coins to your balance!`);
    } catch (err) {
      console.error('[TrollWheel] Failed to collect balance:', err);
    }
  };
  
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#0a0a1a] via-[#0f172a] to-[#0a0a1a] min-h-0">
      {/* Background effects */}
      <div className="absolute inset-0">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-yellow-500/20"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{ y: [0, -30, 0], x: [0, 15, 0], rotate: [0, 15, 0] }}
            transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
          >
            <Coins className="w-8 h-8" />
          </motion.div>
        ))}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px]" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-2 md:gap-4 p-2 md:p-4 mx-auto w-full overflow-hidden">
        {/* Header */}
        <div className="text-center w-full">
          <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 drop-shadow-[0_0_20px_rgba(168,85,247,0.6)]">
            TROLL WHEEL
          </h1>
          <p className="text-cyan-300 text-xs md:text-sm mt-1 font-medium">SPIN TO WIN! 🎰</p>
        </div>
        
        {/* Balance Display - Single on mobile, all on desktop */}
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 w-full px-2">
          {/* Locked Status - Show when user is trolled */}
          {isWheelLocked && (
            <motion.div 
              className="flex items-center gap-2 md:gap-3 bg-red-900/80 backdrop-blur-md px-4 md:px-6 py-2 md:py-3 rounded-full border-2 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.6)]"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="p-1.5 md:p-2 bg-red-500/20 rounded-full">
                <span className="text-xl md:text-2xl">🤡</span>
              </div>
              <div>
                <p className="text-xs text-red-400/70 font-bold uppercase tracking-wider">TROLLED!</p>
                <p className="text-base md:text-lg font-black text-white">No spins for {getLockTimeRemaining()}</p>
              </div>
            </motion.div>
          )}
          {/* Always show Trollmonds Balance */}
          {!isWheelLocked && (
          <motion.div 
            className="flex items-center gap-2 md:gap-3 bg-black/70 backdrop-blur-md px-4 md:px-6 py-2 md:py-3 rounded-full border-2 border-purple-500/50 shadow-[0_0_25px_rgba(168,85,247,0.4)]"
            whileHover={{ scale: 1.02 }}
          >
            <div className="p-1.5 md:p-2 bg-purple-500/20 rounded-full">
              <Gem className="w-4 md:w-5 h-4 md:h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-purple-400/70 font-bold uppercase tracking-wider">Trollmonds</p>
              <p className="text-lg md:text-xl font-black text-white">{userBalance.toLocaleString()}</p>
            </div>
          </motion.div>
          )}
          {/* Free Spins Counter */}
          {!isWheelLocked && freeSpinsRemaining > 0 && (
          <motion.div 
            className="flex items-center gap-2 md:gap-3 bg-black/70 backdrop-blur-md px-4 md:px-6 py-2 md:py-3 rounded-full border-2 border-green-500/50 shadow-[0_0_25px_rgba(34,197,94,0.4)]"
            whileHover={{ scale: 1.02 }}
          >
            <div className="p-1.5 md:p-2 bg-green-500/20 rounded-full">
              <Zap className="w-4 md:w-5 h-4 md:h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-green-400/70 font-bold uppercase tracking-wider">Free Spins</p>
              <p className="text-lg md:text-xl font-black text-white">{freeSpinsRemaining}</p>
            </div>
          </motion.div>
          )}
          {!isWheelLocked && (
          <motion.button 
            onClick={() => setShowInventory(!showInventory)}
            className="hidden md:flex items-center gap-2 md:gap-3 bg-black/70 backdrop-blur-md px-4 md:px-6 py-2 md:py-3 rounded-full border-2 border-purple-500/50 shadow-[0_0_25px_rgba(168,85,247,0.4)]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="p-1.5 md:p-2 bg-purple-500/20 rounded-full">
              <Package className="w-4 md:w-5 h-4 md:h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-purple-400/70 font-bold uppercase tracking-wider">Gift Box</p>
              <p className="text-lg md:text-xl font-black text-white">{inventory.length}</p>
            </div>
          </motion.button>
          )}
        </div>
        
        {/* Inventory Panel */}
        <AnimatePresence>
          {showInventory && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md bg-black/80 backdrop-blur-md border-2 border-purple-500/50 rounded-2xl p-3 md:p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-400" />
                  My Gift Box
                </h3>
                <button 
                  onClick={() => setShowInventory(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              
              {inventory.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No items yet. Spin the wheel to win!</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {inventory.map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between bg-gray-900/50 rounded-xl p-3 border border-gray-700"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">
                          {item.item_type === 'ghost_mode' && '👻'}
                          {item.item_type === 'featured_broadcaster' && '⭐'}
                          {item.item_type === 'free_perk' && '✨'}
                          {item.item_type === 'free_insurance' && '🛡️'}
                          {item.item_type === 'free_entrance' && '🎆'}
                        </div>
                        <div>
                          <p className="font-bold text-white">{item.item_name}</p>
                          <p className="text-xs text-gray-400">{item.item_description}</p>
                        </div>
                      </div>
                      {item.is_active ? (
                        <span className="text-green-400 text-sm font-bold">ACTIVE</span>
                      ) : (
                        <button
                          onClick={() => activateItem(item.id)}
                          className="bg-purple-500 text-white px-3 py-1 rounded-lg text-sm font-bold hover:bg-purple-600"
                        >
                          ACTIVATE
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Bid Selector */}
        <div className="w-full max-w-md px-1 md:px-2">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <span className="text-xs md:text-sm text-cyan-300 font-bold">BID AMOUNT</span>
            <span className={`text-base md:text-lg font-black ${isFreeSpin ? 'text-green-400' : 'text-yellow-400'}`}>
              {isFreeSpin ? 'FREE ✨' : `${currentBidCost.toLocaleString()} 💎`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3 justify-center">
            {BID_MULTIPLIERS.map((bid) => {
              const bidCost = getBidCost(bid.value, userBalance);
              const isMax = bid.value === 0;
              const isDisabled = isSpinning || (!isFreeSpin && (isMax ? userBalance < SPIN_COST : userBalance < bidCost));
              
              return (
                <motion.button
                  key={bid.value}
                  onClick={() => setSelectedMultiplier(bid.value)}
                  disabled={isDisabled}
                  className={`px-3 md:px-4 py-2 md:py-2.5 font-bold rounded-xl transition-all min-w-[60px] md:min-w-[70px] text-xs md:text-sm
                    ${selectedMultiplier === bid.value 
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black shadow-[0_0_20px_rgba(249,115,22,0.6)]' 
                      : isDisabled
                        ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                        : 'bg-black/60 text-white hover:bg-black/80 border border-yellow-500/30 hover:border-yellow-400'
                    }`}
                  whileHover={!isDisabled ? { scale: 1.05 } : {}}
                  whileTap={!isDisabled ? { scale: 0.95 } : {}}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{bid.label}</span>
                    <span className="text-[9px] md:text-[10px] opacity-70">
                      {isFreeSpin ? 'FREE' : `${bidCost.toLocaleString()}💎`}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
        
        {/* Tire Wheel - Everything rotates together */}
        <div className="relative mt-2 md:mt-4" style={{ width: size, height: size, maxWidth: '100%', transform: 'scale(0.75)', transformOrigin: 'center center' }}>
          <div className="absolute inset-0 rounded-full bg-purple-600/30 blur-[40px]" />
          
          {/* Rotating container - includes tire, segments and tiles */}
          <motion.div
            ref={wheelRef}
            className="absolute"
            style={{ width: size, height: size }}
            animate={{ rotate: rotation }}
            transition={{ duration: 4, ease: [0.17, 0.67, 0.12, 0.99] }}
          >
            {/* Wheel Segments - shows the reward slices */}
            <WheelSegments size={size} rewards={WHEEL_REWARDS} />
            {/* Tire Ring - rotates with wheel */}
            <TireTreadPattern size={size} />
            <TireRing size={size} />
          </motion.div>
          
          {/* Center Hub - stays fixed */}
          <motion.div key={spinKey}>
            <CenterHub 
              size={size} 
              onSpin={handleSpin} 
              disabled={(!isFreeSpin && userBalance < currentBidCost) || isWheelLocked}
              isSpinning={isSpinning}
              isFreeSpin={isFreeSpin}
            />
          </motion.div>
          
          {/* Pointer - stays fixed */}
          <WheelPointer />
          
          {/* Spark effects - stay fixed */}
          <TireSparks />
          
        </div>
        
        <p className="text-gray-400 text-xs md:text-sm text-center max-w-md px-2">
          Spin the wheel and win Trollmonds, special items, or even GHOST MODE! Higher bids multiply your winnings.
        </p>
      </div>
    </div>
  );
}
