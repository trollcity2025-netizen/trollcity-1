import { supabase } from './supabase'
import { useAuthStore } from './store'

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

    const response = await fetch('/api/livekit-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        roomName,
        participantName: profile.username,
        allowPublish,
        level: profile.level || 1,
        user_id: profile.id,
        username: profile.username,
        role: profile.role,
      }),
    })

    const responseText = await response.text()
    if (!response.ok) {
      let errorData: any = null
      if (responseText) {
        try {
          errorData = JSON.parse(responseText)
        } catch {
          //
        }
      }

      console.error('[getLiveKitToken] Token request failed:', errorData || responseText)
      throw new Error(
        errorData?.error ||
          errorData?.message ||
          `Token request failed: ${response.status}`
      )
    }

    let data: LiveKitTokenResponse
    try {
      data = responseText ? JSON.parse(responseText) : ({} as LiveKitTokenResponse)
    } catch (parseErr) {
      console.error('[getLiveKitToken] Token parse failed:', parseErr)
      throw new Error('Token response was not valid JSON')
    }

    console.log('[getLiveKitToken] ✅ Token obtained', {
      room: data.room,
      allowPublish: data.allowPublish,
      identity: data.identity,
    })

    return data
  } catch (err: any) {
    console.error('[getLiveKitToken] Fatal error:', err.message)
    throw err
  }
}
