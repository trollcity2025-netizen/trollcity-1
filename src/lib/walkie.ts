import { supabase } from './supabase'

export type WalkieSessionType = 'standard' | 'bug'
export type WalkieSessionStatus = 'active' | 'ended'
export type PagingRequestStatus = 'pending' | 'accepted' | 'declined' | 'missed' | 'expired'

export interface WalkieSession {
  id: string
  created_at: string
  type: WalkieSessionType
  status: WalkieSessionStatus
  created_by: string
  participants: string[] // User IDs
  bug_report_id?: string
}

export interface PagingRequest {
  id: string
  created_at: string
  sender_id: string
  receiver_id: string
  type: WalkieSessionType
  status: PagingRequestStatus
  metadata: Record<string, any>
  session_id?: string
}

export const walkieApi = {
  // Send a page
  sendPage: async (targetUserId: string, type: WalkieSessionType, bugMetadata: any = {}) => {
    const { data, error } = await supabase.rpc('send_walkie_page', {
      target_user_id: targetUserId,
      page_type: type,
      bug_metadata: bugMetadata
    })

    if (error) throw error
    return data
  },

  // Respond to a page
  respondToPage: async (pageId: string, response: 'accepted' | 'declined') => {
    const { data, error } = await supabase.rpc('respond_to_walkie_page', {
      page_id: pageId,
      response
    })

    if (error) throw error
    return data
  },

  // Get active pages for user
  subscribeToPages: (userId: string, callback: (payload: any) => void) => {
    return supabase
      .channel('walkie_pages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'walkie_paging_requests',
          filter: `receiver_id=eq.${userId}`
        },
        callback
      )
      .subscribe()
  },

  // Subscribe to session updates (e.g. ended)
  subscribeToSession: (sessionId: string, callback: (payload: any) => void) => {
    return supabase
      .channel(`walkie_session:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'walkie_sessions',
          filter: `id=eq.${sessionId}`
        },
        callback
      )
      .subscribe()
  },

  // Fetch active session if any
  getActiveSession: async () => {
    // This is tricky because we need to check if user is in participants array.
    // RLS handles visibility, so we can just query for active sessions.
    const { data, error } = await supabase
      .from('walkie_sessions')
      .select('*')
      .eq('status', 'active')
      .limit(1) // Assuming one active session at a time for simplicity as per requirement "Single Walkie system"
    
    if (error) throw error
    return data?.[0] as WalkieSession | undefined
  },

  // Get pending pages
  getPendingPages: async () => {
    // Cannot select related sender details directly if foreign key is not detected by PostgREST cache
    // Fallback: Fetch requests first, then fetch sender profiles manually
    const { data: requests, error } = await supabase
      .from('walkie_paging_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    if (!requests || requests.length === 0) return []

    // Fetch sender profiles
    const senderIds = [...new Set(requests.map((r: any) => r.sender_id))]
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, username, role, is_admin, is_lead_officer, is_troll_officer')
      .in('id', senderIds)

    if (profilesError) throw profilesError
    
    // Map profiles to requests
    const profileMap = new Map(profiles?.map(p => [p.id, p]))
    
    return requests.map((r: any) => ({
      ...r,
      sender: profileMap.get(r.sender_id) || { username: 'Unknown' }
    }))
  },

  // End session
  endSession: async (sessionId: string) => {
    const { error } = await supabase
      .from('walkie_sessions')
      .update({ status: 'ended' })
      .eq('id', sessionId)
    
    if (error) throw error
  },

  // Get Walkie LiveKit Token
  getWalkieToken: async (channelId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')

    const res = await fetch('/api/livekit-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ 
        room: channelId,
        allowPublish: true
      })
    })

    if (!res.ok) {
      let err;
      try {
        err = await res.json()
      } catch {
        err = { error: `Request failed with status ${res.status}` }
      }
      throw new Error(err.error || 'Failed to get walkie token')
    }

    return await res.json()
  }
}
