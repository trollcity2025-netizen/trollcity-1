/**
 * Easter Theme Preview
 *
 * Preview of the Easter holiday theme for Troll City.
 * Access: /dev/easter-theme-preview
 *
 * Full Easter aesthetic: pastel pink, blue, purple, green backgrounds,
 * spring motifs, egg hunt, gift shop, broadcast abilities.
 */

import React, { useState, useCallback } from 'react'

// ── EASTER THEME TOKENS ─────────────────────────────────────────────────
const EASTER = {
  // Pastel palette
  pink: '#FFB6C1',
  pinkDeep: '#FF69B4',
  blue: '#87CEEB',
  blueLight: '#B0E0E6',
  purple: '#DDA0DD',
  purpleLight: '#E6E6FA',
  green: '#98FB98',
  greenLight: '#BDFCC9',
  yellow: '#FFFACD',
  peach: '#FFDAB9',
  white: '#FFFAF0',

  // Gradients
  bgGradient: 'linear-gradient(135deg, #fce4ec 0%, #e8eaf6 25%, #e0f7fa 50%, #f3e5f5 75%, #fff8e1 100%)',
  cardBg: 'rgba(255, 255, 255, 0.65)',
  cardBorder: 'rgba(255, 182, 193, 0.4)',
  bannerGradient: 'linear-gradient(135deg, #FFB6C1 0%, #DDA0DD 50%, #87CEEB 100%)',
  buttonGradient: 'linear-gradient(135deg, #FF69B4 0%, #DDA0DD 50%, #87CEEB 100%)',
  buttonSecondary: 'linear-gradient(135deg, #98FB98 0%, #B0E0E6 100%)',
  glowPink: '0 0 20px rgba(255, 105, 180, 0.3)',
  glowPurple: '0 0 20px rgba(221, 160, 221, 0.3)',
  glowBlue: '0 0 20px rgba(135, 206, 235, 0.3)',
}

const giftPacks = [
  { id: 'easter_egg', name: 'Golden Egg', coinPrice: 500, emoji: '🥚', animation: 'glow', category: 'exclusive', description: 'A rare golden Easter egg!' },
  { id: 'easter_bunny', name: 'Easter Bunny', coinPrice: 200, emoji: '🐰', animation: 'bounce', category: 'limited', description: 'Cute bunny companion animation' },
]

const bonuses = [
  { type: 'xp_multiplier', value: 1.25, description: '1.25x XP for Easter activity!', affectedActions: ['stream', 'chat'] },
]

// ── FLOATING PARTICLES ──────────────────────────────────────────────────
const EASTER_EMOJIS = ['🥚', '🐰', '🐣', '🌸', '🌼', '🌷', '🦋', '🌿', '🪺', '💐', '🎀', '🍬']

interface Particle {
  id: number
  emoji: string
  left: number
  delay: number
  duration: number
  size: number
}

function EasterParticles() {
  const [particles] = useState<Particle[]>(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i,
      emoji: EASTER_EMOJIS[i % EASTER_EMOJIS.length],
      left: Math.random() * 100,
      delay: Math.random() * 15,
      duration: 12 + Math.random() * 12,
      size: 16 + Math.random() * 18,
    }))
  )

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute select-none"
          style={{
            left: `${p.left}%`,
            top: '-5%',
            fontSize: `${p.size}px`,
            opacity: 0.35,
            animation: `float-particle ${p.duration}s linear ${p.delay}s infinite`,
          }}
        >
          {p.emoji}
        </span>
      ))}
      <style>{`
        @keyframes float-particle {
          0% { transform: translateY(-5vh) rotate(0deg) scale(0.8); opacity: 0; }
          10% { opacity: 0.35; }
          50% { transform: translateY(50vh) rotate(180deg) scale(1); }
          90% { opacity: 0.35; }
          100% { transform: translateY(105vh) rotate(360deg) scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── EASTER EGG HUNT (preview click mechanic) ────────────────────────────
interface EasterEggData {
  id: number
  x: number
  y: number
  color: string
  found: boolean
  reward: string
}

const EGG_COLORS = ['#FFB6C1', '#87CEEB', '#DDA0DD', '#98FB98', '#FFDAB9', '#E6E6FA', '#B0E0E6', '#FFFACD', '#FF69B4', '#BDFCC9']

const EGG_REWARDS = [
  { label: '+5 Troll Coins' },
  { label: '+10 Troll Coins' },
  { label: '+25 Troll Coins' },
  { label: '+50 Trollmonds' },
  { label: 'Kick Insurance 24h' },
  { label: 'Free Box Price' },
  { label: 'Mute Hammer' },
  { label: 'Truth Serum' },
  { label: 'Fake System Alert' },
  { label: 'Gold Frame Broadcast' },
  { label: 'Coin Drop Event' },
  { label: 'VIP Chat Only' },
  { label: 'Raid Another Stream' },
  { label: 'Citywide Broadcast' },
  { label: 'Troll Foot' },
  { label: 'Team Freeze' },
  { label: 'Reverse' },
  { label: 'Double XP' },
]

function generateEggs(count: number): EasterEggData[] {
  return Array.from({ length: count }, (_, i) => {
    const reward = EGG_REWARDS[Math.floor(Math.random() * EGG_REWARDS.length)]
    return {
      id: i,
      x: 5 + Math.random() * 85,
      y: 5 + Math.random() * 85,
      color: EGG_COLORS[i % EGG_COLORS.length],
      found: false,
      reward: reward.label,
    }
  })
}

// Colored egg SVG
function EggIcon({ color, size = 32 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 32 42" fill="none">
      <ellipse cx="16" cy="24" rx="14" ry="17" fill={color} stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
      <ellipse cx="16" cy="24" rx="14" ry="17" fill="url(#egg-shine)" />
      <path d="M6 18 Q16 12 26 18" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" />
      <path d="M7 26 Q16 32 25 26" stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none" />
      <circle cx="11" cy="20" r="2" fill="rgba(255,255,255,0.35)" />
      <circle cx="20" cy="28" r="1.5" fill="rgba(255,255,255,0.3)" />
      <circle cx="15" cy="32" r="1" fill="rgba(255,255,255,0.25)" />
      <defs>
        <radialGradient id="egg-shine" cx="0.35" cy="0.3" r="0.6">
          <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
    </svg>
  )
}

function EasterEggHunt() {
  const [eggs, setEggs] = useState<EasterEggData[]>(() => generateEggs(10))
  const [foundCount, setFoundCount] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  const handleEggClick = useCallback((eggId: number) => {
    setEggs((prev) =>
      prev.map((egg) => {
        if (egg.id === eggId && !egg.found) {
          setFoundCount((c) => c + 1)
          setToast(`Found: ${egg.reward}`)
          setTimeout(() => setToast(null), 2500)
          return { ...egg, found: true }
        }
        return egg
      })
    )
  }, [])

  const resetEggs = () => {
    setEggs(generateEggs(10))
    setFoundCount(0)
    setToast(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: '#9C27B0' }}>
          Easter Egg Hunt Preview
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(255,105,180,0.15)', color: '#FF69B4' }}>
            {foundCount}/10 found
          </span>
          <button
            onClick={resetEggs}
            className="px-3 py-1 rounded-lg text-xs font-semibold text-white transition-all hover:scale-105"
            style={{ background: EASTER.buttonGradient }}
          >
            Reset Eggs
          </button>
        </div>
      </div>

      <div className="relative w-full h-[500px] rounded-3xl overflow-hidden" style={{ background: EASTER.bgGradient, border: '2px solid rgba(255,182,193,0.3)', boxShadow: EASTER.glowPink }}>
        {/* Grass at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-16" style={{ background: 'linear-gradient(to top, #90EE90 0%, #BDFCC9 60%, transparent 100%)' }} />

        {/* Decorative flowers */}
        {['🌸', '🌼', '🌷', '🌻', '💐'].map((f, i) => (
          <span key={i} className="absolute text-2xl select-none" style={{
            bottom: `${2 + Math.random() * 8}%`,
            left: `${10 + i * 18}%`,
            opacity: 0.6,
            transform: `rotate(${-15 + Math.random() * 30}deg)`,
          }}>{f}</span>
        ))}

        {/* Butterfly decorations */}
        <span className="absolute text-xl select-none" style={{ top: '10%', left: '15%', opacity: 0.4, animation: 'float-particle 8s ease-in-out infinite' }}>🦋</span>
        <span className="absolute text-xl select-none" style={{ top: '20%', right: '20%', opacity: 0.4, animation: 'float-particle 10s ease-in-out 2s infinite' }}>🦋</span>

        {/* Easter eggs */}
        {eggs.map((egg) => (
          <button
            key={egg.id}
            onClick={() => handleEggClick(egg.id)}
            className={`absolute transition-all duration-500 cursor-pointer select-none
              ${egg.found ? 'scale-150 opacity-0 pointer-events-none' : 'hover:scale-125'}`}
            style={{
              left: `${egg.x}%`,
              top: `${egg.y}%`,
              transform: 'translate(-50%, -50%)',
              animation: egg.found ? undefined : 'egg-bounce 2.5s ease-in-out infinite',
              animationDelay: `${egg.id * 0.3}s`,
              filter: egg.found ? 'none' : `drop-shadow(0 0 8px ${egg.color})`,
            }}
            disabled={egg.found}
          >
            {egg.found ? (
              <span className="text-2xl">✨</span>
            ) : (
              <EggIcon color={egg.color} size={26} />
            )}
          </button>
        ))}

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl text-white font-bold text-sm animate-bounce" style={{ background: EASTER.buttonGradient, boxShadow: EASTER.glowPink }}>
            You found: {toast}
          </div>
        )}

        {/* Found overlay */}
        {foundCount === 10 && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(255,240,245,0.85)', backdropFilter: 'blur(8px)' }}>
            <div className="text-center">
              <div className="text-6xl mb-4">🏆</div>
              <h4 className="text-2xl font-bold mb-2" style={{ color: '#FF69B4' }}>All Eggs Found!</h4>
              <p className="text-sm mb-4" style={{ color: '#9C27B0' }}>Max 10 eggs per user (May 5-7)</p>
              <button
                onClick={resetEggs}
                className="px-8 py-3 rounded-2xl font-bold text-white text-sm hover:scale-105 transition-transform"
                style={{ background: EASTER.buttonGradient, boxShadow: EASTER.glowPink }}
              >
                Hunt Again
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes egg-bounce {
          0%, 100% { transform: translate(-50%, -50%) translateY(0) rotate(-3deg); }
          25% { transform: translate(-50%, -50%) translateY(-5px) rotate(2deg); }
          50% { transform: translate(-50%, -50%) translateY(0) rotate(3deg); }
          75% { transform: translate(-50%, -50%) translateY(-3px) rotate(-2deg); }
        }
      `}</style>
    </div>
  )
}

// ── COLOR SWATCH ─────────────────────────────────────────────────────────
function ColorSwatch({ label, color, textColor }: { label: string; color: string; textColor?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ backgroundColor: color, border: '2px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
      <div>
        <p className="text-sm font-semibold" style={{ color: textColor || '#4A4A4A' }}>{label}</p>
        <p className="text-xs font-mono" style={{ color: '#888' }}>{color}</p>
      </div>
    </div>
  )
}

// ── EASTER CARD WRAPPER ──────────────────────────────────────────────────
function EasterCard({ children, glow, className = '' }: { children: React.ReactNode; glow?: string; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-4 ${className}`}
      style={{
        background: EASTER.cardBg,
        border: `1.5px solid ${EASTER.cardBorder}`,
        backdropFilter: 'blur(12px)',
        boxShadow: glow || '0 4px 20px rgba(221,160,221,0.12)',
      }}
    >
      {children}
    </div>
  )
}

// ── MAIN PREVIEW ────────────────────────────────────────────────────────
export default function EasterThemePreview() {
  const [activeSection, setActiveSection] = useState<'full' | 'colors' | 'hunt' | 'rewards'>('full')

  return (
    <div className="min-h-screen" style={{ background: EASTER.bgGradient, color: '#4A4A4A' }}>
      <EasterParticles />

      <div className="relative z-30 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold mb-2 flex items-center justify-center gap-3">
            <span className="text-4xl">🥚</span>
            <span style={{ background: 'linear-gradient(135deg, #FF69B4 0%, #9C27B0 30%, #2196F3 60%, #4CAF50 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Easter Theme Preview
            </span>
            <span className="text-4xl">🐰</span>
          </h1>
          <p className="text-sm" style={{ color: '#9C27B0' }}>
            Pastel pink, blue, purple &amp; green · May 5-7 Egg Hunt
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-2 mb-8 justify-center flex-wrap">
          {([
            { key: 'full', label: 'Home Page Mock' },
            { key: 'colors', label: 'Theme Colors' },
            { key: 'hunt', label: 'Egg Hunt' },
            { key: 'rewards', label: 'Rewards' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className="px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all hover:scale-105"
              style={
                activeSection === tab.key
                  ? { background: EASTER.buttonGradient, color: '#fff', boxShadow: EASTER.glowPink }
                  : { background: 'rgba(255,255,255,0.5)', color: '#777', border: '1px solid rgba(255,182,193,0.3)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── FULL HOME PAGE MOCK ────────────────────────────────────── */}
        {activeSection === 'full' && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold mb-1" style={{ color: '#FF69B4' }}>Home Page with Easter Theme</h2>
              <p className="text-sm" style={{ color: '#999' }}>Pastel spring background replaces the dark Troll City theme</p>
            </div>

            <div className="rounded-3xl overflow-hidden" style={{ border: '2px solid rgba(255,182,193,0.35)', boxShadow: '0 8px 40px rgba(255,105,180,0.15)' }}>
              {/* Mock Homepage */}
              <div className="relative min-h-[700px]" style={{ background: EASTER.bgGradient }}>
                {/* Easter radial overlays */}
                <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 120% at 20% 20%, rgba(255,182,193,0.25), transparent)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(140% 140% at 80% 10%, rgba(135,206,235,0.2), transparent)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(140% 140% at 50% 80%, rgba(221,160,221,0.18), transparent)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(100% 100% at 90% 60%, rgba(152,251,152,0.15), transparent)' }} />

                {/* Content */}
                <div className="relative z-10 p-4 md:p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg" style={{ background: EASTER.buttonGradient, boxShadow: EASTER.glowPink }}>
                        🏰
                      </div>
                      <span className="text-lg font-extrabold" style={{ background: 'linear-gradient(135deg, #FF69B4, #9C27B0, #2196F3)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        TrollCity
                      </span>
                    </div>
                    <div className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(255,105,180,0.15)', color: '#FF69B4', border: '1px solid rgba(255,105,180,0.25)' }}>
                      Easter Event Active
                    </div>
                  </div>

                  {/* Easter Event Banner */}
                  <EasterCard className="mb-4" glow={EASTER.glowPink}>
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">🐰</div>
                      <div className="flex-1">
                        <h3 className="font-bold text-sm" style={{ color: '#FF69B4' }}>Easter Egg Hunt is Live!</h3>
                        <p className="text-xs" style={{ color: '#888' }}>Find hidden eggs across all pages · Max 10 per user · May 5-7</p>
                      </div>
                      <div className="px-4 py-2 rounded-xl text-white text-xs font-bold hover:scale-105 transition-transform cursor-pointer" style={{ background: EASTER.buttonGradient, boxShadow: EASTER.glowPink }}>
                        Find Eggs
                      </div>
                    </div>
                    {/* Progress */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs" style={{ color: '#999' }}>Eggs Found</span>
                        <span className="text-xs font-bold" style={{ color: '#FF69B4' }}>3/10</span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,182,193,0.2)' }}>
                        <div className="h-full rounded-full" style={{ width: '30%', background: EASTER.buttonGradient }} />
                      </div>
                    </div>
                  </EasterCard>

                  {/* Tabs */}
                  <EasterCard className="mb-4">
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1.5 rounded-xl font-semibold text-xs text-white" style={{ background: EASTER.buttonGradient }}>
                        Troll Feed
                      </button>
                      <button className="px-3 py-1.5 rounded-xl font-semibold text-xs" style={{ background: 'rgba(255,182,193,0.15)', color: '#999' }}>
                        Live Now
                      </button>
                      <button className="px-3 py-1.5 rounded-xl font-semibold text-xs" style={{ background: 'rgba(135,206,235,0.15)', color: '#999' }}>
                        Troll Pods
                      </button>
                    </div>
                  </EasterCard>

                  {/* Mock Feed */}
                  <div className="space-y-3">
                    {/* Feed item 1 + hidden egg */}
                    <div className="relative">
                      <EasterCard>
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="w-8 h-8 rounded-full" style={{ background: 'linear-gradient(135deg, #FFB6C1, #FF69B4)' }} />
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#4A4A4A' }}>TrollMaster99</p>
                            <p className="text-[10px]" style={{ color: '#aaa' }}>2 minutes ago</p>
                          </div>
                        </div>
                        <p className="text-xs" style={{ color: '#666' }}>Just found a pastel egg near the pods tab! This Easter event is gorgeous 🥚✨</p>
                      </EasterCard>
                      <button className="absolute -top-2 -right-2 hover:scale-125 transition-transform cursor-pointer" style={{ animation: 'egg-bounce 2.5s ease-in-out infinite', filter: 'drop-shadow(0 0 6px rgba(255,105,180,0.4))' }} title="Hidden Easter Egg!">
                        <EggIcon color="#FFB6C1" size={20} />
                      </button>
                    </div>

                    {/* Feed item 2 */}
                    <EasterCard>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-8 h-8 rounded-full" style={{ background: 'linear-gradient(135deg, #87CEEB, #42A5F5)' }} />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#4A4A4A' }}>StreamQueen</p>
                          <p className="text-[10px]" style={{ color: '#aaa' }}>5 minutes ago</p>
                        </div>
                      </div>
                      <p className="text-xs" style={{ color: '#666' }}>The Easter Bunny animation is so cute! Got it from the gift shop 🐰</p>
                    </EasterCard>

                    {/* Feed item 3 + hidden egg */}
                    <div className="relative">
                      <EasterCard>
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="w-8 h-8 rounded-full" style={{ background: 'linear-gradient(135deg, #DDA0DD, #9C27B0)' }} />
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#4A4A4A' }}>NeonTroll</p>
                            <p className="text-[10px]" style={{ color: '#aaa' }}>8 minutes ago</p>
                          </div>
                        </div>
                        <p className="text-xs" style={{ color: '#666' }}>1.25x XP from Easter bonuses is hitting different 🔥</p>
                      </EasterCard>
                      <button className="absolute -bottom-2 left-4 hover:scale-125 transition-transform cursor-pointer" style={{ animation: 'egg-bounce 3s ease-in-out 0.5s infinite', filter: 'drop-shadow(0 0 4px rgba(135,206,235,0.5))' }} title="Hidden Easter Egg!">
                        <EggIcon color="#87CEEB" size={18} />
                      </button>
                    </div>

                    {/* Easter Gift Shop card */}
                    <EasterCard glow={EASTER.glowPurple}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold" style={{ color: '#9C27B0' }}>Easter Gift Shop</span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(152,251,152,0.2)', color: '#4CAF50' }}>Limited Time</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {giftPacks.map((gift) => (
                          <div key={gift.id} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,182,193,0.2)' }}>
                            <div className="text-2xl mb-1">{gift.emoji}</div>
                            <p className="text-xs font-semibold" style={{ color: '#4A4A4A' }}>{gift.name}</p>
                            <p className="text-[10px] font-bold mt-1" style={{ color: '#FF69B4' }}>10 coins</p>
                          </div>
                        ))}
                      </div>
                    </EasterCard>
                  </div>

                  {/* Sidebar mock (desktop) */}
                  <div className="hidden lg:grid grid-cols-3 gap-3 mt-4">
                    <EasterCard>
                      <h4 className="text-xs font-bold mb-2" style={{ color: '#4A4A4A' }}>Quick Access</h4>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 p-2 rounded-xl" style={{ background: 'rgba(244,67,54,0.08)' }}>
                          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#F44336' }} />
                          <span className="text-[10px] font-medium" style={{ color: '#4A4A4A' }}>Live Streams</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-xl" style={{ background: 'rgba(33,150,243,0.08)' }}>
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#2196F3' }} />
                          <span className="text-[10px] font-medium" style={{ color: '#4A4A4A' }}>Podcast Rooms</span>
                        </div>
                      </div>
                    </EasterCard>

                    <EasterCard glow={EASTER.glowPink}>
                      <h4 className="text-xs font-bold mb-2" style={{ color: '#FF69B4' }}>Easter Stats</h4>
                      <div className="space-y-2 text-[10px]">
                        <div className="flex justify-between"><span style={{ color: '#999' }}>Eggs Found Today</span><span className="font-bold" style={{ color: '#4A4A4A' }}>1,247</span></div>
                        <div className="flex justify-between"><span style={{ color: '#999' }}>Active Hunters</span><span className="font-bold" style={{ color: '#4A4A4A' }}>342</span></div>
                        <div className="flex justify-between"><span style={{ color: '#999' }}>Abilities Won</span><span className="font-bold" style={{ color: '#4A4A4A' }}>89</span></div>
                      </div>
                    </EasterCard>

                    <EasterCard glow={EASTER.glowBlue}>
                      <h4 className="text-xs font-bold mb-2" style={{ color: '#2196F3' }}>Active Bonuses</h4>
                      <div className="space-y-1.5">
                        <div className="p-2 rounded-xl" style={{ background: 'rgba(152,251,152,0.15)' }}>
                          <p className="text-[10px] font-semibold" style={{ color: '#4A4A4A' }}>1.25x XP</p>
                          <p className="text-[9px]" style={{ color: '#999' }}>Stream & Chat</p>
                        </div>
                        <div className="p-2 rounded-xl" style={{ background: 'rgba(221,160,221,0.15)' }}>
                          <p className="text-[10px] font-semibold" style={{ color: '#4A4A4A' }}>🛡️ Kick Insurance</p>
                          <p className="text-[9px]" style={{ color: '#999' }}>From egg finds</p>
                        </div>
                      </div>
                    </EasterCard>
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <EasterCard glow={EASTER.glowPink}>
                <h4 className="font-bold text-sm mb-2" style={{ color: '#FF69B4' }}>Theme Design</h4>
                <p className="text-xs" style={{ color: '#888' }}>
                  Full pastel Easter aesthetic: soft pink, blue, purple &amp; green backgrounds.
                  Replaces the dark Troll City theme with a spring holiday feel.
                </p>
              </EasterCard>
              <EasterCard glow={EASTER.glowBlue}>
                <h4 className="font-bold text-sm mb-2" style={{ color: '#2196F3' }}>Hidden Eggs</h4>
                <p className="text-xs" style={{ color: '#888' }}>
                  Pastel-colored SVG eggs hidden across all pages. Users click to collect.
                  Max 10 per user during May 5-7.
                </p>
              </EasterCard>
              <EasterCard glow={EASTER.glowPurple}>
                <h4 className="font-bold text-sm mb-2" style={{ color: '#9C27B0' }}>Rewards</h4>
                <p className="text-xs" style={{ color: '#888' }}>
                  Troll coins, trollmonds, kick insurance (24h), free box price,
                  and all 12 broadcast abilities as random drops.
                </p>
              </EasterCard>
            </div>
          </div>
        )}

        {/* ── THEME COLORS ────────────────────────────────────────────── */}
        {activeSection === 'colors' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Easter Palette */}
              <EasterCard glow={EASTER.glowPink}>
                <h3 className="text-lg font-bold mb-4" style={{ color: '#FF69B4' }}>Easter Pastel Palette</h3>
                <div className="space-y-3">
                  <ColorSwatch label="Pink" color="#FFB6C1" textColor="#4A4A4A" />
                  <ColorSwatch label="Pink Deep" color="#FF69B4" textColor="#4A4A4A" />
                  <ColorSwatch label="Blue Sky" color="#87CEEB" textColor="#4A4A4A" />
                  <ColorSwatch label="Blue Light" color="#B0E0E6" textColor="#4A4A4A" />
                  <ColorSwatch label="Lavender" color="#DDA0DD" textColor="#4A4A4A" />
                  <ColorSwatch label="Lavender Light" color="#E6E6FA" textColor="#4A4A4A" />
                  <ColorSwatch label="Green Spring" color="#98FB98" textColor="#4A4A4A" />
                  <ColorSwatch label="Green Light" color="#BDFCC9" textColor="#4A4A4A" />
                  <ColorSwatch label="Yellow Cream" color="#FFFACD" textColor="#4A4A4A" />
                  <ColorSwatch label="Peach" color="#FFDAB9" textColor="#4A4A4A" />
                </div>
              </EasterCard>

              {/* Troll City Colors */}
              <EasterCard>
                <h3 className="text-lg font-bold mb-4" style={{ color: '#9C27B0' }}>Troll City Base (for comparison)</h3>
                <div className="space-y-3">
                  <ColorSwatch label="Purple Neon" color="#9333ea" textColor="#4A4A4A" />
                  <ColorSwatch label="Pink Neon" color="#ec4899" textColor="#4A4A4A" />
                  <ColorSwatch label="Cyan Neon" color="#06b6d4" textColor="#4A4A4A" />
                  <ColorSwatch label="Dark BG" color="#020617" textColor="#4A4A4A" />
                  <ColorSwatch label="Card BG" color="#0f172a" textColor="#4A4A4A" />
                </div>
                <p className="mt-4 text-xs p-3 rounded-xl" style={{ background: 'rgba(156,39,176,0.08)', color: '#888' }}>
                  Easter completely replaces these dark/neon colors with a light pastel spring aesthetic.
                </p>
              </EasterCard>
            </div>

            {/* Side by side */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-center" style={{ color: '#4A4A4A' }}>Side-by-Side</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Troll City */}
                <div className="rounded-2xl overflow-hidden" style={{ border: '2px solid rgba(147,51,234,0.3)' }}>
                  <div className="p-3 text-center" style={{ background: 'rgba(147,51,234,0.1)' }}>
                    <span className="text-sm font-bold" style={{ color: '#9333ea' }}>Default Troll City</span>
                  </div>
                  <div className="relative h-48">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 120% at 20% 20%, rgba(147,51,234,0.18), transparent)' }} />
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(140% 140% at 80% 0%, rgba(45,212,191,0.14), transparent)' }} />
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(140% 140% at 90% 90%, rgba(236,72,153,0.12), transparent)' }} />
                    <div className="relative z-10 flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="text-3xl mb-2">🏙️</div>
                        <p className="text-white font-bold text-sm">Dark + Neon Purple/Pink/Cyan</p>
                        <p className="text-slate-400 text-xs">Cyberpunk vibes</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Easter */}
                <div className="rounded-2xl overflow-hidden" style={{ border: '2px solid rgba(255,105,180,0.3)' }}>
                  <div className="p-3 text-center" style={{ background: 'rgba(255,105,180,0.1)' }}>
                    <span className="text-sm font-bold" style={{ color: '#FF69B4' }}>Easter Theme</span>
                  </div>
                  <div className="relative h-48" style={{ background: EASTER.bgGradient }}>
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 120% at 20% 20%, rgba(255,182,193,0.3), transparent)' }} />
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(140% 140% at 80% 10%, rgba(135,206,235,0.25), transparent)' }} />
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(140% 140% at 50% 80%, rgba(221,160,221,0.2), transparent)' }} />
                    <div className="relative z-10 flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="text-3xl mb-2">🥚</div>
                        <p className="font-bold text-sm" style={{ color: '#FF69B4' }}>Light + Pastel Pink/Blue/Purple/Green</p>
                        <p style={{ color: '#888' }} className="text-xs">Spring holiday vibes</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Button Previews */}
            <EasterCard>
              <h3 className="text-lg font-bold mb-4" style={{ color: '#4A4A4A' }}>Button & Badge Styles</h3>
              <div className="flex flex-wrap gap-3">
                <button className="px-6 py-2.5 rounded-2xl font-bold text-white text-sm hover:scale-105 transition-transform" style={{ background: EASTER.buttonGradient, boxShadow: EASTER.glowPink }}>
                  Easter Primary
                </button>
                <button className="px-6 py-2.5 rounded-2xl font-bold text-sm hover:scale-105 transition-transform" style={{ background: EASTER.buttonSecondary, color: '#4A4A4A', boxShadow: EASTER.glowBlue }}>
                  Easter Secondary
                </button>
                <button className="px-6 py-2.5 rounded-2xl font-bold text-white text-sm hover:scale-105 transition-transform" style={{ background: 'linear-gradient(135deg, #9333ea, #ec4899, #06b6d4)' }}>
                  Troll City Primary
                </button>
                <span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(255,105,180,0.15)', color: '#FF69B4', border: '1px solid rgba(255,105,180,0.25)' }}>
                  Easter Badge
                </span>
                <span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(135,206,235,0.15)', color: '#2196F3', border: '1px solid rgba(135,206,235,0.25)' }}>
                  Blue Badge
                </span>
                <span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(221,160,221,0.15)', color: '#9C27B0', border: '1px solid rgba(221,160,221,0.25)' }}>
                  Purple Badge
                </span>
                <span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(152,251,152,0.15)', color: '#4CAF50', border: '1px solid rgba(152,251,152,0.25)' }}>
                  Green Badge
                </span>
              </div>
            </EasterCard>
          </div>
        )}

        {/* ── EGG HUNT ────────────────────────────────────────────────── */}
        {activeSection === 'hunt' && (
          <div className="space-y-6">
            <EasterEggHunt />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EasterCard glow={EASTER.glowPink}>
                <h4 className="font-bold text-sm mb-3" style={{ color: '#FF69B4' }}>Hunt Rules</h4>
                <ul className="text-xs space-y-2" style={{ color: '#666' }}>
                  <li className="flex items-start gap-2"><span>🥚</span> Max <strong style={{ color: '#4A4A4A' }}>10 eggs per user</strong> throughout the event</li>
                  <li className="flex items-start gap-2"><span>📅</span> Active dates: <strong style={{ color: '#4A4A4A' }}>May 5 – May 7</strong></li>
                  <li className="flex items-start gap-2"><span>🌐</span> Eggs spawn randomly on <strong style={{ color: '#4A4A4A' }}>all pages</strong></li>
                  <li className="flex items-start gap-2"><span>👥</span> Available to <strong style={{ color: '#4A4A4A' }}>all roles</strong></li>
                  <li className="flex items-start gap-2"><span>👆</span> Click an egg to <strong style={{ color: '#4A4A4A' }}>instantly collect</strong></li>
                  <li className="flex items-start gap-2"><span>⚡</span> Rewards are <strong style={{ color: '#4A4A4A' }}>credited immediately</strong></li>
                </ul>
              </EasterCard>
              <EasterCard glow={EASTER.glowBlue}>
                <h4 className="font-bold text-sm mb-3" style={{ color: '#2196F3' }}>User Incentives</h4>
                <ul className="text-xs space-y-2" style={{ color: '#666' }}>
                  <li className="flex items-start gap-2"><span>🎁</span> Users who gift more <strong style={{ color: '#4A4A4A' }}>trollmonds</strong> get more eggs</li>
                  <li className="flex items-start gap-2"><span>🪙</span> Giving up to <strong style={{ color: '#4A4A4A' }}>10 troll coins</strong> qualifies</li>
                  <li className="flex items-start gap-2"><span>💰</span> Every egg find <strong style={{ color: '#4A4A4A' }}>credits balances</strong> correctly</li>
                  <li className="flex items-start gap-2"><span>🛡️</span> Kick insurance <strong style={{ color: '#4A4A4A' }}>24h protection</strong></li>
                  <li className="flex items-start gap-2"><span>📦</span> <strong style={{ color: '#4A4A4A' }}>Free box price</strong> discount on seats</li>
                  <li className="flex items-start gap-2"><span>🎮</span> Random <strong style={{ color: '#4A4A4A' }}>broadcast abilities</strong></li>
                </ul>
              </EasterCard>
            </div>
          </div>
        )}

        {/* ── REWARDS ────────────────────────────────────────────────── */}
        {activeSection === 'rewards' && (
          <div className="space-y-6">
            {/* Gift Packs */}
            <div>
              <h3 className="text-lg font-bold mb-4" style={{ color: '#FF69B4' }}>Easter Gift Shop</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {giftPacks.map((gift) => (
                  <EasterCard key={gift.id} glow={EASTER.glowPurple}>
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{gift.emoji}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold" style={{ color: '#4A4A4A' }}>{gift.name}</h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{
                            background: gift.category === 'exclusive' ? 'rgba(255,105,180,0.15)' : 'rgba(152,251,152,0.15)',
                            color: gift.category === 'exclusive' ? '#FF69B4' : '#4CAF50',
                          }}>{gift.category}</span>
                        </div>
                        <p className="text-sm mb-2" style={{ color: '#888' }}>{gift.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg" style={{ color: '#FF69B4' }}>10 coins</span>
                          <span className="text-xs line-through" style={{ color: '#bbb' }}>{gift.coinPrice} coins</span>
                        </div>
                      </div>
                    </div>
                  </EasterCard>
                ))}
              </div>
            </div>

            {/* Bonuses */}
            <div>
              <h3 className="text-lg font-bold mb-4" style={{ color: '#4CAF50' }}>Active Bonuses</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {bonuses.map((bonus, i) => (
                  <EasterCard key={i} glow={EASTER.glowBlue}>
                    <h4 className="font-bold mb-1" style={{ color: '#4A4A4A' }}>{bonus.description}</h4>
                    <p className="text-sm" style={{ color: '#888' }}>Affects: {bonus.affectedActions.join(', ')}</p>
                    <p className="text-2xl font-bold mt-2" style={{ color: '#4CAF50' }}>{bonus.value}x</p>
                  </EasterCard>
                ))}
                <EasterCard glow={EASTER.glowPink}>
                  <h4 className="font-bold mb-1" style={{ color: '#4A4A4A' }}>🛡️ Kick Insurance (24h)</h4>
                  <p className="text-sm" style={{ color: '#888' }}>Earned from finding Easter eggs</p>
                  <p className="text-sm mt-2 font-medium" style={{ color: '#FF69B4' }}>Protects against being kicked from streams</p>
                </EasterCard>
                <EasterCard glow={EASTER.glowBlue}>
                  <h4 className="font-bold mb-1" style={{ color: '#4A4A4A' }}>📦 Free Box Price</h4>
                  <p className="text-sm" style={{ color: '#888' }}>Earned from finding Easter eggs</p>
                  <p className="text-sm mt-2 font-medium" style={{ color: '#2196F3' }}>Free seat in any paid broadcast box</p>
                </EasterCard>
              </div>
            </div>

            {/* Broadcast Abilities */}
            <div>
              <h3 className="text-lg font-bold mb-4" style={{ color: '#9C27B0' }}>Random Broadcast Abilities</h3>
              <p className="text-sm mb-4" style={{ color: '#888' }}>Each Easter egg has a chance to contain a random broadcast ability:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { icon: '🔨', name: 'Mute Hammer', rarity: 'Rare' },
                  { icon: '🧪', name: 'Truth Serum', rarity: 'Epic' },
                  { icon: '🚨', name: 'Fake System Alert', rarity: 'Rare' },
                  { icon: '🖼️', name: 'Gold Frame Broadcast', rarity: 'Rare' },
                  { icon: '🪙', name: 'Coin Drop Event', rarity: 'Epic' },
                  { icon: '🔒', name: 'VIP Chat Only', rarity: 'Epic' },
                  { icon: '⚔️', name: 'Raid Another Stream', rarity: 'Epic' },
                  { icon: '🏙️', name: 'Citywide Broadcast', rarity: 'Legendary' },
                  { icon: '🦶', name: 'Troll Foot', rarity: 'Epic' },
                  { icon: '❄️', name: 'Team Freeze', rarity: 'Rare' },
                  { icon: '🔄', name: 'Reverse', rarity: 'Rare' },
                  { icon: '💰', name: 'Double XP', rarity: 'Epic' },
                ].map((ability) => (
                  <EasterCard key={ability.name}>
                    <div className="text-center">
                      <div className="text-2xl mb-1">{ability.icon}</div>
                      <p className="text-xs font-semibold" style={{ color: '#4A4A4A' }}>{ability.name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                        background: ability.rarity === 'Legendary' ? 'rgba(255,215,0,0.15)' : ability.rarity === 'Epic' ? 'rgba(221,160,221,0.15)' : 'rgba(135,206,235,0.15)',
                        color: ability.rarity === 'Legendary' ? '#FF8F00' : ability.rarity === 'Epic' ? '#9C27B0' : '#2196F3',
                      }}>
                        {ability.rarity}
                      </span>
                    </div>
                  </EasterCard>
                ))}
              </div>
            </div>

            {/* Price Update */}
            <EasterCard glow={EASTER.glowPink}>
              <h4 className="font-bold text-sm mb-2" style={{ color: '#FF69B4' }}>Price Update</h4>
              <p className="text-xs" style={{ color: '#888' }}>
                Gift pack prices updated from 500/200 coins to <strong style={{ color: '#4A4A4A' }}>10 coins</strong> each.
                Easter event dates changed from April 5-19 to <strong style={{ color: '#4A4A4A' }}>May 5-7</strong>.
              </p>
            </EasterCard>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-xs" style={{ color: '#bbb' }}>
          Easter Theme Preview · Dev Only · /dev/easter-theme-preview
        </div>
      </div>
    </div>
  )
}
