
import React, { useEffect, useRef, useState, useCallback } from 'react';
import './GoldenBuzzerGodMode.css';

// --- PROPS INTERFACE ---
interface GoldenBuzzerGodModeProps {
  trigger: boolean;
  judgeName?: string;
  onComplete: () => void; // Callback to reset the trigger
}

// --- HELPER FUNCTIONS ---

// Safely play audio, handling autoplay restrictions
const playSound = (src: string, volume: number = 1.0) => {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(err => console.warn(`Audio autoplay blocked for ${src}:`, err));
  } catch (error) {
    console.error(`Failed to play sound ${src}:`, error);
  }
};

// Safely trigger device vibration
const triggerVibration = (pattern: number | number[]) => {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      console.warn('Vibration failed:', error);
    }
  }
};

// --- PARTICLE & CANVAS LOGIC ---

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
  lifespan: number;
  type: 'spark' | 'ember' | 'streak' | 'confetti' | 'coin';
  rotation: number;
  spin: number;
  flutter: number;
}

const PARTICLE_COUNT = 300;
const coinImage = new Image();
coinImage.src = '/images/troll-coin.png'; // Placeholder for your coin image

// --- REACT COMPONENT ---

export const GoldenBuzzerGodMode: React.FC<GoldenBuzzerGodModeProps> = ({ trigger, judgeName, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [showShockwave, setShowShockwave] = useState(false);
  const [showRays, setShowRays] = useState(false);
  const [showFlare, setShowFlare] = useState(false);
  const [shake, setShake] = useState(false);
  const [blur, setBlur] = useState(false);

  const particles = useRef<Particle[]>([]);

  const resetState = useCallback(() => {
    setIsAnimating(false);
    setShowCelebration(false);
    setShowFlash(false);
    setShowShockwave(false);
    setShowRays(false);
    setShowFlare(false);
    setShake(false);
    setBlur(false);
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    particles.current = [];
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    onComplete();
  }, [onComplete]);

  const createExplosion = (canvas: HTMLCanvasElement) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 15 + 5; // Energetic speed
      const type: Particle['type'] = i % 10 === 0 ? 'streak' : i % 5 === 0 ? 'ember' : 'spark';

      let color = '#FFD700';
      if (type === 'ember') color = '#FFAA00';
      if (type === 'streak') color = '#FFFFFF';

      particles.current.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: type === 'streak' ? Math.random() * 2 + 1 : Math.random() * 4 + 2,
        color,
        opacity: 1,
        lifespan: 100, // Frames
        type,
        rotation: 0,
        spin: 0,
        flutter: 0,
      });
    }
  };

  const createCelebrationParticles = (canvas: HTMLCanvasElement) => {
    for (let i = 0; i < 100; i++) {
      // Confetti
      particles.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height, // Start above screen
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 3 + 2,
        size: Math.random() * 8 + 5,
        color: ['#FFD700', '#FFC300', '#FFAA00', '#FFFFFF'][Math.floor(Math.random() * 4)],
        opacity: 1,
        lifespan: 300,
        type: 'confetti',
        rotation: Math.random() * 360,
        spin: (Math.random() - 0.5) * 10,
        flutter: Math.random() * 0.5 + 0.5,
      });

      // Coins
      if (i % 2 === 0) {
        particles.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * -canvas.height,
          vx: (Math.random() - 0.5) * 1,
          vy: Math.random() * 4 + 4, // Coins fall faster
          size: Math.random() * 20 + 20,
          color: '',
          opacity: 1,
          lifespan: 300,
          type: 'coin',
          rotation: Math.random() * 360,
          spin: (Math.random() - 0.5) * 15,
          flutter: 0,
        });
      }
    }
  };

  const drawParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.current.forEach((p, index) => {
      p.x += p.vx;
      p.y += p.vy;
      p.opacity = p.lifespan / 100;
      p.lifespan -= 1;

      if (p.type === 'confetti' || p.type === 'coin') {
        p.vy += 0.1; // Gravity
        p.vx *= 0.99;
        p.rotation += p.spin;
        p.x += Math.sin(p.y * p.flutter * 0.1) * 0.5;
      }

      if (p.lifespan <= 0) {
        particles.current.splice(index, 1);
        return;
      }

      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.translate(-p.x, -p.y);

      switch (p.type) {
        case 'spark':
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'ember':
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'streak':
          ctx.lineWidth = p.size;
          ctx.strokeStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 5, p.y - p.vy * 5);
          ctx.stroke();
          break;
        case 'confetti':
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 0.6);
          break;
        case 'coin':
          if (coinImage.complete) {
            const scale = Math.abs(Math.cos(p.rotation * 0.1)); // Fake 3D spin
            ctx.drawImage(coinImage, p.x - p.size / 2, p.y - p.size / 2, p.size * scale, p.size);
          }
          break;
      }
      ctx.restore();
    });

    if (particles.current.length > 0) {
      animationFrameId.current = requestAnimationFrame(drawParticles);
    } else {
      // When all particles are gone, start the final fade out
      setTimeout(() => {
        const mainOverlay = document.querySelector('.god-mode-overlay');
        mainOverlay?.classList.add('cleanup');
        setTimeout(resetState, 2000); // Wait for fade out to finish
      }, 1000); // Extra delay before cleanup
    }
  }, []);

  useEffect(() => {
    if (trigger && !isAnimating) {
      setIsAnimating(true);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      // --- STAGE 1: IMPACT ---
      playSound('/sounds/bass-hit.mp3', 0.8);
      triggerVibration([200, 50, 100]);
      setShake(true);
      setShowFlash(true);
      setTimeout(() => setShake(false), 500);
      setTimeout(() => setShowFlash(false), 800);

      // --- STAGE 2: EXPLOSION ---
      setTimeout(() => {
        if (canvas) createExplosion(canvas);
        animationFrameId.current = requestAnimationFrame(drawParticles);
        setShowShockwave(true);
        setShowRays(true);
        setShowFlare(true);
        setBlur(true); // Bonus: background blur
      }, 200);
      setTimeout(() => setShowShockwave(false), 1200);
      setTimeout(() => setShowRays(false), 3200);
      setTimeout(() => setShowFlare(false), 3200);
      setTimeout(() => setBlur(false), 3200);

      // --- STAGE 3: CELEBRATION ---
      setTimeout(() => {
        playSound('/sounds/crowd-cheer.mp3', 0.5);
        setShowCelebration(true);
        if (canvas) createCelebrationParticles(canvas);
      }, 1000);

      // --- STAGE 4: RESOLUTION (Handled by particle loop completion) ---
    }
  }, [trigger, isAnimating, drawParticles, resetState]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  if (!isAnimating) return null;

  return (
    <div className={`god-mode-overlay active ${shake ? 'screen-shake' : ''} ${blur ? 'blur-background' : ''}`}>
      {showFlash && <div className="screen-flash"></div>}
      
      <canvas ref={canvasRef} />

      {showShockwave && <div className="shockwave"></div>}
      {showRays && (
        <div className="light-rays-container">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="light-ray" style={{ transform: `rotate(${i * 45}deg)` }}></div>
          ))}
        </div>
      )}
      {showFlare && <div className="lens-flare"></div>}

      {showCelebration && (
        <>
          <div className="winner-spotlight"></div>
          <div className="celebration-text-container">
            <div className="judge-name-text">{judgeName || 'A Judge'}</div>
            <div className="golden-buzzer-text">Golden Buzzer!</div>
          </div>
        </>
      )}
    </div>
  );
};
