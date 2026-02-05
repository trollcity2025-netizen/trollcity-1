import { useEffect, useState, useCallback } from 'react';
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
    role?: string;
    troll_coins?: number;
  };
  status: 'active' | 'left' | 'kicked';
  joined_at: string;
}

export function useStreamSeats(streamId: string | undefined) {
  const [seats, setSeats] = useState<Record<number, SeatSession>>({});
  const { user } = useAuthStore();
  const [mySession, setMySession] = useState<SeatSession | null>(null);

  const fetchSeats = useCallback(async () => {
    if (!streamId) return;

    const { data, error } = await supabase
      .from('stream_seat_sessions')
      .select(`
        *,
        user_profile:user_profiles(username, avatar_url, is_gold, rgb_username_expires_at, role, troll_coins)
      `)
      .eq('stream_id', streamId)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching seats:', error);
      return;
    }

    const seatMap: Record<number, SeatSession> = {};
    let mySess: SeatSession | null = null;

    data?.forEach((s: any) => {
      seatMap[s.seat_index] = {
        id: s.id,
        seat_index: s.seat_index,
        user_id: s.user_id,
        user_profile: s.user_profile,
        status: s.status,
        joined_at: s.joined_at
      };
      
      if (user && s.user_id === user.id) {
        mySess = seatMap[s.seat_index];
      }
    });

    setSeats(seatMap);
    setMySession(mySess);
  }, [streamId, user]);

  useEffect(() => {
    fetchSeats();

    if (!streamId) return;

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
          fetchSeats();
          
          // Realtime Revocation Check
          const newRecord = payload.new as any;
          if (user && newRecord && newRecord.user_id === user.id) {
             const newStatus = newRecord.status;
             if (newStatus !== 'active') {
                 // Force disconnect is handled by BroadcastPage reacting to mySession changing to null/kicked
                 // fetchSeats will update mySession, which triggers the effect in BroadcastPage
             }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, fetchSeats, user]);

  const joinSeat = async (seatIndex: number, price: number) => {
    if (!user || !streamId) return false;

    try {
      const { data, error } = await supabase.rpc('join_seat_atomic', {
        p_stream_id: streamId,
        p_seat_index: seatIndex,
        p_price: price
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      toast.success("Joined seat!");
      await fetchSeats();
      return true;
    } catch (err: any) {
      toast.error(err.message || "Failed to join seat");
      return false;
    }
  };

  const leaveSeat = async () => {
    if (!mySession) return;
    
    try {
      const { data, error } = await supabase.rpc('leave_seat_atomic', {
        p_session_id: mySession.id
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.message);
      
      toast.success("Left seat");
      setMySession(null);
      await fetchSeats();
    } catch (err: any) {
      console.error(err);
    }
  };
  
  const kickParticipant = async (targetUserId: string) => {
      if (!streamId) return;
      try {
          const { data, error } = await supabase.rpc('kick_participant_atomic', {
              p_stream_id: streamId,
              p_target_user_id: targetUserId,
              p_reason: 'Host kicked'
          });
          
          if (error) throw error;
          if (!data.success) throw new Error(data.message);
          toast.success("User kicked");
      } catch (e: any) {
          toast.error(e.message);
      }
  };

  return { seats, mySession, joinSeat, leaveSeat, kickParticipant, refreshSeats: fetchSeats };
}
