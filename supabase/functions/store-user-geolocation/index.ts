/**
 * Store User Geolocation - Edge Function
 * 
 * This edge function stores IP geolocation data when a user logs in or signs up.
 * It uses the ipapi.co service for IP geolocation lookup.
 * 
 * PRIVACY: Location data is only accessible to super_admin and platform_admin.
 * Approximate city-level location is stored for emergency response purposes.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface IpApiResponse {
  ip: string;
  city?: string;
  region?: string;
  region_code?: string;
  country?: string;
  country_code?: string;
  country_name?: string;
  continent_code?: string;
  continent_name?: string;
  latitude?: number;
  longitude?: number;
  asn?: string;
  org?: string;
  isp?: string;
  timezone?: string;
  utc_offset?: string;
  error?: boolean;
  reason?: string;
}

/**
 * Lookup IP geolocation using ipapi.co
 */
async function lookupIpGeolocation(ipAddress: string): Promise<IpApiResponse | null> {
  try {
    // Skip for localhost/private IPs
    if (ipAddress === '127.0.0.1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
      return {
        ip: ipAddress,
        city: 'Local',
        region: 'Local',
        country: 'Local',
        isp: 'Local Network'
      };
    }

    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
    
    if (!response.ok) {
      console.error(`[store-user-geolocation] IP lookup failed: ${response.status}`);
      return null;
    }

    const data = await response.json() as IpApiResponse;
    
    if (data.error) {
      console.error(`[store-user-geolocation] IP lookup error: ${data.reason}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error("[store-user-geolocation] IP lookup exception:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Parse request body
    const { 
      user_id, 
      ip_address,
      user_agent,
      event_type = 'login' // 'login' | 'signup'
    } = await req.json();

    if (!user_id || !ip_address) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: user_id, ip_address" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Lookup geolocation data
    const geoData = await lookupIpGeolocation(ip_address);

    // Store location data using database function
    const { data, error } = await supabaseAdmin.rpc('store_user_geolocation', {
      p_user_id: user_id,
      p_ip_address: ip_address,
      p_city: geoData?.city || null,
      p_state: geoData?.region || null,
      p_country: geoData?.country_name || geoData?.country || null,
      p_latitude: geoData?.latitude || null,
      p_longitude: geoData?.longitude || null,
      p_isp: geoData?.isp || geoData?.org || null
    });

    if (error) {
      console.error("[store-user-geolocation] Failed to store location:", error);
      throw error;
    }

    // Log the event to admin_audit_logs
    await supabaseAdmin.rpc('log_admin_audit', {
      p_admin_id: user_id,
      p_action: `user_${event_type}`,
      p_target_user_id: user_id,
      p_target_type: 'user',
      p_details: {
        ip_address,
        city: geoData?.city,
        country: geoData?.country_name || geoData?.country,
        isp: geoData?.isp || geoData?.org,
        user_agent: user_agent || null
      },
      p_ip_address: ip_address
    });

    return new Response(
      JSON.stringify({
        success: true,
        stored: data || true,
        location: {
          city: geoData?.city,
          state: geoData?.region,
          country: geoData?.country_name || geoData?.country,
          isp: geoData?.isp || geoData?.org
        }
      }),
      { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[store-user-geolocation] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
});
