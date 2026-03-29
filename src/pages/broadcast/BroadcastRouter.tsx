import React, { useEffect, useState } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { Stream } from '../../types/broadcast'
import BroadcastPage from './BroadcastPage'
import ViewerPage from './ViewerPage'
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

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
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  
  const [stream, setStream] = useState<Stream | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Password protection state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [enteredPassword, setEnteredPassword] = useState('')
  const [validatingPassword, setValidatingPassword] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)

  // Handle password validation
  const handleValidatePassword = async () => {
    if (!enteredPassword.trim()) {
      toast.error('Please enter a password')
      return
    }
    
    setValidatingPassword(true)
    try {
      console.log('[BroadcastRouter] Validating password for stream:', streamId)
      
      const { data, error } = await supabase.rpc('validate_broadcast_password', {
        p_stream_id: streamId,
        p_password: enteredPassword
      })
      
      console.log('[BroadcastRouter] Validation result:', { data, error })
      
      if (error) {
        console.error('[BroadcastRouter] RPC error:', error)
        throw error
      }
      
      if (data?.success === true) {
        // Store session access
        sessionStorage.setItem(`stream_access_${streamId}`, 'granted')
        setHasAccess(true)
        setShowPasswordModal(false)
        toast.success('Access granted!')
      } else {
        console.log('[BroadcastRouter] Password incorrect:', data?.error)
        toast.error(data?.error || 'Incorrect password')
      }
    } catch (err: any) {
      console.error('Password validation error:', err)
      // Don't grant access on error - show error message
      toast.error(err?.message || 'Failed to validate password')
    } finally {
      setValidatingPassword(false)
    }
  }

  useEffect(() => {
    if (!streamId) {
      setError('No stream ID provided.')
      setIsLoading(false)
      return
    }

    const fetchStream = async () => {
      // Check if streamId looks like a UUID or a username
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(streamId);
      
      let streamData = null;
      
      if (isUUID) {
        // It's a UUID - direct stream lookup
        const { data, error: fetchError } = await supabase
          .from('streams')
          .select('*, total_likes, is_protected, password_hash')
          .eq('id', streamId)
          .maybeSingle();
        
        if (!fetchError && data) {
          streamData = data;
        }
      } else {
        // It's a username - look up user first, then their active stream
        const { data: userData, error: userError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', streamId)
          .maybeSingle();
        
        if (!userError && userData) {
          // Found user, now look for their active stream
          const { data: streamDataByUser, error: streamError } = await supabase
            .from('streams')
            .select('*, total_likes, is_protected, password_hash')
            .eq('user_id', userData.id)
            .eq('is_live', true)
            .eq('status', 'live')
            .maybeSingle();
          
          if (!streamError && streamDataByUser) {
            streamData = streamDataByUser;
          }
        }
      }

      if (!streamData) {
        setError('Stream not found.')
        setIsLoading(false)
        return
      }

      setStream(streamData)
      setIsLoading(false)
    }

    fetchStream()
  }, [streamId])

  // Also listen for realtime updates to stream status
  useEffect(() => {
    if (!streamId || !stream) return

    const channel = supabase
      .channel(`stream-status-${streamId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'streams',
        filter: `id=eq.${streamId}`
      }, (payload) => {
        if (payload.new.status === 'ended') {
          // Redirect to summary when stream ends
          navigate(`/broadcast/summary/${streamId}`)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId, stream, navigate])

  // Check for password protection when stream is loaded
  useEffect(() => {
    if (!stream) return
    
    // If user is the host, they always have access
    if (user?.id === stream.user_id) {
      setHasAccess(true)
      return
    }
    
    // Check if user is an officer (they can bypass password)
    const userRole = profile?.role
    const isOfficer = userRole === 'admin' || 
                      userRole === 'secretary' || 
                      userRole === 'lead_troll_officer' || 
                      userRole === 'troll_officer' ||
                      profile?.is_admin ||
                      profile?.is_troll_officer ||
                      profile?.is_lead_officer ||
                      profile?.is_staff
    
    console.log('[BroadcastRouter] Password check:', {
      userId: user?.id,
      profileRole: profile?.role,
      isOfficer,
      isProtected: stream.is_protected,
      hasSessionAccess: sessionStorage.getItem(`stream_access_${streamId}`)
    })
    
    if (isOfficer) {
      // Officers can bypass password
      console.log('[BroadcastRouter] Officer bypass - granting access')
      setHasAccess(true)
      return
    }
    
    // Check if stream is protected (explicitly check for true)
    const isProtected = stream.is_protected === true
    
    if (isProtected) {
      console.log('[BroadcastRouter] Stream is protected, checking session...')
      // Check if user already validated in this session
      const sessionAccess = sessionStorage.getItem(`stream_access_${streamId}`)
      if (sessionAccess === 'granted') {
        setHasAccess(true)
      } else {
        console.log('[BroadcastRouter] Showing password modal')
        setShowPasswordModal(true)
      }
    } else {
      console.log('[BroadcastRouter] Stream is not protected (is_protected =', stream.is_protected, '), granting access')
      setHasAccess(true)
    }
  }, [stream, streamId, user, profile])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-black text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="ml-4">Loading stream...</p>
      </div>
    )
  }

  if (error || !stream) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh bg-black text-white">
        <p className="text-red-500">{error || 'Stream not found'}</p>
      </div>
    )
  }

  // If stream is ended, check if this is a government-ended stream
  // Government streams should NOT show summary - just redirect to live
  if (stream.status === 'ended') {
    // Check if user came from government streams (by checking localStorage or URL)
    const fromGovernment = localStorage.getItem('fromGovernmentStreams');
    if (fromGovernment) {
      localStorage.removeItem('fromGovernmentStreams');
      return <Navigate to="/government/streams" replace />;
    }
    return <Navigate to={`/broadcast/summary/${streamId}`} replace />
  }

  // Check if current user is the host
  const isHost = user?.id === stream.user_id

  console.log('[BroadcastRouter] Routing decision:', {
    streamId,
    userId: user?.id,
    streamOwnerId: stream.user_id,
    isHost,
    hasAccess,
    route: 'BroadcastPage (LiveKit)'
  })

  // Show password modal if needed
  if (showPasswordModal && !hasAccess) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 max-w-md w-full space-y-4">
          <div className="flex items-center gap-3 text-purple-400">
            <Lock className="w-6 h-6" />
            <h2 className="text-xl font-bold text-white">Protected Broadcast</h2>
          </div>
          
          <p className="text-gray-400 text-sm">
            This broadcast is password protected. Please enter the password to join.
          </p>
          
          <div className="space-y-2">
            <input
              type="password"
              value={enteredPassword}
              onChange={(e) => setEnteredPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleValidatePassword()}
              placeholder="Enter password..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white"
              autoFocus
            />
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                // Go back if password is required
                navigate(-1)
              }}
              className="flex-1 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={handleValidatePassword}
              disabled={validatingPassword}
              className="flex-1 py-3 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-colors disabled:opacity-50"
            >
              {validatingPassword ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </span>
              ) : (
                'Join Broadcast'
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // TCNN streams route to dedicated TCNN pages (not the generic broadcast UI)
  const isTCNN = stream.category === 'tcnn'
  if (isTCNN && hasAccess) {
    if (isHost) {
      console.log('[BroadcastRouter] TCNN host → redirecting to TCNN broadcaster studio')
      return <Navigate to={`/tcnn/broadcaster/${streamId}`} replace />
    }
    console.log('[BroadcastRouter] TCNN viewer → redirecting to TCNN viewer page')
    return <Navigate to={`/tcnn/viewer/${streamId}`} replace />
  }

  // Route based on user role
  // ALL users (hosts AND viewers) now use BroadcastPage with LiveKit
  // BroadcastPage handles both publisher (host) and audience (viewer) roles
  return <BroadcastPage />
}

export default BroadcastRouter
