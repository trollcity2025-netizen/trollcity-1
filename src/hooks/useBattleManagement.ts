import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface BattleGuest {
  user_id: string;
  username: string;
  seat_index: number;
  joined_at: string;
}

interface BattleManagementState {
  guests: BattleGuest[];
  isLoading: boolean;
  error: string | null;
}

interface UseBattleManagementProps {
  battleId: string | null;
  streamId: string | null;
  isHost: boolean;
}

export function useBattleManagement({ battleId, streamId, isHost }: UseBattleManagementProps) {
  const [state, setState] = useState<BattleManagementState>({
    guests: [],
    isLoading: false,
    error: null,
  });

  // Fetch current guests in battle
  const fetchGuests = useCallback(async () => {
    if (!battleId || !streamId) return;

    try {
      const { data, error } = await supabase
        .from('battle_participants')
        .select('user_id, username, metadata, seat_index')
        .eq('battle_id', battleId)
        .eq('role', 'stage');

      if (error) throw error;

      const guests: BattleGuest[] = (data || [])
        .filter((p: any) => {
          // Only include guests from this stream
          const metadata = p.metadata ? JSON.parse(p.metadata) : {};
          return metadata.sourceStreamId === streamId;
        })
        .map((p: any) => ({
          user_id: p.user_id,
          username: p.username,
          seat_index: p.seat_index || 0,
          joined_at: p.metadata ? JSON.parse(p.metadata).joined_at : new Date().toISOString(),
        }));

      setState(prev => ({ ...prev, guests }));
    } catch (err) {
      console.error('Error fetching battle guests:', err);
    }
  }, [battleId, streamId]);

  // Subscribe to participant changes
  useEffect(() => {
    if (!battleId) return;

    fetchGuests();

    const channel = supabase
      .channel(`battle_guests:${battleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'battle_participants',
          filter: `battle_id=eq.${battleId}`,
        },
        () => {
          fetchGuests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [battleId, fetchGuests]);

  // Handle guest leaving
  const handleGuestLeave = useCallback(
    async (guestUserId: string) => {
      if (!battleId || !streamId || !isHost) {
        toast.error('Only the host can remove guests');
        return false;
      }

      try {
        setState(prev => ({ ...prev, isLoading: true }));

        // Call the RPC to handle guest leave with auto box adjustment
        const { data, error } = await supabase.rpc('handle_battle_guest_leave', {
          p_battle_id: battleId,
          p_guest_user_id: guestUserId,
        });

        if (error) throw error;

        if (data?.success) {
          toast.success(data.message || 'Guest removed');

          // Update local state
          setState(prev => ({
            ...prev,
            guests: prev.guests.filter(g => g.user_id !== guestUserId),
            isLoading: false,
          }));

          return true;
        } else {
          toast.error(data?.message || 'Failed to remove guest');
          setState(prev => ({ ...prev, isLoading: false }));
          return false;
        }
      } catch (err: any) {
        console.error('Error handling guest leave:', err);
        toast.error(err.message || 'Failed to remove guest');
        setState(prev => ({ ...prev, isLoading: false, error: err.message }));
        return false;
      }
    },
    [battleId, streamId, isHost]
  );

  // Allow a new guest to join (increase box count)
  const allowGuestJoin = useCallback(
    async (targetBoxCount?: number) => {
      if (!streamId || !isHost) {
        toast.error('Only the host can add boxes');
        return false;
      }

      try {
        // Get current box count
        const { data: streamData } = await supabase
          .from('streams')
          .select('box_count')
          .eq('id', streamId)
          .single();

        const currentBoxCount = streamData?.box_count || 1;
        const newBoxCount = targetBoxCount || currentBoxCount + 1;

        if (newBoxCount > 6) {
          toast.warning('Maximum 6 boxes allowed');
          return false;
        }

        // Update box count
        const { error } = await supabase.rpc('set_stream_box_count', {
          p_stream_id: streamId,
          p_new_box_count: newBoxCount,
        });

        if (error) throw error;

        // Broadcast the change
        const broadcastChannel = supabase.channel(`stream:${streamId}`);
        await broadcastChannel.send({
          type: 'broadcast',
          event: 'box_count_changed',
          payload: { box_count: newBoxCount, stream_id: streamId },
        });

        toast.success(`Box added! Total: ${newBoxCount}`);
        return true;
      } catch (err: any) {
        console.error('Error adding box:', err);
        toast.error(err.message || 'Failed to add box');
        return false;
      }
    },
    [streamId, isHost]
  );

  // Auto-adjust boxes when a guest leaves
  const autoAdjustBoxes = useCallback(
    async (leftGuestSeatIndex: number) => {
      if (!streamId || !isHost) return;

      try {
        // Get current box count
        const { data: streamData } = await supabase
          .from('streams')
          .select('box_count')
          .eq('id', streamId)
          .single();

        const currentBoxCount = streamData?.box_count || 1;

        // Only decrease if we have more than 1 box and the left guest was in the highest seat
        const highestOccupiedSeat = Math.max(...state.guests.map(g => g.seat_index), 0);

        if (currentBoxCount > 1 && leftGuestSeatIndex >= highestOccupiedSeat) {
          const newBoxCount = Math.max(1, currentBoxCount - 1);

          const { error } = await supabase.rpc('set_stream_box_count', {
            p_stream_id: streamId,
            p_new_box_count: newBoxCount,
          });

          if (error) throw error;

          // Broadcast the change
          const broadcastChannel = supabase.channel(`stream:${streamId}`);
          await broadcastChannel.send({
            type: 'broadcast',
            event: 'box_count_changed',
            payload: {
              box_count: newBoxCount,
              stream_id: streamId,
              reason: 'guest_left',
            },
          });
        }
      } catch (err) {
        console.error('Error auto-adjusting boxes:', err);
      }
    },
    [streamId, isHost, state.guests]
  );

  return {
    ...state,
    fetchGuests,
    handleGuestLeave,
    allowGuestJoin,
    autoAdjustBoxes,
    guestCount: state.guests.length,
  };
}

export default useBattleManagement;