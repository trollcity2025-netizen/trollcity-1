import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'

export default function StreamSummary() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [stream, setStream] = useState<any | null>(null)
  const [likeCount, setLikeCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!id) return
      setLoading(true)
      try {
        const { data: s, error } = await supabase
          .from('streams')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw error
        setStream(s)

        try {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('stream_id', id)
            .eq('message_type', 'like')
          setLikeCount(Number(count || 0))
        } catch {}
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load summary')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-troll-dark flex items-center justify-center">
        <div className="text-troll-gold text-xl animate-pulse">Loading summary…</div>
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-troll-dark flex items-center justify-center">
        <div className="text-troll-purple text-xl">Summary not available</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05010B] via-[#090018] to-[#180019] text-white">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 via-purple-500 to-green-400 bg-clip-text text-transparent">
            Stream Summary
          </h1>
          <div className="text-sm text-gray-300">{stream.title} • {new Date(stream.start_time).toLocaleString()}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0D0D0D] rounded-xl p-5 border border-yellow-500/60">
            <div className="text-xs text-gray-400">Total Viewers</div>
            <div className="text-3xl font-bold">{Number(stream.current_viewers || 0)}</div>
          </div>
          <div className="bg-[#0D0D0D] rounded-xl p-5 border border-yellow-500/60">
            <div className="text-xs text-gray-400">Gift Coins</div>
            <div className="text-3xl font-bold">{Number(stream.total_gifts_coins || 0)}</div>
          </div>
          <div className="bg-[#0D0D0D] rounded-xl p-5 border border-yellow-500/60">
            <div className="text-xs text-gray-400">Unique Gifters</div>
            <div className="text-3xl font-bold">{Number(stream.total_unique_gifters || 0)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-[#0D0D0D] rounded-xl p-5 border border-yellow-500/60">
            <div className="text-xs text-gray-400">Troll Likes</div>
            <div className="text-3xl font-bold">{likeCount}</div>
          </div>
          <div className="bg-[#0D0D0D] rounded-xl p-5 border border-yellow-500/60">
            <div className="text-xs text-gray-400">Duration</div>
            <div className="text-3xl font-bold">
              {stream.end_time ? Math.max(1, Math.round((new Date(stream.end_time).getTime() - new Date(stream.start_time).getTime())/60000)) : 0}m
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={() => navigate('/')} className="px-4 py-2 rounded bg-yellow-500 text-black font-semibold">Back Home</button>
          {profile?.role === 'admin' && (
            <button onClick={() => navigate(`/stream/${stream.id}`)} className="px-4 py-2 rounded bg-purple-600 text-white">Reopen Stream</button>
          )}
        </div>
      </div>
    </div>
  )
}

