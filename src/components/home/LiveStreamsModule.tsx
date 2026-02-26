import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Video, Star, Trophy } from 'lucide-react'
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
  is_featured?: boolean
  likes_count?: number
  gifts_value?: number
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
  const [rankings, setRankings] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true

    const fetchStreams = async () => {
      try {
        // Fetch streams with featured status
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
            is_featured,
            likes_count,
            gifts_value,
            user_profiles:user_profiles!streams_user_id_fkey (
              username,
              avatar_url
            )
          `)
          .eq('is_live', true)
          .order('viewer_count', { ascending: false })
          .range(0, 99)

        if (error) throw error
        
        // Also fetch current hour rankings
        const { data: rankingsData } = await supabase
          .from('broadcast_rankings')
          .select('stream_id, rank_position')
          .order('rank_position', { ascending: true })
          .limit(100)

        const rankingsMap = new Map<string, number>()
        rankingsData?.forEach((r) => {
          rankingsMap.set(r.stream_id, r.rank_position)
        })

        const normalized = (data || []).map((row: any) => ({
          ...row,
          user_profiles: Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles
        }))
        
        if (mounted) {
          setStreams(normalized as Stream[])
          setRankings(rankingsMap)
        }
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

  // Sort streams: featured first, then by viewer count
  const sortedStreams = useMemo(() => {
    return [...streams].sort((a, b) => {
      // Featured streams always first
      if (a.is_featured && !b.is_featured) return -1
      if (!a.is_featured && b.is_featured) return 1
      // Then by viewer count
      return (b.viewer_count || b.current_viewers || 0) - (a.viewer_count || a.current_viewers || 0)
    })
  }, [streams])

  const handleJoin = (streamId: string) => {
    if (!onRequireAuth('join live streams')) return
    navigate(`/watch/${streamId}`)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} aspect-video rounded-2xl animate-pulse`}
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

  // Get featured streams count
  const featuredCount = streams.filter(s => s.is_featured).length

  return (
    <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
      {/* Featured Section */}
      {featuredCount > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Featured Broadcasters</h3>
            <span className="text-xs text-slate-400">(Pinned)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedStreams.filter(s => s.is_featured).map((stream) => {
              const rank = rankings.get(stream.id)
              return (
                <div
                  key={stream.id}
                  onClick={() => handleJoin(stream.id)}
                  className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl overflow-hidden cursor-pointer hover:border-yellow-400/40 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10 hover:-translate-y-1 border-2 border-yellow-500/30`}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-black/40 flex items-center justify-center overflow-hidden">
                    {stream.thumbnail_url ? (
                      <img src={stream.thumbnail_url} alt={stream.title || 'Live stream'} className="w-full h-full object-cover" />
                    ) : stream.user_profiles?.avatar_url ? (
                      <img src={stream.user_profiles.avatar_url} alt={stream.user_profiles.username || ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-cyan-900/20">
                        <Video className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 text-white/20" />
                      </div>
                    )}
                    
                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1 shadow-lg shadow-red-900/20 animate-pulse">
                        <span className="w-2 h-2 bg-white rounded-full" />
                        LIVE
                      </span>
                      <span className="px-2 py-1 bg-yellow-600 text-white text-xs font-bold rounded flex items-center gap-1">
                        <Star className="w-3 h-3 fill-white" />
                        FEATURED
                      </span>
                    </div>

                    {/* Ranking */}
                    {rank && rank <= 10 && (
                      <div className="absolute top-3 right-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          rank === 1 ? 'bg-yellow-500 text-black' :
                          rank === 2 ? 'bg-slate-300 text-black' :
                          rank === 3 ? 'bg-amber-600 text-white' :
                          'bg-slate-700 text-white'
                        }`}>
                          #{rank}
                        </div>
                      </div>
                    )}

                    {/* Viewer Count */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-medium text-white/90">
                      <Users className="w-3 h-3" />
                      {stream.current_viewers || stream.viewer_count || 0}
                    </div>
                  </div>

                  {/* Stream Info */}
                  <div className="p-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-white/10">
                          {stream.user_profiles?.avatar_url ? (
                            <img src={stream.user_profiles.avatar_url} alt={stream.user_profiles.username || ''} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600 text-white font-bold text-lg">
                              {stream.user_profiles?.username?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate hover:text-yellow-400 transition-colors">
                          {stream.title || 'Untitled Stream'}
                        </p>
                        <p className="text-slate-400 text-sm truncate">
                          {stream.user_profiles?.username || 'Unknown streamer'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All Streams Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">All Live Streams</h3>
          <span className="text-xs text-slate-400">(Top 100)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedStreams.filter(s => !s.is_featured).map((stream) => {
            const rank = rankings.get(stream.id)
            return (
              <div
                key={stream.id}
                onClick={() => handleJoin(stream.id)}
                className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl overflow-hidden cursor-pointer hover:border-cyan-400/40 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-1`}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-black/40 flex items-center justify-center overflow-hidden">
                  {stream.thumbnail_url ? (
                    <img src={stream.thumbnail_url} alt={stream.title || 'Live stream'} className="w-full h-full object-cover" />
                  ) : stream.user_profiles?.avatar_url ? (
                    <img src={stream.user_profiles.avatar_url} alt={stream.user_profiles.username || ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-cyan-900/20">
                      <Video className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 text-white/20" />
                    </div>
                  )}
                  
                  {/* Live Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1 shadow-lg shadow-red-900/20 animate-pulse">
                      <span className="w-2 h-2 bg-white rounded-full" />
                      LIVE
                    </span>
                  </div>

                  {/* Ranking Number */}
                  {rank && (
                    <div className="absolute top-3 right-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        rank === 1 ? 'bg-yellow-500 text-black' :
                        rank === 2 ? 'bg-slate-300 text-black' :
                        rank === 3 ? 'bg-amber-600 text-white' :
                        'bg-slate-700 text-white'
                      }`}>
                        #{rank}
                      </div>
                    </div>
                  )}

                  {/* Viewer Count */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-medium text-white/90">
                    <Users className="w-3 h-3" />
                    {stream.current_viewers || stream.viewer_count || 0}
                  </div>
                </div>

                {/* Stream Info */}
                <div className="p-4">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-white/10">
                        {stream.user_profiles?.avatar_url ? (
                          <img src={stream.user_profiles.avatar_url} alt={stream.user_profiles.username || ''} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600 text-white font-bold text-lg">
                            {stream.user_profiles?.username?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate hover:text-cyan-400 transition-colors">
                        {stream.title || 'Untitled Stream'}
                      </p>
                      <p className="text-slate-400 text-sm truncate">
                        {stream.user_profiles?.username || 'Unknown streamer'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
