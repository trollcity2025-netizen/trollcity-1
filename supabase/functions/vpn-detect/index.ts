
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

const IPINFO_TOKEN = Deno.env.get('IPINFO_TOKEN');

serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(origin);
  }

  const headers = corsHeaders(origin);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { ip, user_id } = await req.json();

    if (!ip || !user_id) {
      return new Response(JSON.stringify({ error: 'Missing ip or user_id' }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const ipinfoResponse = await fetch(`https://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`);
    const ipinfoData = await ipinfoResponse.json();

    const isVpn = ipinfoData.vpn || ipinfoData.proxy || ipinfoData.tor || ipinfoData.relay;

    if (isVpn) {
      const { error } = await supabase
        .from('user_profiles')
        .update({ vpn_detected: true, last_known_ip: ip })
        .eq('id', user_id);

      if (error) {
        console.error('Error updating user profile for VPN detection:', error);
      }
    }

    return new Response(JSON.stringify({ vpn: isVpn }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
