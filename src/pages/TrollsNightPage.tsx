import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { 
  Play, 
  Users, 
  Radio,
  Zap,
  Flame
} from 'lucide-react'

// Mock Data as requested
const MOCK_STREAMS = [
  { id: 1, title: 'Midnight Troll Talk', user: '@NeonTrollKing', viewers: '1.2k', category: 'Talk', color: 'from-purple-600 to-blue-600' },
  { id: 2, title: 'Late Night Laughs', user: '@PixelSavage', viewers: '850', category: 'Comedy', color: 'from-pink-600 to-rose-600' },
  { id: 3, title: 'City Lights Radio', user: '@VibeCaster', viewers: '2.1k', category: 'Music', color: 'from-blue-600 to-cyan-600' },
  { id: 4, title: 'Gaming After Dark', user: '@MoonlitTroll', viewers: '3.4k', category: 'Gaming', color: 'from-green-600 to-emerald-600' },
  { id: 5, title: 'Art Under Neon', user: '@CrownJester', viewers: '500', category: 'Art', color: 'from-yellow-600 to-orange-600' },
  { id: 6, title: 'Troll Court Debates', user: '@GlowPainter', viewers: '1.8k', category: 'Debate', color: 'from-red-600 to-purple-600' },
]

export default function TrollsNightPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  
  const isAdmin = profile?.role === 'admin' || profile?.is_admin

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#050012] text-white flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 mb-4">
          TROLLS @ NIGHT
        </h1>
        <div className="text-2xl font-bold text-yellow-400 mb-2 flex items-center gap-2">
          <span className="animate-pulse">⚠️</span>
          UNDER CONSTRUCTION
          <span className="animate-pulse">⚠️</span>
        </div>
        <p className="text-purple-200/80 max-w-md">
          This exclusive late-night zone is currently being built by the troll architects. 
          Check back later for chaos, streams, and neon lights.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050012] text-white overflow-x-hidden pb-20">
      
      {/* HERO BANNER */}
      <div className="relative w-full h-[400px] overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: `url('https://images.unsplash.com/photo-1565626424178-b254d9229748?q=80&w=2070&auto=format&fit=crop')`,
          }}
        >
          {/* Dark Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050012] via-[#050012]/60 to-transparent" />
          <div className="absolute inset-0 bg-purple-900/20 mix-blend-overlay" />
        </div>

        {/* Content Container */}
        <div className="relative z-10 h-full flex flex-col justify-center px-8 md:px-12 max-w-7xl mx-auto">
          {/* Main Title Area */}
          <div className="max-w-2xl space-y-6">
            <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 drop-shadow-[0_0_25px_rgba(236,72,153,0.5)]">
              TROLLS @ NIGHT
            </h1>
            
            <p className="text-xl md:text-2xl text-purple-100 font-medium tracking-wide drop-shadow-md">
              Late-night lives, chaos chats, and streaming energy
            </p>

            {/* Buttons Row */}
            <div className="flex items-center gap-4 pt-4">
              <button className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition shadow-[0_0_20px_rgba(255,255,255,0.4)] flex items-center gap-2">
                <Play className="w-5 h-5 fill-black" />
                Explore Live
              </button>
              <button className="px-8 py-3 bg-black/40 backdrop-blur-md border border-purple-500/50 text-white font-bold rounded-full hover:bg-black/60 transition flex items-center gap-2">
                <Flame className="w-5 h-5 text-purple-400" />
                Top Creators
              </button>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-6 text-sm md:text-base font-semibold text-purple-200/80 pt-2">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                2,814 Live Now
              </span>
              <span>|</span>
              <span>98K Viewers</span>
              <span>|</span>
              <span>+500 New Tonight</span>
            </div>
          </div>

          {/* Right-side Neon Billboard Effect */}
          <div className="absolute right-10 top-1/2 -translate-y-1/2 hidden lg:block opacity-80 mix-blend-screen pointer-events-none">
             <div className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-purple-900/0 via-purple-500/20 to-purple-900/0 rotate-90 tracking-widest blur-sm">
               NIGHT
             </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-8 space-y-12 -mt-10 relative z-20">
        
        {/* LIVE NOW SECTION */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-ping absolute inset-0" />
                <div className="w-3 h-3 bg-red-600 rounded-full relative" />
              </div>
              <h2 className="text-2xl font-bold tracking-wide text-white">Live Now</h2>
            </div>
            
            <button 
              onClick={() => navigate('/go-live')}
              className="px-6 py-2 bg-gradient-to-r from-red-600 to-pink-600 rounded-lg font-bold text-sm hover:brightness-110 transition shadow-lg shadow-red-900/30 flex items-center gap-2"
            >
              <Radio className="w-4 h-4" />
              Go Live
            </button>
          </div>

          {/* Empty State Container */}
          <div className="w-full h-64 rounded-2xl border border-purple-500/30 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-4 shadow-[0_0_30px_rgba(168,85,247,0.15)] relative overflow-hidden group hover:border-purple-500/50 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 pointer-events-none" />
            
            <div className="p-4 rounded-full bg-white/5 border border-white/10 group-hover:scale-110 transition-transform duration-500">
              <Zap className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-xl text-purple-200/60 font-medium tracking-widest uppercase">
              No one is live right now…
            </p>
          </div>
        </section>

        {/* STREAM GRID SECTION */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold tracking-wide text-white">Recommended For You</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {MOCK_STREAMS.slice(0, 4).map((stream) => (
              <div 
                key={stream.id}
                className="group relative bg-[#0F0F1A] rounded-2xl overflow-hidden border border-white/5 hover:border-purple-500/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(168,85,247,0.25)] hover:-translate-y-1 cursor-pointer"
              >
                {/* Thumbnail */}
                <div className={`h-48 w-full bg-gradient-to-br ${stream.color} relative`}>
                  <div className="absolute top-3 left-3 px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded flex items-center gap-1 uppercase tracking-wider shadow-sm">
                    Live
                  </div>
                  <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-white text-xs font-medium flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {stream.viewers}
                  </div>
                  
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/40">
                      <Play className="w-5 h-5 fill-white text-white ml-1" />
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                      {stream.title}
                    </h3>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 font-medium hover:text-white transition-colors">
                      {stream.user}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-purple-300 text-[10px] border border-purple-500/20">
                      {stream.category}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
