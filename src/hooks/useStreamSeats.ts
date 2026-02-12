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

export function useStreamSeats(streamId: string | undefined, userId?: string, broadcasterProfile?: any) {
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
    const interval = setInterval(fetchSeats, 5000);

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
        () => {
          // Always rely on server truth via RPC
          fetchSeats();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [streamId, fetchSeats]);

  const joinSeat = async (seatIndex: number, price: number) => {
    if (!effectiveUserId || !streamId) return false;

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
      await fetchSeats();
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
      await fetchSeats();
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
      await fetchSeats();
    } catch (e: any) {
      toast.error(e.message || 'Failed to kick user');
    }
  };

  return { seats, mySession, joinSeat, leaveSeat, kickParticipant, refreshSeats: fetchSeats };
}
