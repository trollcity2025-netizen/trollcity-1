import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { fadeIn, fadeOut, lerp, BackgroundGlow, GiftLabel } from './utils';

/* ============================================================
   CONFETTI – massive confetti shower
   ============================================================ */
export function ConfettiAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));
  const colors = ['#ff1744', '#2196f3', '#ffeb3b', '#4caf50', '#ff9800', '#e040fb', '#00bcd4'];

  const pieces = Array.from({ length: 80 }).map((_, i) => {
    const seed = i * 7.3;
    const startX = 10 + (seed % 80);
    const speed = 0.5 + (seed % 5) * 0.3;
    const drift = Math.sin(seed) * 100;
    const y = ((frame * speed + seed * 20) % 120) - 10;
    const rot = frame * speed * 3 + seed;
    const w = 8 + (i % 4) * 4;
    const h = 12 + (i % 3) * 6;

    return (
      <div key={i} style={{
        position: 'absolute', left: `${startX}%`, top: `${y}%`,
        width: w, height: h, background: colors[i % colors.length],
        transform: `rotate(${rot}deg) translateX(${Math.sin(frame * 0.05 + seed) * drift}px)`,
        borderRadius: i % 3 === 0 ? '50%' : 2,
        opacity: 0.9, boxShadow: `0 0 8px ${colors[i % colors.length]}40`,
      }} />
    );
  });

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op, overflow: 'hidden' }}>
      <BackgroundGlow color="#e040fb" opacity={0.1} />
      {pieces}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   FIRE – large fire pit burning with visible flames
   ============================================================ */
export function FireAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  const flames = Array.from({ length: 12 }).map((_, i) => {
    const x = 35 + (i / 12) * 30;
    const height = 80 + Math.sin(frame * 0.15 + i * 0.8) * 40 + Math.cos(frame * 0.2 + i) * 20;
    const width = 30 + Math.sin(frame * 0.1 + i * 1.2) * 10;
    const colors = i < 4 ? '#ff4500' : i < 8 ? '#ff6d00' : '#ffab00';

    return (
      <div key={i} style={{
        position: 'absolute', bottom: '20%', left: `${x}%`,
        width, height: `${height}%`, borderRadius: '50% 50% 20% 20%',
        background: `linear-gradient(0deg, ${colors}, transparent)`,
        transform: `translateX(-50%) skewX(${Math.sin(frame * 0.1 + i) * 5}deg)`,
        opacity: 0.7 + Math.sin(frame * 0.2 + i) * 0.2,
        filter: `blur(${2 + i * 0.5}px)`,
      }} />
    );
  });

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 80%, rgba(255,69,0,0.3), transparent 60%)`,
      }} />
      {flames}
      <div style={{
        position: 'absolute', bottom: '15%', left: '50%', transform: 'translateX(-50%)',
        width: '40%', height: 20, background: '#3e2723', borderRadius: '10px 10px 0 0',
        boxShadow: '0 0 30px rgba(255,69,0,0.4)',
      }} />
      {Array.from({ length: 20 }).map((_, i) => {
        const sx = 30 + Math.random() * 40;
        const sy = 80 + (frame * 0.5 + i * 20) % 30;
        return (
          <div key={i} style={{
            position: 'absolute', left: `${sx}%`, top: `${sy}%`,
            width: 4, height: 4, borderRadius: '50%', background: '#ff6d00',
            opacity: 0.6, boxShadow: '0 0 8px #ff4500',
          }} />
        );
      })}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   BOUQUET – flowers float out one by one
   ============================================================ */
export function BouquetAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));
  const flowers = ['\uD83C\uDF38', '\uD83C\uDF3A', '\uD83C\uDF39', '\uD83C\uDF37', '\uD83C\uDF3B', '\uD83C\uDF3C'];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#e91e63" opacity={0.15} />
      <div style={{ fontSize: 120, filter: 'drop-shadow(0 0 30px rgba(233,30,99,0.4))' }}>
        &#128144;
      </div>
      {flowers.map((f, i) => {
        const delay = i * 15;
        const progress = interpolate(frame - delay, [0, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
        const angle = (i / flowers.length) * 360 - 90;
        const dist = progress * 200;
        const x = Math.cos((angle * Math.PI) / 180) * dist;
        const y = Math.sin((angle * Math.PI) / 180) * dist - progress * 50;
        return (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            fontSize: 50, transform: `translate(${x}px, ${y}px) rotate(${progress * 360}deg)`,
            opacity: frame > delay ? 1 : 0,
            filter: 'drop-shadow(0 0 10px rgba(233,30,99,0.3))',
          }}>
            {f}
          </div>
        );
      })}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   BAN HAMMER – judge gavel strike
   ============================================================ */
export function BanHammerAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const swing = interpolate(frame, [10, 20], [-60, 20], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });
  const impact = frame > 20 && frame < 30;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#ff9800" opacity={0.2} />
      <div style={{ position: 'relative' }}>
        <div style={{
          fontSize: 160, transform: `rotate(${swing}deg)`, transformOrigin: 'bottom center',
          filter: 'drop-shadow(0 0 30px rgba(255,152,0,0.5))',
        }}>
          &#128296;
        </div>
        {impact && (
          <div style={{
            position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)',
            width: interpolate(frame, [20, 28], [10, 200], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            height: interpolate(frame, [20, 28], [10, 200], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            borderRadius: '50%', border: '3px solid #ff9800',
            opacity: interpolate(frame, [20, 35], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }} />
        )}
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   PARTY – balloons, confetti, and cake
   ============================================================ */
export function PartyAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op, overflow: 'hidden' }}>
      <BackgroundGlow color="#e040fb" opacity={0.15} />
      <div style={{ position: 'absolute', bottom: '20%', left: '50%', transform: 'translateX(-50%)', fontSize: 120 }}>
        &#127856;
      </div>
      {Array.from({ length: 8 }).map((_, i) => {
        const colors = ['#ff1744', '#2196f3', '#ffeb3b', '#4caf50', '#e040fb', '#ff9800'];
        const x = 10 + (i * 13) % 80;
        const float = Math.sin(frame * 0.04 + i * 0.8) * 20;
        return (
          <div key={i} style={{
            position: 'absolute', left: `${x}%`, top: `${15 + float + (i % 3) * 10}%`,
            fontSize: 50 + (i % 3) * 15,
            filter: `drop-shadow(0 5px 15px ${colors[i % colors.length]}60)`,
          }}>
            &#127880;
          </div>
        );
      })}
      {Array.from({ length: 40 }).map((_, i) => {
        const x = 5 + (i * 23) % 90;
        const y = ((frame * 0.8 + i * 15) % 100);
        const colors = ['#ff1744', '#2196f3', '#ffeb3b', '#4caf50'];
        return (
          <div key={i} style={{
            position: 'absolute', left: `${x}%`, top: `${y}%`,
            width: 6, height: 6, borderRadius: i % 2 ? '50%' : 1,
            background: colors[i % colors.length], opacity: 0.8,
          }} />
        );
      })}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   100 – Troll City style "100" animation
   ============================================================ */
export function HundredAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scaleIn = interpolate(frame, [5, 25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) });
  const wobble = Math.sin(frame * 0.15) * 5;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#00e676" opacity={0.2} />
      <div style={{
        fontSize: 220, fontWeight: 'bold', fontFamily: 'system-ui, sans-serif',
        color: '#00e676', textShadow: '0 0 60px rgba(0,230,118,0.6), 0 0 120px rgba(0,230,118,0.3)',
        transform: `scale(${scaleIn}) rotate(${wobble}deg)`,
        WebkitTextStroke: '3px #1b5e20',
      }}>
        &#128175;
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${15 + (i * 31) % 70}%`, top: `${20 + (i * 37) % 60}%`,
          fontSize: 30, opacity: 0.4 + Math.sin(frame * 0.05 + i) * 0.2,
          transform: `rotate(${frame * (i % 2 ? 1 : -1) + i * 36}deg)`,
        }}>
          &#128175;
        </div>
      ))}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   FLEX – muscular arm lifting a weight
   ============================================================ */
export function FlexAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const lift = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const flex = 1 + Math.sin(frame * 0.2) * 0.1;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#f44336" opacity={0.2} />
      <div style={{
        fontSize: 180, transform: `scale(${flex})`,
        filter: 'drop-shadow(0 0 40px rgba(244,67,54,0.5))',
      }}>
        &#128170;
      </div>
      <div style={{
        position: 'absolute', left: '50%', top: '35%', transform: `translateX(-50%) translateY(${-lift * 100}px)`,
        fontSize: 60, opacity: lift, filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.5))',
      }}>
        &#127942;
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   TEDDY BEAR – teddy bear hugs itself
   ============================================================ */
export function TeddyBearAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scaleIn = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.5)) });
  const hug = Math.sin(frame * 0.12);
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#8d6e63" opacity={0.2} />
      <div style={{
        fontSize: 180, transform: `scale(${scaleIn}) scaleX(${1 + hug * 0.05})`,
        filter: 'drop-shadow(0 0 30px rgba(141,110,99,0.4))',
      }}>
        &#129528;
      </div>
      {hug > 0.8 && Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          fontSize: 25, opacity: 0.6,
          transform: `translate(${Math.cos((i / 6) * Math.PI * 2) * 130}px, ${Math.sin((i / 6) * Math.PI * 2) * 130}px)`,
        }}>
          &#10084;&#65039;
        </div>
      ))}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   DUMPSTER FIRE – dumpster visibly on fire
   ============================================================ */
export function DumpsterFireAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 60%, rgba(255,69,0,0.2), transparent 70%)`,
      }} />
      <div style={{ position: 'relative', fontSize: 150, filter: 'drop-shadow(0 0 40px rgba(255,69,0,0.5))' }}>
        &#128465;
      </div>
      {Array.from({ length: 8 }).map((_, i) => {
        const x = -40 + i * 12;
        const height = 30 + Math.sin(frame * 0.2 + i) * 20;
        return (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '-30%',
            transform: `translateX(${x}px)`,
            width: 15, height, borderRadius: '50% 50% 20% 20%',
            background: `linear-gradient(0deg, ${i < 3 ? '#ff4500' : '#ff6d00'}, transparent)`,
            opacity: 0.6 + Math.sin(frame * 0.15 + i) * 0.2,
            filter: 'blur(2px)',
          }} />
        );
      })}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   SIREN – police car with flashing lights drives across
   ============================================================ */
export function SirenAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const x = interpolate(frame, [0, durationInFrames], [-400, 1920 + 400], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const flash = Math.sin(frame * 0.5);
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `rgba(${flash > 0 ? '255,0,0' : '0,0,255'},${Math.abs(flash) * 0.1})`,
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: x,
        transform: 'translateY(-50%)', fontSize: 120,
        filter: 'drop-shadow(0 0 30px rgba(0,0,0,0.5))',
      }}>
        &#128668;
      </div>
      <div style={{
        position: 'absolute', top: '42%', left: x + 80,
        width: 60, height: 20, borderRadius: 10,
        background: flash > 0 ? '#ff0000' : '#0000ff',
        boxShadow: `0 0 40px ${flash > 0 ? '#ff0000' : '#0000ff'}, 0 0 80px ${flash > 0 ? '#ff0000' : '#0000ff'}`,
        opacity: 0.9,
      }} />
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   CHOCOLATE – chocolate bar breaks into pieces
   ============================================================ */
export function ChocolateAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const breakAt = durationInFrames * 0.4;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  const squares = Array.from({ length: 12 }).map((_, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const broken = frame > breakAt;
    const progress = broken ? interpolate(frame, [breakAt, breakAt + 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }) : 0;
    const angle = ((row + col) % 2 ? 1 : -1) * progress * 180;
    const x = (col - 1.5) * 60 + (broken ? (col - 1.5) * progress * 200 : 0);
    const y = (row - 0.5) * 60 + (broken ? (row - 0.5) * progress * 150 : 0);

    return (
      <div key={i} style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 55, height: 55, borderRadius: 5,
        background: 'linear-gradient(135deg, #5d3a1a, #3e2723)',
        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${angle}deg)`,
        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3), 0 2px 5px rgba(0,0,0,0.2)',
        border: '1px solid #4e342e',
      }}>
        <div style={{
          position: 'absolute', top: '30%', left: '20%', right: '20%', bottom: '30%',
          borderRadius: '50%', background: 'rgba(0,0,0,0.15)',
        }} />
      </div>
    );
  });

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#5d3a1a" opacity={0.2} />
      {squares}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   MEDAL – medal award animation
   ============================================================ */
export function MedalAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const dropIn = interpolate(frame, [10, 30], [-300, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.bounce) });
  const shine = Math.sin(frame * 0.15);
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#ffd700" opacity={0.25} />
      <div style={{
        transform: `translateY(${dropIn}px)`,
        fontSize: 180,
        filter: `drop-shadow(0 0 ${30 + shine * 20}px rgba(255,215,0,0.6))`,
      }}>
        &#129351;
      </div>
      {frame > 30 && Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 360 + frame * 2;
        const dist = 130 + Math.sin(frame * 0.1 + i) * 20;
        return (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 6, height: 6, borderRadius: '50%',
            background: '#ffd700',
            transform: `translate(${Math.cos((angle * Math.PI) / 180) * dist}px, ${Math.sin((angle * Math.PI) / 180) * dist}px)`,
            boxShadow: '0 0 10px #ffd700',
            opacity: 0.7,
          }} />
        );
      })}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   CROWN – ultra-realistic crown rotating clockwise
   ============================================================ */
export function CrownAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const rot = frame * 1.5;
  const scaleIn = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 50%, #8b000020, #4a0000)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(139,0,0,0.1) 40px, rgba(139,0,0,0.1) 41px),
                          repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(139,0,0,0.1) 40px, rgba(139,0,0,0.1) 41px)`,
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: `translate(-50%, -50%) scale(${scaleIn}) rotateY(${rot}deg)`,
        fontSize: 200, filter: 'drop-shadow(0 0 60px rgba(255,215,0,0.7))',
      }}>
        &#128081;
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   LAG SWITCH – internet lag/glitch effect
   ============================================================ */
export function LagSwitchAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const glitch = Math.sin(frame * 0.8) > 0.3;
  const xOffset = glitch ? (Math.random() - 0.5) * 30 : 0;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op, overflow: 'hidden' }}>
      {glitch && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `repeating-linear-gradient(0deg, transparent, transparent ${2 + Math.random() * 5}px, rgba(0,255,0,0.03) ${2 + Math.random() * 5}px, rgba(0,255,0,0.03) ${4 + Math.random() * 5}px)`,
        }} />
      )}
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) translateX(${xOffset}px)`,
        fontSize: 100, filter: glitch ? 'hue-rotate(90deg) blur(2px)' : 'none',
        fontFamily: 'monospace', color: glitch ? '#00ff00' : '#ff0000',
        textShadow: glitch ? '2px 0 #ff0000, -2px 0 #0000ff' : '0 0 30px rgba(255,0,0,0.5)',
      }}>
        {glitch ? 'LAG...' : '\u{1F4F6} LAG'}
      </div>
      {glitch && Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', top: `${20 + i * 15}%`, left: 0, right: 0,
          height: 3, background: `rgba(${Math.random() > 0.5 ? '255,0,0' : '0,255,0'},0.3)`,
          transform: `translateX(${(Math.random() - 0.5) * 100}px)`,
        }} />
      ))}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   TROPHY – trophy grows then disappears
   ============================================================ */
export function TrophyAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const grow = interpolate(frame, [10, 30], [0.3, 1.2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.5)) });
  const disappear = interpolate(frame, [durationInFrames - 30, durationInFrames - 5], [1.2, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = frame < durationInFrames - 30 ? grow : disappear;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#ffd700" opacity={0.25} />
      <div style={{
        fontSize: 180, transform: `scale(${scale}) rotate(${Math.sin(frame * 0.1) * 5}deg)`,
        filter: `drop-shadow(0 0 50px rgba(255,215,0,0.6))`,
      }}>
        &#127942;
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   404 ERROR – 404 expands across screen
   ============================================================ */
export function Error404Animation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const expand = interpolate(frame, [10, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: `${expand * 200}%`, height: `${expand * 200}%`,
        transform: 'translate(-50%, -50%)',
        background: '#000', borderRadius: expand < 1 ? '50%' : 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <div style={{
          fontSize: interpolate(frame, [20, 45], [0, 160], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          color: '#ff0000', fontFamily: 'monospace', fontWeight: 'bold',
          textShadow: '0 0 30px rgba(255,0,0,0.5)',
          opacity: expand > 0.5 ? 1 : 0,
        }}>
          404
        </div>
        <div style={{
          fontSize: interpolate(frame, [30, 55], [0, 36], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          color: '#ff4444', fontFamily: 'monospace',
          opacity: expand > 0.7 ? 1 : 0,
          marginTop: 10,
        }}>
          ERROR NOT FOUND
        </div>
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   RING – diamond ring sparkles and glistens
   ============================================================ */
export function RingAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scaleIn = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) });
  const rot = Math.sin(frame * 0.08) * 15;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#e0e0e0" opacity={0.2} />
      <div style={{
        fontSize: 200, transform: `scale(${scaleIn}) rotate(${rot}deg)`,
        filter: `drop-shadow(0 0 ${40 + Math.sin(frame * 0.15) * 20}px rgba(255,255,255,0.6))`,
      }}>
        &#128141;
      </div>
      {Array.from({ length: 20 }).map((_, i) => {
        const sparkle = Math.sin(frame * 0.1 + i * 1.5) > 0.7;
        const x = 20 + (i * 31) % 60;
        const y = 20 + (i * 37) % 60;
        return sparkle ? (
          <div key={i} style={{
            position: 'absolute', left: `${x}%`, top: `${y}%`,
            width: 4, height: 4, borderRadius: '50%', background: '#fff',
            boxShadow: '0 0 10px #fff, 0 0 20px rgba(255,255,255,0.5)',
          }} />
        ) : null;
      })}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}
