import React, { useEffect, useState } from 'react';

const emojis = ['💎', '💜', '🔥', '👑', '😈', '😂'];
const fireworksEmojis = ['🎆', '✨', '💥', '⭐', '🌟', '💫'];
const petalsEmojis = ['🌸', '🌹', '🌺', '🌻', '🌷', '🌼'];

interface TrollRainProps {
  /**
   * Trigger emoji rain when this value changes
   * Pass events like: { type: 'gift' | 'reaction' | 'entrance' | 'fireworks' | 'petals', timestamp: number }
   */
  trigger?: { type: string; timestamp: number } | null;
}

/**
 * Event-driven emoji rain effect
 * Only spawns emojis when triggered by real events (gifts, reactions, entrances)
 * Supports different animation types: fireworks, petals, default
 * NO auto-spawning intervals - completely controlled by parent component
 */
export default function TrollRain({ trigger }: TrollRainProps) {
  const [items, setItems] = useState<{ id: number; emoji: string; animationClass: string }[]>([]);

  useEffect(() => {
    // Only spawn emojis when explicitly triggered
    if (!trigger) return;

    let emojiSet = emojis;
    let animationClass = 'animate-float-emoji';
    let count = Math.floor(Math.random() * 3) + 3; // 3-5 emojis default
    let duration = 4000;

    // Determine animation type and emoji set
    if (trigger.type === 'fireworks') {
      emojiSet = fireworksEmojis;
      animationClass = 'animate-fireworks';
      count = 15; // More emojis for fireworks
      duration = 3000;
    } else if (trigger.type === 'petals') {
      emojiSet = petalsEmojis;
      animationClass = 'animate-falling-petals';
      count = 10; // More petals
      duration = 5000;
    }

    const newItems: { id: number; emoji: string; animationClass: string }[] = [];

    for (let i = 0; i < count; i++) {
      const id = Date.now() + i;
      const emoji = emojiSet[Math.floor(Math.random() * emojiSet.length)];
      newItems.push({ id, emoji, animationClass });

      // Auto-remove after animation completes
      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }, duration);
    }

    setItems((prev) => [...prev, ...newItems]);
  }, [trigger]); // Only run when trigger changes

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((item) => (
        <div
          key={item.id}
          className={`absolute ${item.animationClass} text-4xl`}
          style={{
            left: `${Math.random() * 90}%`,
            bottom: trigger?.type === 'fireworks' ? `${Math.random() * 50 + 25}%` : '-5%',
          }}
        >
          {item.emoji}
        </div>
      ))}
    </div>
  );
}

