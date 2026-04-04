// HiddenEasterEgg Component
// Renders a single clickable Easter egg at a specific position on any page.
// Used by EasterEggOverlay to place eggs across the app during the hunt.

import React, { useState, useCallback, useRef } from 'react'
import type { EggSpawn } from '@/lib/events/easterEggHunt'
import { getEggColor } from '@/lib/events/easterEggHunt'

interface HiddenEasterEggProps {
  spawn: EggSpawn
  found: boolean
  onCollect: (spawn: EggSpawn) => Promise<boolean>
}

// SVG Easter Egg with color and pattern
function EasterEggSVG({ color, size = 28, glowing }: { color: string; size?: number; glowing?: boolean }) {
  return (
    <svg
      width={size}
      height={size * 1.25}
      viewBox="0 0 32 40"
      fill="none"
      style={{
        filter: glowing ? `drop-shadow(0 0 6px ${color})` : undefined,
      }}
    >
      <ellipse cx="16" cy="22" rx="13" ry="16" fill={color} stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      {/* Shine */}
      <ellipse cx="16" cy="22" rx="13" ry="16" fill="url(#egg-shine-e)" />
      {/* Stripes */}
      <path d="M5 16 Q16 10 27 16" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" fill="none" />
      <path d="M6 24 Q16 30 26 24" stroke="rgba(255,255,255,0.25)" strokeWidth="1" fill="none" />
      {/* Dots */}
      <circle cx="11" cy="18" r="1.8" fill="rgba(255,255,255,0.3)" />
      <circle cx="20" cy="26" r="1.3" fill="rgba(255,255,255,0.25)" />
      <circle cx="15" cy="31" r="1" fill="rgba(255,255,255,0.2)" />
      <defs>
        <radialGradient id="egg-shine-e" cx="0.35" cy="0.3" r="0.6">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
    </svg>
  )
}

export default function HiddenEasterEgg({ spawn, found, onCollect }: HiddenEasterEggProps) {
  const [collecting, setCollecting] = useState(false)
  const [justFound, setJustFound] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClick = useCallback(async () => {
    if (found || collecting || justFound) return
    setCollecting(true)

    const success = await onCollect(spawn)
    if (success) {
      setJustFound(true)
      timeoutRef.current = setTimeout(() => {
        setJustFound(false)
      }, 3000)
    }
    setCollecting(false)
  }, [found, collecting, justFound, onCollect, spawn])

  const color = getEggColor(spawn.colorIndex)

  // Hidden eggs are subtle - small opacity, blend with background
  // They become more visible on hover

  if (justFound) {
    return (
      <div
        className="absolute pointer-events-none select-none"
        style={{
          left: `${spawn.x}%`,
          top: `${spawn.y}%`,
          transform: 'translate(-50%, -50%)',
          animation: 'easter-egg-found 0.8s ease-out forwards',
          zIndex: 50,
        }}
      >
        <span className="text-2xl">✨</span>
      </div>
    )
  }

  if (found) return null

  return (
    <button
      onClick={handleClick}
      disabled={collecting}
      className="absolute cursor-pointer select-none group"
      style={{
        left: `${spawn.x}%`,
        top: `${spawn.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 40,
        opacity: 0.35,
        transition: 'opacity 0.3s, transform 0.2s',
        animation: 'easter-egg-idle 3s ease-in-out infinite',
        animationDelay: `${spawn.colorIndex * 0.4}s`,
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.opacity = '1'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.opacity = '0.35'
      }}
      title="Easter Egg"
      aria-label="Hidden Easter Egg"
    >
      <EasterEggSVG color={color} size={24} glowing />
      <style>{`
        button:hover > svg {
          filter: drop-shadow(0 0 8px ${color}) !important;
        }
      `}</style>
    </button>
  )
}

// ── CSS keyframes (injected once) ───────────────────────────────────────

let _injected = false
export function injectEasterEggStyles() {
  if (_injected || typeof document === 'undefined') return
  _injected = true
  const style = document.createElement('style')
  style.id = 'easter-egg-styles'
  style.textContent = `
    @keyframes easter-egg-idle {
      0%, 100% { transform: translate(-50%, -50%) translateY(0) rotate(-2deg); }
      33% { transform: translate(-50%, -50%) translateY(-3px) rotate(1deg); }
      66% { transform: translate(-50%, -50%) translateY(-1px) rotate(2deg); }
    }
    @keyframes easter-egg-found {
      0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      50% { transform: translate(-50%, -50%) scale(1.8); opacity: 0.8; }
      100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}
