import { supabase } from './supabase';

/**
 * Get all currently active streams
 * @returns Promise<Array<{id: string, broadcaster_id: string}>> - Array of active stream IDs and broadcaster IDs
 */
export async function getActiveStreams(): Promise<Array<{id: string, broadcaster_id: string}>> {
  try {
    const { data, error } = await supabase
      .from('streams')
      .select('id, broadcaster_id')
      .eq('is_live', true);

    if (error) {
      console.error('Error fetching active streams:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching active streams:', error);
    return [];
  }
}

/**
 * End all active broadcasts (admin function)
 * This marks all live streams as ended in the database
 * 
 * @returns Promise<{success: boolean, endedCount: number, streams: Array<{id: string, broadcaster_id: string}>}>
 */
export async function endAllBroadcasts(): Promise<{
  success: boolean;
  endedCount: number;
  streams: Array<{id: string, broadcaster_id: string}>;
}> {
  try {
    // Get all active streams
    const activeStreams = await getActiveStreams();
    
    if (activeStreams.length === 0) {
      console.log('[endAllBroadcasts] No active broadcasts to end');
      return {
        success: true,
        endedCount: 0,
        streams: []
      };
    }

    console.log(`[endAllBroadcasts] Found ${activeStreams.length} active broadcasts to end`);

    // Update all streams to ended status
    const { error: updateError } = await supabase
      .from('streams')
      .update({
        is_live: false,
        status: 'ended',
        end_time: new Date().toISOString(),
      })
      .eq('is_live', true);

    if (updateError) {
      console.error('[endAllBroadcasts] Error updating streams:', updateError);
      return {
        success: false,
        endedCount: 0,
        streams: activeStreams
      };
    }

    // Broadcast stream-ended event to all clients
    try {
      const channel = supabase.channel('all-streams-ended');
      
      for (const stream of activeStreams) {
        await channel.send({
          type: 'broadcast',
          event: 'stream-ended',
          payload: {
            streamId: stream.id,
            endedAt: new Date().toISOString(),
            reason: 'admin_ended_all'
          }
        });
      }
      
      console.log('[endAllBroadcasts] Broadcast stream-ended events to all clients');
    } catch (broadcastError) {
      console.warn('[endAllBroadcasts] Error broadcasting stream-ended events:', broadcastError);
      // Continue even if broadcast fails
    }

    // Log the mass stream end
    try {
      await supabase
        .from('stream_ended_logs')
        .insert({
          stream_id: 'all', // Special marker for mass end
          ended_at: new Date().toISOString(),
          reason: 'admin_ended_all'
        });
    } catch (logError: any) {
      if (!logError.message?.includes('does not exist')) {
        console.warn('[endAllBroadcasts] Error logging mass stream end:', logError);
      }
    }

    console.log(`[endAllBroadcasts] Successfully ended ${activeStreams.length} broadcasts`);

    return {
      success: true,
      endedCount: activeStreams.length,
      streams: activeStreams
    };
  } catch (error) {
    console.error('[endAllBroadcasts] Error ending all broadcasts:', error);
    return {
      success: false,
      endedCount: 0,
      streams: []
    };
  }
}

/**
 * End a specific stream by ID (wrapper around individual end)
 * @param streamId - The stream ID to end
 * @returns Promise<boolean> - True if successful
 */
export async function endStreamById(streamId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('streams')
      .update({
        is_live: false,
        status: 'ended',
        end_time: new Date().toISOString(),
      })
      .eq('id', streamId);

    if (error) {
      console.error(`[endStreamById] Error ending stream ${streamId}:`, error);
      return false;
    }

    // Broadcast to clients
    try {
      const channel = supabase.channel(`stream-${streamId}`);
      await channel.send({
        type: 'broadcast',
        event: 'stream-ended',
        payload: {
          streamId,
          endedAt: new Date().toISOString(),
          reason: 'ended_by_admin'
        }
      });
    } catch (e) {
      console.warn('[endStreamById] Broadcast error:', e);
    }

    return true;
  } catch (error) {
    console.error(`[endStreamById] Error ending stream ${streamId}:`, error);
    return false;
  }
}
