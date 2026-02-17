import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Video } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { trollCityTheme } from '@/styles/trollCityTheme'

interface Stream {
  id: string
  user_id: string
  title: string | null
  status: string | null
  viewer_count: number | null
  current_viewers: number | null
  thumbnail_url?: string | null
  user_profiles?: {
    username: string | null
    avatar_url: string | null
  }
}

interface LiveStreamsModuleProps {
  onRequireAuth: (intent?: string) => boolean
}

export default function LiveStreamsModule({ onRequireAuth }: LiveStreamsModuleProps) {
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true

    const fetchStreams = async () => {
      try {
        const { data, error } = await supabase
          .from('streams')
          .select(`
            id,
            title,
            status,
            viewer_count,
            current_viewers,
            thumbnail_url,
            user_id,
            user_profiles:user_profiles!streams_user_id_fkey (
              username,
              avatar_url
            )
          `)
          .eq('is_live', true)
          .order('viewer_count', { ascending: false })
          .range(0, 49)

        if (error) throw error
        const normalized = (data || []).map((row: any) => ({
          ...row,
          user_profiles: Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles
        }))
        if (mounted) setStreams(normalized as Stream[])
      } catch (err) {
        console.error('Error fetching streams:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchStreams()
    const interval = setInterval(fetchStreams, 15000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const handleJoin = (streamId: string) => {
    navigate(`/watch/${streamId}`)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} h-[120px] rounded-2xl animate-pulse`}
          />
        ))}
      </div>
    )
  }

  if (streams.length === 0) {
    return (
      <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-6 text-center`}>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          <Video className="h-6 w-6 text-white/40" />
        </div>
        <h3 className="text-lg font-semibold text-white">No Live Streams</h3>
        <p className={`${trollCityTheme.text.muted} text-sm mt-1`}>Be the first to go live.</p>
      </div>
    )
  }

  return (
    <div className="max-h-[420px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
      {streams.map((stream) => (
        <div
          key={stream.id}
          className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-4 flex gap-4 items-center hover:border-cyan-400/40 transition-colors`}
        >
          <div className="relative h-[84px] w-[140px] overflow-hidden rounded-xl bg-black/40 flex-shrink-0">
            {stream.thumbnail_url ? (
              <img
                src={stream.thumbnail_url}
                alt={stream.title || 'Live stream'}
                className="h-full w-full object-cover"
              />
            ) : stream.user_profiles?.avatar_url ? (
              <img
                src={stream.user_profiles.avatar_url}
                alt={stream.user_profiles.username || 'Streamer avatar'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-cyan-900/20" />
            )}
            <div className="absolute left-2 top-2 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
              LIVE
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {stream.title || 'Untitled Stream'}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {stream.user_profiles?.username || 'Unknown streamer'}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
              <Users className="h-3 w-3" />
              {stream.current_viewers || stream.viewer_count || 0} watching
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleJoin(stream.id)}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-600 hover:opacity-90 transition-opacity"
          >
            Join Live
          </button>
        </div>
      ))}
    </div>
  )
}
