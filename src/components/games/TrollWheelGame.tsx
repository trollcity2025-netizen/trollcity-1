// TrollWheelGame.tsx - Enhanced Troll Wheel with Bankruptcy, Special Items, Ghost Mode, and Featured Broadcaster
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Gem, RotateCw, Ghost, Star, Package, Zap, Shield, Sparkles } from 'lucide-react';

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
  type: 'coins' | 'bankrupt' | 'trolled' | 'free_perk' | 'free_insurance' | 'free_entrance' | 'ghost_mode' | 'featured_broadcaster';
  coins: number;
  label: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'special';
  color: string;
  glowColor: string;
  icon: string;
}

// Enhanced wheel rewards: 14 coin amounts + 1 bankrupt + 1 troll (24hr lock)
const WHEEL_REWARDS: WheelReward[] = [
  // Coin rewards (14 segments)
  { id: 0, type: 'coins', coins: 1, label: '+1', description: '+1 coin', rarity: 'common', color: '#22c55e', glowColor: '#4ade80', icon: '🪙' },
  { id: 1, type: 'coins', coins: 5, label: '+5', description: '+5 coins', rarity: 'common', color: '#22c55e', glowColor: '#4ade80', icon: '🪙' },
  { id: 2, type: 'coins', coins: 10, label: '+10', description: '+10 coins', rarity: 'common', color: '#22c55e', glowColor: '#4ade80', icon: '🪙' },
  { id: 3, type: 'coins', coins: 50, label: '+50', description: '+50 coins', rarity: 'uncommon', color: '#3b82f6', glowColor: '#60a5fa', icon: '🪙' },
  { id: 4, type: 'coins', coins: 100, label: '+100', description: '+100 coins', rarity: 'uncommon', color: '#3b82f6', glowColor: '#60a5fa', icon: '🪙' },
  { id: 5, type: 'coins', coins: 150, label: '+150', description: '+150 coins', rarity: 'rare', color: '#8b5cf6', glowColor: '#a78bfa', icon: '🪙' },
  { id: 6, type: 'coins', coins: 200, label: '+200', description: '+200 coins', rarity: 'rare', color: '#8b5cf6', glowColor: '#a78bfa', icon: '🪙' },
  { id: 7, type: 'coins', coins: 250, label: '+250', description: '+250 coins', rarity: 'epic', color: '#f59e0b', glowColor: '#fbbf24', icon: '🪙' },
  { id: 8, type: 'coins', coins: 300, label: '+300', description: '+300 coins', rarity: 'epic', color: '#f59e0b', glowColor: '#fbbf24', icon: '🪙' },
  { id: 9, type: 'coins', coins: 350, label: '+350', description: '+350 coins', rarity: 'epic', color: '#f59e0b', glowColor: '#fbbf24', icon: '🪙' },
  { id: 10, type: 'coins', coins: 400, label: '+400', description: '+400 coins', rarity: 'legendary', color: '#ef4444', glowColor: '#f87171', icon: '🪙' },
  { id: 11, type: 'coins', coins: 450, label: '+450', description: '+450 coins', rarity: 'legendary', color: '#ef4444', glowColor: '#f87171', icon: '🪙' },
  { id: 12, type: 'coins', coins: 500, label: '+500', description: '+500 coins', rarity: 'legendary', color: '#ef4444', glowColor: '#f87171', icon: '🪙' },
  { id: 13, type: 'coins', coins: 550, label: '+550', description: '+550 coins', rarity: 'legendary', color: '#ef4444', glowColor: '#f87171', icon: '🪙' },
  // Special rewards
  { id: 14, type: 'bankrupt', coins: 0, label: 'BANKRUPT', description: 'Lose all coins!', rarity: 'special', color: '#1a1a1a', glowColor: '#000000', icon: '💀' },
  { id: 15, type: 'trolled', coins: 0, label: 'TROLLED!', description: 'No spins for 24 hours!', rarity: 'special', color: '#dc2626', glowColor: '#ef4444', icon: '🤡' },
];

// Additional special items that can be won (weighted lower)
const SPECIAL_REWARDS: WheelReward[] = [
  { id: 16, type: 'ghost_mode', coins: 0, label: 'GHOST MODE', description: 'Hide from broadcast for 24 hours!', rarity: 'special', color: '#6b7280', glowColor: '#9ca3af', icon: '👻' },
  { id: 17, type: 'free_perk', coins: 0, label: 'FREE PERK', description: 'Get a free perk from Coin Store!', rarity: 'special', color: '#14b8a6', glowColor: '#2dd4bf', icon: '✨' },
  { id: 18, type: 'free_insurance', coins: 0, label: 'FREE INSURANCE', description: 'Get free insurance for 7 days!', rarity: 'special', color: '#0ea5e9', glowColor: '#38bdf8', icon: '🛡️' },
  { id: 19, type: 'free_entrance', coins: 0, label: 'FREE ENTRANCE', description: 'Get a free entrance effect!', rarity: 'special', color: '#a855f7', glowColor: '#c084fc', icon: '🎆' },
];

const SPIN_COST = 125;
const SEGMENT_ANGLE = 360 / WHEEL_REWARDS.length;

const BID_MULTIPLIERS = [
  { value: 1, label: '1x', cost: 125 },
  { value: 2, label: '2x', cost: 250 },
  { value: 3, label: '3x', cost: 375 },
  { value: 5, label: '5x', cost: 625 },
  { value: 10, label: '10x', cost: 1250 },
  { value: 25, label: '25x', cost: 3125 },
  { value: 50, label: '50x', cost: 6250 },
  { value: 100, label: 'MAX', cost: 12500 },
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

// Tire Tread Pattern
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
const CenterHub = ({ size, onSpin, disabled, isSpinning }: { 
  size: number; 
  onSpin: () => void; 
  disabled: boolean;
  isSpinning: boolean;
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
            <span className="text-[10px] text-purple-200 font-bold">{disabled ? 'NO COINS' : 'PLAY'}</span>
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
  const [rotation, setRotation] = useState(0);
  const [selectedMultiplier, setSelectedMultiplier] = useState(1);
  const [winningIndex, setWinningIndex] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastWin, setLastWin] = useState<{ type: string; label: string; description: string; coins: number; multiplier: number } | null>(null);
  
  // Wheel balance state (separate from user's troll_coins)
  const [wheelBalance, setWheelBalance] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<{ bankrupt_landed: boolean; total_spins: number } | null>(null);
  
  // Inventory state
  const [inventory, setInventory] = useState<WheelInventoryItem[]>([]);
  const [showInventory, setShowInventory] = useState(false);
  
  const wheelRef = useRef<HTMLDivElement>(null);
  const size = 400;
  const currentBidCost = BID_MULTIPLIERS.find(m => m.value === selectedMultiplier)?.cost || SPIN_COST;
  
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
      
      // Get or create today's session
      const { data: session } = await supabase
        .rpc('get_or_create_wheel_session');
      
      if (session && session.length > 0) {
        setSessionId(session[0].id);
        setSessionData({
          bankrupt_landed: session[0].bankrupt_landed,
          total_spins: session[0].total_spins
        });
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
  
  const MIN_BALANCE_TO_SPIN = 2000;
  
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
    
    // Check minimum balance requirement
    if (userBalance < MIN_BALANCE_TO_SPIN) {
      toast.error(`Need at least ${MIN_BALANCE_TO_SPIN.toLocaleString()} coins to spin!`);
      return;
    }
    
    if (userBalance < currentBidCost) {
      toast.error(`Not enough coins! Need ${currentBidCost} coins for ${selectedMultiplier}x bid.`);
      return;
    }
    
    // Play spin sound
    playSpinSound();
    
    // Deduct cost first from actual balance
    const newBalance = userBalance - currentBidCost;
    onBalanceChange(newBalance);
    setIsSpinning(true);
    setLastWin(null);
    setWinningIndex(null);
    setShowConfetti(false);
    
    // === RANDOM SPIN WITH 1 IN 15 CHANCE FOR SPECIAL WINS ===
    let resultIndex: number;
    
    // 1 in 15 chance for special result (bankrupt or trolled)
    const roll = Math.random() * 15;
    
    if (roll < 1) {
      // Special result - either bankrupt (50%) or trolled (50%)
      resultIndex = Math.random() < 0.5 ? 14 : 15; // 14 = bankrupt, 15 = trolled
    } else {
      // Regular result - random coin reward
      resultIndex = Math.floor(Math.random() * 14); // 0-13 = coin rewards
    }
    
    // Get the reward
    const result = WHEEL_REWARDS[resultIndex];
    
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
    
    // Wait for spin to finish
    setTimeout(async () => {
      // Process the result
      let finalCoins = 0;
      let message = '';
      
      if (result.type === 'coins') {
        finalCoins = result.coins * selectedMultiplier;
        // Add directly to user's actual balance
        const finalUserBalance = newBalance + finalCoins;
        onBalanceChange(finalUserBalance);
        
        // Update in database
        await supabase.rpc('add_troll_coins', { 
          p_user_id: profile.id, 
          p_amount: finalCoins 
        }).catch(() => {});
        
        // Play win sound
        playWinSound();
        message = `🎉 WIN! x${selectedMultiplier}: +${finalCoins} coins`;
        
      } else if (result.type === 'bankrupt') {
        // Lose all coins - reset to 0!
        onBalanceChange(0);
        
        // Play bankrupt sound
        playBankruptSound();
        
        // Update in database
        await supabase.rpc('set_troll_coins', { 
          p_user_id: profile.id, 
          p_amount: 0 
        }).catch(() => {});
        
        message = '💀 BANKRUPT! You lost all your coins!';
        
      } else if (result.type === 'trolled') {
        // Trolled! No spins for 24 hours
        playTrolledSound();
        
        // Set troll lock until 24 hours from now
        const trollLockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        
        await supabase
          .from('user_profiles')
          .update({ wheel_troll_locked_until: trollLockUntil })
          .eq('id', profile.id);
        
        message = '🤡 TROLLED! No spins for 24 hours! Mwahaha!';
        
      } else if (result.type === 'featured_broadcaster') {
        playWinSound();
        message = '⭐ FEATURED! You will be featured on Live Now for 30 minutes!';
        
        // Add to inventory
        await addToInventory('featured_broadcaster', 'Featured Broadcaster', 'Get featured on Live Now page for 30 minutes');
        
        // Update profile immediately
        await supabase
          .from('user_profiles')
          .update({ featured_broadcaster_until: new Date(Date.now() + 30 * 60 * 1000).toISOString() })
          .eq('id', profile.id);
        
      } else if (result.type === 'ghost_mode') {
        playWinSound();
        message = '👻 GHOST MODE! You are hidden from broadcast for 24 hours!';
        
        // Add to inventory
        await addToInventory('ghost_mode', 'Ghost Mode', 'Hide from broadcast and live chat for 24 hours');
        
        // Update profile immediately
        await supabase
          .from('user_profiles')
          .update({ ghost_mode_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
          .eq('id', profile.id);
        
      } else if (result.type === 'free_perk') {
        playWinSound();
        message = '✨ FREE PERK! Visit Coin Store to claim your free perk!';
        
        // Add to inventory
        await addToInventory('free_perk', 'Free Perk', 'Get any perk from Coin Store for free');
        
      } else if (result.type === 'free_insurance') {
        playWinSound();
        message = '🛡️ FREE INSURANCE! You got 7 days of free insurance!';
        
        // Add to inventory
        await addToInventory('free_insurance', 'Free Insurance', 'Free insurance for 7 days');
        
      } else if (result.type === 'free_entrance') {
        playWinSound();
        message = '🎆 FREE ENTRANCE! You got a free entrance effect!';
        
        // Add to inventory
        await addToInventory('free_entrance', 'Free Entrance Effect', 'Get any entrance effect for free');
      }
      
      // Set last win for display
      setLastWin({ 
        type: result.type,
        label: result.label, 
        description: result.description,
        coins: finalCoins, 
        multiplier: selectedMultiplier 
      });
      
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      
      // Show toast
      toast.success(message);
      
      // Record spin in database
      try {
        supabase.from('troll_wheel_wins').insert({
          user_id: profile.id,
          spin_cost: currentBidCost,
          reward_value: finalCoins,
          coins_awarded: finalCoins,
          multiplier_used: selectedMultiplier,
        });
      } catch (err) {
        console.warn('[TrollWheel] Failed to record spin:', err);
      }
      
      setIsSpinning(false);
      
      // Reload inventory
      loadInventory();
    }, 4000);
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
        
        // Update profile to reflect the change
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', profile?.id)
          .single();
        
        if (profileData) {
          // Force refresh of profile in store
          window.location.reload();
        }
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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-[#0a0a1a] via-[#0f172a] to-[#0a0a1a]">
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
      <div className="relative z-10 flex flex-col items-center gap-6 p-4 md:p-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 drop-shadow-[0_0_20px_rgba(168,85,247,0.6)]">
            TROLL WHEEL
          </h1>
          <p className="text-cyan-300 text-sm mt-2 font-medium">SPIN TO WIN! 🎰</p>
        </div>
        
        {/* Balance Display - Single on mobile, all on desktop */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          {/* Always show Troll Coins */}
          <motion.div 
            className="flex items-center gap-3 bg-black/70 backdrop-blur-md px-6 py-3 rounded-full border-2 border-yellow-500/50 shadow-[0_0_25px_rgba(234,179,8,0.4)]"
            whileHover={{ scale: 1.02 }}
          >
            <div className="p-2 bg-yellow-500/20 rounded-full">
              <Coins className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-yellow-400/70 font-bold uppercase tracking-wider">Troll Coins</p>
              <p className="text-xl font-black text-white">{userBalance.toLocaleString()}</p>
            </div>
          </motion.div>
          
          {/* Wheel Balance - Hidden on mobile */}
          <motion.div 
            className="hidden md:flex items-center gap-3 bg-black/70 backdrop-blur-md px-6 py-3 rounded-full border-2 border-cyan-500/50 shadow-[0_0_25px_rgba(6,182,212,0.4)]"
            whileHover={{ scale: 1.02 }}
          >
            <div className="p-2 bg-cyan-500/20 rounded-full">
              <Gem className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs text-cyan-400/70 font-bold uppercase tracking-wider">Wheel Balance</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-black text-white">{wheelBalance.toLocaleString()}</p>
                {wheelBalance > 0 && (
                  <button 
                    onClick={collectWheelBalance}
                    className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold hover:bg-green-600"
                  >
                    COLLECT
                  </button>
                )}
              </div>
            </div>
          </motion.div>
          
          {/* Inventory Button - Hidden on mobile */}
          <motion.button 
            onClick={() => setShowInventory(!showInventory)}
            className="hidden md:flex items-center gap-3 bg-black/70 backdrop-blur-md px-6 py-3 rounded-full border-2 border-purple-500/50 shadow-[0_0_25px_rgba(168,85,247,0.4)]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="p-2 bg-purple-500/20 rounded-full">
              <Package className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-purple-400/70 font-bold uppercase tracking-wider">Gift Box</p>
              <p className="text-xl font-black text-white">{inventory.length}</p>
            </div>
          </motion.button>
        </div>
        
        {/* Inventory Panel */}
        <AnimatePresence>
          {showInventory && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md bg-black/80 backdrop-blur-md border-2 border-purple-500/50 rounded-2xl p-4"
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
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-3 px-2">
            <span className="text-sm text-cyan-300 font-bold">BID AMOUNT</span>
            <span className="text-lg font-black text-yellow-400">{currentBidCost.toLocaleString()} coins</span>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {BID_MULTIPLIERS.map((bid) => (
              <motion.button
                key={bid.value}
                onClick={() => setSelectedMultiplier(bid.value)}
                disabled={isSpinning || userBalance < bid.cost}
                className={`px-4 py-2.5 font-bold rounded-xl transition-all
                  ${selectedMultiplier === bid.value 
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black shadow-[0_0_20px_rgba(249,115,22,0.6)]' 
                    : userBalance < bid.cost
                      ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                      : 'bg-black/60 text-white hover:bg-black/80 border border-yellow-500/30 hover:border-yellow-400'
                  }`}
                whileHover={userBalance >= bid.cost ? { scale: 1.05 } : {}}
                whileTap={userBalance >= bid.cost ? { scale: 0.95 } : {}}
              >
                {bid.label}
              </motion.button>
            ))}
          </div>
        </div>
        
        {/* Tire Wheel - Everything rotates together */}
        <div className="relative mt-8" style={{ width: size, height: size }}>
          <div className="absolute inset-0 rounded-full bg-purple-600/30 blur-[40px]" />
          
          {/* Rotating container - includes tire and tiles */}
          <motion.div
            ref={wheelRef}
            className="absolute"
            style={{ width: size, height: size }}
            animate={{ rotate: rotation }}
            transition={{ duration: 4, ease: [0.17, 0.67, 0.12, 0.99] }}
          >
            {/* Tire Ring - rotates with wheel */}
            <TireTreadPattern size={size} />
            <TireRing size={size} />
          </motion.div>
          
          {/* Center Hub - stays fixed */}
          <CenterHub 
            size={size} 
            onSpin={handleSpin} 
            disabled={userBalance < currentBidCost}
            isSpinning={isSpinning}
          />
          
          {/* Pointer - stays fixed */}
          <WheelPointer />
          
          {/* Spark effects - stay fixed */}
          <TireSparks />
          
          {/* Coin particles */}
          <CoinParticles show={showConfetti} />
        </div>
        
        {/* Win Display */}
        <AnimatePresence>
          {lastWin && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="bg-black/80 backdrop-blur-md border-2 border-yellow-500/50 px-8 py-4 rounded-2xl shadow-[0_0_40px_rgba(234,179,8,0.5)]"
            >
              <div className="text-center">
                <p className="text-cyan-300 text-sm font-bold uppercase tracking-wider">🎉 YOU WON! 🎉</p>
                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mt-1">
                  {lastWin.label}
                </p>
                <p className="text-gray-300 text-sm mt-1">{lastWin.description}</p>
                {lastWin.coins > 0 && (
                  <div className="flex items-center justify-center gap-4 mt-2">
                    <span className="text-green-400 font-bold">+{lastWin.coins} coins</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <p className="text-gray-400 text-sm text-center max-w-md">
          Spin the wheel and win coins, special items, or even GHOST MODE! Higher bids multiply your coin winnings.
        </p>
      </div>
    </div>
  );
}
