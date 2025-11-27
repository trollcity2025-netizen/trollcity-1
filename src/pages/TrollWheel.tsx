import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Sparkles, Coins, Shield, Zap, Crown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { UserProfile as BaseUserProfile } from '../lib/supabase'
type WheelUserProfile = BaseUserProfile & { badge?: string }
import { recordAppEvent } from '../lib/progressionEngine'
import { useAuthStore, refreshSession } from '../lib/store'
import { toast } from 'sonner'

// Sounds — put real audio files in /public/sounds (optional)
let laughSound: HTMLAudioElement | null = null
let jackpotSound: HTMLAudioElement | null = null
let spinSound: HTMLAudioElement | null = null
let clickSound: HTMLAudioElement | null = null

// Initialize sounds safely
try {
  laughSound = new Audio('/sounds/evil_laugh.mp3')
  jackpotSound = new Audio('/sounds/jackpot_reverb.mp3')
  spinSound = new Audio('/sounds/metal_spin.mp3')
  clickSound = new Audio('/sounds/click.mp3')
} catch (e) {
  console.log('Audio files not available, continuing without sound')
}

const SPIN_COST = 500
const DEFAULT_DAILY_SPINS = 10

interface WheelPrize {
  id: string
  name: string
  type: 'coins' | 'insurance' | 'multiplier' | 'vip' | 'jackpot' | 'nothing'
  value: number
  probability: number
  icon: JSX.Element | string
  color: string
  glow: string
  description: string
}

const WHEEL_PRIZES: WheelPrize[] = [
  {
    id: '1',
    name: '750 Coins',
    type: 'coins',
    value: 750,
    probability: 28,
    icon: <Coins />,
    color: '#064e3b',
    glow: '#22c55e',
    description: '750 FREE coins'
  },
  {
    id: '2',
    name: 'Nothing',
    type: 'nothing',
    value: 0,
    probability: 23,
    icon: '💀',
    color: '#111827',
    glow: '#6b7280',
    description: 'Trolled hard. You won nothing.'
  },
  {
    id: '3',
    name: 'Insurance',
    type: 'insurance',
    value: 1,
    probability: 10,
    icon: <Shield />,
    color: '#1d4ed8',
    glow: '#60a5fa',
    description: 'Kick / penalty protection'
  },
  {
    id: '4',
    name: '200 Coins',
    type: 'coins',
    value: 200,
    probability: 14,
    icon: <Coins />,
    color: '#065f46',
    glow: '#22c55e',
    description: '200 FREE coins'
  },
  {
    id: '5',
    name: '2x Multiplier',
    type: 'multiplier',
    value: 2,
    probability: 9,
    icon: <Zap />,
    color: '#b45309',
    glow: '#facc15',
    description: '2x rewards for 30 minutes'
  },
  {
    id: '6',
    name: 'BANKRUPT (Free Coins)',
    type: 'vip', // keep type but treat as bankrupt in logic
    value: 0,
    probability: 5,
    icon: '💸',
    color: '#7f1d1d',
    glow: '#f97316',
    description: 'Lose ALL free coins (paid coins safe)'
  },
  {
    id: '7',
    name: '5000 Coins',
    type: 'coins',
    value: 5000,
    probability: 7,
    icon: <Coins />,
    color: '#15803d',
    glow: '#4ade80',
    description: 'BIG WIN: 5000 FREE coins'
  },
  {
    id: '8',
    name: '1,000,000 Coins',
    type: 'coins',
    value: 1_000_000,
    probability: 2, // ~1 in 50
    icon: '🤑',
    color: '#22c55e',
    glow: '#bbf7d0',
    description: 'MEGA WIN: 1,000,000 FREE coins!'
  },
  {
    id: '9',
    name: 'Troll Crown (Jackpot)',
    type: 'jackpot',
    value: 1,
    probability: 2,
    icon: <Crown />,
    color: '#7e22ce',
    glow: '#e879f9',
    description: 'Ultra rare crown badge'
  }
]

const TrollWheel = () => {
  const { profile, session } = useAuthStore()
  const [isSpinning, setIsSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [selectedPrize, setSelectedPrize] = useState<WheelPrize | null>(null)
  const [dailySpinsLeft, setDailySpinsLeft] = useState(DEFAULT_DAILY_SPINS)
  const [showResult, setShowResult] = useState(false)
  const wheelRef = useRef<HTMLDivElement>(null)
  const clickIntervalRef = useRef<number | null>(null)

  // Debug rotation changes
  useEffect(() => {
    console.log('[Wheel] Rotation changed:', rotation, 'isSpinning:', isSpinning)
  }, [rotation, isSpinning])

  const checkDailySpins = useCallback(async () => {
    if (!profile?.id) return
    try {
      // Refresh session to ensure valid token
      const freshSession = await refreshSession()
      const token = freshSession?.access_token || session?.access_token || ''
      
      if (!token) {
        console.error('[Wheel] No access token available')
        const fallback = profile?.role === 'troll_officer' ? 15 : DEFAULT_DAILY_SPINS
        setDailySpinsLeft(fallback)
        return
      }
      
      console.log('[Wheel] Checking daily spins with token:', token.substring(0, 20) + '...')
      
      const resp = await fetch('/api/wheel/spins/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: profile.id })
      })
      
      const j = await resp.json().catch(() => ({}))
      
      if (!resp.ok) {
        console.error('[Wheel] Status check failed:', resp.status, j)
        if (resp.status === 401) {
          toast.error('Session expired. Please refresh the page.')
        }
        const fallback = profile?.role === 'troll_officer' ? 15 : DEFAULT_DAILY_SPINS
        setDailySpinsLeft(fallback)
        return
      }
      
      if (!j.success) {
        console.log('[Wheel] Status check unsuccessful:', j)
        const fallback = profile?.role === 'troll_officer' ? 15 : DEFAULT_DAILY_SPINS
        setDailySpinsLeft(fallback)
        return
      }
      
      const fallback = profile?.role === 'troll_officer' ? 15 : DEFAULT_DAILY_SPINS
      setDailySpinsLeft(Number(j.spins_left || fallback))
      console.log('[Wheel] Daily spins remaining:', j.spins_left)
    } catch (err) {
      console.error('[Wheel] Status check error:', err)
      const fallback = profile?.role === 'troll_officer' ? 15 : DEFAULT_DAILY_SPINS
      setDailySpinsLeft(fallback)
    }
  }, [profile?.id, profile?.role, session?.access_token])

  useEffect(() => {
    if (profile?.id) {
      checkDailySpins()
    }
  }, [profile?.id, checkDailySpins])

  const registerSpin = useCallback(async () => {
    if (!profile?.id) return
    try {
      // Refresh session to ensure valid token
      const freshSession = await refreshSession()
      const token = freshSession?.access_token || session?.access_token || ''
      
      if (!token) {
        console.error('[Wheel] No access token for registerSpin')
        return
      }
      
      const resp = await fetch('/api/wheel/spins/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: profile.id })
      })
      await resp.json().catch(() => ({}))
    } catch (e) {
      console.error('[Wheel] registerSpin error', e)
    }
  }, [profile?.id, session?.access_token])

  const sendBigWinBanner = async (prize: WheelPrize) => {
    if (!profile) return
    try {
      await supabase.from('live_banner_events').insert([
        {
          user_id: profile.id,
          username: profile.username,
          prize_name: prize.name,
          prize_value: prize.value,
          created_at: new Date().toISOString()
        }
      ])
    } catch (err) {
      console.error('live_banner_events insert error', err)
    }
  }

  const spinWheel = async () => {
    if (!profile) return
    if (isSpinning) return

    if (dailySpinsLeft <= 0) {
      toast.error('No more free spins today.')
      return
    }

    if ((profile.free_coin_balance || 0) < SPIN_COST) {
      toast.error('You need at least 500 FREE coins to spin.')
      return
    }

    // Refresh session to ensure valid token
    const freshSession = await refreshSession()
    const token = freshSession?.access_token || session?.access_token
    
    if (!token) {
      toast.error('Session expired. Please refresh the page and sign in again.')
      return
    }

    // Call API to get prize first
    let prize: WheelPrize | null = null
    let serverProfile: { free_coin_balance?: number; badge?: string } | null = null
    try {
      console.log('[Wheel] Initiating spin:', { userId: profile.id, balance: profile.free_coin_balance, cost: SPIN_COST })
      console.log('[Wheel] Using token:', token.substring(0, 20) + '...')
      
      const resp = await fetch('/api/wheel/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: profile.id, spinCost: SPIN_COST, prizes: WHEEL_PRIZES.map(p => ({ id: p.id, name: p.name, type: p.type === 'vip' ? 'bankrupt' : p.type, value: p.value, probability: p.probability })) })
      })
      
      console.log('[Wheel] API response status:', resp.status)
      
      let j: { success?: boolean; prize?: { id: string; name: string; type: WheelPrize['type'] | 'bankrupt'; value: number; probability: number }; profile?: { free_coin_balance?: number; badge?: string }; error?: string; details?: string } = { success: false }
      
      try {
        const jRaw = await resp.json()
        if (jRaw && typeof jRaw === 'object') {
          j = jRaw as typeof j
        }
      } catch (parseErr) {
        console.error('[Wheel] JSON parse error:', parseErr)
        const textResponse = await resp.text().catch(() => 'Unable to read response')
        console.error('[Wheel] Response text:', textResponse)
        toast.error('Server returned invalid response. Please try again.')
        return
      }
      
      console.log('[Wheel] API response:', j)
      
      if (!resp.ok || !j.success || !j.prize) {
        const errorMsg = j?.error || 'Spin failed'
        const errorDetails = j?.details || ''
        console.error('[Wheel] Spin failed:', errorMsg, errorDetails)
        
        // Special handling for auth errors
        if (resp.status === 401 || errorMsg.includes('token') || errorMsg.includes('Invalid token')) {
          toast.error('Session expired. Please refresh the page and sign in again.')
        } else {
          toast.error(`${errorMsg}${errorDetails ? ': ' + errorDetails : ''}`)
        }
        return
      }
      
      const jp = j.prize as { id: string; name: string; type: WheelPrize['type'] | 'bankrupt'; value: number; probability: number }
      prize = { id: jp.id, name: jp.name, type: (jp.type === 'bankrupt' ? 'vip' : jp.type), value: jp.value, probability: jp.probability, icon: '', color: '', glow: '', description: '' }
      serverProfile = j.profile
      
      console.log('[Wheel] Prize won:', prize)
      console.log('[Wheel] Updated profile:', serverProfile)
      
      const currentBadge = (profile as WheelUserProfile).badge || ''
      const updatedProfile: WheelUserProfile = { ...(profile as BaseUserProfile), free_coin_balance: Number(serverProfile?.free_coin_balance || profile.free_coin_balance), badge: String(serverProfile?.badge || currentBadge) }
      useAuthStore.getState().setProfile(updatedProfile)
    } catch (err) {
      console.error('[Wheel] Spin error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to spin'
      toast.error(errorMessage)
      return
    }

    // NOW start the visual spinning animation with the prize we got
    console.log('[Wheel] Starting visual animation for prize:', prize!.name)
    
    // Calculate the target rotation FIRST
    const idx = WHEEL_PRIZES.findIndex((p) => p.id === prize!.id)
    const segmentAngle = 360 / WHEEL_PRIZES.length
    const targetAngle = idx * segmentAngle + segmentAngle / 2
    const spins = 8 + Math.random() * 3
    const finalRotation = rotation + spins * 360 + (360 - targetAngle)

    console.log('[Wheel] Animation params:', { prizeIndex: idx, currentRotation: rotation, finalRotation, spins })
    
    // Set up the animation state WITHOUT triggering rotation yet
    setIsSpinning(true)
    setShowResult(false)
    setSelectedPrize(prize)
    
    // Play spin sound (if available)
    try {
      const playPromise = spinSound?.play()
      if (playPromise) {
        playPromise.catch(() => {
          // Autoplay policy prevented playback
        })
      }
    } catch (e) {
      // Sound not available
    }
    
    try { 
      if (clickSound) clickSound.currentTime = 0 
    } catch (e) { 
      // Sound not available
    }
    
    if (clickIntervalRef.current) {
      clearInterval(clickIntervalRef.current)
      clickIntervalRef.current = null
    }
    
    if (clickSound) {
      clickIntervalRef.current = window.setInterval(() => {
        try {
          if (clickSound) {
            clickSound.currentTime = 0
            const playPromise = clickSound.play()
            if (playPromise) {
              playPromise.catch(() => {
                // Autoplay policy prevented playback
              })
            }
          }
        } catch (e) { 
          // Silent fail for missing audio
        }
      }, 200)
    }

    // CRITICAL: Use setTimeout to ensure React renders isSpinning=true BEFORE we change rotation
    // This ensures the CSS transition class is applied to the element before the transform changes
    setTimeout(() => {
      setRotation(finalRotation)
    }, 100)

    setTimeout(async () => {
      if (clickIntervalRef.current) {
        clearInterval(clickIntervalRef.current)
        clickIntervalRef.current = null
      }
      
      // Play result sounds (if available)
      try {
        if (prize!.type === 'nothing') {
          const playPromise = laughSound?.play()
          playPromise?.catch(() => {})
        }
        if (prize!.type === 'jackpot' || prize!.value >= 5000 || prize!.value >= 1_000_000) {
          const playPromise = jackpotSound?.play()
          playPromise?.catch(() => {})
        }
      } catch (e) {
        // Sound not available
      }

      // Prize already applied server-side; show result only
      if (prize!.type === 'coins') {
        toast.success(`You won ${prize!.value.toLocaleString()} FREE coins!`)
      } else if (prize!.type === 'insurance') {
        toast.success('Kick / penalty insurance activated.')
      } else if (prize!.type === 'multiplier') {
        toast.success(`x${prize!.value} multiplier active for 30 minutes.`)
      } else if (prize!.type === 'vip') {
        toast.error('BANKRUPT! All FREE coins wiped. Paid coins are safe.')
        try { await recordAppEvent(profile!.id, 'WHEEL_BANKRUPT', {}) } catch (e) { console.error('recordAppEvent WHEEL_BANKRUPT error', e) }
      } else if (prize!.type === 'jackpot') {
        toast.success('JACKPOT! Troll Crown unlocked.')
        try { await recordAppEvent(profile!.id, 'HIGH_RISK_SPIN', {}) } catch (e) { console.error('recordAppEvent HIGH_RISK_SPIN error', e) }
      } else if (prize!.type === 'nothing') {
        toast('The trolls laugh at you. Try again.', { description: 'You won nothing this time.' })
      }

      // Big win? send banner event
      if (
        (prize!.type === 'coins' && prize!.value >= 5000) ||
        prize!.value >= 1_000_000 ||
        prize!.type === 'jackpot'
      ) {
        await sendBigWinBanner(prize!)
      }

      // Update spin counter (registerSpin is called by backend now)
      setDailySpinsLeft(prev => Math.max(0, prev - 1))
      
      // Refresh from server to sync
      setTimeout(() => checkDailySpins(), 1000)

      setIsSpinning(false)
      setShowResult(true)
    }, 4800)
  }

  // removed unused selectPrize

  // Prize messaging handled inline in spin handler

  const canSpin =
    !!profile &&
    !isSpinning &&
    dailySpinsLeft > 0 &&
    (profile.free_coin_balance || 0) >= SPIN_COST

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#05010b] text-white relative overflow-hidden">
      {/* Neon ambient background */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="w-full h-full bg-[radial-gradient(circle_at_top,_#7c3aed_0,_transparent_55%),_radial-gradient(circle_at_bottom,_#22c55e_0,_transparent_55%)] animate-pulse" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Balance banner */}
        {profile && (
          <div className="mb-3 flex items-center gap-3 px-4 py-2 rounded-xl border border-yellow-500/40 bg-black/40 shadow-[0_0_20px_rgba(250,204,21,0.25)]">
            <div className="flex items-center gap-2 text-sm">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span>Paid:</span>
              <span className="font-bold text-yellow-300">{Number(profile.paid_coin_balance || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Free:</span>
              <span className="font-bold text-emerald-300">{Number(profile.free_coin_balance || 0).toLocaleString()}</span>
            </div>
          </div>
        )}
        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#FFC93C] drop-shadow-[0_0_25px_#FFD700] mb-2 text-center">
          Troll Wheel of Chaos
        </h1>
        <p className="text-sm sm:text-base text-gray-300 mb-1">
          500 coins per spin • {dailySpinsLeft} spins left today
        </p>
        <p className="text-xs text-gray-400 mb-6">
          FREE coins are used; winnings add to your FREE coins.
        </p>

        {/* Pointer */}
        <div className="relative mb-4">
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20">
            <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-b-[36px] border-transparent border-b-red-600 drop-shadow-[0_0_18px_#f97373]" />
          </div>

          {/* Wheel */}
          <div
            ref={wheelRef}
            className="relative w-80 h-80 sm:w-96 sm:h-96 rounded-full border-[10px] border-[#facc15] shadow-[0_0_60px_#FACC15] overflow-hidden bg-[radial-gradient(circle_at_30%_20%,#fef3c7_0,#0b0b15_40%),radial-gradient(circle_at_70%_80%,#f97316_0,#020617_45%)] transition-transform duration-[4800ms] ease-[cubic-bezier(0.17,0.67,0.83,0.67)]"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {/* Inner metallic ring */}
            <div className="absolute inset-4 rounded-full border border-yellow-400/40 shadow-[inset_0_0_25px_rgba(0,0,0,0.9)]" />

            {/* Tick marks */}
            {Array.from({ length: 36 }).map((_, i) => (
              <div
                key={i}
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `rotate(${(i * 10)}deg) translate(0, -170px)`
                }}
              >
                <div className="w-1 h-3 bg-yellow-300 rounded-sm shadow-[0_0_6px_#facc15]" />
              </div>
            ))}

            {WHEEL_PRIZES.map((prize, i) => {
              const angle = 360 / WHEEL_PRIZES.length
              return (
                <div
                  key={prize.id}
                  style={{ transform: `rotate(${i * angle}deg)` }}
                  className="absolute inset-0 origin-center flex items-start justify-center"
                >
                  <div
                    className="w-40 h-40 flex flex-col items-center justify-center text-center text-[10px] sm:text-xs font-bold"
                    style={{
                      clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
                      transform: 'translateY(-8%)',
                      backgroundColor: prize.color,
                      boxShadow: `0 0 16px ${prize.glow}`
                    }}
                  >
                    <div className="text-xl mb-1">{prize.icon}</div>
                    <div>{prize.name}</div>
                  </div>
                </div>
              )
            })}

            {/* Center hub */}
            <div className="absolute inset-1/3 rounded-full bg-[#020617] border border-yellow-400 flex items-center justify-center shadow-[0_0_30px_rgba(250,204,21,0.6)]">
              <div className="text-center text-xs">
                <div className="text-[#facc15] font-bold flex items-center justify-center gap-1">
                  <Sparkles className="w-4 h-4" /> Troll City
                </div>
                <div className="text-[10px] text-gray-300 mt-1">
                  Spin at your own risk
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Spin button */}
        <button
          onClick={spinWheel}
          disabled={!canSpin}
          className="mt-4 px-8 py-3 rounded-full bg-gradient-to-r from-[#facc15] to-[#f97316] text-black font-extrabold text-lg shadow-[0_0_25px_#facc15] hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSpinning ? 'Spinning…' : 'SPIN (500 COINS)'}
        </button>

        {/* Helpful message when button is disabled */}
        {!canSpin && !isSpinning && (
          <div className="mt-3 text-sm text-red-400 text-center max-w-md">
            {!profile && 'Please sign in to spin'}
            {profile && dailySpinsLeft <= 0 && 'No spins left today - come back tomorrow!'}
            {profile && dailySpinsLeft > 0 && (profile.free_coin_balance || 0) < SPIN_COST && 
              `You need at least ${SPIN_COST.toLocaleString()} FREE coins to spin (you have ${(profile.free_coin_balance || 0).toLocaleString()})`
            }
          </div>
        )}

        {/* Result */}
        {showResult && selectedPrize && (
          <div className="mt-6 px-6 py-4 bg-black/70 border border-yellow-500/60 rounded-xl shadow-[0_0_25px_#FACC15] text-center max-w-md">
            <div className="text-3xl mb-2">{selectedPrize.icon}</div>
            <h2 className="text-xl font-bold text-[#facc15] mb-1">
              {selectedPrize.name}
            </h2>
            <p className="text-gray-300 text-sm">{selectedPrize.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default TrollWheel
