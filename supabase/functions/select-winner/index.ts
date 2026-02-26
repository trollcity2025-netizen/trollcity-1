import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { show_id } = await request.json()

    const { data: votes, error: votesError } = await supabase
      .from('mai_talent_votes')
      .select('audition_id, amount')
      .eq('show_id', show_id)

    if (votesError) {
      throw votesError
    }

    const voteCounts = votes.reduce((acc, vote) => {
      acc[vote.audition_id] = (acc[vote.audition_id] || 0) + vote.amount
      return acc
    }, {})

    const winnerId = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b)

    return new Response(JSON.stringify({ winner_id: winnerId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
}
