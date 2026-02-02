
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("role, is_admin, is_lead_officer, is_troll_officer")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isLeadOfficer = 
      profile.role === 'lead_troll_officer' || 
      profile.is_lead_officer === true || 
      profile.is_admin === true || 
      profile.role === 'admin';

    const isTrollOfficer = 
      profile.role === 'troll_officer' || 
      profile.is_troll_officer === true || 
      isLeadOfficer;

    let body;
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is broadcaster for the relevant stream
    let isBroadcaster = false;
    let isModerator = false;
    if (params.streamId) {
      const { data: stream } = await supabaseAdmin
        .from('streams')
        .select('broadcaster_id')
        .eq('id', params.streamId)
        .single();
      
      if (stream && stream.broadcaster_id === user.id) {
        isBroadcaster = true;
      }

      // Check for Moderator status
      const { data: participant } = await supabaseAdmin
        .from('streams_participants')
        .select('is_moderator')
        .eq('stream_id', params.streamId)
        .eq('user_id', user.id)
        .single();
      
      if (participant?.is_moderator) {
        isModerator = true;
      }
    }

    // Authorization Check
    const allowedBroadcasterActions = [
      'kick_participant', 
      'assign_moderator', 
      'remove_moderator', 
      'mute_participant', 
      'disable_chat', 
      'clear_seat_ban',
      'end_stream',
      'mute_media',
      'set_frame_mode',
      'alert_officers',
      'start_stream',
      'troll_mic_mute',
      'troll_mic_unmute',
      'troll_immunity',
      'troll_kick',
      'notify_user',
      'log_officer_action',
      'log_theme_event',
      'start_troll_battle',
      'assign_battle_guests',
      'assign_broadofficer',
      'remove_broadofficer',
      'update_box_count',
      'clear_stage',
      'set_price'
    ];
    
    // Moderators can do subset? For now assume Moderators can do moderation stuff.
    // Also allow "Troll Actions" for regular users (paid).
    const paidActions = ['troll_mic_mute', 'troll_mic_unmute', 'troll_immunity', 'troll_kick'];
    
    // Check if action requires privilege or can be paid
    const isPaidAction = paidActions.includes(action);

    // Public actions (anyone can report or gift)
    const publicActions = [
      'report_user', 
      'send_gift', 
      'send_stream_message', 
      'join_stream_box', 
      'claim_watch_xp', 
      'verify_stream_password', 
      'check_broadofficer',
      'find_opponent',
      'skip_opponent',
      'get_stream',
      'get_stream_status',
      'get_quick_gifts',
      'get_stream_box_count',
      'get_stream_theme',
      'ensure_dm_conversation',
      'get_stream_viewers',
      'get_active_battle'
    ];
    
    // Moderator privileges
    const allowedModeratorActions = [
        'kick_participant',
        'mute_participant',
        'disable_chat',
        'troll_mic_mute',
        'troll_mic_unmute',
        'troll_kick',
        'alert_officers', // Moderators should be able to alert officers
        'log_officer_action'
    ];

    const isAuthorized = 
        isTrollOfficer || 
        (isBroadcaster && allowedBroadcasterActions.includes(action)) ||
        (isModerator && allowedModeratorActions.includes(action)) ||
        publicActions.includes(action) ||
        isPaidAction; // Allow paid actions to proceed to case logic (where fee is enforced)

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Forbidden: Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result;

    switch (action) {
      case "get_moderation_context": {
        result = {
          success: true,
          currentUser: user,
          officerProfile: profile,
          isPrivileged: isTrollOfficer || isBroadcaster || isModerator,
          isBroadcaster,
          isModerator,
          isTrollOfficer
        };
        break;
      }

      case "block_user": {
        const { targetUserId } = params;
        if (!targetUserId) throw new Error("Missing targetUserId");
        
        // Check if already blocked to avoid error? Or upsert?
        // Usually insert.
        const { error } = await supabaseAdmin
          .from('user_relationships')
          .insert({
            follower_id: user.id,
            following_id: targetUserId,
            status: 'blocked'
          });
          
        if (error) {
             // If duplicate, maybe update?
             if (error.code === '23505') { // Unique violation
                  const { error: updateError } = await supabaseAdmin
                    .from('user_relationships')
                    .update({ status: 'blocked' })
                    .eq('follower_id', user.id)
                    .eq('following_id', targetUserId);
                  if (updateError) throw updateError;
             } else {
                 throw error;
             }
        }
        
        result = { success: true };
        break;
      }

      case "report_user": {
        const { targetUserId, streamId, reason, description } = params;
        if (!targetUserId || !reason) throw new Error("Missing required fields");

        const { error } = await supabaseAdmin
          .from('user_reports')
          .insert({
             reporter_id: user.id,
             reported_id: targetUserId,
             reason,
             description: description || '',
             stream_id: streamId || null,
             status: 'pending'
          });

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "join_stream_box": {
        const { room, seatIndex, username, avatarUrl, role, metadata, joinPrice } = params;
        if (!room || seatIndex === undefined) throw new Error("Missing required fields");

        const safeSeatIndex = Number(seatIndex);
        const userId = user.id;

        // 1. Check for bans
        const { data: banRow, error: _banError } = await supabaseAdmin
          .from("broadcast_seat_bans")
          .select("banned_until")
          .eq("room", room)
          .eq("user_id", userId)
          .maybeSingle();

        if (banRow) {
          const bannedUntil = banRow.banned_until ? new Date(banRow.banned_until) : null;
          const now = new Date();
          if (!bannedUntil || bannedUntil > now) {
             throw new Error("You are temporarily restricted from joining the guest box.");
          }
        }

        // 2. Deduct Coins if needed
        if (joinPrice && joinPrice > 0) {
           const { data: _deductData, error: deductError } = await supabaseAdmin.rpc('deduct_user_troll_coins', {
              p_user_id: userId,
              p_amount: String(joinPrice),
              p_coin_type: 'troll_coins'
           });

           if (deductError) {
              console.error("Deduction failed:", deductError);
              throw new Error("Failed to process payment: " + deductError.message);
           }
           
           // Log transaction
           await supabaseAdmin.from('coin_transactions').insert({
              user_id: userId,
              amount: -joinPrice,
              transaction_type: 'perk_purchase',
              coin_type: 'troll_coins',
              description: `Joined seat ${safeSeatIndex} in broadcast`,
              metadata: {
                 seatIndex: safeSeatIndex,
                 room,
                 ...metadata
              }
           });
        }

        // 3. Claim Seat
        const { data, error } = await supabaseAdmin.rpc("claim_broadcast_seat", {
          p_room: room,
          p_seat_index: safeSeatIndex,
          p_user_id: userId,
          p_username: username ?? profile.username,
          p_avatar_url: avatarUrl ?? profile.avatar_url ?? null,
          p_role: role ?? profile.role,
          p_metadata: metadata ?? {},
        });

        if (error) throw error;
        result = { success: true, seat: data?.[0] };
        break;
      }

      case "leave_stream_box": {
        const { room, seatIndex, force, banMinutes, banPermanent } = params;
        if (!room) throw new Error("Missing room");

        // Permission check for force removal
        if (force) {
            // Re-verify authority just in case
            if (!isTrollOfficer && !isBroadcaster && !isModerator) {
                throw new Error("Unauthorized to force remove users");
            }
        }

        const { data, error } = await supabaseAdmin.rpc("release_broadcast_seat", {
            p_room: room,
            p_seat_index: seatIndex ? Number(seatIndex) : null,
            p_user_id: user.id, 
            p_force: Boolean(force)
        });

        if (error) throw error;

        // Handle banning if requested and authorized
        if ((banMinutes || banPermanent) && (isTrollOfficer || isBroadcaster || isModerator)) {
             const bannedUntil = banPermanent
              ? null
              : new Date(Date.now() + (Number(banMinutes) * 60 * 1000)).toISOString();

             await supabaseAdmin
                .from("broadcast_seat_bans")
                .upsert(
                  {
                    room,
                    user_id: data?.[0]?.user_id, // We need the user_id of the person who was removed. 
                    banned_until: bannedUntil,
                    created_by: user.id,
                  },
                  { onConflict: "room,user_id" }
                );
        }

        result = { success: true, seat: data?.[0] };
        break;
      }

      case "list_stream_seats": {
         const { room } = params;
         if (!room) throw new Error("Missing room");
         
         const { data: seats, error } = await supabaseAdmin
            .from("broadcast_seats")
            .select("*")
            .eq("room", room);
            
         if (error) throw error;
         result = { success: true, seats: seats || [] };
         break;
      }

      case "get_seat_bans": {
        const { room } = params;
        if (!room) throw new Error("Missing room");

        if (!isTrollOfficer && !isBroadcaster && !isModerator) {
           throw new Error("Unauthorized to view ban list");
        }

        const { data, error } = await supabaseAdmin
          .from('broadcast_seat_bans')
          .select('id,user_id,banned_until,created_at,reason')
          .eq('room', room)
          .order('created_at', { ascending: false });

        if (error) throw error;
        result = { success: true, bans: data };
        break;
      }
      
      case "get_stream": {
        const { streamId } = params;
        if (!streamId) throw new Error("Missing streamId");

        const { data, error } = await supabaseAdmin
            .from('streams')
            .select('*')
            .eq('id', streamId)
            .single();

        if (error) throw error;
        result = { success: true, stream: data };
        break;
      }

      case "get_stream_status": {
        const { streamId } = params;
        if (!streamId) throw new Error("Missing streamId");

        const { data, error } = await supabaseAdmin
            .from('streams')
            .select('status, is_live')
            .eq('id', streamId)
            .single();

        if (error) throw error;
        result = { success: true, status: data };
        break;
      }

      case "get_quick_gifts": {
        const { data, error } = await supabaseAdmin
            .from('gift_items')
            .select('*')
            .order('value', { ascending: true });
            
        if (error) throw error;
        result = { success: true, gifts: data || [] };
        break;
      }

      case "send_stream_message": {
        const { streamId, content, type } = params;
        if (!streamId || !content) throw new Error("Missing content");

        const { error } = await supabaseAdmin
            .from('stream_chat_messages')
            .insert({
                stream_id: streamId,
                user_id: user.id,
                content,
                type: type || 'chat',
                is_visible: true
            });

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "alert_officers": {
        const { streamId, reason } = params;
        if (!streamId) throw new Error("Missing streamId");

        // Create a panic alert
        const { error } = await supabaseAdmin
            .from('creator_panic_alerts')
            .insert({
                stream_id: streamId,
                creator_id: user.id,
                reason: reason || 'Help requested',
                status: 'active'
            });

        if (error) throw error;
        result = { success: true, message: 'Officers alerted' };
        break;
      }

      case "mute_participant": {
          const { streamId, targetUserId, duration } = params;
          if (!streamId || !targetUserId) throw new Error("Missing params");

          // Insert into mutes table (assuming one exists or handle via chat permissions)
          // For now, let's assume we just log it as a moderation action which triggers triggers
          const { error } = await supabaseAdmin.rpc('mute_user_in_stream', {
              p_stream_id: streamId,
              p_user_id: targetUserId,
              p_duration_minutes: duration || 5
          });

          if (error) throw error;
          result = { success: true };
          break;
      }

      case "kick_participant": {
          const { streamId, targetUserId } = params;
           if (!streamId || !targetUserId) throw new Error("Missing params");
           
           // Remove from participants
           const { error } = await supabaseAdmin
             .from('streams_participants')
             .delete()
             .eq('stream_id', streamId)
             .eq('user_id', targetUserId);
             
           if (error) throw error;
           result = { success: true };
           break;
      }

      case "disable_chat": {
          const { streamId, disabled } = params;
           if (!streamId) throw new Error("Missing params");
           
           const { error } = await supabaseAdmin
             .from('streams')
             .update({ chat_disabled: disabled })
             .eq('id', streamId);
             
           if (error) throw error;
           result = { success: true };
           break;
      }
      
      case "end_stream": {
           const { streamId } = params;
           if (!streamId) throw new Error("Missing params");
           
           const { error } = await supabaseAdmin
             .from('streams')
             .update({ status: 'ended', ended_at: new Date().toISOString() })
             .eq('id', streamId);
             
           if (error) throw error;
           result = { success: true };
           break;
      }

      case "log_officer_action": {
        // Just a logger pass-through, since logic is in the officer_actions table trigger usually
        // But we can insert manually too
        const { actionType, details, targetUserId, streamId } = params;
        
        const { error } = await supabaseAdmin
            .from('officer_actions')
            .insert({
                officer_id: user.id,
                action_type: actionType,
                target_user_id: targetUserId,
                stream_id: streamId,
                details: details || {}
            });

        if (error) throw error;
        result = { success: true };
        break;
      }
      
      case "approve_officer_application": {
        if (!isLeadOfficer) throw new Error("Unauthorized: Lead Officer only");
        const { userId } = params;
        if (!userId) throw new Error("Missing userId");

        // 1. Call RPC to approve application
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('approve_officer_application', {
            p_user_id: userId
        });

        if (rpcError) throw rpcError;
        if (!rpcData?.success) {
             throw new Error(rpcData?.error || 'Failed to approve officer application via RPC');
        }

        // 2. Activate officer in profiles
        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .update({
            is_officer_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case "approve_lead_application": {
        if (!isLeadOfficer) throw new Error("Unauthorized: Lead Officer only");
        const { applicationId } = params;
        if (!applicationId) throw new Error("Missing applicationId");

        const { data, error } = await supabaseAdmin
          .from('applications')
          .update({
            lead_officer_approved: true,
            lead_officer_reviewed_by: user.id,
            lead_officer_reviewed_at: new Date().toISOString()
          })
          .eq('id', applicationId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }
      
      case "get_officer_shifts": {
          // This should probably be in officer-actions or admin-actions
          // But if we are here...
          const { limit } = params;
          const { data, error } = await supabaseAdmin
            .from('officer_work_sessions')
            .select('*, officer:officer_id(username, avatar_url)')
            .order('clock_in', { ascending: false })
            .limit(limit || 20);
            
          if (error) throw error;
          result = { success: true, shifts: data };
          break;
      }

      case "get_stream_viewers": {
        const { streamId } = params;
        if (!streamId) throw new Error("Missing streamId");

        // Get count
        const { count, error: countError } = await supabaseAdmin
            .from('stream_viewers')
            .select('*', { count: 'exact', head: true })
            .eq('stream_id', streamId);

        if (countError) throw countError;

        // Get recent viewers (limit 50)
        const { data: viewers, error: viewersError } = await supabaseAdmin
            .from('stream_viewers')
            .select('user_id, last_seen, user:user_profiles(id, username, avatar_url)')
            .eq('stream_id', streamId)
            .order('last_seen', { ascending: false })
            .limit(50);

        if (viewersError) throw viewersError;

        // Map to expected format
        const mappedViewers = viewers?.map((v: any) => ({
            userId: v.user_id,
            username: v.user?.username,
            avatarUrl: v.user?.avatar_url,
            lastSeen: v.last_seen
        })) || [];

        result = { 
            success: true, 
            count: count || 0, 
            viewers: mappedViewers 
        };
        break;
      }

      case "get_active_battle": {
          const { broadcasterId } = params;
          if (!broadcasterId) throw new Error("Missing broadcasterId");

          const { data: battle, error } = await supabaseAdmin
             .from('troll_battles')
             .select('*')
             .or(`player1_id.eq.${broadcasterId},player2_id.eq.${broadcasterId}`)
             .eq('status', 'active')
             .maybeSingle();

          if (error) throw error;
          
          if (battle) {
             result = { success: true, battle, active: true };
          } else {
             result = { success: true, active: false };
          }
          break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in officer-actions:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
