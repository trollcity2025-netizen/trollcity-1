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

export interface LiveKitDiagnosticResult {
  success: boolean
  error?: string
  details?: {
    environmentCheck: {
      hasEnvVars: boolean
      livekitUrl?: string
    }
    sessionCheck: {
      hasSession: boolean
      userId?: string
    }
    tokenGeneration: {
      success: boolean
      tokenLength?: number
      error?: string
    }
    connectivityCheck: {
      canConnect: boolean
      error?: string
    }
  }
}

// Diagnostic function to check LiveKit setup and connectivity
export async function diagnoseLiveKitConnection(): Promise<LiveKitDiagnosticResult> {
  const details: LiveKitDiagnosticResult['details'] = {
    environmentCheck: { hasEnvVars: false },
    sessionCheck: { hasSession: false },
    tokenGeneration: { success: false },
    connectivityCheck: { canConnect: false }
  }

  try {
    // 1. Check environment variables
    const livekitUrl = import.meta.env.VITE_LIVEKIT_URL || (import.meta.env as any).VITE_LIVEKIT_CLOUD_URL
    details.environmentCheck = {
      hasEnvVars: !!livekitUrl,
      livekitUrl
    }

    if (!livekitUrl) {
      return {
        success: false,
        error: 'LiveKit URL not configured. Please set VITE_LIVEKIT_URL or VITE_LIVEKIT_CLOUD_URL environment variables.',
        details
      }
    }

    // 2. Check session
    const { user, profile } = useAuthStore.getState()
    if (!user || !profile) {
      return {
        success: false,
        error: 'User not authenticated. Please sign in first.',
        details: {
          ...details,
          sessionCheck: { hasSession: false }
        }
      }
    }

    details.sessionCheck = {
      hasSession: true,
      userId: user.id
    }

    // 3. Test token generation
    try {
      const testToken = await getLiveKitToken(`diagnostic-test-${Date.now()}`, false)
      details.tokenGeneration = {
        success: true,
        tokenLength: testToken.token.length
      }
    } catch (tokenError: any) {
      details.tokenGeneration = {
        success: false,
        error: tokenError?.message || 'Token generation failed'
      }
      
      return {
        success: false,
        error: `Token generation failed: ${tokenError?.message || 'Unknown error'}`,
        details
      }
    }

    // 4. Basic connectivity check (ping the LiveKit URL)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(livekitUrl.replace('wss://', 'https://').replace('/ws', '/health'), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      clearTimeout(timeoutId)
      
      details.connectivityCheck = {
        canConnect: response.ok || response.status === 404 // 404 is ok for health endpoint
      }
    } catch (connectError: any) {
      details.connectivityCheck = {
        canConnect: false,
        error: connectError?.message || 'Connection failed'
      }
      
      // Don't fail the whole diagnostic for connectivity issues
      console.warn('[LiveKit Diagnostic] Connectivity check failed:', connectError?.message)
    }

    return {
      success: true,
      details
    }

  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Diagnostic failed',
      details
    }
  }
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

    if (!response.success || !response.data) {
      console.error('[getLiveKitToken] Token request failed:', response)
      throw new Error(response.error || 'Failed to fetch LiveKit token')
    }

    const tokenData = response.data
    console.log('[getLiveKitToken] Token obtained', {
      room: tokenData.room,
      allowPublish: tokenData.allowPublish,
      identity: tokenData.identity,
    })

    return tokenData
  } catch (err: any) {
    console.error('[getLiveKitToken] Fatal error:', err.message)
    throw err
  }
}
