 import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLiveKit } from '@/hooks/useLiveKit'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export default function JoinPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { connect, startPublishing } = useLiveKit()
  const { profile } = useAuthStore()

  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const t = q.get('token')
    if (t) setToken(t)
  }, [location.search])

  useEffect(() => {
    if (!token) return
    const join = async () => {
      setLoading(true)
      try {
        // Validate token server-side (optional): check broadcast_tokens table for existence
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

        // Connect using token override in LiveKitProvider
        // room is present in token record
        const room = data.room
        // Build a minimal user identity for guest
        const guestUser = { id: `guest-${Date.now()}`, username: profile?.username || 'Guest' }

        // Use context connect with tokenOverride
        const connected = await connect(room, guestUser, { allowPublish: true, tokenOverride: token })
        if (!connected) {
          toast.error('Failed to join room')
          setLoading(false)
          return
        }

        // Start publishing local camera/mic
        try {
          console.log('🎥 Attempting to start publishing camera/mic...')
          await startPublishing()
          console.log('✅ Camera/mic publishing started successfully')
        } catch (err: any) {
          console.warn('startPublishing failed:', err)
          // Don't show error toast for join page - let the broadcast page handle it
          if (err.message?.includes('permission') || err.message?.includes('camera') || err.message?.includes('microphone')) {
            console.log('⚠️ Camera/mic permission or device issue detected')
          }
        }

        // Mark token as used
        try {
          await supabase.from('broadcast_tokens').update({ used: true }).eq('token', token)
        } catch (err) {
          console.warn('Failed to mark token used', err)
        }

        toast.success('Joined as host — you can publish now')
        // Navigate to broadcast page for the room
        navigate(`/watch/${room}`)
      } catch (err) {
        console.error('Join error', err)
        toast.error('Unable to join')
      } finally {
        setLoading(false)
      }
    }

    join()
  }, [token, connect, startPublishing, navigate, profile])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07070A] text-white">
      <div className="p-6 rounded-lg border border-purple-700/40 bg-[#0B0A10]">
        <h2 className="text-xl font-bold mb-2">Joining...</h2>
        <p className="text-sm text-gray-300">Connecting with token{loading && '...'}</p>
      </div>
    </div>
  )
}
