import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useViewerTracking(streamId: string | null, userId: string | null) {
  useEffect(() => {
    if (!streamId || !userId) return

    const trackViewer = async () => {
      try {
        // Check if user is already tracked for this stream
        const { data: existing, error: checkError } = await supabase
          .from('stream_viewers')
          .select('id')
          .eq('stream_id', streamId)
          .eq('user_id', userId)
          .maybeSingle()

        if (checkError) {
          console.error('Error checking existing viewer:', checkError)
          return
        }

        if (existing) {
          // User already tracked, just update the timestamp
          const { error: updateError } = await supabase
            .from('stream_viewers')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', existing.id)

          if (updateError) {
            console.error('Error updating viewer timestamp:', updateError)
          }
        } else {
          // Add new viewer
          const { error: insertError } = await supabase
            .from('stream_viewers')
            .insert({
              stream_id: streamId,
              user_id: userId,
              joined_at: new Date().toISOString(),
              last_seen: new Date().toISOString()
            })

          if (insertError) {
            console.error('Error inserting new viewer:', insertError)
          }
        }

        // Update stream viewer count
        const { error: countError, count } = await supabase
          .from('stream_viewers')
          .select('*', { count: 'exact', head: true })
          .eq('stream_id', streamId)

        if (countError) {
          console.error('Error counting viewers:', countError)
          return
        }

        // Update the stream's current_viewers field
        const { error: updateStreamError } = await supabase
          .from('streams')
          .update({ current_viewers: count })
          .eq('id', streamId)

        if (updateStreamError) {
          console.error('Error updating stream viewer count:', updateStreamError)
        }

      } catch (error) {
        console.error('Error in viewer tracking:', error)
      }
    }

    // Track viewer when component mounts
    trackViewer()

    // Set up interval to update last_seen every 30 seconds
    const interval = setInterval(trackViewer, 30000)

    // Clean up on unmount
    const cleanup = async () => {
      clearInterval(interval)

      try {
        // Remove viewer from tracking
        const { error } = await supabase
          .from('stream_viewers')
          .delete()
          .eq('stream_id', streamId)
          .eq('user_id', userId)

        if (error) {
          console.error('Error removing viewer:', error)
          return
        }

        // Update stream viewer count
        const { error: countError, count } = await supabase
          .from('stream_viewers')
          .select('*', { count: 'exact', head: true })
          .eq('stream_id', streamId)

        if (countError) {
          console.error('Error counting viewers after cleanup:', countError)
          return
        }

        const { error: updateStreamError } = await supabase
          .from('streams')
          .update({ current_viewers: count || 0 })
          .eq('id', streamId)

        if (updateStreamError) {
          console.error('Error updating stream viewer count after cleanup:', updateStreamError)
        }

      } catch (error) {
        console.error('Error in viewer cleanup:', error)
      }
    }

    return cleanup

  }, [streamId, userId])

  return null
}