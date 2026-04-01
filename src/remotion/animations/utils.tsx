import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, spring, Easing } from 'remotion';

export function useSpringValue(
  frame: number,
  fps: number,
  config?: { damping?: number; stiffness?: number; mass?: number }
) {
  return spring({ frame, fps, config: config ?? { damping: 15, stiffness: 100, mass: 0.8 } });
}

export function lerp(frame: number, range: [number, number], output: [number, number], easing?: (t: number) => number) {
  return interpolate(frame, range, output, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
}

export function fadeIn(frame: number, start: number, end: number) {
  return interpolate(frame, [start, end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

export function fadeOut(frame: number, start: number, end: number) {
  return interpolate(frame, [start, end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

export function scaleIn(frame: number, start: number, end: number) {
  return interpolate(frame, [start, end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.5)) });
}

export function scaleUp(frame: number, start: number, end: number, from = 0, to = 1) {
  return interpolate(frame, [start, end], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

export function slideIn(frame: number, start: number, end: number, from: number, to: number) {
  return interpolate(frame, [start, end], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
}

export function rotate(frame: number, start: number, end: number, from: number, to: number) {
  return interpolate(frame, [start, end], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

export function pulse(frame: number, speed: number, min: number, max: number) {
  return interpolate(Math.sin(frame * speed * 0.1), [-1, 1], [min, max]);
}

export function bounce(frame: number, start: number, end: number, height: number) {
  const t = interpolate(frame, [start, end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return -height * Math.sin(t * Math.PI);
}

interface ParticleProps {
  emoji: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startFrame: number;
  endFrame: number;
  size: number;
  rotation?: number;
  opacity?: [number, number];
}

export function Particle({ emoji, startX, startY, endX, endY, startFrame, endFrame, size, rotation = 0, opacity = [0, 1] }: ParticleProps) {
  const frame = useCurrentFrame();
  const x = lerp(frame, [startFrame, endFrame], [startX, endX]);
  const y = lerp(frame, [startFrame, endFrame], [startY, endY]);
  const op = interpolate(frame, [startFrame, endFrame], opacity, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rot = interpolate(frame, [startFrame, endFrame], [0, rotation], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return React.createElement('div', {
    style: {
      position: 'absolute',
      left: `${x}%`,
      top: `${y}%`,
      fontSize: `${size}px`,
      transform: `translate(-50%, -50%) rotate(${rot}deg)`,
      opacity: op,
      pointerEvents: 'none',
    },
  }, emoji);
}

export function BackgroundGlow({ color, opacity = 0.3 }: { color: string; opacity?: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeDuration = Math.min(15, durationInFrames * 0.15);
  const fadeInVal = interpolate(frame, [0, fadeDuration], [0, opacity], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeOutVal = interpolate(frame, [durationInFrames - fadeDuration, durationInFrames], [opacity, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const op = Math.min(fadeInVal, fadeOutVal);

  return React.createElement('div', {
    style: {
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(ellipse at center, ${color}${Math.round(op * 255).toString(16).padStart(2, '0')}, transparent 70%)`,
      pointerEvents: 'none',
    },
  });
}

export function GiftLabel({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeInVal = fadeIn(frame, 5, 20);
  const fadeOutVal = fadeOut(frame, durationInFrames - 20, durationInFrames - 5);
  const op = Math.min(fadeInVal, fadeOutVal);

  return React.createElement('div', {
    style: {
      position: 'absolute',
      bottom: '8%',
      left: '50%',
      transform: 'translateX(-50%)',
      textAlign: 'center',
      opacity: op,
      pointerEvents: 'none',
      zIndex: 100,
    },
  },
    React.createElement('div', {
      style: { fontSize: '48px', fontWeight: 'bold', color: '#fff', textShadow: '0 0 30px rgba(0,0,0,0.8), 0 2px 10px rgba(0,0,0,0.5)', fontFamily: 'system-ui, sans-serif' },
    }, `${emoji} ${name}`),
    React.createElement('div', {
      style: { fontSize: '28px', color: cost >= 2000 ? '#ffd700' : '#ccc', textShadow: '0 0 20px rgba(0,0,0,0.8)', fontFamily: 'system-ui, sans-serif', marginTop: '4px' },
    }, `${cost.toLocaleString()} coins`)
  );
}
