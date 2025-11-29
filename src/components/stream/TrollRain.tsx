import React, { useEffect, useState } from 'react';

const emojis = ['💎', '💜', '🔥', '👑', '😈', '😂'];

export default function TrollRain() {
  const [items, setItems] = useState<{ id: number; emoji: string }[]>([]);

  useEffect(() => {
    let idCounter = 0;
    const spawn = setInterval(() => {
      const id = Date.now() + idCounter++;
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      setItems((prev) => [...prev, { id, emoji }]);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 4000);
    }, 1500);

    return () => clearInterval(spawn);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="absolute animate-float-emoji text-4xl"
          style={{
            left: `${Math.random() * 90}%`,
            bottom: '-5%',
            animationDelay: `${index * 0.2}s`,
          }}
        >
          {item.emoji}
        </div>
      ))}
    </div>
  );
}

