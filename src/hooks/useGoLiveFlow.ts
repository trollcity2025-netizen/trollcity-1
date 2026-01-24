import { useCallback, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { ConnectionState, Room, RoomEvent, Track } from 'livekit-client'
import { toast } from 'sonner'
import { getLiveKitToken, type LiveKitTokenResponse } from '../lib/livekit-utils'

export interface StreamConfig {
  title: string
  category: 'Just Chatting' | 'Family Stream' | 'Music' | 'Other' | 'Officer Stream' | 'Tromody Show' | 'Troll Battles'
  description?: string
  audience?: 'public' | 'followers' | 'family'
  allowGifts?: boolean
  guestSlots?: number
}



export const useGoLiveFlow = () => {
  const { user, profile } = useAuthStore()
  
  const [stream, setStream] = useState<any>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'publishing' | 'error'>('idle')
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const roomRef = useRef<Room | null>(null)
  const localTracksRef = useRef<any[]>([])

  const createStreamRecord = useCallback(
    async (config: StreamConfig) => {
      if (!user || !profile) {
        setError('You must be logged in')
        return null
      }

      try {
        const streamId = crypto.randomUUID()
        
        const categoryDefaults: Record<string, any> = {
          'Just Chatting': { guestSlots: 3 },
          'Family Stream': { guestSlots: 4, familyBonus: true },
          'Music': { guestSlots: 2 },
          'Other': { guestSlots: 3 },
          'Officer Stream': { guestSlots: 2 },
          'Tromody Show': { guestSlots: 0 },
          'Troll Battles': { guestSlots: 1 },
        }

        const defaults = categoryDefaults[config.category] || { guestSlots: 3 }

        const { data, error: insertError } = await supabase
          .from('streams')
          .insert({
            id: streamId,
            broadcaster_id: profile.id,
            title: config.title,
            category: config.category,
            description: config.description || '',
            audience_type: config.audience || 'public',
            allow_gifts: config.allowGifts !== false,
            room_name: `stream-${streamId}`,
            is_live: false,
            status: 'preparing',
            viewer_count: 0,
            current_viewers: 0,
            total_gifts_coins: 0,
            popularity: 0,
            max_guest_slots: config.guestSlots ?? defaults.guestSlots,
            created_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (insertError) {
          console.error('[useGoLiveFlow] Stream creation failed:', insertError)
          setError('Failed to create stream')
          return null
        }

        console.log(`[useGoLiveFlow] Stream created: ${streamId} category=${config.category}`)
        setStream(data)
        return data
      } catch (err: any) {
        console.error('[useGoLiveFlow] Error creating stream:', err)
        setError(err.message || 'Failed to create stream')
        return null
      }
    },
    [user, profile]
  )

  const getToken = useCallback(
    async (streamId: string, allowPublish: boolean) => {
      if (!user) {
        setError('You must be logged in')
        return null
      }

      if (!profile?.id || !profile?.username || !profile?.role) {
        setError('Profile not fully loaded. Please try again.')
        console.error('[useGoLiveFlow] Profile incomplete:', {
          id: profile?.id,
          username: profile?.username,
          role: profile?.role,
        })
        return null
      }

      try {
        const tokenData = await getLiveKitToken(streamId, allowPublish)
        console.log(`[useGoLiveFlow] Token obtained: allowPublish=${tokenData.allowPublish} room=${tokenData.room}`)
        return tokenData
      } catch (err: any) {
        console.error('[useGoLiveFlow] Token request failed:', err.message)
        setError(err.message || 'Failed to get token')
        return null
      }
    },
    [user, profile]
  )

  const connectToRoom = useCallback(
    async (streamId: string, allowPublish: boolean, providedToken?: LiveKitTokenResponse) => {
      console.log(`[useGoLiveFlow] connectToRoom called: streamId=${streamId} allowPublish=${allowPublish} state=${connectionState} tokenProvided=${Boolean(providedToken)}`)
      
      if (connectionState === 'connecting' || connectionState === 'connected' || connectionState === 'publishing') {
        console.warn('[useGoLiveFlow] Already connecting or connected')
        return roomRef.current
      }

      setConnectionState('connecting')
      setError(null)

      try {
        const tokenData = providedToken ?? (await getToken(streamId, allowPublish))
        
        if (!tokenData) {
          console.error('[useGoLiveFlow] Failed to get token')
          setConnectionState('error')
          return null
        }

        console.log(`[useGoLiveFlow] Token received - allowPublish=${tokenData.allowPublish} room=${tokenData.room}`)

        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
          stopLocalTrackOnUnpublish: true,
        })

        newRoom.on(RoomEvent.Connected, () => {
          console.log(`[useGoLiveFlow] ✅ Room connected: ${streamId}`)
          setConnectionState('connected')
        })

        newRoom.on(RoomEvent.Disconnected, () => {
          console.log('[useGoLiveFlow] Room disconnected')
          setConnectionState('idle')
        })

        newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
          console.log(`[useGoLiveFlow] Participant connected: ${participant.identity}`)
        })

        console.log(`[useGoLiveFlow] Connecting to LiveKit URL: ${tokenData.livekitUrl || import.meta.env.VITE_LIVEKIT_URL}`)
        await newRoom.connect(tokenData.livekitUrl || import.meta.env.VITE_LIVEKIT_URL, tokenData.token)
        setConnectionState('connected')

        roomRef.current = newRoom
        setRoom(newRoom)
        
        console.log('[useGoLiveFlow] Room connection established')
        console.log('[useGoLiveFlow] Room state after connect:', {
          roomState: newRoom.state,
          localParticipantId: newRoom.localParticipant?.identity,
          isCameraEnabled: newRoom.localParticipant?.isCameraEnabled,
          isMicrophoneEnabled: newRoom.localParticipant?.isMicrophoneEnabled,
        })
        return newRoom
      } catch (err: any) {
        console.error('[useGoLiveFlow] Room connection failed:', err.message || err)
        setConnectionState('error')
        setError(err.message || 'Failed to connect to room')
        return null
      }
    },
    [getToken, connectionState]
  )

  const requestPermissions = useCallback(async () => {
    setPermissionState('requesting')
    setError(null)
    console.log('[useGoLiveFlow] Requesting camera and microphone permissions...')

      try {
      console.log('[useGoLiveFlow] Calling getUserMedia with video=true, audio=true')
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      const videoTracks = mediaStream.getVideoTracks()
      const audioTracks = mediaStream.getAudioTracks()
      
      console.log(`[useGoLiveFlow] ✅ Permissions granted - video=${videoTracks.length} audio=${audioTracks.length}`)
      
      setLocalStream(mediaStream)
      setPermissionState('granted')
      return mediaStream
    } catch (err: any) {
      console.error('[useGoLiveFlow] ❌ Permission request failed:', err.name, err.message)
      setPermissionState('denied')
      setError('Camera/Microphone blocked. Please enable permissions and try again.')
      return null
    }
  }, [])

  const publishTracks = useCallback(
    async (stream?: MediaStream) => {
      const activeStream = stream ?? localStream
      const currentRoom = roomRef.current
      console.log(
        `[useGoLiveFlow] publishTracks called - room=${!!currentRoom} stream=${!!activeStream} state=${connectionState}`
      )

      if (!currentRoom) {
        const err = 'Room not connected'
        console.error('[useGoLiveFlow]', err)
        setError(err)
        return false
      }

      if (!activeStream) {
        const err = 'Camera and microphone not enabled'
        console.error('[useGoLiveFlow]', err)
        setError(err)
        return false
      }

      const roomState = currentRoom.state
      if (roomState !== ConnectionState.Connected) {
        const err = `Not connected to room - roomState=${roomState} state=${connectionState}`
        console.error('[useGoLiveFlow]', err)
        setError(err)
        return false
      }

      try {
        setConnectionState('publishing')
        console.log('[useGoLiveFlow] Starting track publishing...')

        const videoTrack = activeStream.getVideoTracks()[0]
        const audioTrack = activeStream.getAudioTracks()[0]

        console.log(`[useGoLiveFlow] Available tracks - video=${!!videoTrack} audio=${!!audioTrack}`)

        if (!videoTrack || !audioTrack) {
          throw new Error('Missing video or audio track')
        }

        console.log('[useGoLiveFlow] Publishing video track...')
        await currentRoom.localParticipant.publishTrack(videoTrack, {
          name: 'camera',
          source: Track.Source.Camera,
        })

        console.log('[useGoLiveFlow] Publishing audio track...')
        console.log('[useGoLiveFlow] Audio Track Diagnostics:', {
          readyState: audioTrack.readyState,
          enabled: audioTrack.enabled,
          muted: audioTrack.muted,
          settings: audioTrack.getSettings()
        });

        await currentRoom.localParticipant.publishTrack(audioTrack, {
          name: 'microphone',
          source: Track.Source.Microphone,
        })

        localTracksRef.current = [videoTrack, audioTrack]

        console.log(`[useGoLiveFlow] ✅ Successfully published ${localTracksRef.current.length} tracks`)
        setConnectionState('connected')

        return true
      } catch (err: any) {
        console.error('[useGoLiveFlow] Track publish failed:', err.message || err)
        setConnectionState('error')
        setError(err.message || 'Failed to publish tracks')
        return false
      }
  }, [roomRef, localStream, connectionState])

  const initializeGoLive = useCallback(
    async (config: StreamConfig) => {
      console.log(`[useGoLiveFlow] initializeGoLive: category=${config.category} title=${config.title}`)
      
      try {
        if (!profile?.is_broadcaster && !profile?.is_admin) {
          const err = 'You are not approved to broadcast'
          console.error('[useGoLiveFlow]', err)
          setError(err)
          return null
        }

        if (config.category === 'Officer Stream' && !profile?.is_troll_officer && !profile?.is_admin) {
          const err = 'Only officers and admins can start officer streams'
          console.error('[useGoLiveFlow]', err)
          setError(err)
          return null
        }

        console.log('[useGoLiveFlow] Creating stream record...')
        const newStream = await createStreamRecord(config)
        if (!newStream) {
          console.error('[useGoLiveFlow] Failed to create stream')
          return null
        }

        console.log(`[useGoLiveFlow] Stream created: ${newStream.id}`)

        return newStream
      } catch (err: any) {
        console.error('[useGoLiveFlow] initializeGoLive error:', err.message || err)
        setError(err.message || 'Failed to initialize go live')
        return null
      }
    },
    [profile, createStreamRecord]
  )

  const finishGoingLive = useCallback(async (streamIdOverride?: string) => {
    const targetStreamId = streamIdOverride || stream?.id
    console.log(`[useGoLiveFlow] finishGoingLive called - stream=${targetStreamId}`)
    
    if (!targetStreamId) {
      const err = 'Stream not initialized'
      console.error('[useGoLiveFlow]', err)
      setError(err)
      return false
    }

    try {

      console.log('[useGoLiveFlow] Enabling camera and microphone via LiveKit...')
      try {
        if (roomRef.current?.localParticipant?.enableCameraAndMicrophone) {
          await roomRef.current.localParticipant.enableCameraAndMicrophone()
          console.log('[useGoLiveFlow] ✅ Camera and microphone enabled via LiveKit')
        } else {
          console.log('[useGoLiveFlow] enableCameraAndMicrophone not available, publishing tracks manually...')
          const publishSuccess = await publishTracks()
          if (!publishSuccess) {
            console.error('[useGoLiveFlow] Failed to publish tracks')
            return false
          }
        }
      } catch (enableErr: any) {
        console.warn('[useGoLiveFlow] enableCameraAndMicrophone failed, trying manual publish:', enableErr.message)
        const publishSuccess = await publishTracks()
        if (!publishSuccess) {
          console.error('[useGoLiveFlow] Manual track publishing also failed')
          return false
        }
      }

      const r = targetStreamId
      console.log(`[useGoLiveFlow] Updating stream ${r} status to live...`)
      const { error: updateError } = await supabase
        .from('streams')
        .update({
          is_live: true,
          status: 'live',
          start_time: new Date().toISOString(),
        })
        .eq('id', r)

      if (updateError) {
        console.error('[useGoLiveFlow] Stream update failed:', updateError)
        setError('Failed to update stream status')
        return false
      }

      console.log(`[useGoLiveFlow] ✅ Stream ${r} is now live`)
            
            // Auto-track family task: Host a Clan Stream
            if (user?.id) {
              supabase.rpc('track_family_event', { 
                p_user_id: user.id, 
                p_metric: 'streams_started', 
                p_increment: 1 
              }).then(({ error }) => {
                if (error) console.error('Error tracking family stream task:', error)
              })
            }

            toast.success('You are live!')
      return true
    } catch (err: any) {
      console.error('[useGoLiveFlow] finishGoingLive error:', err.message || err)
      setError(err.message || 'Failed to finish going live')
      return false
    }
  }, [stream, publishTracks])

  const disconnect = useCallback(() => {
    localTracksRef.current.forEach((track) => track.stop?.())
    localTracksRef.current = []
    localStream?.getTracks().forEach((track) => track.stop())
    setLocalStream(null)
    roomRef.current?.disconnect()
    roomRef.current = null
    setRoom(null)
    setConnectionState('idle')
    console.log('[useGoLiveFlow] Disconnected')
  }, [localStream])

  return {
    stream,
    room,
    connectionState,
    permissionState,
    localStream,
    error,
    createStreamRecord,
    getToken,
    connectToRoom,
    requestPermissions,
    publishTracks,
    initializeGoLive,
    finishGoingLive,
    disconnect,
  }
}


