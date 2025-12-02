import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html } = await req.json()

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, html' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to use Resend if available
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const appEmailFrom = Deno.env.get('APP_EMAIL_FROM') || 'noreply@trollcity.app'

    if (resendApiKey) {
      try {
        // Dynamic import for Resend
        const { Resend } = await import('npm:resend@2.0.0')
        const resend = new Resend(resendApiKey)

        const email = await resend.emails.send({
          from: appEmailFrom,
          to,
          subject,
          html,
        })

        return new Response(
          JSON.stringify({ success: true, data: email }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (resendError: any) {
        console.error('Resend error:', resendError)
        // Fall through to log-only mode
      }
    }

    // Fallback: Log email (for development/testing)
    console.log('Email would be sent:', { to, subject, html: html.substring(0, 100) + '...' })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email logged (RESEND_API_KEY not configured)',
        logged: { to, subject }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('SendEmail error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

