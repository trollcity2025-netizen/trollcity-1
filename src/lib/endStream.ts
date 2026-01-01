import { supabase } from './supabase'
import { Room } from 'livekit-client'

export async function endStream(streamId: string, room: Room | null) {
  try {
    // Disconnect LiveKit
    if (room) {
      try {
        // ✅ Fix: Stop all local tracks BEFORE unpublishing to avoid "closed peer" error
        const trackPublications = room.localParticipant.trackPublications
        if (trackPublications) {
          const localTracks = Array.from(trackPublications.values())
          
          // First, stop all tracks
          localTracks.forEach((pub) => {
            if (pub.track) {
              try {
                pub.track.stop()
              } catch (e) {
                console.warn('Error stopping track:', e)
              }
            }
          })
          
          // Wait a moment for tracks to fully stop
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Then unpublish tracks
          localTracks.forEach((pub) => {
            if (pub.track) {
              try {
                room.localParticipant.unpublishTrack(pub.track)
              } catch (e) {
                console.warn('Error unpublishing track:', e)
              }
            }
          })
        }

        // Wait a moment before disconnecting
        await new Promise(resolve => setTimeout(resolve, 200))

        // Disconnect from room
        await room.disconnect()
      } catch (roomError) {
        console.error('Error disconnecting LiveKit room:', roomError)
        // Continue even if room disconnect fails
      }
    }

    // Update Supabase – mark stream as ended
    await supabase
      .from('streams')
      .update({
        is_live: false,
        status: 'ended',
        end_time: new Date().toISOString(),
      })
      .eq('id', streamId)

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
    } catch (viewerError) {
      // Table might not exist, that's okay
      console.log('live_viewers table may not exist, skipping cleanup')
    }

    return true
  } catch (error) {
    console.error('Error ending stream:', error)
    return false
  }
}

