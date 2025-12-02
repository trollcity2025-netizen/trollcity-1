import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GiftBurstProps {
  sender: string;
  giftName: string;
  icon: string; // emoji/svgs like 🧌 🎁 💎 💵
  amount: number; // coins
  trigger: boolean;
  onComplete?: () => void;
  targetUserId?: string; // Target participant user ID
  side?: 'A' | 'B' | null; // Battle side (A = host, B = opponent)
  intensity?: 'small' | 'medium' | 'big'; // Animation intensity
  position?: { x: number; y: number } | null; // Custom position (percentage)
}

// 🟡 CoinRain Effect
function CoinRain() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ y: -100, x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920) }}
          animate={{ y: (typeof window !== 'undefined' ? window.innerHeight : 1080) + 50 }}
          transition={{ duration: 3, delay: i * 0.2 }}
          className="absolute text-yellow-400 text-3xl"
        >
          💰
        </motion.div>
      ))}
    </div>
  );
}

// 🔹 DiamondSparkle Effect
function DiamondSparkle() {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1.5, opacity: 1 }}
      transition={{ duration: 1 }}
      className="absolute top-[-20px] left-1/2 -translate-x-1/2 text-6xl drop-shadow-[0_0_18px_#00FFFF]"
    >
      💎
    </motion.div>
  );
}

// 🧌 TrollWalkAcross Effect
function TrollWalkAcross() {
  return (
    <motion.div
      initial={{ x: -200, y: 80 }}
      animate={{ x: (typeof window !== 'undefined' ? window.innerWidth : 1920) + 200 }}
      transition={{ duration: 8, ease: "linear" }}
      className="absolute text-6xl drop-shadow-[0_0_16px_#b700ff]"
    >
      🧌
    </motion.div>
  );
}

// 👑 CrownDrop Effect
function CrownDrop() {
  return (
    <motion.div
      initial={{ y: -100, scale: 0.5 }}
      animate={{ y: 40, scale: 1 }}
      transition={{ duration: 1, type: "spring" }}
      className="absolute left-1/2 -translate-x-1/2 text-6xl drop-shadow-[0_0_14px_#FFD700]"
    >
      👑
    </motion.div>
  );
}

// 🎆 FireworkBurst Effect
function FireworkBurst() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          initial={{ opacity: 1, scale: 0, top: "50%", left: "50%" }}
          animate={{
            opacity: 0,
            scale: 3,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
          }}
          transition={{ duration: 1.8 }}
        >
          🎆
        </motion.div>
      ))}
    </>
  );
}

export default function GiftBurst({
  sender,
  giftName,
  icon,
  amount,
  trigger,
  onComplete,
  targetUserId,
  side,
  intensity = 'medium',
  position,
}: GiftBurstProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (trigger) {
      setShow(true);
      setTimeout(() => {
        setShow(false);
        onComplete?.();
      }, 4500);
    }
  }, [trigger, onComplete]);

  if (!show) return null;

  // Calculate position based on side or custom position
  let positionClass = 'top-1/4 left-1/2 -translate-x-1/2'
  if (position) {
    positionClass = `top-[${position.y}%] left-[${position.x}%] -translate-x-1/2 -translate-y-1/2`
  } else if (side === 'A') {
    // Host side (left)
    positionClass = 'top-1/4 left-1/4 -translate-x-1/2'
  } else if (side === 'B') {
    // Opponent side (right)
    positionClass = 'top-1/4 left-3/4 -translate-x-1/2'
  }

  const scale = intensity === 'big' ? 1.5 : intensity === 'small' ? 0.8 : 1.2

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale }}
        exit={{ opacity: 0, y: -40 }}
        className={`fixed ${positionClass} z-[80] text-white text-center`}
      >
        {/* Gift Icon Burst */}
        <motion.div
          initial={{ scale: 0.5, rotate: -20 }}
          animate={{ scale: 1.4, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="text-7xl mb-2 drop-shadow-[0_0_25px_rgba(255,0,255,0.8)]"
        >
          {icon}
        </motion.div>

        {/* Sender and Gift Info */}
        <div className="px-6 py-3 rounded-full bg-black/70 backdrop-blur text-lg border border-purple-500 shadow-[0_0_10px_#B700FF]">
          <strong>{sender}</strong> sent <strong>{giftName}</strong> 🎁  
          <span className="text-purple-300 ml-2">({amount.toLocaleString()} coins)</span>
        </div>

        {/* Special Effects based on icon */}
        {icon === "💎" && <DiamondSparkle />}
        {icon === "💵" && <CoinRain />}
        {icon === "🎆" && <FireworkBurst />}
        {icon === "👑" && <CrownDrop />}
        {icon === "🧌" && <TrollWalkAcross />}
      </motion.div>
    </AnimatePresence>
  );
}

