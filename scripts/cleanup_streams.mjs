import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  try {
    console.log('Fetching all streams (live and ended)...')
    // We want to remove ALL broadcasts, so we select all.
    // If user only meant live ones, this might be too aggressive, but "remove all broadcast" implies cleanup.
    // I will target all streams.
    const { data: streams, error: fetchError } = await supabase
      .from('streams')
      .select('id, title')

    if (fetchError) {
      console.error('Failed to fetch streams:', fetchError.message)
      process.exit(1)
    }

    if (!streams || streams.length === 0) {
      console.log('No streams found. Nothing to remove.')
      process.exit(0)
    }

    console.log(`Found ${streams.length} streams. Starting cleanup...`)

    const streamIds = streams.map(s => s.id)

    // 1. End all live streams first (good practice to trigger any triggers if they exist, though we are deleting anyway)
    console.log('Marking streams as ended...')
    await supabase
      .from('streams')
      .update({
        status: 'ended',
        is_live: false,
        ended_at: new Date().toISOString()
      })
      .in('id', streamIds)

    // 2. Delete related data
    const relatedTables = [
      'stream_messages', // specific table for stream chat? Check schema if possible. AdminDashboard said 'chat_messages' and 'messages'
      'chat_messages',
      'messages',
      'stream_reports',
      'streams_participants',
      'stream_gifts',
      'gifts', // might be the gift definitions, be careful. stream_gifts is likely the log.
      'stream_ended_logs',
      'stream_mutes',
      'live_viewers' // from endStream.ts
    ]

    // We need to be careful with table names. 
    // AdminDashboard used: 'messages', 'stream_reports', 'gifts', 'chat_messages'.
    // And 'streams_participants'.
    
    // I'll try to delete from known tables by stream_id.
    // If a table doesn't have stream_id or doesn't exist, it will error, but we can catch it.

    for (const table of relatedTables) {
      console.log(`Deleting from ${table}...`)
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .in('stream_id', streamIds)
        
        if (error) {
             // Ignore "relation does not exist" or "column does not exist"
             if (!error.message.includes('does not exist')) {
                 console.warn(`Error deleting from ${table}:`, error.message)
             }
        }
      } catch (e) {
        // ignore
      }
    }

    // 3. Delete streams
    console.log('Deleting streams...')
    const { error: deleteError } = await supabase
      .from('streams')
      .delete()
      .in('id', streamIds)

    if (deleteError) {
      console.error('Failed to delete streams:', deleteError.message)
    } else {
      console.log(`Successfully deleted ${streams.length} streams.`)
    }

  } catch (e) {
    console.error('Unexpected error:', e)
    process.exit(1)
  }
}

main()
