import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTickerStore } from '../../stores/tickerStore';
import { cn } from '../../lib/utils';
import {
  TickerMessage,
  TickerTheme,
  CATEGORY_COLORS,
  SPEED_MAP,
} from '../../types/ticker';
import PriorityTickerMessage from './PriorityTickerMessage';

interface BroadcastTickerProps {
  className?: string;
}

const THEME_STYLES: Record<
  TickerTheme,
  { bg: string; border: string; text: string; glow?: string }
> = {
  neon: {
    bg: 'bg-black/70',
    border: 'border-cyan-500/30',
    text: 'text-cyan-100',
    glow: 'shadow-[0_0_10px_rgba(0,255,255,0.15)]',
  },
  minimal: {
    bg: 'bg-zinc-950/90',
    border: 'border-white/10',
    text: 'text-white/80',
  },
  luxury: {
    bg: 'bg-gradient-to-r from-amber-950/80 via-zinc-900/80 to-amber-950/80',
    border: 'border-amber-500/20',
    text: 'text-amber-100',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.15)]',
  },
  glitch: {
    bg: 'bg-black/80',
    border: 'border-purple-500/30',
    text: 'text-purple-100',
    glow: 'shadow-[0_0_8px_rgba(168,85,247,0.2)]',
  },
};

const POSITION_CLASSES: Record<string, string> = {
  top: 'top-0 left-0 right-0',
  bottom: 'bottom-0 left-0 right-0',
  floating: 'top-12 left-2 right-2',
};

export default function BroadcastTicker({ className }: BroadcastTickerProps) {
  const { messages, settings, priorityMessage, isPaused } = useTickerStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const themeStyle = THEME_STYLES[settings.theme] || THEME_STYLES.neon;
  const positionClass = POSITION_CLASSES[settings.position] || POSITION_CLASSES.bottom;
  const speedPxPerSec = SPEED_MAP[settings.speed] || SPEED_MAP.medium;

  // Build the scrolling content - duplicate messages for seamless loop
  const scrollingMessages = useMemo(() => {
    if (messages.length === 0) return [];
    // Duplicate to create seamless loop
    return [...messages, ...messages];
  }, [messages]);

  // CSS animation approach for smooth continuous scrolling
  const scrollDuration = useMemo(() => {
    if (messages.length === 0) return 30;
    // Speed mapping: slow=40s, medium=25s, fast=12s for full scroll
    return SPEED_MAP[settings.speed] || SPEED_MAP.medium;
  }, [messages.length, settings.speed]);

  // Don't render if no messages and no priority
  if (messages.length === 0 && !priorityMessage) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative z-30 pointer-events-none',
        positionClass,
        className
      )}
      style={{ opacity: settings.opacity }}
    >
      {/* Priority message overlay */}
      <AnimatePresence>
        {priorityMessage && (
          <PriorityTickerMessage
            message={priorityMessage}
            theme={settings.theme}
            onComplete={() => {}}
          />
        )}
      </AnimatePresence>

      {/* Main ticker bar */}
      {messages.length > 0 && !priorityMessage && (
        <div
          className={cn(
            'relative overflow-hidden backdrop-blur-md border-b',
            themeStyle.bg,
            themeStyle.border,
            themeStyle.glow,
            settings.position === 'floating' && 'rounded-xl border shadow-xl',
            settings.position === 'bottom' && 'border-b-0 border-t',
            settings.theme === 'glitch' && 'animate-ticker-glitch'
          )}
          style={{
            transform: 'translateZ(0)',
            willChange: 'transform',
            height: '32px',
          }}
        >
          {/* Gradient masks */}
          <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-black/80 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-black/80 to-transparent z-10 pointer-events-none" />

          {/* Scrolling ticker content */}
          <div
            className={cn(
              'ticker-scroll-container flex items-center h-full whitespace-nowrap',
              isPaused && 'ticker-paused'
            )}
            style={{
              animation: isPaused
                ? 'none'
                : `ticker-scroll ${scrollDuration}s linear infinite`,
            }}
          >
            {scrollingMessages.map((msg, idx) => (
              <TickerItem
                key={`${msg.id}-${idx}`}
                message={msg}
                theme={settings.theme}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TickerItem({
  message,
  theme,
}: {
  message: TickerMessage;
  theme: TickerTheme;
}) {
  const categoryColor = CATEGORY_COLORS[message.category] || '#00d4ff';

  return (
    <div className="flex items-center gap-3 px-4 shrink-0">
      {/* Category indicator dot */}
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          backgroundColor: categoryColor,
          boxShadow: `0 0 6px ${categoryColor}`,
        }}
      />

      {/* Tags */}
      {message.tags.length > 0 && (
        <span className="text-xs shrink-0">
          {message.tags.join(' ')}
        </span>
      )}

      {/* Message content */}
      <span
        className={cn(
          'text-xs font-semibold tracking-wide',
          theme === 'neon' && 'text-cyan-200',
          theme === 'minimal' && 'text-white/80',
          theme === 'luxury' && 'text-amber-200',
          theme === 'glitch' && 'text-purple-200'
        )}
      >
        {message.content}
      </span>

      {/* Separator */}
      <span className="text-white/20 text-[10px] shrink-0 mx-2">●</span>
    </div>
  );
}
