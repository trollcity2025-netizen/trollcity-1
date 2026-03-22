import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';

export interface SeatSession {
  id: string; // session_id
  seat_index: number;
  user_id: string;
  guest_id?: string; // For guest users (TC-xxxx)
  user_profile?: {
    username: string;
    avatar_url: string;
    is_gold?: boolean;
    rgb_username_expires_at?: string;
    glowing_username_color?: string;
    role?: string;
    troll_coins?: number;
    trollmonds_balance?: number;
    troll_role?: string;
    created_at?: string;
  };
  status: 'active' | 'left' | 'kicked';
  joined_at: string;
}

export function useStreamSeats(streamId: string | undefined, userId?: string, broadcasterProfile?: any, streamData?: any) {
  const [seats, setSeats] = useState<Record<number, SeatSession>>({});
  const { user, profile } = useAuthStore();
  const [mySession, setMySession] = useState<SeatSession | null>(null);
  
  // For instant seat removal when LiveKit participant disconnects
  // This is called from BroadcastPage when a participantDisconnected event fires
  const handleParticipantDisconnected = useCallback((participantIdentity: string) => {
    // Find the seat with this guest_id or user_id and remove it instantly
    setSeats(prev => {
      const next = { ...prev };
      let found = false;
      Object.keys(next).forEach(key => {
        const seat = next[Number(key)];
        if (seat?.guest_id === participantIdentity || seat?.user_id === participantIdentity) {
          delete next[Number(key)];
          found = true;
        }
      });
      if (found) {
        console.log('[useStreamSeats] Instantly removed seat for disconnected participant:', participantIdentity);
      }
      return next;
    });
  }, []);

  // Use passed userId or fall back to auth user id
  const effectiveUserId = userId || user?.id;

  // Keep user id in a ref so fetchSeats doesn't need to change identity when userId changes
  const effectiveUserIdRef = useRef<string | undefined>(effectiveUserId);
  useEffect(() => {
    effectiveUserIdRef.current = effectiveUserId;
  }, [effectiveUserId]);

  // Prevent overlapping fetches (realtime bursts + polling)
  const isFetchingRef = useRef(false);

  const fetchSeats = useCallback(async () => {
    if (!streamId) return;
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    try {
      // Use RPC to bypass RLS and ensure visibility
      const { data, error } = await supabase.rpc('get_stream_seats', {
        p_stream_id: streamId,
      });

      if (error) {
        console.error('[useStreamSeats] Error fetching seats:', error);
        return;
      }

      const seatMap: Record<number, SeatSession> = {};
      let mySess: SeatSession | null = null;

      const uid = effectiveUserIdRef.current;

      data?.forEach((s: any) => {
        const idx = Number(s.seat_index);

        // Reconstruct user_profile structure to match interface
        const userProfile = {
          username: s.username,
          avatar_url: s.avatar_url,
          is_gold: s.is_gold,
          rgb_username_expires_at: s.rgb_username_expires_at,
          glowing_username_color: s.glowing_username_color,
          role: s.role,
          troll_coins: Number(s.troll_coins || 0),
          trollmonds_balance: Number(s.trollmonds_balance || 0),
          troll_role: s.troll_role,
          created_at: s.created_at,
        };

        seatMap[idx] = {
          id: s.id,
          seat_index: idx,
          user_id: s.user_id,
          guest_id: s.guest_id, // Include guest_id for guest users
          user_profile: userProfile,
          status: s.status,
          joined_at: s.joined_at,
        };

        if (uid && (s.user_id === uid || s.guest_id === uid)) {
          mySess = seatMap[idx];
        }
      });

      setSeats(seatMap);
      setMySession(mySess);
    } catch (e) {
      console.error('[useStreamSeats] fetchSeats failed:', e);
    } finally {
      isFetchingRef.current = false;
    }
  }, [streamId]);

  useEffect(() => {
    // Don't create timers/channels until we have a streamId
    if (!streamId) return;

    fetchSeats();

    // Polling fallback to ensure consistency even if Realtime fails
    // Reduced to 3 seconds for faster seat updates (guest leaving shows instantly)
    const interval = setInterval(fetchSeats, 3000);

    const channel = supabase
      .channel(`seats:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_seat_sessions',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          console.log('[useStreamSeats] Realtime update received:', payload);
          // Always rely on server truth via RPC
          fetchSeats();
        }
      )
      // Also listen for stream updates (box_count changes, status changes)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          console.log('[useStreamSeats] Stream update received:', payload);
          // Re-fetch seats when stream config changes
          fetchSeats();
          
          // If stream ended, automatically leave seat for stage users
          if (payload.new?.status === 'ended' && mySession) {
            console.log('[useStreamSeats] Stream ended, auto-leaving seat');
            leaveSeat();
          }
        }
      )
      .subscribe((status) => {
        console.log('[useStreamSeats] Channel subscription status:', status);
      });

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [streamId, fetchSeats, mySession]);

  // Cleanup effect: leave seat when component unmounts or stream ends
  useEffect(() => {
    return () => {
      // Only leave seat if we have an active session and stream is ending
      if (mySession && streamData?.status === 'ended') {
        console.log('[useStreamSeats] Cleanup: leaving seat due to stream end');
        leaveSeat();
      }
    };
  }, [mySession, streamData?.status]);

  // Effect to handle stream end - remove all stage users
  useEffect(() => {
    if (streamData?.status === 'ended') {
      console.log('[useStreamSeats] Stream ended, cleaning up all seats');
      
      // Clear local seats state immediately
      setSeats({});
      setMySession(null);
      
      // Call RPC to leave seat if user had a session
      if (mySession?.id) {
        supabase.rpc('leave_seat_atomic', {
          p_session_id: mySession.id,
        }).then(({ error }) => {
          if (error) {
            console.warn('[useStreamSeats] Error leaving seat on stream end:', error);
          } else {
            console.log('[useStreamSeats] Successfully left seat on stream end');
          }
        });
      }
    }
  }, [streamData?.status, mySession?.id]);

  // Listen for balance update events to refresh seat data
  // This ensures all participants see updated balances when gifts are sent/received
  // Note: The existing 10-second polling will handle most updates - this is backup
  useEffect(() => {
    const handleBalanceUpdate = () => {
      console.log('[useStreamSeats] 💰 Balance update detected');
      // Use the existing polling mechanism - don't force immediate refresh
      // to avoid causing full page reloads
    };
    
    const handleBroadcastBalanceUpdate = (event: Event) => {
      console.log('[useStreamSeats] 🎁 Received broadcast-balance-update');
      // Rely on existing polling for seat data - 10 second intervals
      // This prevents full page reloads while still keeping balances updated
    };
    
    window.addEventListener('refresh-seat-balances', handleBalanceUpdate);
    window.addEventListener('broadcast-balance-update', handleBroadcastBalanceUpdate);
    
    return () => {
      window.removeEventListener('refresh-seat-balances', handleBalanceUpdate);
      window.removeEventListener('broadcast-balance-update', handleBroadcastBalanceUpdate);
    };
  }, []);

  const joinSeat = async (seatIndex: number, price: number) => {
    if (!effectiveUserId || !streamId) return false;

    // OPTIMIZED: Check both existing session AND target seat in parallel
    const [existingSessionResult, targetSeatResult] = await Promise.all([
      // Check if user already has a seat
      supabase
        .from('stream_seat_sessions')
        .select('id, seat_index, user_id, guest_id, status')
        .eq('stream_id', streamId)
        .eq('status', 'active')
        .or(`user_id.eq.${effectiveUserId},guest_id.eq.${effectiveUserId}`)
        .maybeSingle(),
      // Check if target seat is occupied
      supabase
        .from('stream_seat_sessions')
        .select('id, user_id, guest_id, status')
        .eq('stream_id', streamId)
        .eq('seat_index', seatIndex)
        .eq('status', 'active')
        .maybeSingle()
    ]);

    const existingSession = existingSessionResult.data;
    const targetSeat = targetSeatResult.data;

    if (existingSession) {
      console.log('[useStreamSeats] User already has a seat, using existing session:', existingSession.id);
      // User already has a seat - update local state to trigger LiveKit connection
      const newSession: SeatSession = {
        id: existingSession.id,
        seat_index: existingSession.seat_index,
        user_id: existingSession.user_id,
        guest_id: existingSession.guest_id,
        user_profile: profile ? { username: profile.username || 'Guest', avatar_url: profile.avatar_url || '' } : undefined,
        status: 'active',
        joined_at: new Date().toISOString()
      };
      setMySession(newSession);
      setSeats(prev => ({ ...prev, [existingSession.seat_index]: newSession }));
      toast.success('Joined seat!');
      return true;
    }

    if (targetSeat) {
      // Seat is already occupied - check if it's by a guest
      if (targetSeat.guest_id && targetSeat.guest_id !== effectiveUserId) {
        // This seat is occupied by a guest (not the current user)
        // Prevent broadcaster from moving the guest
        toast.error("Cannot move a guest who has already taken a seat");
        return false;
      }
    }

    // Check if seats are locked
    if (streamData?.are_seats_locked) {
      toast.error("Seats are currently locked");
      return false;
    }

    // Check Restrictions
    if (profile?.live_restricted_until) {
        const restrictedUntil = new Date(profile.live_restricted_until);
        if (restrictedUntil > new Date()) {
             // User is restricted. Check if broadcaster is Admin/Role (exempt).
             const isBroadcasterSpecial = broadcasterProfile?.is_admin || 
                                         broadcasterProfile?.role === 'admin' || 
                                         broadcasterProfile?.role === 'lead_troll_officer' || 
                                         ['admin', 'moderator', 'lead_officer', 'owner'].includes(broadcasterProfile?.role || '');
    
            if (!isBroadcasterSpecial) {
                 toast.error("You are restricted from joining seats (Broadcast Restriction Active)");
                 return false;
            }
        }
    }

    // Prevent concurrent join requests
    if (joinSeat.isRunning) {
      console.log('[useStreamSeats] Join already in progress, skipping');
      return false;
    }
    joinSeat.isRunning = true;

    try {
      const isGuest = effectiveUserId.startsWith('TC-');
      const payload = {
        p_stream_id: streamId,
        p_seat_index: seatIndex,
        p_price: price,
        p_user_id: isGuest ? null : effectiveUserId,
        p_guest_id: isGuest ? effectiveUserId : null
      };

      const { data: result, error } = await supabase.rpc('join_seat_atomic', payload);

      if (error) {
        console.warn('[useStreamSeats] join_seat_atomic RPC error:', error);
        // Try direct insert as fallback
        const { error: insertError } = await supabase.from('stream_seat_sessions').insert({
          stream_id: streamId,
          seat_index: seatIndex,
          user_id: isGuest ? null : effectiveUserId,
          guest_id: isGuest ? effectiveUserId : null,
          status: 'active',
          joined_at: new Date().toISOString()
        });
        
        if (insertError) {
          throw insertError;
        }
        toast.success('Joined seat!');
        
        // IMMEDIATELY update local state to reflect seat ownership
        // This triggers LiveKit initialization without waiting for polling
        const newSession: SeatSession = {
          id: `temp-${Date.now()}`,
          seat_index: seatIndex,
          user_id: isGuest ? null : effectiveUserId,
          guest_id: isGuest ? effectiveUserId : null,
          user_profile: profile ? { username: profile.username || 'Guest', avatar_url: profile.avatar_url || '' } : undefined,
          status: 'active',
          joined_at: new Date().toISOString()
        };
        setMySession(newSession);
        setSeats(prev => ({ ...prev, [seatIndex]: newSession }));
        
        return true;
      }

      // Handle RPC returning table (array) or object
      const data = Array.isArray(result) ? result[0] : result;

      if (!data || !data.success) throw new Error(data?.message || 'Failed to join seat');

      toast.success('Joined seat!');
      
      // IMMEDIATELY update local state to reflect seat ownership
      // This triggers LiveKit initialization without waiting for polling
      const newSession: SeatSession = {
        id: data.session_id || `temp-${Date.now()}`,
        seat_index: seatIndex,
        user_id: isGuest ? null : effectiveUserId,
        guest_id: isGuest ? effectiveUserId : null,
        user_profile: profile ? { username: profile.username || 'Guest', avatar_url: profile.avatar_url || '' } : undefined,
        status: 'active',
        joined_at: new Date().toISOString()
      };
      setMySession(newSession);
      setSeats(prev => ({ ...prev, [seatIndex]: newSession }));
      
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to join seat');
      return false;
    } finally {
      joinSeat.isRunning = false;
    }
  };
  
  // Add static properties for concurrency control
  joinSeat.isRunning = false;

  const leaveSeat = async () => {
    if (!mySession) return;

    // Prevent concurrent leave requests
    if (leaveSeat.isRunning) {
      console.log('[useStreamSeats] Leave already in progress, skipping');
      return;
    }
    leaveSeat.isRunning = true;

    // Capture session data before clearing
    const sessionId = mySession.id;
    const seatIndex = mySession.seat_index;
    
    // IMMEDIATELY clear local state so UI updates instantly
    // This prevents the "shows on viewer side" issue
    setMySession(null);
    setSeats(prev => {
      const next = { ...prev };
      delete next[seatIndex];
      return next;
    });

    try {
      // First, try to update the session status directly (more reliable than atomic)
      const { error: updateError } = await supabase
        .from('stream_seat_sessions')
        .update({ status: 'left', left_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('status', 'active');

      if (updateError) {
        console.warn('[useStreamSeats] Direct update failed, trying RPC:', updateError);
        // Fall back to RPC if direct update fails
        const { data: result, error } = await supabase.rpc('leave_seat_atomic', {
          p_session_id: sessionId,
        });

        if (error) {
          console.warn('[useStreamSeats] RPC leave_seat_atomic failed:', error);
        }

        // Handle RPC returning table (array) or object
        const data = Array.isArray(result) ? result[0] : result;

        if (!data || !data.success) {
          console.warn('[useStreamSeats] Leave seat returned failure:', data?.message);
        }
      }

      toast.success('Left seat');
    } catch (err: any) {
      console.error('Leave seat failed:', err);
      // Already cleared local state above, so no need to do anything else
    } finally {
      leaveSeat.isRunning = false;
    }
  };
  
  // Add static property for concurrency control
  leaveSeat.isRunning = false;

  const kickParticipant = async (targetUserId: string) => {
    if (!streamId) return;
    try {
      const { data: result, error } = await supabase.rpc('kick_participant_atomic', {
        p_stream_id: streamId,
        p_target_user_id: targetUserId,
        p_reason: 'Host kicked',
      });

      if (error) throw error;

      // Handle RPC returning table (array) or object
      const data = Array.isArray(result) ? result[0] : result;

      if (!data || !data.success) throw new Error(data?.message || 'User kicked failed');

      toast.success('User kicked');
      // Don't call fetchSeats - the realtime subscription will handle state update
    } catch (e: any) {
      toast.error(e.message || 'Failed to kick user');
    }
  };

  return { seats, mySession, joinSeat, leaveSeat, kickParticipant, refreshSeats: fetchSeats, handleParticipantDisconnected };
}
