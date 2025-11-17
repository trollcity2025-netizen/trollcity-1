import { supabase } from '@/api/supabaseClient';

/**
 * Clean up stale live streams that haven't had a heartbeat recently
 * This function should be called periodically to ensure only active streams are shown
 */
export async function cleanupStaleStreams() {
  try {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes - more lenient than the 60s frontend filter
    const staleTime = new Date(now.getTime() - staleThreshold);

    // Find streams that are marked as live but haven't had a recent heartbeat
    const { data: staleStreams, error: selectError } = await supabase
      .from('streams')
      .select('id, title, streamer_name, last_heartbeat, created_at')
      .eq('is_live', true)
      .or(`last_heartbeat.is.null,last_heartbeat.lt.${staleTime.toISOString()}`)
      .limit(100); // Process in batches to avoid overwhelming the system

    if (selectError) {
      console.error('Error finding stale streams:', selectError);
      return { cleaned: 0, error: selectError };
    }

    if (!staleStreams || staleStreams.length === 0) {
      return { cleaned: 0, message: 'No stale streams found' };
    }

    console.log(`Found ${staleStreams.length} stale streams to clean up`);

    // Update the stale streams to mark them as ended
    const streamIds = staleStreams.map(stream => stream.id);
    const { error: updateError } = await supabase
      .from('streams')
      .update({
        is_live: false,
        status: 'ended',
        ended_date: now.toISOString()
      })
      .in('id', streamIds);

    if (updateError) {
      console.error('Error updating stale streams:', updateError);
      return { cleaned: 0, error: updateError };
    }

    console.log(`Successfully cleaned up ${staleStreams.length} stale streams`);

    // Log details of cleaned streams for debugging
    staleStreams.forEach(stream => {
      const lastHeartbeat = stream.last_heartbeat ? new Date(stream.last_heartbeat) : null;
      const createdAt = new Date(stream.created_at);
      const ageMinutes = Math.floor((now - createdAt) / (1000 * 60));
      const staleMinutes = lastHeartbeat ? Math.floor((now - lastHeartbeat) / (1000 * 60)) : 'unknown';
      
      console.log(`Cleaned stream: "${stream.title}" by ${stream.streamer_name || 'unknown'} (Age: ${ageMinutes}min, Stale: ${staleMinutes}min)`);
    });

    return { cleaned: staleStreams.length, streams: staleStreams };
  } catch (error) {
    console.error('Unexpected error in cleanupStaleStreams:', error);
    return { cleaned: 0, error };
  }
}

/**
 * Set up automatic stream cleanup
 * This should be called when the app initializes
 */
export function setupStreamCleanup() {
  // Run cleanup every 2 minutes
  const cleanupInterval = setInterval(async () => {
    try {
      const result = await cleanupStaleStreams();
      if (result.cleaned > 0) {
        console.log(`Stream cleanup completed: ${result.cleaned} streams cleaned`);
      }
    } catch (error) {
      console.error('Error during scheduled stream cleanup:', error);
    }
  }, 2 * 60 * 1000); // 2 minutes

  // Run cleanup immediately on setup
  cleanupStaleStreams().then(result => {
    if (result.cleaned > 0) {
      console.log(`Initial stream cleanup completed: ${result.cleaned} streams cleaned`);
    }
  });

  console.log('Stream cleanup system initialized - running every 2 minutes');
  
  // Return cleanup function for when component unmounts
  return () => {
    clearInterval(cleanupInterval);
    console.log('Stream cleanup system stopped');
  };
}

/**
 * Manual cleanup function for admin use or specific triggers
 */
export async function forceStreamCleanup(olderThanMinutes = 5) {
  const staleThreshold = olderThanMinutes * 60 * 1000;
  const staleTime = new Date(Date.now() - staleThreshold);

  try {
    const { data: staleStreams, error: selectError } = await supabase
      .from('streams')
      .select('id, title, streamer_name, last_heartbeat, created_at')
      .eq('is_live', true)
      .or(`last_heartbeat.is.null,last_heartbeat.lt.${staleTime.toISOString()}`);

    if (selectError) throw selectError;
    if (!staleStreams || staleStreams.length === 0) {
      return { cleaned: 0, message: 'No stale streams found' };
    }

    const streamIds = staleStreams.map(stream => stream.id);
    const { error: updateError } = await supabase
      .from('streams')
      .update({
        is_live: false,
        status: 'ended',
        ended_date: new Date().toISOString()
      })
      .in('id', streamIds);

    if (updateError) throw updateError;

    return { cleaned: staleStreams.length, streams: staleStreams };
  } catch (error) {
    console.error('Error during force cleanup:', error);
    return { cleaned: 0, error };
  }
}