import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { TickerMessage, TickerTheme, CATEGORY_COLORS } from '../../types/ticker';

interface PriorityTickerMessageProps {
  message: TickerMessage;
  theme: TickerTheme;
  onComplete: () => void;
}

const THEME_BG: Record<TickerTheme, string> = {
  neon: 'bg-gradient-to-r from-cyan-950/90 via-cyan-900/80 to-cyan-950/90 border-cyan-400/50',
  minimal: 'bg-zinc-900/95 border-white/20',
  luxury: 'bg-gradient-to-r from-amber-950/90 via-amber-900/70 to-amber-950/90 border-amber-400/40',
  glitch: 'bg-gradient-to-r from-purple-950/90 via-fuchsia-900/70 to-purple-950/90 border-purple-400/50',
};

export default function PriorityTickerMessage({
  message,
  theme,
  onComplete,
}: PriorityTickerMessageProps) {
  const categoryColor = CATEGORY_COLORS[message.category] || '#ff3366';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'relative overflow-hidden backdrop-blur-xl border rounded-lg mx-2 mb-1',
        'shadow-lg pointer-events-auto',
        THEME_BG[theme]
      )}
      style={{
        boxShadow: `0 0 20px ${categoryColor}33, 0 4px 20px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Animated background pulse */}
      <motion.div
        className="absolute inset-0 opacity-20"
        style={{ backgroundColor: categoryColor }}
        animate={{ opacity: [0.1, 0.25, 0.1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Scan line effect for glitch theme */}
      {theme === 'glitch' && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent"
          animate={{ y: ['-100%', '200%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          style={{ height: '30%' }}
        />
      )}

      <div className="relative flex items-center gap-3 px-4 py-2">
        {/* Priority badge */}
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest"
          style={{
            backgroundColor: `${categoryColor}22`,
            color: categoryColor,
            border: `1px solid ${categoryColor}44`,
          }}
        >
          <span className="animate-pulse">●</span>
          LIVE
        </div>

        {/* Tags */}
        {message.tags.length > 0 && (
          <span className="text-base shrink-0">
            {message.tags.join(' ')}
          </span>
        )}

        {/* Content */}
        <span
          className={cn(
            'text-sm font-bold tracking-wide flex-1',
            theme === 'neon' && 'text-cyan-100',
            theme === 'minimal' && 'text-white',
            theme === 'luxury' && 'text-amber-100',
            theme === 'glitch' && 'text-purple-100'
          )}
        >
          {message.content}
        </span>

        {/* Close button */}
        <button
          onClick={onComplete}
          className="text-white/30 hover:text-white/60 transition-colors text-xs"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
}
