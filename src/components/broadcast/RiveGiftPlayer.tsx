/**
 * Rive Gift Player
 * Plays per-gift Rive animations (.riv files) with transparent backgrounds
 * Each gift has its own unique .riv animation file and sound
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';
import { findGiftAnimation, getGiftDuration, playGiftAudio, GiftAnimEntry } from '../../lib/giftAnimationRegistry';
import './rive-gift-player.css';

interface RiveGiftPlayerProps {
  giftName: string;
  giftIcon: string;
  giftValue: number;
  onComplete: () => void;
}

// Rive canvas component for a single gift
function GiftRiveCanvas({ entry, duration, onComplete }: {
  entry: GiftAnimEntry;
  duration: number;
  onComplete: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const completed = useRef(false);

  // Load Rive animation
  const { rive, RiveComponent } = useRive({
    src: entry.animation,
    autoplay: false,
    stateMachines: entry.stateMachine || 'State Machine 1',
    onLoad: () => {
      // Play the animation trigger
      const input = rive?.stateMachineInputs(entry.stateMachine || 'State Machine 1')
        ?.find((i: any) => i.name === (entry.inputName || 'play'));
      if (input && input.type === 58) { // Trigger type
        input.fire();
      }
      // Start playing
      rive?.play();
    },
    onLoadError: () => {
      // Rive file doesn't exist, will show fallback
    },
  });

  // Play sound on mount
  useEffect(() => {
    audioRef.current = playGiftAudio(entry.sound);
    if (!audioRef.current) {
      audioRef.current = playGiftAudio(entry.fallbackSound);
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, [entry]);

  // Auto-complete after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!completed.current) {
        completed.current = true;
        onComplete();
      }
    }, duration * 1000);
    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  return (
    <div className="rive-canvas-wrap">
      <RiveComponent className="rive-canvas" />
    </div>
  );
}

// Fallback when no .riv file exists
function GiftFallback({ icon, name, duration, onComplete, sound }: {
  icon: string;
  name: string;
  duration: number;
  onComplete: () => void;
  sound: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const completed = useRef(false);

  useEffect(() => {
    audioRef.current = playGiftAudio(sound);
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, [sound]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!completed.current) { completed.current = true; onComplete(); }
    }, duration * 1000);
    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  return (
    <div className="rive-fallback">
      <div className="rive-fallback-icon">{icon}</div>
      <div className="rive-fallback-name">{name.replace(/_/g, ' ')}</div>
      <div className="rive-fallback-hint">
        Drop <code>{name.toLowerCase().replace(/_/g, '-')}.riv</code> into <code>/public/gift-rive/</code>
      </div>
    </div>
  );
}

// Main overlay component
export function RiveGiftPlayer({ giftName, giftIcon, giftValue, onComplete }: RiveGiftPlayerProps) {
  const [phase, setPhase] = useState<'enter' | 'active' | 'exit'>('enter');
  const entry = findGiftAnimation(giftName, giftIcon);
  const duration = getGiftDuration(giftValue);
  const completed = useRef(false);

  const handleComplete = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    setPhase('exit');
    setTimeout(onComplete, 400);
  }, [onComplete]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('active'), 50);
    return () => clearTimeout(t1);
  }, []);

  const tierColor = giftValue >= 50000 ? '#ffd700' : giftValue >= 10000 ? '#ff3b5c' : giftValue >= 2500 ? '#f59e0b' : giftValue >= 500 ? '#a855f7' : '#00e5ff';

  return createPortal(
    <div className={`rive-overlay rive-${phase}`}>
      {/* Transparent background - no opaque fill */}

      {/* Rive animation or fallback */}
      {entry ? (
        <GiftRiveCanvas entry={entry} duration={duration} onComplete={handleComplete} />
      ) : (
        <GiftFallback
          icon={giftIcon}
          name={giftName}
          duration={duration}
          onComplete={handleComplete}
          sound="/sounds/click.mp3"
        />
      )}

      {/* Gift label */}
      <div className="rive-label">
        <span className="rive-label-icon">{giftIcon}</span>
        <span className="rive-label-name">{giftName.replace(/_/g, ' ')}</span>
        <span className="rive-label-cost" style={{ color: tierColor }}>{giftValue.toLocaleString()} coins</span>
      </div>

      {/* Progress bar */}
      <div className="rive-progress">
        <div className="rive-progress-bar" style={{ background: tierColor, animationDuration: `${duration}s` }} />
      </div>
    </div>,
    document.body
  );
}
