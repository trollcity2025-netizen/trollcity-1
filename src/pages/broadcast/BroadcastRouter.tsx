import React, { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { Stream } from '../../types/broadcast'
import BroadcastPage from './BroadcastPage'
import ViewerPage from './ViewerPage'
import { Loader2 } from 'lucide-react'

/**
 * BroadcastRouter - Routes to the appropriate page based on user role
 * 
 * - If user is the host (stream owner) → BroadcastPage (uses LiveKit)
 * - If user is a viewer → BroadcastPage (uses LiveKit to subscribe)
 * 
 * Both pages use LiveKit for video - hosts publish, viewers subscribe.
 */
function BroadcastRouter() {
  const { id: streamId } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  
  const [stream, setStream] = useState<Stream | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!streamId) {
      setError('No stream ID provided.')
      setIsLoading(false)
      return
    }

    const fetchStream = async () => {
      const { data, error: fetchError } = await supabase
        .from('streams')
        .select('*, total_likes, mux_playback_id')
        .eq('id', streamId)
        .maybeSingle()

      if (fetchError || !data) {
        setError('Stream not found.')
        setIsLoading(false)
        return
      }

      setStream(data)
      setIsLoading(false)
    }

    fetchStream()
  }, [streamId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="ml-4">Loading stream...</p>
      </div>
    )
  }

  if (error || !stream) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <p className="text-red-500">{error || 'Stream not found'}</p>
      </div>
    )
  }

  // Check if current user is the host
  const isHost = user?.id === stream.user_id

  console.log('[BroadcastRouter] Routing decision:', {
    streamId,
    userId: user?.id,
    streamOwnerId: stream.user_id,
    isHost,
    route: 'BroadcastPage (LiveKit)'
  })

  // Route based on user role
  // ALL users (hosts AND viewers) now use BroadcastPage with LiveKit
  // BroadcastPage handles both publisher (host) and audience (viewer) roles
  return <BroadcastPage />
}

export default BroadcastRouter
