import { supabase } from './supabase'

export interface StartCourtSessionParams {
  sessionId: string
  maxBoxes: number
  roomName: string
  userId: string
}

export interface CourtSessionData {
  id: string
  sessionId: string
  maxBoxes: number
  roomName: string
  status: 'active'
  created_at: string
  startedAt: string
}

export async function startCourtSession(params: StartCourtSessionParams): Promise<{ data: CourtSessionData | null, error: any }> {
  try {
    const { sessionId, maxBoxes, roomName, userId } = params

    // First, check if there's already an active session
    const { data: existingSession } = await supabase
      .from('court_sessions')
      .select('*')
      .eq('status', 'active')
      .maybeSingle()

    if (existingSession) {
      return {
        data: null,
        error: new Error('A court session is already active')
      }
    }

    // Create new court session
    const { data, error } = await supabase
      .from('court_sessions')
      .insert({
        id: sessionId,
        session_id: sessionId,
        max_boxes: maxBoxes,
        room_name: roomName,
        status: 'active',
        started_by: userId,
        created_at: new Date().toISOString(),
        started_at: new Date().toISOString()
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating court session:', error)
      return { data: null, error }
    }

    return {
      data: {
        id: data.id,
        sessionId: data.session_id,
        maxBoxes: data.max_boxes,
        roomName: data.room_name,
        status: 'active',
        created_at: data.created_at,
        startedAt: data.started_at
      },
      error: null
    }
  } catch (err) {
    console.error('Error in startCourtSession:', err)
    return { data: null, error: err }
  }
}