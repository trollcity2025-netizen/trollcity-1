
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

// TODO: Replace with a real toxicity analysis API client
// For demonstration, we'll use a mock function.
// In a real implementation, this would call an external service
// like Google's Perspective API, OpenAI's moderation endpoint, or a similar service.
async function getToxicityScore(text: string): Promise<number> {
  console.log(`Analyzing text (MOCK): "${text}"`)
  // Mock analysis: score is based on message length for demonstration
  const score = Math.min(text.length / 100, 1.0)
  return Promise.resolve(score)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message } = await req.json()
    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Create a hash of the message to use as a cache key
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message))
    const textHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')

    // 2. Check the cache first
    const { data: cached, error: cacheError } = await supabaseAdmin
      .from('ai_moderation_cache')
      .select('toxicity_score')
      .eq('text_hash', textHash)
      .single()

    if (cacheError && cacheError.code !== 'PGRST116') { // Ignore "No rows found"
      console.error('Error checking cache:', cacheError)
    }

    if (cached) {
      return new Response(JSON.stringify({ score: cached.toxicity_score }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 3. If not in cache, analyze the text
    const score = await getToxicityScore(message)

    // 4. Store the result in the cache
    const { error: insertError } = await supabaseAdmin
      .from('ai_moderation_cache')
      .insert({
        text_hash: textHash,
        toxicity_score: score,
        is_flagged: score > 0.7, // Example threshold
      })

    if (insertError) {
      console.error('Error saving to cache:', insertError)
    }

    return new Response(JSON.stringify({ score }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
