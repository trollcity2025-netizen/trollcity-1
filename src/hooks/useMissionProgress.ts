import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

export function useMissionProgress(streamId: string) {
  const { user } = useAuthStore();

  const trackGiftSent = useCallback(
    async (_coinAmount: number) => {
      if (!user?.id || !streamId) return;
      try {
        await supabase.rpc('update_mission_progress', {
          p_stream_id: streamId,
          p_user_id: user.id,
          p_metric: 'gifts_sent',
          p_value: 1,
        });
      } catch (err) {
        console.warn('[MissionProgress] Failed to track gift sent:', err);
      }
    },
    [user?.id, streamId]
  );

  const trackCoinsSpent = useCallback(
    async (coinAmount: number) => {
      if (!user?.id || !streamId) return;
      try {
        await supabase.rpc('update_mission_progress', {
          p_stream_id: streamId,
          p_user_id: user.id,
          p_metric: 'coins_spent',
          p_value: coinAmount,
        });
      } catch (err) {
        console.warn('[MissionProgress] Failed to track coins spent:', err);
      }
    },
    [user?.id, streamId]
  );

  const trackChatMessage = useCallback(async () => {
    if (!user?.id || !streamId) return;
    try {
      await supabase.rpc('update_mission_progress', {
        p_stream_id: streamId,
        p_user_id: user.id,
        p_metric: 'chat_messages',
        p_value: 1,
      });
    } catch (err) {
      console.warn('[MissionProgress] Failed to track chat message:', err);
    }
  }, [user?.id, streamId]);

  const trackMissionProgress = useCallback(
    async (metric: string, value: number) => {
      if (!user?.id || !streamId) return;
      try {
        await supabase.rpc('update_mission_progress', {
          p_stream_id: streamId,
          p_user_id: user.id,
          p_metric: metric,
          p_value: value,
        });
      } catch (err) {
        console.warn('[MissionProgress] Failed to track mission progress:', err);
      }
    },
    [user?.id, streamId]
  );

  return {
    trackGiftSent,
    trackCoinsSpent,
    trackChatMessage,
    trackMissionProgress,
  };
}
