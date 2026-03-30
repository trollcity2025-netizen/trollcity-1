
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { trollCityTheme } from '@/styles/trollCityTheme'
import PWAInstallPrompt from '../components/PWAInstallPrompt'
import EventCountdown from '@/components/EventCountdown'
import TrollWallFeed from '@/components/home/TrollWallFeed'
import TCNNPopupWidget from '@/components/tcnn/TCNNPopupWidget'
import FeaturedBroadcasts from '@/components/broadcast/FeaturedBroadcasts'
import { supabase } from '@/lib/supabase'
import PromoSlot from '@/components/promo/PromoSlot'
import { Radio, Mic, Users, Play, Eye, X, ChevronRight } from 'lucide-react'

// Animated gradient background
const AnimatedGradient = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 animate-gradient-shift" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.18),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.14),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(140%_140%_at_90%_90%,rgba(236,72,153,0.12),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.08)_0%,rgba(14,165,233,0.06)_40%,rgba(236,72,153,0.08)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.06),transparent_35%)] mix-blend-screen" />
      <style>
        {`
          @keyframes gradient-shift {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.85; }
          }
          .animate-gradient-shift {
            animation: gradient-shift 12s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  );
};



interface LiveItem {
  id: string
  title: string
  type: 'stream' | 'podcast'
  viewerCount: number
  streamerName: string
  streamerAvatar: string | null
  isFeatured?: boolean
}

type TabType = 'live' | 'pods' | 'wall'

export default function Home() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [activeTab, setActiveTab] = useState<TabType>('wall')
  const [liveItems, setLiveItems] = useState<LiveItem[]>([])
  const [podItems, setPodItems] = useState<LiveItem[]>([])
  const [totalViewers, setTotalViewers] = useState(0)
  const [loadingLive, setLoadingLive] = useState(true)
  const [showLiveGrid, setShowLiveGrid] = useState(false)

  // Auto-scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Fetch live streams and podcasts
  useEffect(() => {
    let mounted = true

    const fetchLiveContent = async () => {
      try {
        // Fetch live streams with featured status
        const { data: streamsData, error: streamsError } = await supabase
          .from('streams')
          .select(`
            id,
            title,
            current_viewers,
            viewer_count,
            is_featured,
            user_profiles:broadcaster_id(username, avatar_url)
          `)
          .eq('is_live', true)
          .order('is_featured', { ascending: false })
          .order('current_viewers', { ascending: false })
          .limit(100)

        if (streamsError) throw streamsError

        // Fetch live podcasts
        const { data: podsData, error: podsError } = await supabase
          .from('pod_rooms')
          .select(`
            id,
            title,
            viewer_count,
            user_profiles:host_id(username, avatar_url)
          `)
          .eq('is_live', true)
          .order('viewer_count', { ascending: false })
          .limit(20)

        if (podsError) throw podsError

        if (mounted) {
          const streams: LiveItem[] = (streamsData || []).map((stream: any) => ({
            id: stream.id,
            title: stream.title || 'Untitled Stream',
            type: 'stream',
            viewerCount: stream.current_viewers || stream.viewer_count || 0,
            streamerName: stream.user_profiles?.username || 'Unknown',
            streamerAvatar: stream.user_profiles?.avatar_url || null,
            isFeatured: stream.is_featured || false,
          }))

          const podcasts: LiveItem[] = (podsData || []).map((pod: any) => ({
            id: pod.id,
            title: pod.title || 'Untitled Podcast',
            type: 'podcast',
            viewerCount: pod.viewer_count || 0,
            streamerName: pod.user_profiles?.username || 'Unknown',
            streamerAvatar: pod.user_profiles?.avatar_url || null,
          }))

          setLiveItems(streams)
          setPodItems(podcasts)
          setTotalViewers(streams.reduce((sum, item) => sum + item.viewerCount, 0))
        }
      } catch (err) {
        console.error('Error fetching live content:', err)
      } finally {
        if (mounted) setLoadingLive(false)
      }
    }

    fetchLiveContent()
    
    // Poll every 30 seconds
    const interval = setInterval(fetchLiveContent, 30000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const requireAuth = useCallback(
    (intent?: string) => {
      if (user) return true
      toast.info(`Sign in to ${intent || 'continue'}.`)
      navigate('/auth')
      return false
    },
    [navigate, user]
  )

  const handleLiveItemClick = (item: LiveItem) => {
    if (item.type === 'stream') {
      navigate(`/watch/${item.id}`)
    } else {
      if (!requireAuth('join a pod')) return
      navigate(`/pods/${item.id}`)
    }
  }

  return (
    <div className={`relative h-dvh flex flex-col ${trollCityTheme.backgrounds.primary}`}>
      {/* TCNN Popup - Only shows when TCNN is live */}
      <TCNNPopupWidget onRequireAuth={requireAuth} />

      {/* Event Countdown Banner */}
      <EventCountdown />

      {/* Animated Background */}
      <AnimatedGradient />

      {/* PWA Install Prompt - Only on Landing Page */}
      <PWAInstallPrompt />

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1 min-h-0 px-4 md:px-6 pt-4 pb-2 safe-top">
        <div className="max-w-7xl mx-auto flex flex-col flex-1 min-h-0 w-full">
          {/* Header with Tabs */}
          <section className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-3 flex-shrink-0`}>
            {/* Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('wall')}
                className={`px-4 py-1.5 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === 'wall'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                Troll Feed
              </button>
              <button
                onClick={() => setActiveTab('live')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === 'live'
                    ? 'bg-red-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <Radio className="w-4 h-4" />
                Live Now
                {liveItems.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {liveItems.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('pods')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === 'pods'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <Mic className="w-4 h-4" />
                Troll Pods
                {podItems.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-cyan-500 text-white text-xs rounded-full">
                    {podItems.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab Content - Live */}
            {activeTab === 'live' && (
              <div className="mt-3">
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-white">{liveItems.length} Broadcasting</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{totalViewers.toLocaleString()} watching now</span>
                  </div>
                </div>

                {liveItems.filter(item => item.isFeatured).length > 0 && (
                  <div className="mb-3">
                    <FeaturedBroadcasts />
                  </div>
                )}

                <button
                  onClick={() => setShowLiveGrid(!showLiveGrid)}
                  className={`w-full py-2.5 ${trollCityTheme.gradients.primary} rounded-xl font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity`}
                >
                  {showLiveGrid ? 'Hide All Broadcasts' : 'Explore All Broadcasts'}
                  <ChevronRight className={`w-5 h-5 transition-transform ${showLiveGrid ? 'rotate-90' : ''}`} />
                </button>

                {showLiveGrid && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {loadingLive ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="aspect-video bg-white/5 rounded-xl animate-pulse" />
                      ))
                    ) : liveItems.length === 0 ? (
                      <div className="col-span-full text-center py-6">
                        <Radio className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                        <p className="text-slate-400 text-sm">No one is live right now</p>
                      </div>
                    ) : (
                      liveItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleLiveItemClick(item)}
                          className="relative aspect-video bg-slate-800 rounded-xl overflow-hidden cursor-pointer group hover:ring-2 hover:ring-cyan-400/50 transition-all"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 to-pink-900/30 flex items-center justify-center">
                            {item.streamerAvatar ? (
                              <img src={item.streamerAvatar} alt={item.streamerName} className="w-full h-full object-cover" />
                            ) : (
                              <Play className="w-12 h-12 text-white/30" />
                            )}
                          </div>
                          {item.isFeatured && (
                            <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded flex items-center gap-1">
                              FEATURED
                            </div>
                          )}
                          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-red-600 rounded">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            <span className="text-xs font-bold text-white">LIVE</span>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                            <p className="text-white font-medium text-sm truncate">{item.title}</p>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-slate-300 text-xs truncate">{item.streamerName}</p>
                              <div className="flex items-center gap-1 text-slate-300 text-xs">
                                <Users className="w-3 h-3" />
                                {item.viewerCount}
                              </div>
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center">
                              <Play className="w-6 h-6 text-white ml-1" fill="white" />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab Content - Pods */}
            {activeTab === 'pods' && (
              <div className="mt-3">
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-white">{podItems.length} Podcast Rooms</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {podItems.length === 0 ? (
                    <div className="col-span-full text-center py-6">
                      <Mic className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">No podcast rooms active</p>
                    </div>
                  ) : (
                    podItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleLiveItemClick(item)}
                        className="relative bg-slate-800 rounded-xl p-3 cursor-pointer group hover:bg-slate-700 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-purple-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {item.streamerAvatar ? (
                              <img src={item.streamerAvatar} alt={item.streamerName} className="w-full h-full object-cover" />
                            ) : (
                              <Mic className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium text-sm truncate">{item.title}</p>
                            <p className="text-slate-400 text-xs truncate">{item.streamerName}</p>
                            <div className="flex items-center gap-1 text-slate-400 text-xs">
                              <Users className="w-3 h-3" />
                              {item.viewerCount}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Ad Banner - compact */}
          <div className="flex-shrink-0 mt-2">
            <PromoSlot placement="home_horizontal_banner" variant="horizontal" />
          </div>

          {/* Main Content Area */}
          <div className={`flex-1 min-h-0 mt-2 ${activeTab === 'wall' ? '' : 'hidden'}`}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
              <div className="lg:col-span-8 min-h-0">
                <TrollWallFeed onRequireAuth={requireAuth} />
              </div>
              <div className="lg:col-span-4 space-y-3">
                <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-3`}>
                  <h3 className="text-base font-semibold text-white mb-2">Quick Access</h3>
                  <div className="space-y-1.5">
                    <button
                      onClick={() => setActiveTab('live')}
                      className="w-full flex items-center justify-between p-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Radio className="w-5 h-5 text-red-500" />
                        <span className="text-white font-medium text-sm">Live Streams</span>
                      </div>
                      <span className="text-red-400 text-sm">{liveItems.length}</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('pods')}
                      className="w-full flex items-center justify-between p-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Mic className="w-5 h-5 text-cyan-500" />
                        <span className="text-white font-medium text-sm">Podcast Rooms</span>
                      </div>
                      <span className="text-cyan-400 text-sm">{podItems.length}</span>
                    </button>
                  </div>
                </div>
                <PromoSlot placement="right_panel_featured" variant="featured" />
              </div>
            </div>
          </div>
        </div>
        <div className="safe-bottom flex-shrink-0" />
      </div>
    </div>
  )
}
