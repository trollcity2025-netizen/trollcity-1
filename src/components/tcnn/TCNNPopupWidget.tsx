/**
 * TCNNPopupWidget Component
 * 
 * A popup widget that appears when TCNN news is live.
 * Only shows when there's an active news broadcast.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { 
  Radio, 
  Users, 
  Play, 
  X,
  Maximize2
} from 'lucide-react'

interface TCNNStream {
  id: string
  title: string
  streamerName: string
  streamerAvatar: string | null
  viewerCount: number
  isLive: boolean
}

interface TCNNPopupWidgetProps {
  onRequireAuth: (intent?: string) => boolean
}

export default function TCNNPopupWidget({ onRequireAuth }: TCNNPopupWidgetProps) {
  const navigate = useNavigate()
  const [stream, setStream] = useState<TCNNStream | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [hasShownPopup, setHasShownPopup] = useState(false)

  useEffect(() => {
    let mounted = true

    const fetchTCNNStream = async () => {
      try {
        // Check for active TCNN stream
        const { data, error } = await supabase
          .from('streams')
          .select(`
            id,
            title,
            user_id,
            is_live,
            viewer_count,
            current_viewers,
            agora_channel,
            broadcaster:user_profiles!user_id(username, avatar_url)
          `)
          .eq('category', 'tcnn')
          .eq('is_live', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) throw error

        if (mounted) {
          if (data) {
            const broadcaster = Array.isArray(data.broadcaster) 
              ? data.broadcaster[0] 
              : data.broadcaster

            const streamData: TCNNStream = {
              id: data.id,
              title: data.title || 'TCNN Live Broadcast',
              streamerName: broadcaster?.username || 'TCNN News Caster',
              streamerAvatar: broadcaster?.avatar_url || null,
              viewerCount: data.current_viewers || data.viewer_count || 0,
              isLive: data.is_live,
            }
            
            setStream(streamData)
            
            // Show popup if this is first time finding a live stream
            if (!hasShownPopup) {
              setShowPopup(true)
              setHasShownPopup(true)
            }
          } else {
            setStream(null)
            setShowPopup(false)
          }
          setLoading(false)
        }
      } catch (err) {
        console.error('Error fetching TCNN stream:', err)
        if (mounted) setLoading(false)
      }
    }

    fetchTCNNStream()
    
    // Poll every 30 seconds (reduced from 15s to lower server load)
    const interval = setInterval(fetchTCNNStream, 30000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [hasShownPopup])

  const handleWatchClick = () => {
    if (!onRequireAuth('watch TCNN')) return
    navigate(`/tcnn/viewer/${stream?.id}`)
  }

  const handleGoToTCNN = () => {
    if (!onRequireAuth('view TCNN')) return
    navigate('/tcnn')
  }

  const handleClose = () => {
    setShowPopup(false)
  }

  const handleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  // Don't render if no stream or popup is closed
  if (!stream?.isLive || !showPopup || loading) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={handleClose} />
      
      {/* Popup Container */}
      <div className="fixed bottom-4 right-4 z-50">
        {isMinimized ? (
          // Minimized State
          <button
            onClick={handleMinimize}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 rounded-full shadow-lg shadow-red-500/30 hover:from-red-500 hover:to-red-600 transition-all group"
          >
            <div className="relative">
              <Radio className="w-5 h-5 text-white" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
            <span className="text-white font-semibold text-sm">TCNN Live</span>
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <Play className="w-3 h-3 text-white ml-0.5" fill="white" />
            </div>
          </button>
        ) : (
          // Full Expanded State
          <div className="w-80 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-red-500/30 shadow-2xl shadow-red-500/20 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-900/80 to-red-800/80 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Radio className="w-4 h-4 text-red-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                </div>
                <span className="text-xs font-bold text-red-100 uppercase tracking-wider">TCNN Live</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleMinimize}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="Minimize"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-red-200" />
                </button>
                <button
                  onClick={handleClose}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5 text-red-200" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Stream Preview */}
              <div 
                onClick={handleWatchClick}
                className="relative aspect-video bg-black rounded-xl overflow-hidden cursor-pointer group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
                
                {/* Play Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-red-600/90 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                    <Play className="w-6 h-6 text-white ml-1" fill="white" />
                  </div>
                </div>

                {/* Viewer Count */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded-lg">
                  <Users className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-xs font-medium text-white">
                    {stream.viewerCount.toLocaleString()}
                  </span>
                </div>

                {/* Streamer Info */}
                <div className="absolute bottom-2 left-2 flex items-center gap-2">
                  {stream.streamerAvatar ? (
                    <img 
                      src={stream.streamerAvatar} 
                      alt={stream.streamerName}
                      className="w-8 h-8 rounded-full border-2 border-red-500/50"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center">
                      <Radio className="w-4 h-4 text-red-400" />
                    </div>
                  )}
                  <div className="bg-black/60 px-2 py-1 rounded-lg">
                    <p className="text-xs font-medium text-white truncate max-w-[120px]">
                      {stream.title}
                    </p>
                    <p className="text-[10px] text-white/60">
                      {stream.streamerName}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleWatchClick}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-semibold text-white transition-colors"
                >
                  Watch Now
                </button>
                <button
                  onClick={handleGoToTCNN}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium text-white transition-colors"
                >
                  TCNN Page
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
