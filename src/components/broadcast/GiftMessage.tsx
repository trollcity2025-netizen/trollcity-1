import React, { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Coins, Gift as GiftIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import useSound from 'use-sound';
import coinSound from '/sounds/entrance/coins.mp3';
import legendarySound from '/sounds/jackpot_reverb.mp3';

interface GiftMessageProps {
  id: string; // Add id for auto-collapse
  username: string;
  giftName: string;
  giftAmount: number; // Value of a single gift
  giftCount: number; // How many times this gift was sent in this message
  rarity: "common" | "rare" | "epic" | "legendary";
  giftIcon?: string; // URL or emoji
  totalCoins: number; // Total coins for this stacked gift message
  onAnimationComplete: (id: string) => void; // Callback for parent to remove message
}

const rarityStyles = {
  common: {
    bg: 'bg-zinc-800/70',
    border: 'border-zinc-700',
    text: 'text-zinc-200',
    iconBg: 'bg-zinc-700',
    coinText: 'text-zinc-400',
  },
  rare: {
    bg: 'bg-blue-800/70',
    border: 'border-blue-700',
    text: 'text-blue-200',
    iconBg: 'bg-blue-700',
    coinText: 'text-blue-400',
  },
  epic: {
    bg: 'bg-purple-800/70',
    border: 'border-purple-700',
    text: 'text-purple-200',
    iconBg: 'bg-purple-700',
    coinText: 'text-purple-400',
  },
  legendary: {
    bg: 'bg-yellow-800/70',
    border: 'border-yellow-700',
    text: 'text-yellow-200',
    iconBg: 'bg-yellow-700',
    coinText: 'text-yellow-400',
  },
};

const GiftMessage: React.FC<GiftMessageProps> = ({ id, username, giftName, giftAmount, giftCount, rarity, giftIcon, totalCoins, onAnimationComplete }) => {
  const styles = rarityStyles[rarity];
  const countControls = useAnimation();
  const [playCoinSound] = useSound(coinSound, { volume: 0.5 });
  const [playLegendarySound] = useSound(legendarySound, { volume: 0.7 });

  useEffect(() => {
    if (rarity === 'legendary') {
        playLegendarySound();
    } else {
        playCoinSound();
    }
  }, [id, playCoinSound, playLegendarySound, rarity]); // Play sound only when the gift first appears

  useEffect(() => {
    // Animate the count when it changes
    countControls.start({
        scale: [1, 1.2, 1],
        transition: { duration: 0.2 }
    });
  }, [giftCount, countControls]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onAnimationComplete(id);
    }, 5000); // Auto-collapse after 5 seconds

    return () => clearTimeout(timer);
  }, [id, onAnimationComplete]);

  // Define animations based on rarity
  const variants = {
    initial: { opacity: 0, x: -50, scale: 0.8 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -50, scale: 0.8, transition: { duration: 0.2 } },
  };

  const transition = {
    common: { duration: 0.3, ease: 'easeOut' },
    rare: { type: 'spring', stiffness: 300, damping: 20, mass: 1 },
    epic: { duration: 0.5, ease: 'easeInOut' },
    legendary: { type: 'spring', stiffness: 200, damping: 10, mass: 1 },
  };

  return (
    <motion.div
      layout // Enable layout animations for smooth transitions when items are added/removed
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={transition[rarity]}
      className={cn(
        'relative flex items-center gap-2 p-2 rounded-lg shadow-lg overflow-hidden my-1',
        styles.bg,
        styles.border,
        'border'
      )}
    >
      {/* Animated Gift Icon */}
      <div className={cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center', styles.iconBg)}>
        {giftIcon ? (
          giftIcon.startsWith('http') ? (
            <img src={giftIcon} alt={giftName} className="w-full h-full object-contain" />
          ) : (
            <span className="text-xl">{giftIcon}</span>
          )
        ) : (
          <GiftIcon size={18} className={styles.text} />
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 text-sm leading-tight">
        <span className="font-bold text-white">{username}</span>
        <span className="text-zinc-400 ml-1">sent</span>
        <span className={cn('font-semibold ml-1', styles.text)}>{giftName}</span>
        {giftCount > 1 && <motion.span className="font-bold ml-1" animate={countControls}>x{giftCount}</motion.span>}
      </div>

      {/* Coin Amount */}
      <div className="flex-shrink-0 flex items-center gap-1 ml-2">
        <Coins size={14} className={styles.coinText} />
        <motion.span className={cn('font-bold', styles.coinText)} animate={countControls}>{totalCoins.toLocaleString()}</motion.span>
      </div>

      {/* Optional: Rarity-based glow border/effects */}
      {rarity === 'legendary' && (
        <div className="absolute inset-0 rounded-lg pointer-events-none animate-pulse-slow" style={{ border: '2px solid gold', boxShadow: '0 0 10px gold' }}></div>
      )}
    </motion.div>
  );
};

export default React.memo(GiftMessage);
