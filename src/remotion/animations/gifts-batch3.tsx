import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { fadeIn, fadeOut, lerp, BackgroundGlow, GiftLabel } from './utils';

/* ============================================================
   DIAMOND – spinning crystal diamond with premium shine
   ============================================================ */
export function DiamondAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const rot = frame * 2;
  const scaleIn = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(0,229,255,0.15), #000 70%)' }} />
      <div style={{
        fontSize: 220, transform: `scale(${scaleIn}) rotateY(${rot}deg)`,
        filter: `drop-shadow(0 0 60px rgba(0,229,255,0.7)) drop-shadow(0 0 120px rgba(224,64,251,0.3))`,
      }}>
        &#128142;
      </div>
      {Array.from({ length: 25 }).map((_, i) => {
        const angle = (i / 25) * 360 + frame * 1.5;
        const dist = 150 + Math.sin(frame * 0.08 + i) * 30;
        const sparkle = Math.sin(frame * 0.12 + i * 2) > 0.5;
        return sparkle ? (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 5, height: 5, borderRadius: '50%',
            background: i % 3 === 0 ? '#e040fb' : '#00e5ff',
            transform: `translate(${Math.cos((angle * Math.PI) / 180) * dist}px, ${Math.sin((angle * Math.PI) / 180) * dist}px)`,
            boxShadow: `0 0 10px ${i % 3 === 0 ? '#e040fb' : '#00e5ff'}`,
          }} />
        ) : null;
      })}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   CASH STACK – stacks of money pile up
   ============================================================ */
export function CashStackAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  const stacks = Array.from({ length: 8 }).map((_, i) => {
    const delay = i * 8;
    const dropIn = interpolate(frame - delay, [0, 15], [-200, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.bounce) });
    return { delay, dropIn, x: (i - 3.5) * 55 };
  });

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#4caf50" opacity={0.2} />
      <div style={{ position: 'relative', width: 500, height: 300 }}>
        {stacks.map((s, i) => (
          <div key={i} style={{
            position: 'absolute', left: '50%', bottom: 50,
            transform: `translateX(calc(-50% + ${s.x}px)) translateY(${frame > s.delay ? s.dropIn : -200}px)`,
            opacity: frame > s.delay ? 1 : 0,
          }}>
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} style={{
                width: 100, height: 30, background: 'linear-gradient(135deg, #4caf50, #2e7d32)',
                borderRadius: 4, marginTop: j === 0 ? 0 : -25, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                border: '1px solid #1b5e20', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#1b5e20', fontSize: 14, fontWeight: 'bold',
              }}>
                $
              </div>
            ))}
          </div>
        ))}
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   ROCKET – realistic rocket launches with smoke
   ============================================================ */
export function RocketAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const launch = interpolate(frame, [20, durationInFrames - 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });
  const shake = frame > 15 && frame < 30 ? (Math.random() - 0.5) * 5 : 0;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #0d47a1 0%, #1a237e 50%, #000 100%)' }} />
      {Array.from({ length: 100 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${(i * 37) % 100}%`, top: `${(i * 43) % 60}%`,
          width: 2, height: 2, borderRadius: '50%', background: '#fff',
          opacity: 0.3 + Math.sin(frame * 0.05 + i) * 0.3,
        }} />
      ))}
      <div style={{
        position: 'absolute', left: '50%', bottom: `${10 + launch * 90}%`,
        transform: `translateX(-50%) translateX(${shake}px)`,
        fontSize: 120, filter: 'drop-shadow(0 0 40px rgba(255,109,0,0.6))',
      }}>
        &#128640;
      </div>
      {launch < 0.8 && Array.from({ length: 15 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', bottom: `${5 + launch * 80}%`,
          width: 20 + Math.random() * 30, height: 20 + Math.random() * 40,
          borderRadius: '50%', transform: `translateX(${(Math.random() - 0.5) * 80}px)`,
          background: i < 5 ? '#ff4500' : i < 10 ? '#ff6d00' : '#ffab00',
          opacity: 0.5 + Math.random() * 0.3, filter: 'blur(5px)',
        }} />
      ))}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   GOLD BAR – gold bar reveal effect
   ============================================================ */
export function GoldBarAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const reveal = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.5)) });
  const shine = Math.sin(frame * 0.12);
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#ffd700" opacity={0.3} />
      <div style={{
        width: 200 * reveal, height: 100 * reveal,
        background: 'linear-gradient(135deg, #ffd700 0%, #ffb300 30%, #ffd700 50%, #ff8f00 70%, #ffd700 100%)',
        borderRadius: 10, boxShadow: `0 0 ${50 + shine * 30}px rgba(255,215,0,0.6), inset 0 2px 10px rgba(255,255,255,0.3)`,
        transform: `perspective(400px) rotateX(${15 - shine * 5}deg) rotateY(${shine * 10}deg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 40 * reveal, fontWeight: 'bold', color: '#b8860b',
        textShadow: '0 1px 2px rgba(255,255,255,0.3)',
      }}>
        Au 999.9
      </div>
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${20 + (i * 37) % 60}%`, top: `${25 + (i * 41) % 50}%`,
          width: 4, height: 4, borderRadius: '50%', background: '#fff',
          opacity: Math.sin(frame * 0.1 + i * 1.3) > 0.6 ? 0.8 : 0,
          boxShadow: '0 0 8px #ffd700',
        }} />
      ))}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   ROLEX – luxury watch glistens, hands rotate quickly
   ============================================================ */
export function RolexAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scaleIn = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <BackgroundGlow color="#ffd700" opacity={0.2} />
      <div style={{ position: 'relative', transform: `scale(${scaleIn})` }}>
        <div style={{
          width: 200, height: 200, borderRadius: '50%',
          background: 'linear-gradient(135deg, #c0c0c0 0%, #ffd700 25%, #c0c0c0 50%, #ffd700 75%, #c0c0c0 100%)',
          boxShadow: `0 0 60px rgba(255,215,0,0.5), 0 0 120px rgba(255,215,0,0.2)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 180, height: 180, borderRadius: '50%', background: '#1a1a2e',
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * 360 - 90;
              const x = Math.cos((angle * Math.PI) / 180) * 75;
              const y = Math.sin((angle * Math.PI) / 180) * 75;
              return (
                <div key={i} style={{
                  position: 'absolute', left: '50%', top: '50%',
                  width: 3, height: 10, background: '#ffd700',
                  transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${angle + 90}deg)`,
                }} />
              );
            })}
            <div style={{
              position: 'absolute', width: 3, height: 50, background: '#ffd700',
              transform: `rotate(${frame * 6}deg)`, transformOrigin: 'bottom center',
              bottom: '50%', left: 'calc(50% - 1.5px)',
            }} />
            <div style={{
              position: 'absolute', width: 2, height: 35, background: '#fff',
              transform: `rotate(${frame * 0.5}deg)`, transformOrigin: 'bottom center',
              bottom: '50%', left: 'calc(50% - 1px)',
            }} />
            <div style={{
              position: 'absolute', width: 8, height: 8, borderRadius: '50%',
              background: '#ffd700', boxShadow: '0 0 10px #ffd700',
            }} />
          </div>
        </div>
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   SPORTS CAR – luxury car drives L to R with rev sound
   ============================================================ */
export function SportsCarAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const x = interpolate(frame, [0, durationInFrames], [-500, 1920 + 500], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bounce = Math.abs(Math.sin(frame * 0.5)) * 3;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, #263238 0%, #37474f 100%)',
      }} />
      <div style={{
        position: 'absolute', bottom: '25%', left: 0, right: 0, height: 4,
        background: 'rgba(255,255,255,0.2)',
      }} />
      <div style={{
        position: 'absolute', bottom: '28%', left: x,
        transform: `translateY(${-bounce}px)`, fontSize: 120,
        filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))',
      }}>
        &#127950;
      </div>
      {Array.from({ length: 10 }).map((_, i) => {
        const trailX = x - i * 80;
        return (
          <div key={i} style={{
            position: 'absolute', bottom: '30%', left: trailX,
            width: 40, height: 4, background: `rgba(255,109,0,${0.5 - i * 0.05})`,
            borderRadius: 2, filter: 'blur(2px)',
          }} />
        );
      })}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   YACHT – ocean scene with yacht moving L to R
   ============================================================ */
export function YachtAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const x = interpolate(frame, [0, durationInFrames], [-400, 1920 + 400], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bob = Math.sin(frame * 0.1) * 10;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #87ceeb 0%, #4fc3f7 50%, #0288d1 51%, #01579b 100%)' }} />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', top: `${52 + i * 3}%`, left: 0, right: 0, height: 3,
          background: `rgba(255,255,255,${0.1 - i * 0.015})`,
          transform: `translateX(${Math.sin(frame * 0.03 + i) * 30}px)`,
        }} />
      ))}
      <div style={{
        position: 'absolute', top: '50%', left: x,
        transform: `translateY(calc(-50% + ${bob}px))`, fontSize: 100,
        filter: 'drop-shadow(0 5px 20px rgba(0,0,0,0.3))',
      }}>
        &#128674;
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   PRIVATE JET – jet takes off with realistic sound
   ============================================================ */
export function PrivateJetAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const taxiPhase = interpolate(frame, [0, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const takeoff = interpolate(frame, [30, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const x = interpolate(frame, [0, durationInFrames], [-400, 1920 + 400], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = takeoff < 0.5 ? 0 : (takeoff - 0.5) * 2 * -400;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #1565c0 0%, #42a5f5 60%, #90caf9 100%)' }} />
      <div style={{
        position: 'absolute', bottom: '30%', left: 0, right: 0, height: 8,
        background: '#616161', boxShadow: '0 -5px 15px rgba(0,0,0,0.3)',
      }} />
      <div style={{
        position: 'absolute', bottom: `calc(30% + ${y}px)`, left: x,
        fontSize: 100, transform: `rotate(${-takeoff * 15}deg)`,
        filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.4))',
      }}>
        &#9992;
      </div>
      {takeoff > 0.1 && Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: '32%', left: x - i * 40,
          width: 30 + i * 10, height: 10, borderRadius: '50%',
          background: `rgba(200,200,200,${0.4 - i * 0.05})`, filter: 'blur(3px)',
        }} />
      ))}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   MANSION – ultra-realistic mansion with opening doors/windows
   ============================================================ */
export function MansionAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scaleIn = interpolate(frame, [0, 30], [0.5, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));
  const windowOpen = interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #1a237e 0%, #283593 50%, #1b5e20 51%, #2e7d32 100%)' }} />
      <div style={{ position: 'relative', transform: `scale(${scaleIn})` }}>
        <div style={{
          width: 350, height: 200, background: 'linear-gradient(180deg, #f5f0e8, #e8dcc8)',
          borderRadius: 5, boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0, borderLeft: '180px solid transparent', borderRight: '180px solid transparent',
            borderBottom: '60px solid #795548',
          }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute', top: 40, left: `${10 + i * 16}%`,
              width: 35, height: 50, background: windowOpen > 0.5 ? '#ffeb3b' : '#37474f',
              borderRadius: '15px 15px 0 0', border: '2px solid #8d6e63',
              boxShadow: windowOpen > 0.5 ? '0 0 15px rgba(255,235,59,0.5)' : 'none',
              transform: `perspective(200px) rotateY(${windowOpen * 30}deg)`,
              transformOrigin: 'left center',
            }} />
          ))}
          <div style={{
            position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: 50, height: 80, background: '#5d4037', borderRadius: '25px 25px 0 0',
            border: '3px solid #3e2723',
            transform2: `perspective(200px) rotateY(${windowOpen * 45}deg)`,
          }} />
        </div>
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   DRAGON – fierce dragon flies across scene
   ============================================================ */
export function DragonAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const x = interpolate(frame, [0, durationInFrames], [-500, 1920 + 500], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = Math.sin(frame * 0.08) * 100;
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }} />
      <div style={{
        position: 'absolute', left: x, top: `calc(30% + ${y}px)`,
        fontSize: 160, transform: 'scaleX(-1)',
        filter: 'drop-shadow(0 0 40px rgba(255,0,0,0.5)) drop-shadow(0 0 80px rgba(255,109,0,0.3))',
      }}>
        &#128009;
      </div>
      {Array.from({ length: 20 }).map((_, i) => {
        const fx = x - i * 40;
        const fy = y + Math.sin(frame * 0.08 + i * 0.3) * 80 + 30;
        return (
          <div key={i} style={{
            position: 'absolute', left: fx, top: `calc(30% + ${fy}px)`,
            width: 15 + i * 3, height: 15 + i * 3, borderRadius: '50%',
            background: i < 5 ? '#ff4500' : i < 10 ? '#ff6d00' : '#ffab00',
            opacity: 0.5 - i * 0.02, filter: 'blur(3px)',
          }} />
        );
      })}
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}

/* ============================================================
   PLANET – Earth rotating in high detail
   ============================================================ */
export function PlanetAnimation({ name, emoji, cost }: { name: string; emoji: string; cost: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const rot = frame * 0.8;
  const scaleIn = interpolate(frame, [0, 25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.2)) });
  const op = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, durationInFrames - 12, durationInFrames));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <div style={{ position: 'absolute', inset: 0, background: '#000' }} />
      {Array.from({ length: 200 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${(i * 37) % 100}%`, top: `${(i * 43) % 100}%`,
          width: i % 10 === 0 ? 3 : 1, height: i % 10 === 0 ? 3 : 1,
          borderRadius: '50%', background: '#fff',
          opacity: 0.2 + Math.sin(frame * 0.02 + i) * 0.3,
        }} />
      ))}
      <div style={{
        width: 300 * scaleIn, height: 300 * scaleIn, borderRadius: '50%',
        background: `linear-gradient(${rot}deg, #1565c0 0%, #4caf50 20%, #2196f3 30%, #4caf50 50%, #1565c0 60%, #4caf50 80%, #2196f3 100%)`,
        boxShadow: '0 0 80px rgba(33,150,243,0.4), inset -30px -10px 60px rgba(0,0,0,0.4)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: `linear-gradient(${rot + 90}deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)`,
        }} />
      </div>
      <GiftLabel name={name} emoji={emoji} cost={cost} />
    </div>
  );
}
