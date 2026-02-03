import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { Coins, Send, Waves, Trophy, User } from 'lucide-react'
import ClickableUsername from '../components/ClickableUsername'

type Donation = {
  id: string
  user_id: string
  amount: number
  message: string | null
  created_at: string
  username?: string
  avatar_url?: string
}

export default function PublicPool() {
  const { profile } = useAuthStore()
  const [poolBalance, setPoolBalance] = useState<number>(0)
  const [donations, setDonations] = useState<Donation[]>([])
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hasPoolRealtimeRef = useRef<boolean>(false)
  
  // Visualizer State
  const particlesRef = useRef<any[]>([])
  const animationFrameRef = useRef<number>()

  // Load Initial Data
  useEffect(() => {
    const loadData = async () => {
      // 1. Get Pool Balance
      const { data: poolData } = await supabase
        .from('admin_pool')
        .select('trollcoins_balance')
        .limit(1)
        .single()

      // 2. Get Recent Donations
      const { data: donationData } = await supabase
        .from('pool_donations')
        .select(`
          id,
          user_id,
          amount,
          message,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(50)
      
      let donationsTotal = 0
      if (donationData) {
        // Manually fetch user profiles since the relationship is tricky with auth.users
        const userIds = Array.from(new Set(donationData.map((d: any) => d.user_id)))
        
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, created_at')
          .in('id', userIds)
          
        const profileMap = new Map()
        if (profiles) {
          profiles.forEach((p: any) => {
            profileMap.set(p.id, p)
          })
        }
        const mappedDonations = donationData.map((d: any) => ({
          ...d,
          username: profileMap.get(d.user_id)?.username,
          avatar_url: profileMap.get(d.user_id)?.avatar_url,
          user_created_at: profileMap.get(d.user_id)?.created_at
        }))
        donationsTotal = mappedDonations.reduce(
          (sum, d) => sum + Number(d.amount || 0),
          0
        )
        setDonations(mappedDonations)
      }

      let nextBalance = 0
      if (poolData && poolData.trollcoins_balance != null) {
        nextBalance = Number(poolData.trollcoins_balance) || 0
      }
      if (nextBalance === 0 && donationsTotal > 0) {
        nextBalance = donationsTotal
      }
      setPoolBalance(nextBalance)
    }

    loadData()

    // Realtime Subscriptions
    const poolSub = supabase
      .channel('public-pool-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_pool' },
        (payload) => {
          hasPoolRealtimeRef.current = true
          setPoolBalance(Number(payload.new.trollcoins_balance))
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pool_donations' },
        async (payload) => {
          // Fetch user details for the new donation
          const { data: userData } = await supabase
            .from('user_profiles')
            .select('username, avatar_url')
            .eq('id', payload.new.user_id)
            .single()

          const newDonation = {
            ...payload.new,
            username: userData?.username,
            avatar_url: userData?.avatar_url
          } as Donation

          setDonations(prev => [newDonation, ...prev].slice(0, 50))
          spawnCoins(payload.new.amount)
          if (!hasPoolRealtimeRef.current) {
            setPoolBalance(prev => (prev || 0) + Number(payload.new.amount || 0))
          }
        }
      )
      .subscribe()

    return () => {
      poolSub.unsubscribe()
    }
  }, [])

  // Canvas Visualizer
  const spawnCoins = (amount: number) => {
    if (!canvasRef.current) return
    // Logarithmic scaling for visual coins: don't spawn 1 million particles
    const count = Math.min(Math.floor(Math.log10(amount) * 5) + 5, 50)
    
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: Math.random() * canvasRef.current.width,
        y: -20 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 2,
        vy: 2 + Math.random() * 3,
        size: 3 + Math.random() * 3,
        color: Math.random() > 0.9 ? '#fbbf24' : '#f59e0b', // Gold variations
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.2
      })
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth
        canvas.height = canvas.parentElement.clientHeight
      }
    }
    window.addEventListener('resize', resize)
    resize()

    const animate = () => {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 1. Draw "Water Level" of coins (The Pile)
      // Goal: 10 Million fills the screen nicely
      // Use a curve so it fills fast at first then slows down
      const maxCoins = 10_000_000
      const fillRatio = Math.min(poolBalance / maxCoins, 1.2) // Allow slight overfill
      const pileHeight = canvas.height * fillRatio * 0.8 // Fill up to 80% of screen

      if (pileHeight > 0) {
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - pileHeight)
        gradient.addColorStop(0, '#78350f') // Dark gold/brown bottom
        gradient.addColorStop(0.5, '#b45309')
        gradient.addColorStop(1, '#fbbf24') // Bright gold top

        ctx.fillStyle = gradient
        ctx.beginPath()
        
        // Wavy top surface
        const time = Date.now() / 1000
        ctx.moveTo(0, canvas.height)
        for (let x = 0; x <= canvas.width; x += 20) {
          const y = canvas.height - pileHeight + Math.sin(x * 0.01 + time) * 10
          ctx.lineTo(x, y)
        }
        ctx.lineTo(canvas.width, canvas.height)
        ctx.fill()
        
        // Top highlight line
        ctx.strokeStyle = '#fcd34d'
        ctx.lineWidth = 3
        ctx.beginPath()
        for (let x = 0; x <= canvas.width; x += 20) {
          const y = canvas.height - pileHeight + Math.sin(x * 0.01 + time) * 10
          ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // 2. Draw Falling Particles
      particlesRef.current.forEach((p, index) => {
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.vRot
        p.vy += 0.1 // Gravity

        // Draw Coin
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(0, 0, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // Remove if below pile or screen
        const pileY = canvas.height - pileHeight
        if (p.y > canvas.height || (pileHeight > 0 && p.y > pileY + 20)) {
           // Splash effect? For now just remove
           particlesRef.current.splice(index, 1)
        }
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resize)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [poolBalance])


  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.rpc('donate_to_public_pool', {
        p_amount: Number(amount),
        p_message: message || null
      })

      if (error) throw error
      
      toast.success('Donation successful! You are a legend.')
      setAmount('')
      setMessage('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to donate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden relative">
      {/* Background Visualizer */}
      <div className="absolute inset-0 z-0">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-b from-slate-900/90 to-transparent pointer-events-auto">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-cyan-500/20 rounded-2xl border border-cyan-500/30 backdrop-blur-md">
                 <Waves className="w-8 h-8 text-cyan-400" />
               </div>
               <div>
                 <h1 className="text-3xl font-bold text-white drop-shadow-lg">Public Coin Pool</h1>
                 <p className="text-cyan-200/80 font-medium">Community Chest & Events Fund</p>
               </div>
             </div>

             <div className="text-right">
                <p className="text-sm text-slate-300 mb-1">Total Pool Value</p>
                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 drop-shadow-sm font-mono">
                  {poolBalance.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                   Target: 10,000,000 ({(poolBalance / 10000000 * 100).toFixed(1)}%)
                </div>
             </div>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 max-w-6xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
          
          {/* Left: Donation Form */}
          <div className="lg:col-span-1 flex flex-col justify-end pb-12 pointer-events-auto">
             <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl">
               <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                 <Coins className="text-yellow-400" />
                 Make a Splash
               </h2>
               
               <form onSubmit={handleDonate} className="space-y-4">
                 <div>
                   <label className="text-xs text-slate-400 ml-1">Amount</label>
                   <div className="relative mt-1">
                     <input 
                       type="number" 
                       value={amount}
                       onChange={e => setAmount(e.target.value)}
                       className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 pl-10 text-lg font-mono focus:border-cyan-500 outline-none transition-colors"
                       placeholder="0"
                     />
                     <div className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-500 font-bold">$</div>
                   </div>
                 </div>

                 <div>
                    <label className="text-xs text-slate-400 ml-1">Message (Optional)</label>
                    <input 
                      type="text" 
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      className="w-full mt-1 bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:border-cyan-500 outline-none transition-colors"
                      placeholder="Shoutout to..."
                      maxLength={50}
                    />
                 </div>

                 <button 
                   disabled={loading}
                   className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {loading ? (
                     <span className="animate-spin">⏳</span> 
                   ) : (
                     <Send className="w-5 h-5" />
                   )}
                   Donate to Pool
                 </button>
                 
                 <div className="text-center text-xs text-slate-500 mt-2">
                   Your balance: {profile?.troll_coins?.toLocaleString() || 0}
                 </div>
               </form>
             </div>
          </div>

          {/* Center: Spacer for visuals */}
          <div className="hidden lg:block"></div>

          {/* Right: Feed */}
          <div className="lg:col-span-1 pointer-events-auto h-full overflow-hidden flex flex-col">
             <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col h-[600px]">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-purple-400" />
                    Recent Donors
                  </h3>
                  <div className="text-xs text-slate-500">Live Feed</div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {donations.length === 0 ? (
                    <div className="text-center text-slate-500 py-10">
                      No donations yet. Be the first!
                    </div>
                  ) : (
                    donations.map((d) => (
                      <div key={d.id} className="bg-slate-950/50 border border-white/5 rounded-xl p-3 flex items-start gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="mt-1">
                          {d.avatar_url ? (
                             <img src={d.avatar_url} className="w-8 h-8 rounded-full border border-white/10" />
                          ) : (
                             <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                               <User className="w-4 h-4 text-slate-400" />
                             </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                           <div className="flex items-center justify-between">
                             <UserNameWithAge
                               user={{
                                 username: d.username || 'Unknown',
                                 created_at: d.user_created_at,
                                 id: d.user_id
                               }}
                               className="font-semibold text-sm text-cyan-200" 
                             />
                             <span className="text-yellow-400 font-mono text-sm">+{d.amount.toLocaleString()}</span>
                           </div>
                           {d.message && (
                             <p className="text-xs text-slate-300 mt-1 break-words">&quot;{d.message}&quot;</p>
                           )}
                           <div className="text-[10px] text-slate-500 mt-1 text-right">
                             {new Date(d.created_at).toLocaleTimeString()}
                           </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  )
}
