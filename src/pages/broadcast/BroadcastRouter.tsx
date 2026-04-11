import React, { useEffect, useState } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { Stream } from '../../types/broadcast'
import BroadcastPage from './BroadcastPage'
import ViewerPage from './ViewerPage'
import StreamEndedPage from './StreamEndedPage'
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

const APP_URL = import.meta.env.VITE_APP_URL || 'https://trollcity.app'
const FALLBACK_PREVIEW_IMAGE = `${APP_URL}/preview-default.svg`

function injectSocialMetaTags(stream: Stream | null, broadcaster: { username: string; avatar_url: string; thumbnail_url?: string } | null) {
  if (!stream) return
  
  const isLive = stream.status === 'live'
  const statusText = isLive ? 'LIVE' : 'Ended'
  const title = `${broadcaster?.username || 'Broadcaster'} is ${statusText} on Troll City`
  const description = stream.title || `Watch this live broadcast on Troll City`
  const canonicalUrl = `${APP_URL}/watch/${stream.id}`
  const previewImage = (stream as any).thumbnail_url || broadcaster?.thumbnail_url || broadcaster?.avatar_url || FALLBACK_PREVIEW_IMAGE
  
  document.title = title
  
  const updateMeta = (property: string, content: string, isName = false) => {
    const existing = document.querySelector(isName ? `meta[name="${property}"]` : `meta[property="${property}"]`)
    if (existing) {
      existing.setAttribute('content', content)
    } else {
      const meta = document.createElement('meta')
      if (isName) {
        meta.setAttribute('name', property)
      } else {
        meta.setAttribute('property', property)
      }
      meta.setAttribute('content', content)
      document.head.appendChild(meta)
    }
  }
  
  // Open Graph tags
  updateMeta('og:type', isLive ? 'video.other' : 'website')
  updateMeta('og:title', title)
  updateMeta('og:description', description)
  updateMeta('og:url', canonicalUrl)
  updateMeta('og:image', previewImage)
  updateMeta('og:site_name', 'Troll City')
  
  if (isLive) {
    updateMeta('og:video', `${APP_URL}/embed/${stream.id}`)
    updateMeta('og:video:secure_url', `${APP_URL}/embed/${stream.id}`)
    updateMeta('og:video:type', 'text/html')
    updateMeta('og:video:width', '1280')
    updateMeta('og:video:height', '720')
    updateMeta('og:live', 'true')
    updateMeta('og:stream:status', 'live')
  }
  
  // Twitter Card tags
  updateMeta('twitter:card', isLive ? 'player' : 'summary_large_image', true)
  updateMeta('twitter:title', title, true)
  updateMeta('twitter:description', description, true)
  updateMeta('twitter:image', previewImage, true)
  updateMeta('twitter:site', '@trollcityapp', true)
  
  if (isLive) {
    updateMeta('twitter:player', `${APP_URL}/embed/${stream.id}`, true)
    updateMeta('twitter:player:width', '1280', true)
    updateMeta('twitter:player:height', '720', true)
  }
  
  // Canonical URL
  const existingCanonical = document.querySelector('link[rel="canonical"]')
  if (existingCanonical) {
    existingCanonical.setAttribute('href', canonicalUrl)
  } else {
    const link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    link.setAttribute('href', canonicalUrl)
    document.head.appendChild(link)
  }
}

function injectSafeMetaForPrivateStream(streamId: string, isPrivate: boolean) {
  const title = isPrivate ? 'Private Broadcast' : 'Stream Not Found'
  const description = isPrivate 
    ? 'This is a private broadcast. Log in to request access.'
    : 'This broadcast is not available.'
  
  document.title = title
  
  const updateMeta = (property: string, content: string, isName = false) => {
    const existing = document.querySelector(isName ? `meta[name="${property}"]` : `meta[property="${property}"]`)
    if (existing) {
      existing.setAttribute('content', content)
    } else {
      const meta = document.createElement('meta')
      if (isName) {
        meta.setAttribute('name', property)
      } else {
        meta.setAttribute('property', property)
      }
      meta.setAttribute('content', content)
      document.head.appendChild(meta)
    }
  }
  
  updateMeta('og:type', 'website')
  updateMeta('og:title', title)
  updateMeta('og:description', description)
  updateMeta('og:url', `${APP_URL}/watch/${streamId}`)
  updateMeta('og:image', FALLBACK_PREVIEW_IMAGE)
  
  updateMeta('twitter:card', 'summary_large_image', true)
  updateMeta('twitter:title', title, true)
  updateMeta('twitter:description', description, true)
  updateMeta('twitter:image', FALLBACK_PREVIEW_IMAGE, true)
}

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
  const [broadcaster, setBroadcaster] = useState<{ username: string; avatar_url: string; thumbnail_url?: string } | null>(null)
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
      let broadcasterData = null;
      
      if (isUUID) {
        // It's a UUID - direct stream lookup
        try {
          const { data, error: fetchError } = await supabase
            .from('streams')
            .select('*')
            .eq('id', streamId)
            .maybeSingle();
          
          console.log('[BroadcastRouter] Stream fetch result:', { data, error: fetchError, streamId });
          
          if (!fetchError && data) {
            streamData = data;
            // Fetch broadcaster profile separately
            if (data.user_id) {
              const { data: profileData } = await supabase
                .from('user_profiles')
                .select('id, username, avatar_url, thumbnail_url')
                .eq('id', data.user_id)
                .maybeSingle();
              broadcasterData = profileData;
            }
          }
        } catch (e) {
          console.error('[BroadcastRouter] Stream fetch error:', e);
        }
      } else {
        // It's a username - look up user first, then their stream (any status - live or recently created)
        const { data: userData, error: userError } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, thumbnail_url')
          .eq('username', streamId)
          .maybeSingle();
        
        console.log('[BroadcastRouter] User lookup result:', { userData, error: userError, streamId });
        
        if (!userError && userData) {
          broadcasterData = userData;
          // Found user, now look for their stream (prefer live, but accept any recent)
          try {
            // First try live streams
            const { data: streamDataByUser, error: streamError } = await supabase
              .from('streams')
              .select('*')
              .eq('user_id', userData.id)
              .eq('is_live', true)
              .eq('status', 'live')
              .maybeSingle();
            
            console.log('[BroadcastRouter] Live stream lookup:', { streamDataByUser, error: streamError });
            
            if (!streamError && streamDataByUser) {
              streamData = streamDataByUser;
            } else {
              // If no live stream, try finding any recent stream (created within last 10 mins)
              const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
              const { data: recentStream } = await supabase
                .from('streams')
                .select('*')
                .eq('user_id', userData.id)
                .gte('created_at', tenMinutesAgo)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              console.log('[BroadcastRouter] Recent stream fallback:', { recentStream });
              
              if (recentStream) {
                streamData = recentStream;
              }
            }
          } catch (e) {
            console.error('[BroadcastRouter] Stream by user fetch error:', e);
          }
        }
      }

      if (!streamData) {
        setError('Stream not found.')
        // Inject safe meta for not found
        injectSafeMetaForPrivateStream(streamId, false)
        setIsLoading(false)
        return
      }

      setStream(streamData)
      setBroadcaster(broadcasterData)
      
      // Inject social meta tags for SEO
      injectSocialMetaTags(streamData, broadcasterData)
      
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
      // Inject safe meta for private stream (don't reveal details)
      injectSafeMetaForPrivateStream(streamId, true)
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

  // If stream is ended, show the ended page
  if (stream.status === 'ended') {
    // Check if user came from government streams (by checking localStorage or URL)
    const fromGovernment = localStorage.getItem('fromGovernmentStreams');
    if (fromGovernment) {
      localStorage.removeItem('fromGovernmentStreams');
      return <Navigate to="/government/streams" replace />;
    }
    return <StreamEndedPage />
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
