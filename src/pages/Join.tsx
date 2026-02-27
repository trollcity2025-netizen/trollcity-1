import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export default function JoinPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const [token, setToken] = useState<string | null>(null)
  const [room, setRoom] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [validated, setValidated] = useState(false)

  // Get token from URL
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const t = q.get('token')
    if (t) setToken(t)
  }, [location.search])

  // Validate token and get room
  useEffect(() => {
    if (!token || validated) return
    const validateToken = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('broadcast_tokens')
          .select('*')
          .eq('token', token)
          .maybeSingle()

        if (error) console.warn('Token lookup error', error)
        if (!data) {
          toast.error('Invalid or expired token')
          setLoading(false)
          return
        }

        setRoom(data.room)
        setValidated(true)

        // Mark token as used
        try {
          await supabase.from('broadcast_tokens').update({ used: true }).eq('token', token)
        } catch (err) {
          console.warn('Failed to mark token used', err)
        }
      } catch (err) {
        console.error('Join error', err)
        toast.error('Unable to join')
      } finally {
        setLoading(false)
      }
    }

    validateToken()
  }, [token, validated])

  // Use the room hook to connect - automatically handles connection and publishing
  const { isConnected } = useRoom({ 
    url: room ? `room-${room}` : undefined, 
    token: token || undefined 
  })

  // Navigate when connected
  useEffect(() => {
    if (isConnected && room) {
      toast.success('Joined as host — you can publish now')
      navigate(`/watch/${room}`)
    }
  }, [isConnected, room, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07070A] text-white">
      <div className="p-6 rounded-lg border border-purple-700/40 bg-[#0B0A10]">
        <h2 className="text-xl font-bold mb-2">Joining...</h2>
        <p className="text-sm text-gray-300">Connecting with token{loading && '...'}</p>
      </div>
    </div>
  )
}
