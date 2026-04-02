/**
 * Gift Theme Player - Premium CSS-based gift animations
 * 
 * Each gift gets a unique themed animation with:
 * - Themed emoji particles (falling, rising, floating)
 * - Animated center icon matching the gift
 * - Background glow/effects matching the theme
 * - Per-gift sound effect
 * - Transparent background for clean overlay
 */

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { detectGiftTheme, getThemeParticleEmojis, getThemeColor, getThemeAnimationType, GiftTheme } from '../../lib/giftThemeEngine';
import { playGiftSound } from '../../lib/giftSoundMap';
import '../../pages/dev/gift-themed-animations.css';

interface GiftThemePlayerProps {
  giftName: string;
  giftIcon: string;
  giftValue: number;
  duration: number;
  onComplete: () => void;
  usePortal?: boolean;
  containerStyle?: React.CSSProperties;
}

// Generate particle data for a theme
function generateParticles(theme: GiftTheme, emojis: string[], count: number) {
  const particles: Array<{ id: number; emoji: string; left: string; delay: string; size: string; animClass: string }> = [];
  const animType = getThemeAnimationType(theme);
  const animClass = `ga-tp-${animType}`;

  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      emoji: emojis[i % emojis.length],
      left: `${5 + Math.random() * 90}%`,
      delay: `${Math.random() * 2}s`,
      size: `${20 + Math.random() * 20}px`,
      animClass,
    });
  }
  return particles;
}

// Background effect component per theme
function ThemeBackground({ theme, color, duration }: { theme: GiftTheme; color: string; duration: number }) {
  const style = { '--duration': `${duration}s` } as React.CSSProperties;

  switch (theme) {
    case 'fire':
    case 'volcano':
      return (
        <div className="ga-theme-bg" style={style}>
          <div className="ga-fire-floor" style={{ background: `linear-gradient(0deg, ${color}60, transparent)` }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ga-fire-particle" style={{ left: `${10 + i * 15}%`, animationDelay: `${i * 0.3}s` }} />
          ))}
        </div>
      );
    case 'police':
      return (
        <div className="ga-theme-bg" style={style}>
          <div className="ga-siren-overlay">
            <div className="ga-siren-red" />
            <div className="ga-siren-blue" />
          </div>
        </div>
      );
    case 'smoke':
    case 'cigarette':
      return (
        <div className="ga-theme-bg" style={style}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="ga-smoke-cloud" style={{ left: `${20 + i * 15}%`, animationDelay: `${i * 0.5}s` }} />
          ))}
        </div>
      );
    case 'rainbow':
      return (
        <div className="ga-theme-bg" style={style}>
          <div className="ga-rainbow-arc" />
        </div>
      );
    case 'ocean':
      return (
        <div className="ga-theme-bg" style={style}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ga-wave" style={{ animationDelay: `${i * 0.6}s` }} />
          ))}
        </div>
      );
    case 'tornado':
      return (
        <div className="ga-theme-bg" style={style}>
          <div className="ga-tornado-bg" />
        </div>
      );
    case 'camera':
      return (
        <div className="ga-theme-bg" style={style}>
          <div className="ga-flash-overlay" />
        </div>
      );
    case 'car':
    case 'boat':
    case 'train':
      return (
        <div className="ga-theme-bg" style={style}>
          <div className="ga-road-line" style={{ borderColor: color }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ga-road-dash" />
            ))}
          </div>
        </div>
      );
    case 'bomb':
      return (
        <div className="ga-theme-bg" style={style}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ga-explosion-ring" style={{ borderColor: color, animationDelay: `${0.5 + i * 0.3}s` }} />
          ))}
        </div>
      );
    case 'wheel':
      return (
        <div className="ga-theme-bg" style={style}>
          <div className="ga-wheel-bg">🎡</div>
        </div>
      );
    case 'sword':
    case 'knife':
      return (
        <div className="ga-theme-bg" style={style}>
          <div className="ga-slash-line" style={{ borderColor: color }} />
          <div className="ga-slash-line ga-slash-2" style={{ borderColor: color }} />
        </div>
      );
    default:
      return (
        <div className="ga-theme-bg" style={style}>
          <div className="ga-bg-pulse" style={{ background: `radial-gradient(circle, ${color}20, transparent)` }} />
        </div>
      );
  }
}

// Center icon with theme-specific animation
function ThemeCenterIcon({ icon, theme, color, duration }: { icon: string; theme: GiftTheme; color: string; duration: number }) {
  const animType = getThemeAnimationType(theme);
  const centerClass = `ga-tc-${animType}`;
  const style = { '--duration': `${duration}s` } as React.CSSProperties;

  return (
    <div className={`ga-theme-center ${centerClass}`} style={style}>
      <div className="ga-theme-icon" style={{ filter: `drop-shadow(0 0 20px ${color})` }}>
        {icon}
      </div>
    </div>
  );
}

export function GiftThemePlayer({ giftName, giftIcon, giftValue, duration, onComplete, usePortal = true, containerStyle }: GiftThemePlayerProps) {
  const soundPlayed = useRef(false);
  const completed = useRef(false);

  const theme = useMemo(() => detectGiftTheme(giftName, giftIcon), [giftName, giftIcon]);
  const color = useMemo(() => getThemeColor(theme), [theme]);
  const emojis = useMemo(() => getThemeParticleEmojis(theme), [theme]);
  const particleCount = useMemo(() => {
    if (giftValue >= 50000) return 30;
    if (giftValue >= 10000) return 22;
    if (giftValue >= 2500) return 16;
    if (giftValue >= 500) return 12;
    return 8;
  }, [giftValue]);

  const particles = useMemo(() => generateParticles(theme, emojis, particleCount), [theme, emojis, particleCount]);

  useEffect(() => {
    if (!soundPlayed.current) {
      soundPlayed.current = true;
      playGiftSound(giftName, giftIcon, giftValue);
    }
  }, [giftName, giftIcon, giftValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!completed.current) {
        completed.current = true;
        onComplete();
      }
    }, duration * 1000);
    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  const tierColor = giftValue >= 50000 ? '#ffd700' : giftValue >= 10000 ? '#ff3b5c' : giftValue >= 2500 ? '#f59e0b' : giftValue >= 500 ? '#a855f7' : '#00e5ff';

  const overlay = (
    <div
      className="gift-3d-overlay g3d-active"
      style={{
        '--duration': `${duration}s`,
        ...(containerStyle || {}),
      } as React.CSSProperties}
    >
      <ThemeBackground theme={theme} color={color} duration={duration} />

      <div className="ga-theme-particles">
        {particles.map(p => (
          <div
            key={p.id}
            className={`ga-theme-particle ${p.animClass}`}
            style={{
              left: p.left,
              fontSize: p.size,
              animationDelay: p.delay,
              animationDuration: `${1.5 + Math.random()}s`,
              filter: `drop-shadow(0 0 8px ${color}60)`,
            }}
          >
            {p.emoji}
          </div>
        ))}
      </div>

      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        <ThemeCenterIcon icon={giftIcon} theme={theme} color={color} duration={duration} />
      </div>

      <div className="g3d-progress">
        <div className="g3d-progress-bar" style={{ background: tierColor, animationDuration: `${duration}s` }} />
      </div>
    </div>
  );

  if (!usePortal) return overlay;
  return createPortal(overlay, document.body);
}
