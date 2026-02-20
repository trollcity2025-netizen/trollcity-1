import { supabase } from './supabase'
import { getHlsUrl } from './hls'

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
      hls_url: getHlsUrl(targetId)
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

    const data = updateOrInsert.data;

    // Create Mux stream for the session
    try {
      const muxRes: any = await supabase.functions.invoke('mux-create', {
        method: 'POST',
        body: JSON.stringify({ stream_id: data.id }),
      });

      if (muxRes.error) throw new Error(muxRes.error.message);

      const muxData = muxRes?.data || muxRes;
      const playbackId = muxData?.playback_id || null;
      if (!playbackId) throw new Error('mux-create did not return playback_id');

      // Update the session with Mux data
      const { data: finalData, error: muxUpdateError } = await supabase
        .from('court_sessions')
        .update({
          mux_playback_id: playbackId,
          mux_stream_key: muxData.stream_key || null,
        })
        .eq('id', data.id)
        .select()
        .single();

      if (muxUpdateError) throw muxUpdateError;

      return {
        data: {
          id: finalData.id,
          sessionId: finalData.session_id || finalData.id,
          maxBoxes: finalData.max_boxes,
          roomName: finalData.room_name,
          status: finalData.status,
          created_at: finalData.created_at,
          startedAt: finalData.started_at,
          defendantId: finalData.defendant_id,
          hls_url: finalData.hls_url,
          mux_playback_id: finalData.mux_playback_id,
        },
        error: null,
      };
    } catch (muxError) {
      console.error('Error creating Mux stream for court session:', muxError);
      // If Mux fails, the session is still created but won't be viewable by the public.
      // We can return the session data without the Mux info.
      return { data: {
        id: data.id,
        sessionId: data.session_id || data.id,
        maxBoxes: data.max_boxes,
        roomName: data.room_name,
        status: data.status,
        created_at: data.created_at,
        startedAt: data.started_at,
        defendantId: data.defendant_id,
        hls_url: data.hls_url
      }, error: muxError };
    }
  } catch (err) {
    console.error('Error in startCourtSession:', err)
    return { data: null, error: err }
  }
}
