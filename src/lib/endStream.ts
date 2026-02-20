export async function endStream(streamId: string) {
  try {


    // Update Supabase – mark stream as ended
    const { error: updateError } = await supabase
      .from('streams')
      .update({
        is_live: false,
        status: 'ended',
        end_time: new Date().toISOString(),
      })
      .eq('id', streamId)

    if (updateError) {
      console.error('Error updating stream status:', updateError)
      // Continue even if update fails
    }

    // Broadcast stream ended event to all clients
    try {
      const channel = supabase.channel(`stream-${streamId}`)
      
      // Send realtime event to notify all connected clients
      await channel.send({
        type: 'broadcast',
        event: 'stream-ended',
        payload: {
          streamId,
          endedAt: new Date().toISOString(),
          reason: 'ended_by_host'
        }
      })
      
      console.log('[endStream] Broadcast stream-ended event to all clients')
    } catch (broadcastError) {
      console.warn('Error broadcasting stream-ended event:', broadcastError)
      // Continue even if broadcast fails
    }

    // Force navigation for all clients by updating a specific table that triggers realtime
    try {
      // Insert a stream_ended_log entry that all clients can listen to
      await supabase
        .from('stream_ended_logs')
        .insert({
          stream_id: streamId,
          ended_at: new Date().toISOString(),
          reason: 'ended_by_host'
        })
        .select()
        .single()
    } catch (logError: any) {
      // Table might not exist, that's okay - we already have the main stream update
      if (!logError.message?.includes('does not exist')) {
        console.warn('Error logging stream end:', logError)
      }
    }

    // Optional: Remove host from live viewers list/table (if table exists)
    try {
      const { error } = await supabase
        .from('live_viewers')
        .delete()
        .eq('stream_id', streamId)

      // Ignore error if table doesn't exist
      if (error && !error.message.includes('does not exist')) {
        console.warn('Error removing live viewers:', error)
      }
    } catch {
      // Table might not exist, that's okay
      console.log('live_viewers table may not exist, skipping cleanup')
    }

    // Force local navigation if we're still on the stream page
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      if (currentPath.includes(`/stream/${streamId}`) || currentPath.includes('/broadcast')) {
        console.log('[endStream] Forcing navigation to stream summary...')
        // Use setTimeout to ensure it happens after cleanup
        setTimeout(() => {
          window.location.href = `/stream-summary/${streamId}`
        }, 500)
      }
    }

    return true
  } catch (error) {
    console.error('Error ending stream:', error)
    return false
  }
}
