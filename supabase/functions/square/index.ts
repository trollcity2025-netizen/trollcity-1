// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop() || ''

    if (path === 'status' && req.method === 'GET') {
      const appId = Deno.env.get('SQUARE_APPLICATION_ID') || Deno.env.get('VITE_SQUARE_APPLICATION_ID')
      const locationId = Deno.env.get('SQUARE_LOCATION_ID') || Deno.env.get('VITE_SQUARE_LOCATION_ID')
      const sandbox = !!appId && (appId.includes('sandbox') || (locationId || '').includes('sandbox'))
      return new Response(JSON.stringify({ success: true, appId: !!appId, locationId: !!locationId, sandbox }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (path === 'test' && req.method === 'POST') {
      const appId = Deno.env.get('SQUARE_APPLICATION_ID') || Deno.env.get('VITE_SQUARE_APPLICATION_ID')
      const locationId = Deno.env.get('SQUARE_LOCATION_ID') || Deno.env.get('VITE_SQUARE_LOCATION_ID')
      if (!appId || !locationId) {
        return new Response(JSON.stringify({ success: false, error: 'Missing Square credentials' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ success: true, message: 'Square test OK' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: false, error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/square' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
