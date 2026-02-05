import { supabase } from './supabase'

export interface StartCourtSessionParams {
  sessionId: string
  maxBoxes: number
  roomName: string
  userId: string
  defendantId?: string
}

export interface CourtSessionData {
  id: string
  sessionId: string
  maxBoxes: number
  roomName: string
  status: 'active'
  created_at: string
  startedAt: string
  defendantId?: string
  hls_url?: string
}

export async function startCourtSession(params: StartCourtSessionParams): Promise<{ data: CourtSessionData | null, error: any }> {
  try {
    const { sessionId, maxBoxes, roomName, userId, defendantId } = params
    const now = new Date().toISOString()

    let safeDefendantId: string | null = null
    if (defendantId) {
      const { data: defendantProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', defendantId)
        .maybeSingle()

      if (defendantProfile?.id) {
        safeDefendantId = defendantProfile.id
      }
    }

    // Prevent starting a second active/live session
    const { data: existingActive } = await supabase
      .from('court_sessions')
      .select('*')
      .in('status', ['active', 'live'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingActive) {
      return {
        data: null,
        error: new Error('A court session is already active')
      }
    }

    // Reuse the waiting slot whenever one exists instead of inserting a conflicting row
    const { data: waitingSession, error: waitingError } = await supabase
      .from('court_sessions')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (waitingError) {
      console.error('Error checking waiting court session:', waitingError)
      return { data: null, error: waitingError }
    }

    const targetId = waitingSession ? waitingSession.id : sessionId

    const payload = {
      status: 'active',
      started_by: userId,
      started_at: now,
      updated_at: now,
      max_boxes: maxBoxes,
      room_name: roomName,
      defendant_id: safeDefendantId,
      hls_url: `https://cdn.maitrollcity.com/streams/${targetId}.m3u8`
    }

    const updateOrInsert = waitingSession
      ? await supabase
          .from('court_sessions')
          .update(payload)
          .eq('id', waitingSession.id)
          .select('*')
          .single()
      : await supabase
          .from('court_sessions')
          .insert({
            id: sessionId,
            session_id: sessionId,
            created_at: now,
            ...payload
          })
          .select('*')
          .single()

    if (updateOrInsert.error) {
      console.error('Error creating court session:', updateOrInsert.error)
      return { data: null, error: updateOrInsert.error }
    }

    const data = updateOrInsert.data
    return {
      data: {
        id: data.id,
        sessionId: data.session_id || data.id,
        maxBoxes: data.max_boxes,
        roomName: data.room_name,
        status: data.status,
        created_at: data.created_at,
        startedAt: data.started_at,
        defendantId: data.defendant_id,
        hls_url: data.hls_url
      },
      error: null
    }
  } catch (err) {
    console.error('Error in startCourtSession:', err)
    return { data: null, error: err }
  }
}
