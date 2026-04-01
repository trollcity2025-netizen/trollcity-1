import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { fadeIn, fadeOut, lerp, BackgroundGlow, GiftLabel } from './utils';

/* ============================================================
   UNICORN – unicorn grazes, looks up, flies away
   ============================================================ */
export function UnicornAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const phase = frame / durationInFrames;
  const y = phase < 0.6 ? 0 : interpolate(frame, [durationInFrames * 0.6, durationInFrames], [0, -500], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #e1bee7 0%, #f8bbd0 30%, #b2dfdb 60%, #c8e6c9 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(0deg, #4caf50, #81c784, transparent)' }} />
      <div style={{
        position: 'absolute', left: '50%', bottom: `calc(30% + ${y}px)`,
        transform: 'translateX(-50%)', fontSize: 140,
        filter: 'drop-shadow(0 0 40px rgba(233,30,99,0.4))',
      }}>
        &#129412;
      </div>
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${10 + (i * 29) % 80}%`, top: `${10 + (i * 31) % 50}%`,
          fontSize: 15 + (i % 3) * 8, opacity: 0.3 + Math.sin(frame * 0.04 + i) * 0.2,
          transform: `translateY(${Math.sin(frame * 0.03 + i * 0.5) * 15}px)`,
        }}>
          &#10024;
        </div>
      ))}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   PHOENIX – map of Phoenix, Arizona
   ============================================================ */
export function PhoenixAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, 30], [3, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, #ff6f00 0%, #ff8f00 30%, #ffa726 50%, #d84315 70%, #bf360c 100%)',
        transform: `scale(${zoom})`,
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        textAlign: 'center', opacity: interpolate(frame, [25, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        <div style={{ fontSize: 160, filter: 'drop-shadow(0 0 40px rgba(255,111,0,0.6))' }}>
          &#128038;
        </div>
        <div style={{
          fontSize: 48, color: '#fff', fontFamily: 'system-ui, sans-serif', fontWeight: 'bold',
          textShadow: '0 0 20px rgba(0,0,0,0.5)', marginTop: 10,
        }}>
          PHOENIX, AZ
        </div>
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${20 + i * 8}%`, top: `${30 + (i % 3) * 20}%`,
          width: 20, height: 60 + i * 10, background: 'rgba(255,255,255,0.15)',
          borderRadius: 3, transform: `translateY(${Math.sin(frame * 0.02 + i) * 5}px)`,
        }} />
      ))}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   ALIEN INVERSION – UFO lands, aliens come out
   ============================================================ */
export function AlienInvasionAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const land = interpolate(frame, [10, 50], [-300, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const aliensOut = interpolate(frame, [55, durationInFrames - 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <div style={{ position: 'absolute', inset: 0, background: '#0a0a2e' }} />
      {Array.from({ length: 150 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${(i * 29) % 100}%`, top: `${(i * 37) % 60}%`,
          width: i % 8 === 0 ? 3 : 1, height: i % 8 === 0 ? 3 : 1,
          borderRadius: '50%', background: '#fff', opacity: 0.4,
        }} />
      ))}
      <div style={{
        position: 'absolute', left: '50%', top: `calc(30% + ${land}px)`,
        transform: 'translateX(-50%)', fontSize: 140,
        filter: 'drop-shadow(0 0 50px rgba(118,255,3,0.5))',
      }}>
        &#128125;
      </div>
      {frame > 55 && Array.from({ length: 3 }).map((_, i) => {
        const ax = (i - 1) * 100 * aliensOut;
        const ay = 80 * aliensOut;
        return (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '45%',
            transform: `translate(${ax}px, ${ay}px)`,
            fontSize: 60, opacity: aliensOut,
          }}>
            &#128125;
          </div>
        );
      })}
      <div style={{
        position: 'absolute', bottom: '10%', left: 0, right: 0, height: '15%',
        background: 'linear-gradient(0deg, #1b5e20, #2e7d32, transparent)',
      }} />
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   GALAXY – realistic galaxy with meteors
   ============================================================ */
export function GalaxyAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const rot = frame * 0.3;
  const op = Math.min(fadeIn(frame, 0, 10), fadeOut(frame, durationInFrames - 15, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <div style={{ position: 'absolute', inset: 0, background: '#000' }} />
      {Array.from({ length: 300 }).map((_, i) => {
        const angle = (i / 300) * 360 * 3 + rot;
        const dist = (i / 300) * 50 + 10;
        const x = 50 + Math.cos((angle * Math.PI) / 180) * dist;
        const y = 50 + Math.sin((angle * Math.PI) / 180) * dist * 0.4;
        return (
          <div key={i} style={{
            position: 'absolute', left: `${x}%`, top: `${y}%`,
            width: i % 15 === 0 ? 4 : i % 5 === 0 ? 2 : 1,
            height: i % 15 === 0 ? 4 : i % 5 === 0 ? 2 : 1,
            borderRadius: '50%',
            background: i % 20 === 0 ? '#e040fb' : i % 10 === 0 ? '#7c4dff' : '#fff',
            opacity: 0.3 + Math.sin(frame * 0.02 + i * 0.1) * 0.3,
            boxShadow: i % 15 === 0 ? '0 0 5px #e040fb' : 'none',
          }} />
        );
      })}
      {Array.from({ length: 5 }).map((_, i) => {
        const startX = 100;
        const startY = i * 20;
        const progress = ((frame + i * 40) % durationInFrames) / durationInFrames;
        const mx = interpolate(progress, [0, 1], [startX, -10]);
        const my = interpolate(progress, [0, 1], [startY, startY + 40]);
        return (
          <div key={i} style={{
            position: 'absolute', left: `${mx}%`, top: `${my}%`,
            width: 3, height: 3, borderRadius: '50%', background: '#ffab00',
            boxShadow: '0 0 10px #ff6d00, -20px 5px 0 #ff6d0040, -40px 10px 0 #ff6d0020',
          }} />
        );
      })}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   TIME MACHINE – time machine appears, then flies away
   ============================================================ */
export function TimeMachineAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const appear = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.5)) });
  const flyAway = interpolate(frame, [durationInFrames * 0.6, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = appear * (1 + flyAway * 2);
  const y = flyAway * -600;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle, rgba(0,188,212,${0.1 + appear * 0.1}), #000)`,
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: `calc(50% + ${y}px)`,
        transform: `translate(-50%, -50%) scale(${scale}) rotateY(${frame * 5}deg)`,
        fontSize: 140, filter: 'drop-shadow(0 0 50px rgba(0,188,212,0.6))',
      }}>
        &#9203;
      </div>
      {appear > 0.5 && Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 200 + i * 100, height: 200 + i * 100,
          borderRadius: '50%', border: '2px solid rgba(0,188,212,0.3)',
          transform: `translate(-50%, -50%) rotate(${frame * (2 - i * 0.5)}deg)`,
          opacity: 1 - flyAway,
        }} />
      ))}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   BLACK HOLE – expands until full screen, then disappears
   ============================================================ */
export function BlackHoleAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const expand = interpolate(frame, [10, durationInFrames * 0.7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const disappear = interpolate(frame, [durationInFrames * 0.7, durationInFrames - 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const size = expand < 1 ? expand : disappear;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 15, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: '#000' }} />
      {Array.from({ length: 200 }).map((_, i) => {
        const angle = (i / 200) * 360 + frame * 2;
        const baseDist = 100 + (i % 20) * 30;
        const dist = baseDist * size;
        const x = 50 + Math.cos((angle * Math.PI) / 180) * dist / 10;
        const y = 50 + Math.sin((angle * Math.PI) / 180) * dist / 10;
        return (
          <div key={i} style={{
            position: 'absolute', left: `${x}%`, top: `${y}%`,
            width: 3, height: 3, borderRadius: '50%',
            background: i % 5 === 0 ? '#e040fb' : '#fff',
            opacity: 0.4, transform: `rotate(${angle}deg)`,
          }} />
        );
      })}
      <div style={{
        width: `${size * 800}px`, height: `${size * 800}px`, borderRadius: '50%',
        background: 'radial-gradient(circle, #000 30%, #1a0030 50%, #4a0080 60%, #000 70%)',
        boxShadow: `0 0 ${size * 200}px rgba(128,0,255,0.4), 0 0 ${size * 400}px rgba(0,0,0,0.8)`,
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          position: 'absolute', inset: '10%', borderRadius: '50%',
          background: 'radial-gradient(circle, #000 60%, transparent)',
        }} />
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}
