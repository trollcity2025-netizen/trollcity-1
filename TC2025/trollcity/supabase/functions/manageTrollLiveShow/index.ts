import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    )

    const { action, showId, userId, performerId } = await req.json()
    
    if (!userId) {
      throw new Error("User ID is required")
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !userProfile) {
      throw new Error("User profile not found")
    }

    switch (action) {
      case 'join_waitlist':
        return await joinWaitlist(supabaseClient, userId, userProfile)
        
      case 'leave_waitlist':
        return await leaveWaitlist(supabaseClient, userId, showId)
        
      case 'cast_vote':
        const { voteType, waitlistEntryId } = await req.json()
        return await castVote(supabaseClient, userId, showId, waitlistEntryId, voteType)
        
      case 'get_current_show':
        return await getCurrentShow(supabaseClient)
        
      case 'start_performance':
        return await startPerformance(supabaseClient, showId, performerId)
        
      case 'end_performance':
        return await endPerformance(supabaseClient, showId, performerId)
        
      default:
        throw new Error("Invalid action")
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

async function joinWaitlist(supabaseClient, userId, userProfile) {
  // Get current active show
  const { data: currentShow } = await supabaseClient
    .from('troll_live_show')
    .select('*')
    .eq('is_active', true)
    .single()

  if (!currentShow) {
    throw new Error("No active Troll Live Show found")
  }

  // Check if user has enough coins
  if (userProfile.purchased_coins < currentShow.entry_fee_coins) {
    throw new Error(`Insufficient coins. You need ${currentShow.entry_fee_coins} paid coins to join.`)
  }

  // Check if user is already in waitlist
  const { data: existingEntry } = await supabaseClient
    .from('troll_live_show_waitlist')
    .select('*')
    .eq('show_id', currentShow.id)
    .eq('user_id', userId)
    .single()

  if (existingEntry) {
    throw new Error("You are already in the waitlist")
  }

  // Deduct coins
  const { error: coinError } = await supabaseClient
    .from('profiles')
    .update({ 
      purchased_coins: userProfile.purchased_coins - currentShow.entry_fee_coins 
    })
    .eq('id', userId)

  if (coinError) {
    throw new Error("Failed to deduct coins")
  }

  // Record coin transaction
  await supabaseClient.from('coin_transactions').insert({
    user_id: userId,
    amount: -currentShow.entry_fee_coins,
    type: 'troll_live_show_entry',
    description: `Troll Live Show entry fee`,
    reference_id: currentShow.id
  })

  // Get next position
  const { data: lastPosition } = await supabaseClient
    .from('troll_live_show_waitlist')
    .select('position')
    .eq('show_id', currentShow.id)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const nextPosition = (lastPosition?.position || 0) + 1

  // Add to waitlist
  const { data: waitlistEntry, error: waitlistError } = await supabaseClient
    .from('troll_live_show_waitlist')
    .insert({
      show_id: currentShow.id,
      user_id: userId,
      position: nextPosition,
      entry_paid: true
    })
    .select()
    .single()

  if (waitlistError) {
    throw new Error("Failed to join waitlist")
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: "Successfully joined waitlist",
      waitlistEntry,
      position: nextPosition
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function leaveWaitlist(supabaseClient, userId, showId) {
  const { error } = await supabaseClient
    .from('troll_live_show_waitlist')
    .update({ status: 'left' })
    .eq('show_id', showId)
    .eq('user_id', userId)
    .neq('status', 'performing')

  if (error) {
    throw new Error("Failed to leave waitlist")
  }

  return new Response(
    JSON.stringify({ success: true, message: "Left waitlist successfully" }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function castVote(supabaseClient, userId, showId, waitlistEntryId, voteType) {
  // Check if vote already exists
  const { data: existingVote } = await supabaseClient
    .from('troll_live_show_votes')
    .select('*')
    .eq('show_id', showId)
    .eq('waitlist_entry_id', waitlistEntryId)
    .eq('voter_id', userId)
    .single()

  if (existingVote) {
    // Update existing vote
    const { error } = await supabaseClient
      .from('troll_live_show_votes')
      .update({ vote_type: voteType })
      .eq('id', existingVote.id)

    if (error) {
      throw new Error("Failed to update vote")
    }
  } else {
    // Create new vote
    const { error } = await supabaseClient
      .from('troll_live_show_votes')
      .insert({
        show_id: showId,
        waitlist_entry_id: waitlistEntryId,
        voter_id: userId,
        vote_type: voteType
      })

    if (error) {
      throw new Error("Failed to cast vote")
    }
  }

  // Update vote counts in waitlist entry
  const { data: votes } = await supabaseClient
    .from('troll_live_show_votes')
    .select('*')
    .eq('waitlist_entry_id', waitlistEntryId)

  const keepVotes = votes?.filter(v => v.vote_type === 'keep').length || 0
  const kickVotes = votes?.filter(v => v.vote_type === 'kick').length || 0

  await supabaseClient
    .from('troll_live_show_waitlist')
    .update({
      votes_received: keepVotes,
      votes_against: kickVotes
    })
    .eq('id', waitlistEntryId)

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: "Vote cast successfully",
      keepVotes,
      kickVotes
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function getCurrentShow(supabaseClient) {
  const { data: currentShow } = await supabaseClient
    .from('troll_live_show')
    .select(`
      *,
      current_performer:profiles!troll_live_show_current_performer_id_fkey(*),
      waitlist:troll_live_show_waitlist(
        *,
        user:profiles(*)
      ),
      votes:troll_live_show_votes(*)
    `)
    .eq('is_active', true)
    .single()

  if (!currentShow) {
    return new Response(
      JSON.stringify({ error: "No active show found" }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404 
      }
    )
  }

  return new Response(
    JSON.stringify({ show: currentShow }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function startPerformance(supabaseClient, showId, performerId) {
  const now = new Date()
  
  // Update show with current performer
  const { error: showError } = await supabaseClient
    .from('troll_live_show')
    .update({
      current_performer_id: performerId,
      current_performer_start_time: now.toISOString()
    })
    .eq('id', showId)

  if (showError) {
    throw new Error("Failed to start performance")
  }

  // Update waitlist entry
  const { error: waitlistError } = await supabaseClient
    .from('troll_live_show_waitlist')
    .update({
      status: 'performing',
      performance_start_time: now.toISOString()
    })
    .eq('show_id', showId)
    .eq('user_id', performerId)

  if (waitlistError) {
    throw new Error("Failed to update waitlist entry")
  }

  return new Response(
    JSON.stringify({ success: true, message: "Performance started" }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function endPerformance(supabaseClient, showId, performerId) {
  const now = new Date()
  
  // Get current performance
  const { data: waitlistEntry } = await supabaseClient
    .from('troll_live_show_waitlist')
    .select('*')
    .eq('show_id', showId)
    .eq('user_id', performerId)
    .eq('status', 'performing')
    .single()

  if (!waitlistEntry) {
    throw new Error("No active performance found")
  }

  const performanceDuration = Math.floor((now.getTime() - new Date(waitlistEntry.performance_start_time).getTime()) / 1000)

  // Update waitlist entry
  const { error: waitlistError } = await supabaseClient
    .from('troll_live_show_waitlist')
    .update({
      status: 'completed',
      performance_end_time: now.toISOString(),
      performance_duration_seconds: performanceDuration
    })
    .eq('id', waitlistEntry.id)

  if (waitlistError) {
    throw new Error("Failed to end performance")
  }

  // Clear current performer from show
  const { error: showError } = await supabaseClient
    .from('troll_live_show')
    .update({
      current_performer_id: null,
      current_performer_start_time: null
    })
    .eq('id', showId)

  if (showError) {
    throw new Error("Failed to clear current performer")
  }

  // Award win if performance was successful
  if (performanceDuration >= 60) { // Minimum 1 minute to qualify as a win
    await supabaseClient.from('user_wins').insert({
      user_id: performerId,
      win_type: 'troll_live_show_completion',
      amount: 1000, // Award 1000 coins for completing performance
      show_id: showId,
      metadata: {
        duration: performanceDuration,
        votes_received: waitlistEntry.votes_received,
        votes_against: waitlistEntry.votes_against
      }
    })

    // Update user profile wins
    const { data: performerProfile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', performerId)
      .single()

    if (performerProfile) {
      await supabaseClient
        .from('profiles')
        .update({
          wins_count: (performerProfile.wins_count || 0) + 1,
          total_winnings: (performerProfile.total_winnings || 0) + 1000
        })
        .eq('id', performerId)
    }
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: "Performance ended",
      duration: performanceDuration,
      qualifiedForWin: performanceDuration >= 60
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}