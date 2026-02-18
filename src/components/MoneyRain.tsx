import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CoinRain() {
  const [items, setItems] = useState<{ id: number; x: number; delay: number; duration: number; rotation: number; scale: number }[]>([]);

  useEffect(() => {
    // Generate rain items
    const newItems = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // Random horizontal position %
      delay: Math.random() * 2, // Random start delay
      duration: (2 + Math.random() * 2) * 1.65, // Random fall duration (65% slower)
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 0.5, // vary size
    }));
    setItems(newItems);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <AnimatePresence>
        {items.map((item) => (
          <motion.img
            key={item.id}
            src="https://pngimg.com/uploads/coin/coin_PNG36871.png"
            alt="coin"
            initial={{ y: -100, x: `${item.x}vw`, opacity: 0, rotate: item.rotation }}
            animate={{ 
              y: '120vh', 
              opacity: [0, 1, 1, 0],
              rotate: [item.rotation, item.rotation + 360 * (Math.random() > 0.5 ? 1 : -1)]
            }}
            transition={{ 
              duration: item.duration, 
              delay: item.delay,
              ease: "linear",
              repeat: Infinity 
            }}
            className="absolute top-0 w-12 h-12 object-contain"
            style={{ scale: item.scale }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
