
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Create a new court case
    const { data: caseData, error: caseError } = await supabase
      .from('troll_court_cases')
      .insert({
        defendant_id: user_id,
        case_name: 'State vs. [Username]', // Placeholder, will be updated
        case_description: 'Alleged use of an auto-clicker, a violation of the Troll City terms of service.',
        status: 'pending',
      })
      .select('id')
      .single();

    if (caseError) {
      console.error('Error creating court case:', caseError);
      throw new Error('Failed to create court case');
    }

    // Update the case name with the username
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('id', user_id)
      .single();

    if (profile) {
      await supabase
        .from('troll_court_cases')
        .update({ case_name: `State vs. ${profile.username}` })
        .eq('id', caseData.id);
    }

    // Send a notification to the user
    await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id,
        title: 'You have been summoned to Troll Court!',
        body: 'You are hereby summoned to appear in Troll Court to answer for charges of using an auto-clicker.',
        type: 'court_summon',
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
