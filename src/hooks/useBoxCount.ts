import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface UseBoxCountOptions {
  streamId: string;
  initialBoxCount: number;
  isHost: boolean;
}

export function useBoxCount({ streamId, initialBoxCount, isHost }: UseBoxCountOptions) {
  // Local state for instant UI updates - separate from stream object
  const [boxCount, setBoxCount] = useState(initialBoxCount);
  const boxCountRef = useRef(boxCount);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isSubscribedRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    boxCountRef.current = boxCount;
  }, [boxCount]);

  // Sync with initialBoxCount if it changes from parent
  useEffect(() => {
    if (initialBoxCount !== boxCountRef.current) {
      setBoxCount(initialBoxCount);
    }
  }, [initialBoxCount]);

  // Setup broadcast channel for receiving box count updates
  // Listen on stream:{streamId} to match useBattleManagement's broadcast
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase.channel(`stream:${streamId}`);
    channelRef.current = channel;

    channel
      .on(
        'broadcast',
        { event: 'box_count_changed' },
        (payload) => {
          try {
            const boxData = payload.payload;
            if (boxData && boxData.box_count !== undefined) {
              // Only update if different to avoid loops
              if (boxData.box_count !== boxCountRef.current) {
                console.log('[useBoxCount] Received box_count update:', boxData.box_count);
                setBoxCount(boxData.box_count);
              }
            }
          } catch (err) {
            console.error('[useBoxCount] Error processing box_count_changed:', err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
        }
      });

    // Also listen for postgres_changes on streams table as backup
    const dbChannel = supabase
      .channel(`stream-db:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`,
        },
        (payload: any) => {
          const newData = payload.new;
          if (newData && newData.box_count !== undefined && newData.box_count !== boxCountRef.current) {
            console.log('[useBoxCount] Received box_count update from DB:', newData.box_count);
            setBoxCount(newData.box_count);
          }
        }
      )
      .subscribe();

    return () => {
      isSubscribedRef.current = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(dbChannel);
      channelRef.current = null;
    };
  }, [streamId]);

  // Update box count - broadcasts to all viewers
  const updateBoxCount = useCallback(async (newCount: number) => {
    if (!streamId) return;

    // Don't update if the value hasn't changed
    if (boxCountRef.current === newCount) {
      console.log('[useBoxCount] No change needed - same value');
      return;
    }

    console.log('[useBoxCount] Updating box count from', boxCountRef.current, 'to', newCount);

    // Immediately update local state for instant UI feedback
    setBoxCount(newCount);

    // Broadcast to all connected clients
    const channel = channelRef.current;
    if (channel && isSubscribedRef.current) {
      try {
        await channel.send({
          type: 'broadcast',
          event: 'box_count_changed',
          payload: { box_count: newCount, stream_id: streamId }
        });
        console.log('[useBoxCount] Broadcast sent successfully');
      } catch (sendErr) {
        console.error('[useBoxCount] Error sending broadcast:', sendErr);
      }
    }

    // Update database in the background
    try {
      const { error } = await supabase
        .from('streams')
        .update({ box_count: newCount })
        .eq('id', streamId);

      if (error) {
        console.error('[useBoxCount] Database error:', error);
        // Revert on error
        setBoxCount(boxCountRef.current);
        return;
      }
      console.log('[useBoxCount] Database updated successfully');
    } catch (dbErr) {
      console.error('[useBoxCount] Database exception:', dbErr);
      // Revert on error
      setBoxCount(boxCountRef.current);
    }
  }, [streamId]);

  const incrementBoxCount = useCallback(() => {
    if (boxCountRef.current >= 6) return;
    updateBoxCount(boxCountRef.current + 1);
  }, [updateBoxCount]);

  const decrementBoxCount = useCallback(() => {
    if (boxCountRef.current <= 1) return;
    updateBoxCount(boxCountRef.current - 1);
  }, [updateBoxCount]);

  return {
    boxCount,
    setBoxCount: updateBoxCount,
    incrementBoxCount,
    decrementBoxCount,
  };
}
