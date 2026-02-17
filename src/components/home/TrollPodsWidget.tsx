import { useEffect, useState } from 'react'
import { Headphones, Radio } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { trollCityTheme } from '@/styles/trollCityTheme'

interface PodRoom {
  id: string
  title: string | null
  host_id: string
  is_live: boolean
  viewer_count: number | null
  started_at: string | null
  host?: {
    username: string | null
    avatar_url: string | null
  }
}

interface TrollPodsWidgetProps {
  onRequireAuth: (intent?: string) => boolean
}

export default function TrollPodsWidget({ onRequireAuth }: TrollPodsWidgetProps) {
  const [pods, setPods] = useState<PodRoom[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true

    const fetchPods = async () => {
      try {
        const { data, error } = await supabase
          .from('pod_rooms')
          .select('id, title, host_id, is_live, viewer_count, started_at')
          .eq('is_live', true)
          .order('is_live', { ascending: false })
          .order('started_at', { ascending: false })
          .limit(6)

        if (error) throw error

        const rooms = (data as PodRoom[]) || []
        if (rooms.length === 0) {
          if (mounted) setPods([])
          return
        }

        const hostIds = [...new Set(rooms.map((room) => room.host_id))]
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', hostIds)

        const merged = rooms.map((room) => ({
          ...room,
          host: profiles?.find((profile) => profile.id === room.host_id) || {
            username: 'Unknown',
            avatar_url: null
          }
        }))

        if (mounted) setPods(merged)
      } catch (err) {
        console.error('Error fetching pods:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchPods()
    const interval = setInterval(fetchPods, 15000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const handleJoin = (podId: string) => {
    if (!onRequireAuth('listen to a pod')) return
    navigate(`/pods/${podId}`)
  }

  return (
    <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-4`}
      onClick={() => onRequireAuth('listen to a pod')}
    >
      <div className="flex items-center gap-2 mb-3">
        <Headphones className="h-5 w-5 text-purple-300" />
        <h3 className="text-lg font-semibold text-white">Pods</h3>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : pods.length === 0 ? (
        <div className="text-sm text-white/60">No active pods right now.</div>
      ) : (
        <div className="space-y-3">
          {pods.map((pod) => (
            <div key={pod.id} className="rounded-xl border border-white/10 bg-black/30 p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full overflow-hidden bg-white/5 flex-shrink-0">
                {pod.host?.avatar_url ? (
                  <img src={pod.host.avatar_url} alt={pod.host?.username || 'Host'} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-white/60">
                    {pod.host?.username?.[0]?.toUpperCase() || 'P'}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{pod.title || 'Untitled Pod'}</p>
                <p className="text-xs text-white/40 truncate">Host: {pod.host?.username || 'Unknown'}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-500/20 text-red-300">
                  LIVE
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleJoin(pod.id)
                  }}
                  className="text-xs font-semibold px-3 py-1 rounded-lg bg-purple-600/80 text-white hover:bg-purple-500"
                >
                  Join
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && pods.length > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            if (!onRequireAuth('browse pods')) return
            navigate('/pods')
          }}
          className="mt-3 w-full text-xs font-semibold text-purple-200 hover:text-white"
        >
          View all pods
        </button>
      )}

      {!loading && pods.length === 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
          <Radio className="h-3 w-3" />
          Pods refresh automatically.
        </div>
      )}
    </div>
  )
}
