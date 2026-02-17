import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflight();
  }

  const origin = req.headers.get("Origin");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch Profile and Role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isOfficer = profile.role === 'officer' || profile.role === 'lead_troll_officer' || profile.role === 'admin' || profile.is_admin;
    const isLeadOfficer = profile.role === 'lead_troll_officer' || profile.role === 'admin' || profile.is_lead_officer === true || profile.is_admin === true;

    if (!isOfficer) {
      return new Response(JSON.stringify({ error: "Forbidden: Officer access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();
    let result;

    switch (action) {
      case "clock_in": {
        const { error } = await supabaseAdmin
          .from('officer_timesheets')
          .insert({
            officer_id: user.id,
            clock_in: new Date().toISOString(),
            status: 'active'
          });
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "clock_out": {
        const { error } = await supabaseAdmin
          .from('officer_timesheets')
          .update({
            clock_out: new Date().toISOString(),
            status: 'completed'
          })
          .eq('officer_id', user.id)
          .eq('status', 'active');
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "create_warrant": {
        const { targetUserId, reason, fineAmount } = params;
        const { error } = await supabaseAdmin
          .from('officer_warrants')
          .insert({
            officer_id: user.id,
            target_user_id: targetUserId,
            reason,
            fine_amount: fineAmount,
            status: 'active'
          });
        if (error) throw error;
        result = { success: true };
        break;
      }
      
      case "resolve_warrant": {
        const { warrantId, resolution } = params;
        const { error } = await supabaseAdmin
          .from('officer_warrants')
          .update({ 
             status: 'resolved',
             resolution_notes: resolution,
             resolved_at: new Date().toISOString(),
             resolved_by: user.id
          })
          .eq('id', warrantId);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "kick_user": {
         const { targetUsername, streamId } = params;
         if (!targetUsername || !streamId) throw new Error("Missing params");
 
         const { data: targetUser, error: userError } = await supabaseAdmin
           .from('user_profiles')
           .select('id, kick_count')
           .eq('username', targetUsername)
           .single();
 
         if (userError || !targetUser) throw new Error("User not found");
         
         const newKickCount = (targetUser.kick_count || 0) + 1;
         const shouldBan = newKickCount >= 3;

         // Update kick count
         await supabaseAdmin.from('user_profiles').update({
             is_kicked: true,
             kick_count: newKickCount,
             is_banned: shouldBan
         }).eq('id', targetUser.id);

         // Remove from stream
         const { error } = await supabaseAdmin
              .from('streams_participants')
              .delete()
              .eq('stream_id', streamId)
              .eq('user_id', targetUser.id);
              
         if (error) throw error;
         result = { success: true, kicked: true, banned: shouldBan };
         break;
       }
 
       case "ban_user": {
          const { targetUsername, reason } = params;
          if (!targetUsername) throw new Error("Missing params");
          
          const { data: targetUser, error: userError } = await supabaseAdmin
           .from('user_profiles')
           .select('id')
           .eq('username', targetUsername)
           .single();
 
          if (userError || !targetUser) throw new Error("User not found");
          
          await supabaseAdmin.from('user_profiles').update({
             is_banned: true,
             banned_at: new Date().toISOString(),
             banned_by: user.id,
             ban_reason: reason
          }).eq('id', targetUser.id);
          
          // Log to audit
          await supabaseAdmin.from('admin_audit_logs').insert({
              admin_id: user.id,
              action: 'ban_user',
              target_user_id: targetUser.id,
              details: { reason }
          });
          
          result = { success: true };
          break;
       }

      case "ban_ip_address": {
        const { ipAddress, banReason, banDetails, bannedUntil, targetUserId } = params;
        const officerId = user.id;

        let ipToBan = ipAddress;

        // If an officer is banning a user, we need to find their last known IP
        if (!ipToBan && targetUserId) {
          const { data: auditLog, error: logError } = await supabaseAdmin
            .from('audit_logs')
            .select('ip_address')
            .eq('user_id', targetUserId)
            .not('ip_address', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (logError || !auditLog?.ip_address) {
            throw new Error(`Could not find an IP address for the target user. IP bans must be done by an admin with a specified IP.`);
          }
          ipToBan = auditLog.ip_address;
        }

        if (!ipToBan) {
          throw new Error("IP address is required to issue a ban.");
        }

        // Validate IP address format
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ipToBan)) {
          throw new Error(`Invalid IP address format: ${ipToBan}`);
        }

        const fullReason = [banReason, banDetails].filter(Boolean).join(': ');

        const { error: banError } = await supabaseAdmin.from('ip_bans').insert({
          ip_address: ipToBan,
          reason: fullReason,
          banned_until: bannedUntil,
          banned_by: officerId,
        });

        if (banError) {
          // Handle potential primary key conflict if the IP is already banned
          if (banError.code === '23505') { // unique_violation
             throw new Error(`This IP address (${ipToBan}) is already banned.`);
          }
          throw banError;
        }
        
        // Also log to audit logs
        await supabaseAdmin.from('audit_logs').insert({
            action: 'ban_ip_address',
            user_id: officerId,
            target_id: targetUserId, // Log which user was targeted
            details: { 
                banned_ip: ipToBan, 
                reason: fullReason,
                duration: bannedUntil ? 'temporary' : 'permanent'
            },
            ip_address: ipToBan // The IP that was banned
        });

        result = { success: true };
        break;
      }

      case "request_time_off": {
        const { date, reason } = params;
        if (!date) throw new Error("Missing date");
        const { error } = await supabaseAdmin
          .from('officer_time_off_requests')
          .insert({
            officer_id: user.id,
            date,
            reason: reason || '',
            status: 'pending'
          });
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "approve_time_off": {
        if (!isLeadOfficer) throw new Error("Unauthorized");
        const { requestId } = params;
        const { error } = await supabaseAdmin
          .from('officer_time_off_requests')
          .update({ 
            status: 'approved', 
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', requestId);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "reject_time_off": {
        if (!isLeadOfficer) throw new Error("Unauthorized");
        const { requestId, reason } = params;
        const { error } = await supabaseAdmin
          .from('officer_time_off_requests')
          .update({ 
            status: 'rejected', 
            rejection_reason: reason,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', requestId);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "approve_lead_application": {
        if (!isLeadOfficer) throw new Error("Unauthorized");
        const { applicationId } = params;
        const { error } = await supabaseAdmin
          .from('applications')
          .update({ 
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', applicationId);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "reject_lead_application": {
        if (!isLeadOfficer) throw new Error("Unauthorized");
        const { applicationId } = params;
        const { error } = await supabaseAdmin
          .from('applications')
          .update({ 
            status: 'rejected',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', applicationId);
        if (error) throw error;
        result = { success: true };
        break;
      }
      
      // --- Officer Chat (Legacy) ---
      // This section has been removed.

      case "find_opponent": {
         const { data, error } = await supabaseAdmin.rpc('find_opponent', {
             p_user_id: params.userId || user.id, 
             p_strategy: params.strategy || 'random'
         });
         if (error) throw error;
         result = { opponent: data };
         break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }
});