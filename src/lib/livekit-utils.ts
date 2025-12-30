import { supabase } from './supabase'
import { useAuthStore } from './store'
import api, { API_ENDPOINTS } from './api'

export interface LiveKitTokenResponse {
  token: string
  livekitUrl: string
  room: string
  identity: string
  allowPublish: boolean
}

export async function getLiveKitToken(
  roomName: string,
  allowPublish: boolean
): Promise<LiveKitTokenResponse> {
  const { user, profile } = useAuthStore.getState()

  if (!user) {
    throw new Error('User not authenticated')
  }

  if (!profile?.id || !profile?.username || !profile?.role) {
    console.error('[getLiveKitToken] Profile incomplete:', {
      id: profile?.id,
      username: profile?.username,
      role: profile?.role,
    })
    throw new Error('Profile not fully loaded. Required: id, username, role')
  }

  try {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token

    if (!token) {
      throw new Error('No auth token available')
    }

    const body = {
      roomName,
      participantName: profile.username,
      allowPublish,
      level: profile.level || 1,
      user_id: profile.id,
      username: profile.username,
      role: profile.role,
    }

    const response = await api.post<LiveKitTokenResponse>(API_ENDPOINTS.livekit.token, body)

    if (!response || !response.token) {
      console.error('[getLiveKitToken] Token request failed:', response)
      throw new Error(response?.error || 'Failed to fetch LiveKit token')
    }

    console.log('[getLiveKitToken] Token obtained', {
      room: response.room,
      allowPublish: response.allowPublish,
      identity: response.identity,
    })

    return response
  } catch (err: any) {
    console.error('[getLiveKitToken] Fatal error:', err.message)
    throw err
  }
}
