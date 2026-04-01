import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { fadeIn, fadeOut, lerp, BackgroundGlow, GiftLabel } from './utils';

/* ============================================================
   COOKIE – cookie breaks cleanly in half
   ============================================================ */
export function CookieAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const split = interpolate(frame, [15, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const op = Math.min(fadeIn(frame, 0, 10), fadeOut(frame, durationInFrames - 15, durationInFrames));
  const shake = frame < 15 ? Math.sin(frame * 2) * 3 : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#d4a574" opacity={0.2} />
      <div style={{ position: 'relative', transform: `translateX(${shake}px)` }}>
        <div style={{
          width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #d4a574, #8B6914)',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.3), 0 0 40px rgba(212,165,116,0.4)',
          transform: `translateX(${-split * 120}px) rotate(${-split * 25}deg)`, transition: 'none',
          clipPath: 'inset(0 50% 0 0)', position: 'absolute',
        }}>
          {[30, 60, 90, 120, 150].map((x, i) => (
            <div key={i} style={{ position: 'absolute', left: x, top: 60 + i * 25, width: 16, height: 16, borderRadius: '50%', background: '#5C4033', boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.3)' }} />
          ))}
        </div>
        <div style={{
          width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle at 65% 35%, #d4a574, #8B6914)',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.3), 0 0 40px rgba(212,165,116,0.4)',
          transform: `translateX(${split * 120}px) rotate(${split * 25}deg)`,
          clipPath: 'inset(0 0 0 50%)', position: 'absolute',
        }}>
          {[30, 60, 90, 120, 150].map((x, i) => (
            <div key={i} style={{ position: 'absolute', left: x - 20, top: 60 + i * 25, width: 16, height: 16, borderRadius: '50%', background: '#5C4033', boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.3)' }} />
          ))}
        </div>
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   ROSE – rose unravels then closes back up
   ============================================================ */
export function RoseAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const mid = durationInFrames / 2;
  const open = interpolate(frame, [10, mid], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const close = interpolate(frame, [mid, durationInFrames - 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const spread = open > 0 ? open : close;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  const petals = Array.from({ length: 12 }).map((_, i) => {
    const angle = (i / 12) * 360;
    const r = spread * 80;
    const x = Math.cos((angle * Math.PI) / 180) * r;
    const y = Math.sin((angle * Math.PI) / 180) * r;
    return (
      <div key={i} style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 50, height: 70, borderRadius: '50% 50% 50% 0',
        background: i % 3 === 0 ? '#e91e63' : i % 3 === 1 ? '#f48fb1' : '#c2185b',
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${angle + spread * 45}deg) scale(${0.6 + spread * 0.4})`,
        boxShadow: '0 0 15px rgba(233,30,99,0.4)',
        transition: 'none',
      }} />
    );
  });

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#e91e63" opacity={0.25} />
      <div style={{ position: 'relative', width: 300, height: 300 }}>
        {petals}
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: 30, height: 30, borderRadius: '50%', background: '#ffeb3b',
          boxShadow: '0 0 20px rgba(255,235,59,0.6)', zIndex: 10,
        }} />
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   ICE CREAM – ice cream cone slowly melts
   ============================================================ */
export function IceCreamAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const melt = interpolate(frame, [20, durationInFrames - 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const op = Math.min(fadeIn(frame, 0, 10), fadeOut(frame, durationInFrames - 15, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#ffb6c1" opacity={0.2} />
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 0, height: 0, borderLeft: '50px solid transparent', borderRight: '50px solid transparent',
          borderTop: '140px solid #d4a574', position: 'absolute', top: 100 + melt * 60, left: '50%',
          transform: 'translateX(-50%)', filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.3))',
        }} />
        <div style={{
          width: 120 - melt * 20, height: 80 - melt * 40, borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 40%, #ffb6c1, #e91e63)',
          position: 'absolute', top: 40 + melt * 30, left: '50%',
          transform: `translateX(-50%) scaleX(${1 + melt * 0.5}) scaleY(${1 - melt * 0.4})`,
          boxShadow: '0 0 30px rgba(255,182,193,0.5)',
        }} />
        <div style={{
          width: 100 - melt * 15, height: 70 - melt * 35, borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 40%, #98fb98, #4caf50)',
          position: 'absolute', top: -10 + melt * 20, left: '50%',
          transform: `translateX(-50%) translateX(15px) scaleX(${1 + melt * 0.6}) scaleY(${1 - melt * 0.5})`,
          boxShadow: '0 0 25px rgba(152,251,152,0.4)',
        }} />
        {melt > 0.3 && (
          <>
            <div style={{
              position: 'absolute', top: 120 + melt * 80, left: '45%', width: 15, height: 20 + melt * 40,
              borderRadius: '0 0 50% 50%', background: '#ffb6c1', opacity: 0.7,
            }} />
            <div style={{
              position: 'absolute', top: 130 + melt * 70, left: '55%', width: 12, height: 15 + melt * 30,
              borderRadius: '0 0 50% 50%', background: '#98fb98', opacity: 0.7,
            }} />
          </>
        )}
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   THUMBS UP – fist appears then thumb raises upward
   ============================================================ */
export function ThumbsUpAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fistIn = interpolate(frame, [5, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) });
  const thumbUp = interpolate(frame, [25, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.5)) });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#2196f3" opacity={0.2} />
      <div style={{
        fontSize: 180, transform: `scale(${fistIn})`,
        filter: 'drop-shadow(0 0 40px rgba(33,150,243,0.5))',
        position: 'relative',
      }}>
        <span style={{ display: 'block', transform: `rotate(${-thumbUp * 30}deg) translateY(${-thumbUp * 30}px)` }}>
          &#128077;
        </span>
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   COFFEE – coffee pours from pot into mug
   ============================================================ */
export function CoffeeAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pour = interpolate(frame, [15, durationInFrames - 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const op = Math.min(fadeIn(frame, 0, 10), fadeOut(frame, durationInFrames - 15, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#6f4e37" opacity={0.2} />
      <div style={{ position: 'relative', width: 300, height: 400 }}>
        <div style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%) rotate(20deg)',
          width: 80, height: 100, background: 'linear-gradient(135deg, #888, #555)',
          borderRadius: '5px 5px 15px 15px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        }}>
          <div style={{
            position: 'absolute', bottom: -10, right: -5, width: 15, height: 30 + pour * 100,
            background: 'linear-gradient(180deg, #6f4e37, #3e2723)', borderRadius: '0 0 8px 8px',
            opacity: pour > 0.1 ? 1 : 0,
          }} />
        </div>
        <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 100, background: 'linear-gradient(135deg, #fff, #e0e0e0)',
          borderRadius: '0 0 20px 20px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          border: '3px solid #ccc',
        }}>
          <div style={{
            position: 'absolute', bottom: 5, left: 5, right: 5,
            height: `${Math.min(pour * 90, 80)}%`,
            background: 'linear-gradient(180deg, #6f4e37, #3e2723)',
            borderRadius: '0 0 15px 15px', transition: 'none',
          }} />
          {pour > 0.5 && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute', top: -5 - i * 8, left: 20 + i * 18,
              width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.6)',
              opacity: Math.sin(frame * 0.2 + i) * 0.5 + 0.5,
            }} />
          ))}
          <div style={{
            position: 'absolute', right: -30, top: 20, width: 25, height: 40,
            border: '6px solid #ccc', borderLeft: 'none', borderRadius: '0 20px 20px 0',
          }} />
        </div>
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   BEER – beer pours from tap into glass
   ============================================================ */
export function BeerAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pour = interpolate(frame, [15, durationInFrames - 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const op = Math.min(fadeIn(frame, 0, 10), fadeOut(frame, durationInFrames - 15, durationInFrames));
  const headSize = pour * 40;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#f28e1c" opacity={0.2} />
      <div style={{ position: 'relative', width: 200, height: 400 }}>
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 40, height: 80, background: 'linear-gradient(135deg, #888, #444)',
          borderRadius: '5px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
        }}>
          <div style={{
            position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
            width: 8, height: 50 + pour * 150, background: 'linear-gradient(180deg, #f28e1c, #e65100)',
            borderRadius: '0 0 4px 4px', opacity: pour > 0.05 ? 1 : 0,
          }} />
        </div>
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          width: 100, height: 200, background: 'rgba(255,255,255,0.15)',
          borderRadius: '5px 5px 25px 25px', border: '3px solid rgba(255,255,255,0.3)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: `${Math.min(pour * 85, 75)}%`,
            background: 'linear-gradient(180deg, #f28e1c 0%, #e65100 50%, #bf360c 100%)',
            transition: 'none',
          }}>
            {headSize > 10 && (
              <div style={{
                position: 'absolute', top: -headSize, left: 0, right: 0,
                height: headSize, background: 'linear-gradient(180deg, #fff8e1, #ffe0b2)',
                borderRadius: '10px 10px 0 0', boxShadow: '0 -5px 15px rgba(255,248,225,0.5)',
              }} />
            )}
          </div>
        </div>
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   PIZZA – slices fly out from whole pizza to user boxes
   ============================================================ */
export function PizzaAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  const slices = Array.from({ length: 8 }).map((_, i) => {
    const delay = i * 5;
    const angle = (i / 8) * 360;
    const flyProgress = interpolate(frame, [20 + delay, 50 + delay], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
    const x = Math.cos((angle * Math.PI) / 180) * flyProgress * 500;
    const y = Math.sin((angle * Math.PI) / 180) * flyProgress * 300;
    const rot = flyProgress * 360 * (i % 2 === 0 ? 1 : -1);

    return (
      <div key={i} style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 0, height: 0,
        borderLeft: '30px solid transparent', borderRight: '30px solid transparent',
        borderBottom: '80px solid #ff6347',
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rot}deg)`,
        filter: 'drop-shadow(0 0 10px rgba(255,99,71,0.5))',
      }}>
        <div style={{
          position: 'absolute', top: 20, left: -20, width: 40, height: 10,
          background: '#ffd700', borderRadius: 3,
        }} />
      </div>
    );
  });

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <BackgroundGlow color="#ff6347" opacity={0.2} />
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 160, height: 160, borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 40%, #ffcc02, #e65100)',
        boxShadow: '0 0 50px rgba(255,99,71,0.4)',
        opacity: interpolate(frame, [0, 20], [1, 0.3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }} />
      {slices}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   CLAP – two hands clapping
   ============================================================ */
export function ClapAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  const clapCount = Math.floor(durationInFrames / 15);
  const claps = Array.from({ length: clapCount }).map((_, i) => {
    const clapFrame = i * 15;
    const clapProgress = interpolate(frame, [clapFrame, clapFrame + 4, clapFrame + 8], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return clapProgress;
  });
  const currentClap = claps.reduce((max, c, i) => (frame >= i * 15 ? c : max), 0);
  const clapScale = 1 + currentClap * 0.15;
  const sparkles = currentClap > 0.5 ? Array.from({ length: 8 }).map((_, i) => {
    const angle = (i / 8) * 360 + frame * 3;
    const dist = 80 + currentClap * 60;
    return { x: Math.cos((angle * Math.PI) / 180) * dist, y: Math.sin((angle * Math.PI) / 180) * dist };
  }) : [];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#ffeb3b" opacity={0.2} />
      <div style={{ position: 'relative', fontSize: 160, transform: `scale(${clapScale})`, filter: 'drop-shadow(0 0 30px rgba(255,235,59,0.5))' }}>
        &#128079;
      </div>
      {sparkles.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 8, height: 8, borderRadius: '50%', background: '#ffeb3b',
          transform: `translate(${s.x}px, ${s.y}px)`,
          boxShadow: '0 0 10px #ffeb3b', opacity: currentClap,
        }} />
      ))}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   TROLL FACE – troll face overlay
   ============================================================ */
export function TrollFaceAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scaleIn = interpolate(frame, [0, 20], [0.3, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) });
  const wiggle = Math.sin(frame * 0.5) * 3;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 15, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `rgba(0,0,0,${interpolate(frame, [0, 15], [0, 0.6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
      }} />
      <div style={{
        fontSize: 280, transform: `scale(${scaleIn}) rotate(${wiggle}deg)`,
        filter: 'drop-shadow(0 0 50px rgba(0,0,0,0.8))',
        position: 'relative', zIndex: 1,
      }}>
        &#129320;
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   POO – toilet appears, poop drops from air
   ============================================================ */
export function PooAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const toiletIn = interpolate(frame, [5, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.5)) });
  const pooDrop = interpolate(frame, [30, 55], [-300, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bounce });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#795548" opacity={0.15} />
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 180, transform: `scale(${toiletIn})`, filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.3))' }}>
          &#128701;
        </div>
        <div style={{
          position: 'absolute', left: '50%', top: '-20%', transform: `translateX(-50%) translateY(${pooDrop}px)`,
          fontSize: 120, filter: 'drop-shadow(0 5px 15px rgba(0,0,0,0.4))',
        }}>
          &#128169;
        </div>
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   CLOWN – clown rides past on a bike
   ============================================================ */
export function ClownAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const x = interpolate(frame, [0, durationInFrames], [-300, 1920 + 300], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bounce = Math.abs(Math.sin(frame * 0.3)) * 15;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <div style={{
        position: 'absolute', top: '50%', left: x,
        transform: `translateY(calc(-50% + ${-bounce}px))`,
        fontSize: 140, filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.4))',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: 100 }}>&#128690;</span>
        <span style={{ marginLeft: -30 }}>&#129313;</span>
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   SALT – salt shaker flips and shakes salt out
   ============================================================ */
export function SaltAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const flip = interpolate(frame, [10, 30], [0, 180], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const shaking = frame > 30 && frame < durationInFrames - 15 ? Math.sin(frame * 2) * 5 : 0;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  const saltGrains = frame > 30 ? Array.from({ length: 30 }).map((_, i) => {
    const delay = i * 2;
    const progress = interpolate(frame - 30 - delay, [0, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const x = (Math.random() - 0.5) * 100;
    const y = progress * 300 + Math.random() * 50;
    return { x, y, opacity: 1 - progress };
  }) : [];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#e0e0e0" opacity={0.15} />
      <div style={{
        fontSize: 140, transform: `rotate(${flip}deg) translateX(${shaking}px)`,
        filter: 'drop-shadow(0 0 30px rgba(0,0,0,0.3))',
        position: 'relative', zIndex: 1,
      }}>
        &#129386;
      </div>
      {saltGrains.map((g, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '40%',
          width: 4, height: 4, borderRadius: '50%', background: '#fff',
          transform: `translate(${g.x}px, ${g.y}px)`, opacity: g.opacity,
          boxShadow: '0 0 5px rgba(255,255,255,0.5)',
        }} />
      ))}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   TOILET PAPER – roll gets tossed at gifted user
   ============================================================ */
export function ToiletPaperAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const toss = interpolate(frame, [10, durationInFrames - 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const x = lerp(frame, [10, durationInFrames - 15], [-400, 200]);
  const y = lerp(frame, [10, durationInFrames - 15], [200, -50]);
  const rot = toss * 720;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <div style={{
        position: 'absolute', left: '20%', top: '30%',
        transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`,
        fontSize: 120, filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.3))',
      }}>
        &#129523;
      </div>
      {toss > 0.3 && Array.from({ length: 12 }).map((_, i) => {
        const trailX = x - i * 30;
        const trailY = y + i * 15 + Math.sin(i) * 20;
        return (
          <div key={i} style={{
            position: 'absolute', left: '20%', top: '30%',
            width: 40, height: 6, background: '#f5f5f5',
            transform: `translate(${trailX}px, ${trailY}px) rotate(${rot - i * 30}deg)`,
            opacity: 1 - i * 0.08, borderRadius: 3,
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
          }} />
        );
      })}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   PEACH – peach-themed animation
   ============================================================ */
export function PeachAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scaleIn = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) });
  const bounce = spring({ frame, fps: 60, config: { damping: 8, stiffness: 100 } });
  const rot = Math.sin(frame * 0.1) * 10;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 15, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#ffab91" opacity={0.3} />
      <div style={{
        fontSize: 220, transform: `scale(${scaleIn * bounce}) rotate(${rot}deg)`,
        filter: 'drop-shadow(0 0 50px rgba(255,171,145,0.6))',
      }}>
        &#127825;
      </div>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${10 + (i * 37) % 80}%`, top: `${15 + (i * 43) % 70}%`,
          fontSize: 20 + (i % 3) * 10, opacity: 0.3 + Math.sin(frame * 0.05 + i) * 0.2,
          transform: `translateY(${Math.sin(frame * 0.03 + i * 0.5) * 20}px)`,
        }}>
          &#127825;
        </div>
      ))}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   EGGPLANT – eggplant-themed animation
   ============================================================ */
export function EggplantAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scaleIn = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) });
  const wobble = Math.sin(frame * 0.15) * 8;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 15, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#7b1fa2" opacity={0.3} />
      <div style={{
        fontSize: 220, transform: `scale(${scaleIn}) rotate(${wobble}deg)`,
        filter: 'drop-shadow(0 0 50px rgba(123,31,162,0.6))',
      }}>
        &#127814;
      </div>
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${10 + (i * 41) % 80}%`, top: `${10 + (i * 47) % 80}%`,
          fontSize: 18 + (i % 4) * 8, opacity: 0.2 + Math.sin(frame * 0.04 + i * 0.7) * 0.15,
          transform: `translateY(${Math.cos(frame * 0.03 + i) * 15}px)`,
        }}>
          &#127814;
        </div>
      ))}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   KISS – lips stamp onto user's box
   ============================================================ */
export function KissAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const stampIn = interpolate(frame, [10, 18], [3, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(3)) });
  const squash = interpolate(frame, [18, 25], [0.8, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 15, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#ff1493" opacity={0.2} />
      {frame > 18 && (
        <div style={{
          position: 'absolute', inset: '25%', border: '4px solid #ff1493', borderRadius: 15,
          opacity: interpolate(frame, [18, 35], [0.8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          transform: `scale(${interpolate(frame, [18, 35], [1, 1.3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
        }} />
      )}
      <div style={{
        fontSize: 200, transform: `scale(${stampIn * squash})`,
        filter: 'drop-shadow(0 0 40px rgba(255,20,147,0.6))',
      }}>
        &#128139;
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   HEART – heart beats/pulses
   ============================================================ */
export function HeartAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const beat = 1 + Math.sin(frame * 0.25) * 0.15 + Math.sin(frame * 0.5) * 0.08;
  const glow = interpolate(Math.sin(frame * 0.2), [-1, 1], [30, 60]);
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#ff1744" opacity={0.25} />
      <div style={{
        fontSize: 200, transform: `scale(${beat})`,
        filter: `drop-shadow(0 0 ${glow}px rgba(255,23,68,0.6))`,
      }}>
        &#10084;&#65039;
      </div>
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * 360 + frame * 2;
        const dist = 120 + Math.sin(frame * 0.1 + i) * 30;
        return (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 20, height: 20,
            transform: `translate(${Math.cos((angle * Math.PI) / 180) * dist}px, ${Math.sin((angle * Math.PI) / 180) * dist}px)`,
            background: '#ff1744', borderRadius: '50% 50% 50% 0', transform2: `rotate(-45deg)`,
            opacity: 0.4, boxShadow: '0 0 15px rgba(255,23,68,0.5)',
          }} />
        );
      })}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   WARNING – caution sign illuminates/flashes
   ============================================================ */
export function WarningAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const flash = Math.abs(Math.sin(frame * 0.3));
  const scaleIn = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `rgba(255,152,0,${flash * 0.15})`,
      }} />
      <div style={{
        fontSize: 200, transform: `scale(${scaleIn})`,
        filter: `drop-shadow(0 0 ${30 + flash * 40}px rgba(255,152,0,${0.5 + flash * 0.5}))`,
        opacity: 0.5 + flash * 0.5,
      }}>
        &#9888;&#65039;
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   RIP – short graveyard-themed animation
   ============================================================ */
export function RIPAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const rise = interpolate(frame, [10, 35], [100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 15, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
        background: 'linear-gradient(0deg, #1b5e20, #2e7d32, transparent)',
      }} />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: '25%', left: `${15 + i * 18}%`,
          width: 8, height: 40 + i * 15, background: '#5d4037',
          borderRadius: 2, opacity: 0.6,
        }} />
      ))}
      <div style={{
        position: 'relative', zIndex: 1, textAlign: 'center',
        transform: `translateY(${rise}px)`,
      }}>
        <div style={{
          fontSize: 150, filter: 'drop-shadow(0 0 30px rgba(158,158,158,0.5))',
        }}>
          &#128128;
        </div>
        <div style={{
          fontSize: 48, color: '#9e9e9e', fontFamily: 'serif', marginTop: 10,
          textShadow: '0 0 20px rgba(158,158,158,0.5)',
        }}>
          R.I.P.
        </div>
      </div>
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${5 + (i * 7) % 90}%`, top: `${5 + (i * 13) % 40}%`,
          width: 3, height: 3, borderRadius: '50%', background: '#fff',
          opacity: 0.3 + Math.sin(frame * 0.05 + i) * 0.3,
        }} />
      ))}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   LOVE LETTER – B&W envelope opens with kiss lips
   ============================================================ */
export function LoveLetterAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const open = interpolate(frame, [15, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const lipIn = interpolate(frame, [35, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op, filter: 'grayscale(1)' }}>
      <div style={{
        width: 300, height: 200, background: '#f5f5f5', borderRadius: 10,
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)', position: 'relative',
        transform: `perspective(500px) rotateX(${(1 - open) * 30}deg)`,
        transformOrigin: 'top center',
      }}>
        <div style={{
          position: 'absolute', top: -2, left: -2, right: -2, height: '50%',
          background: '#e0e0e0', borderRadius: '10px 10px 0 0',
          transformOrigin: 'top center',
          transform: `rotateX(${(1 - open) * 150}deg)`,
          zIndex: 2, borderBottom: '2px solid #bbb',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          fontSize: 80 * lipIn, opacity: lipIn, zIndex: 1,
        }}>
          &#128139;
        </div>
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}
