import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';

export interface SeatSession {
  id: string; // session_id
  seat_index: number;
  user_id: string;
  user_profile?: {
    username: string;
    avatar_url: string;
    is_gold?: boolean;
    rgb_username_expires_at?: string;
    glowing_username_color?: string;
    role?: string;
    troll_coins?: number;
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
          troll_role: s.troll_role,
          created_at: s.created_at,
        };

        seatMap[idx] = {
          id: s.id,
          seat_index: idx,
          user_id: s.user_id,
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
    // Reduced to 2 seconds for faster updates
    const interval = setInterval(fetchSeats, 2000);

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

  const joinSeat = async (seatIndex: number, price: number) => {
    if (!effectiveUserId || !streamId) return false;

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

      if (error) throw error;

      // Handle RPC returning table (array) or object
      const data = Array.isArray(result) ? result[0] : result;

      if (!data || !data.success) throw new Error(data?.message || 'Failed to join seat');

      toast.success('Joined seat!');
      
      // Just update local state - don't trigger a full refetch that could cause re-renders
      // The realtime subscription will handle keeping seats in sync
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to join seat');
      return false;
    }
  };

  const leaveSeat = async () => {
    if (!mySession) return;

    try {
      const { data: result, error } = await supabase.rpc('leave_seat_atomic', {
        p_session_id: mySession.id,
      });

      if (error) throw error;

      // Handle RPC returning table (array) or object
      const data = Array.isArray(result) ? result[0] : result;

      if (!data || !data.success) throw new Error(data?.message || 'Failed to leave seat');

      toast.success('Left seat');
      setMySession(null);
      // Don't call fetchSeats here - the realtime subscription will update state
    } catch (err: any) {
      console.error('Leave seat failed:', err);
      toast.error(err.message || 'Failed to leave seat');
    }
  };

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

  return { seats, mySession, joinSeat, leaveSeat, kickParticipant, refreshSeats: fetchSeats };
}
