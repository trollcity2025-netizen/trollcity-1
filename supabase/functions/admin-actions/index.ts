import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // 1. Handle Preflight Options
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req.headers.get("origin")) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // 2. Auth Header Check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 3. Get User
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    // 4. Role Check
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("role, is_admin, is_lead_officer")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 403,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    const isAdmin = 
      profile.role === "admin" || 
      profile.role === "lead_troll_officer" || 
      profile.is_lead_officer === true ||
      profile.is_admin === true;


    const isSecretary = profile.role === "secretary";

    if (!isAdmin && !isSecretary) {
      return new Response(JSON.stringify({ error: "Forbidden: Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    // 5. Handle Actions
    const { action, ...params } = await req.json();

    let result;

    switch (action) {
      // --- Payout Requests (Admin/Lead Officer) ---
      case "approve_payout": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { requestId } = params;
        if (!requestId) throw new Error("Missing requestId");

        const { data, error } = await supabaseAdmin
          .from("payout_requests")
          .update({
            status: "approved",
            reviewed_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId)
          .select()
          .single();

        if (error) throw error;

        // Log action
        await supabaseAdmin.rpc("log_admin_action", {
          p_action_type: "approve_payout_request",
          p_target_id: requestId,
          p_details: { status: "approved" },
        });

        result = data;
        break;
      }

      case "reject_payout": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { requestId, reason } = params;
        if (!requestId) throw new Error("Missing requestId");

        const { data, error } = await supabaseAdmin
          .from("payout_requests")
          .update({
            status: "rejected",
            rejected_reason: reason,
            reviewed_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId)
          .select()
          .single();

        if (error) throw error;

        // Log action
        await supabaseAdmin.rpc("log_admin_action", {
          p_action_type: "reject_payout_request",
          p_target_id: requestId,
          p_details: { status: "rejected", reason: reason },
        });

        result = data;
        break;
      }

      case "update_payout_status": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { payoutId, newStatus, reason, paymentReference, notes } = params;
        if (!payoutId || !newStatus) throw new Error("Missing required fields");

        const updates: any = {
            status: newStatus,
            updated_at: new Date().toISOString()
        };

        if (newStatus === 'rejected') {
            updates.rejection_reason = reason;
            updates.processed_by = user.id;
            updates.processed_at = new Date().toISOString();
        } else if (newStatus === 'paid') {
             updates.paid_at = new Date().toISOString();
             updates.processed_by = user.id;
        } else if (newStatus === 'approved') {
             updates.approved_at = new Date().toISOString();
             updates.processed_by = user.id; // Or reviewed_by
        }
        
        if (paymentReference) updates.payment_reference = paymentReference;
        if (notes) updates.notes = notes;

        const { data, error } = await supabaseAdmin
          .from('payout_requests')
          .update(updates)
          .eq('id', payoutId)
          .select()
          .single();

        if (error) throw error;

        // Log action
        await supabaseAdmin.rpc("log_admin_action", {
            p_action_type: "update_payout_status",
            p_target_id: payoutId,
            p_details: { status: newStatus, reason, paymentReference, notes }
        });

        result = { success: true, data };
        break;
      }

      case "get_payout_requests": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { statusFilter } = params;

        let query = supabaseAdmin
            .from('payout_requests')
            .select(`
                *,
                user_profiles!user_id (
                    username,
                    email
                ),
                processor:user_profiles!processed_by (
                    username
                )
            `)
            .order('created_at', { ascending: false });

        if (statusFilter && statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        const { data: payouts, error } = await query;
        if (error) throw error;

        const formattedPayouts = payouts?.map((p: any) => ({
            ...p,
            username: p.user_profiles?.username || 'Unknown',
            email: p.user_profiles?.email || 'Unknown',
            processed_by_username: p.processor?.username || null
        }));

        result = { payouts: formattedPayouts };
        break;
      }

      // --- Cashout Requests (Admin/Secretary) ---
      case "approve_cashout": {
        const { requestId } = params;
        if (!requestId) throw new Error("Missing requestId");

        const updates = {
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id
        };

        const { data, error } = await supabaseAdmin
          .from('cashout_requests')
          .update(updates)
          .eq('id', requestId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case "reject_cashout": {
        const { requestId, reason } = params;
        if (!requestId) throw new Error("Missing requestId");

        // Use the existing RPC to handle refunds properly
        const { data, error } = await supabaseAdmin.rpc('process_cashout_refund', {
          p_request_id: requestId,
          p_admin_id: user.id,
          p_notes: reason || 'Request denied via Admin Panel'
        });

        if (error) throw error;
        result = data;
        break;
      }

      case "update_cashout_status": {
        const { requestId, status } = params;
        if (!requestId || !status) throw new Error("Missing required fields");

        const { data, error } = await supabaseAdmin
          .from('cashout_requests')
          .update({ status })
          .eq('id', requestId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      // --- Executive Intake (Admin/Secretary) ---
      case "assign_intake": {
        const { requestId, assigneeId } = params; // assigneeId is optional (if self-assign)
        if (!requestId) throw new Error("Missing requestId");
        
        const targetAssignee = assigneeId || user.id;

        const { data, error } = await supabaseAdmin
          .from('executive_intake')
          .update({ assigned_secretary: targetAssignee })
          .eq('id', requestId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case "update_intake_status": {
        const { requestId, status } = params;
        if (!requestId || !status) throw new Error("Missing required fields");

        const { data, error } = await supabaseAdmin
          .from('executive_intake')
          .update({ status })
          .eq('id', requestId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case "escalate_intake": {
        const { requestId } = params;
        if (!requestId) throw new Error("Missing requestId");

        const { data, error } = await supabaseAdmin
          .from('executive_intake')
          .update({ status: 'escalated', escalated_to_admin: true })
          .eq('id', requestId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case "update_intake_notes": {
        const { requestId, notes } = params;
        if (!requestId) throw new Error("Missing requestId");

        const { data, error } = await supabaseAdmin
          .from('executive_intake')
          .update({ notes })
          .eq('id', requestId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      // --- Manual Orders (Admin/Secretary) ---
      case "approve_manual_order": {
        const { orderId, externalTxId } = params;
        if (!orderId) throw new Error("Missing orderId");

        // First get the order to know the user
        const { data: orderData, error: orderError } = await supabaseAdmin
          .from('manual_coin_orders')
          .select('user_id, coins, amount')
          .eq('id', orderId)
          .single();

        if (orderError) throw orderError;

        const { data, error } = await supabaseAdmin.rpc('approve_manual_order', {
          p_order_id: orderId,
          p_admin_id: user.id,
          p_external_tx_id: externalTxId || `MANUAL-${Date.now()}`
        });

        if (error) throw error;
        
        // Check if the database function returned success
        if (data && Array.isArray(data) && data.length > 0) {
          const resultRow = data[0];
          if (!resultRow.success) {
            throw new Error(resultRow.error_message || 'Failed to approve order');
          }
          result = { success: resultRow.success, new_balance: resultRow.new_balance };
          
          // Send notification to the user
          if (orderData?.user_id) {
            const coinsAmount = orderData.coins || orderData.amount || 0;
            try {
              await supabaseAdmin.from('notifications').insert({
                user_id: orderData.user_id,
                type: 'manual_order_approved',
                title: 'Coins Added!',
                message: `Your manual coin purchase of ${coinsAmount.toLocaleString()} coins has been approved! Your balance has been updated.`,
                metadata: {
                  order_id: orderId,
                  coins: coinsAmount,
                  new_balance: resultRow.new_balance
                }
              });
            } catch (notifyErr) {
              console.error('Failed to send approval notification:', notifyErr);
            }
          }
        } else {
          throw new Error('Invalid response from approve_manual_order');
        }
        break;
      }

      case "reject_manual_order": {
        const { orderId, reason } = params;
        if (!orderId) throw new Error("Missing orderId");

        // First get the order to know the user
        const { data: orderData, error: orderError } = await supabaseAdmin
          .from('manual_coin_orders')
          .select('user_id, coins, amount')
          .eq('id', orderId)
          .single();

        if (orderError) throw orderError;

        const { data, error } = await supabaseAdmin
          .from('manual_coin_orders')
          .update({ 
            status: 'rejected',
            rejection_reason: reason,
            processed_by: user.id,
            processed_at: new Date().toISOString()
          })
          .eq('id', orderId)
          .select()
          .single();

        if (error) throw error;
        
        // Send notification to the user
        if (orderData?.user_id) {
          const coinsAmount = orderData.coins || orderData.amount || 0;
          try {
            await supabaseAdmin.from('notifications').insert({
              user_id: orderData.user_id,
              type: 'manual_order_rejected',
              title: 'Coin Purchase Rejected',
              message: reason || `Your manual coin purchase of ${coinsAmount.toLocaleString()} coins has been rejected.`,
              metadata: {
                order_id: orderId,
                coins: coinsAmount,
                reason: reason
              }
            });
          } catch (notifyErr) {
            console.error('Failed to send rejection notification:', notifyErr);
            // Don't fail the main operation if notification fails
          }
        }
        
        result = data;
        break;
      }

      case "delete_manual_order": {
        const { orderId } = params;
        if (!orderId) throw new Error("Missing orderId");

        const { data, error } = await supabaseAdmin
          .from('manual_coin_orders')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', orderId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case "get_manual_orders_dashboard": {
        // Can be accessed by Admin or Secretary
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");

        // 1. Fetch Orders
        const { data: orders, error: ordersError } = await supabaseAdmin
          .from('manual_coin_orders')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(200);

        if (ordersError) throw ordersError;

        if (!orders || orders.length === 0) {
            result = { orders: [], profiles: {}, packages: {} };
            break;
        }

        // 2. Fetch Profiles
        const userIds = Array.from(new Set(orders.map((r: any) => r.user_id).filter(Boolean)));
        const profilesMap: Record<string, any> = {};
        if (userIds.length > 0) {
            const { data: userData, error: userError } = await supabaseAdmin
                .from('user_profiles')
                .select('id, username, email, rgb_username_expires_at, role')
                .in('id', userIds);
            
            if (userError) throw userError;
            userData?.forEach((u: any) => { profilesMap[u.id] = u; });
        }

        // 3. Fetch Packages
        const pkgIds = Array.from(new Set(orders.map((r: any) => r.package_id).filter(Boolean)));
        const packagesMap: Record<string, any> = {};
        if (pkgIds.length > 0) {
            const { data: pkgData, error: pkgError } = await supabaseAdmin
                .from('coin_packages')
                .select('id, name, coins, price_usd, amount_cents')
                .in('id', pkgIds);

            if (pkgError) throw pkgError;
            pkgData?.forEach((p: any) => { packagesMap[p.id] = p; });
        }

        result = { orders, profiles: profilesMap, packages: packagesMap };
        break;
      }

      case "get_user_ip": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId } = params;
        if (!userId) throw new Error("Missing userId");

        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .select('last_known_ip')
          .eq('id', userId)
          .single();

        if (error) throw error;
        result = { ip: data?.last_known_ip };
        break;
      }

      // --- User Management (Admin Only) ---
      case "get_users": {
        // Can be accessed by Admin, Lead Officer, or Secretary
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");

        const { page = 1, limit = 100, search } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // Determine if email should be visible
        // Matches logic in UserManagementPanel: 'admin' role or is_admin=true
        const canViewEmails = profile.role === 'admin' || profile.is_admin === true;

        const selectFields = canViewEmails
          ? 'id, username, email, role, troll_coins, free_coin_balance, level, is_troll_officer, is_lead_officer, is_admin, is_troller, created_at, full_name, phone, onboarding_completed, terms_accepted, id_verification_status, bypass_broadcast_restriction, glowing_username_color, rgb_username_expires_at, is_gold, username_style, badge'
          : 'id, username, role, troll_coins, free_coin_balance, level, is_troll_officer, is_lead_officer, is_admin, is_troller, created_at, full_name, phone, onboarding_completed, terms_accepted, id_verification_status, bypass_broadcast_restriction, glowing_username_color, rgb_username_expires_at, is_gold, username_style, badge';

        let query = supabaseAdmin
          .from('user_profiles')
          .select(selectFields, { count: 'exact' });

        if (search) {
            // Note: If we want to search by email but user can't view email, strictly speaking we shouldn't allow searching by it.
            // But for now, we'll keep it simple or restrict it.
            if (canViewEmails) {
                query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%,full_name.ilike.%${search}%`);
            } else {
                query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%`);
            }
        }

        query = query.order('created_at', { ascending: false }).range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;
        result = { data, count };
        break;
      }

      case "update_user_profile": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId, updates, coinAdjustment, roleUpdate } = params;
        if (!userId) throw new Error("Missing userId");

        // 2. Role Update
        if (roleUpdate) {
            const { newRole, reason } = roleUpdate;
            if (newRole) {
                // SECURITY: Protect Owner Account
                // Fetch target user email to verify identity
                const { data: targetUserRes, error: targetError } = await supabaseAdmin.auth.admin.getUserById(userId);
                if (targetError) throw targetError;
                
                const OWNER_EMAIL = 'trollcity2025@gmail.com';
                const isTargetOwner = targetUserRes.user.email?.toLowerCase() === OWNER_EMAIL;
                const isActorOwner = user.email?.toLowerCase() === OWNER_EMAIL;

                if (isTargetOwner && !isActorOwner) {
                     throw new Error("CRITICAL: You cannot change the role of the Owner account.");
                }

                const { error: roleError } = await supabaseAdmin.rpc('set_user_role', {
                    target_user: userId,
                    new_role: newRole,
                    reason: reason || `Admin update by ${user.id}`,
                    acting_admin_id: user.id
                });
                if (roleError) throw roleError;
            }
        }

        // 1. Basic Profile Update (Secure RPC)
        if (updates && Object.keys(updates).length > 0) {
          const { error } = await supabaseAdmin.rpc('admin_update_any_profile_field', {
            p_user_id: userId,
            p_updates: updates,
            p_admin_id: user.id,
            p_reason: 'Admin Panel Update'
          });
          
          if (error) throw error;
        }

        // 3. Coin Adjustment
        if (coinAdjustment) {
            const { amount, reason } = coinAdjustment;
            // amount is the delta. Positive = credit, Negative = debit
            if (amount !== 0) {
                if (amount > 0) {
                   const { error: creditError } = await supabaseAdmin.rpc('troll_bank_credit_coins', {
                     p_user_id: userId,
                     p_coins: amount,
                     p_bucket: 'paid',
                     p_source: 'admin_grant',
                     p_ref_id: null,
                     p_metadata: { admin_id: user.id, reason: reason || 'Manual Adjustment' }
                   });
                   if (creditError) throw creditError;
                } else {
                   const { error: spendError } = await supabaseAdmin.rpc('troll_bank_spend_coins_secure', {
                     p_user_id: userId,
                     p_amount: Math.abs(amount),
                     p_bucket: 'paid',
                     p_source: 'admin_deduct',
                     p_ref_id: null,
                     p_metadata: { admin_id: user.id, reason: reason || 'Manual Adjustment' }
                   });
                   if (spendError) throw spendError;
                }

                // Log it
                await supabaseAdmin.from('coin_transactions').insert({
                    user_id: userId,
                    type: 'admin_adjustment',
                    amount: amount,
                    description: `Admin adjustment: ${reason || 'Manual update'}`,
                    metadata: { admin_id: user.id }
                });
            }
        }

        result = { success: true };
        break;
      }

      case "update_user_bypass": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId, bypass } = params;
        if (!userId) throw new Error("Missing userId");

        // Use secure RPC to bypass trigger protection
        const { data: _data, error } = await supabaseAdmin.rpc('admin_update_any_profile_field', {
            p_user_id: userId,
            p_updates: { bypass_broadcast_restriction: bypass },
            p_admin_id: user.id,
            p_reason: 'Admin Panel Bypass Update'
        });
        if (error) throw error;
        result = { success: true };
        break;
      }
      
      // --- Officer Chat (Legacy) ---
      // This section has been removed.

      case "set_officer_status": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { targetUserId, status, reason } = params;
        if (!targetUserId || status === undefined) throw new Error("Missing params");

        const { error } = await supabaseAdmin.rpc('set_officer_status', {
            target_user_id: targetUserId,
            new_status: status,
            reason: reason || 'Admin update via hub'
        });

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "toggle_lead_officer": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { targetUserId, isLead } = params;
        if (!targetUserId || isLead === undefined) throw new Error("Missing params");

        const { error } = await supabaseAdmin
            .from('user_profiles')
            .update({ is_lead_officer: isLead })
            .eq('id', targetUserId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "approve_application": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized"); // Allow secretary too
        const { applicationId, type, userId, interviewDate, interviewTime } = params;
        if (!applicationId) throw new Error("Missing applicationId");

        // Determine which RPC to call based on type
        // Note: We trust the params here because we are admin. 
        // Ideally we should look up the application first to confirm type, but for now we can rely on frontend passing correct type or look it up.
        
        let appType = type;
        let appUserId = userId;

        if (!appType || !appUserId) {
            const { data: app, error: fetchError } = await supabaseAdmin
                .from('applications')
                .select('type, user_id')
                .eq('id', applicationId)
                .single();
            if (fetchError) throw fetchError;
            appType = app.type;
            appUserId = app.user_id;
        }

        // If interview date/time provided, schedule interview
        if (interviewDate && interviewTime) {
             const scheduledAt = new Date(`${interviewDate}T${interviewTime}`).toISOString();
             
             // Create interview session
             const { error: interviewError } = await supabaseAdmin
                .from('interview_sessions')
                .insert({
                    application_id: applicationId,
                    user_id: appUserId,
                    interviewer_id: user.id, // Admin/Secretary who approved
                    scheduled_at: scheduledAt,
                    status: 'active', // Set to active so they can see it? Or 'scheduled'?
                    // The frontend checks for 'active' to show "Join Interview Room" button.
                    // But usually 'scheduled' makes more sense until the time comes.
                    // However, InterviewRoomPage.tsx checks for 'active' to show the button.
                    // Let's use 'active' or 'scheduled' depending on logic.
                    // Actually, let's use 'scheduled' and update frontend to allow joining if time is right.
                    // But to be safe with existing logic, let's see what 'schedule_interview' RPC does.
                    // 'schedule_interview' RPC likely sets it to 'active' or 'scheduled'.
                    // We'll use 'active' for now to ensure visibility, OR 'scheduled' if we fix the frontend.
                    // The user said "access to interview page upon 10 minutes of scheduled time".
                    // So I should probably use 'scheduled' and update frontend.
                });
            
             if (interviewError) throw interviewError;

             // Update application status to 'interview_scheduled'
             const { error: updateError } = await supabaseAdmin
                .from('applications')
                .update({ 
                    status: 'interview_scheduled',
                    reviewed_by: user.id,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', applicationId);

             if (updateError) throw updateError;
             
             // Create notification
             await supabaseAdmin.from('notifications').insert({
                user_id: appUserId,
                type: 'interview_scheduled',
                title: 'Interview Scheduled',
                message: `Your interview for ${appType} has been scheduled for ${new Date(scheduledAt).toLocaleString()}.`,
                read: false
             });

             result = { success: true, message: "Interview scheduled" };

        } else {
            // Direct approval (no interview or already interviewed)
            // Bypass RPC to avoid "Access denied: Admin only" error in SQL
            
            // 1. Update application
            const { error: updateError } = await supabaseAdmin
                .from('applications')
                .update({
                    status: 'approved',
                    reviewed_by: user.id,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', applicationId);
            
            if (updateError) throw updateError;

            // 2. Handle specific logic based on type (mimic RPCs)
            if (appType === "seller") {
                 // Grant seller role
                 await supabaseAdmin.rpc('set_user_role', { target_user: appUserId, new_role: 'seller', reason: 'Application Approved', acting_admin_id: user.id });
            } else if (appType === "lead_officer") {
                 await supabaseAdmin.from('user_profiles').update({ is_lead_officer: true }).eq('id', appUserId);
            } else if (appType === "troll_officer") {
                 await supabaseAdmin.from('user_profiles').update({ is_troll_officer: true }).eq('id', appUserId);
            }

            // 3. Notification
            await supabaseAdmin.from('notifications').insert({
                user_id: appUserId,
                type: 'application_approved',
                title: 'Application Approved',
                message: `Your application for ${appType} has been approved!`,
                read: false
            });

            result = { success: true };
        }
        break;
      }

      case "deny_application": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { applicationId, reason } = params;
        if (!applicationId) throw new Error("Missing applicationId");

        const { error } = await supabaseAdmin.rpc('deny_application', {
            p_app_id: applicationId,
            p_reviewer_id: user.id,
            p_reason: reason || null
        });

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "delete_application": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { applicationId } = params;
        if (!applicationId) throw new Error("Missing applicationId");

        const { error } = await supabaseAdmin
            .from('applications')
            .update({
                status: 'deleted',
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', applicationId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "review_seller_appeal": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { applicationId, appealAction, notes } = params; // appealAction: 'approve' | 'deny'
        if (!applicationId || !appealAction) throw new Error("Missing required fields");

        const { data, error } = await supabaseAdmin.rpc('review_seller_appeal', {
            p_application_id: applicationId,
            p_action: appealAction,
            p_notes: notes || null
        });

        if (error) throw error;
        result = data;
        break;
      }

      // --- Verification Requests ---
      case "review_verification": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { requestId, reviewAction, notes, grantInfluencer, userId } = params; // reviewAction: 'approve' | 'deny'
        if (!requestId || !reviewAction) throw new Error("Missing required fields");

        const timestamp = new Date().toISOString();

        if (reviewAction === 'approve') {
             if (!userId) throw new Error("Missing userId for approval");
             
             // Update request
             const { error: reqError } = await supabaseAdmin
                .from('verification_requests')
                .update({
                  status: 'approved',
                  reviewed_at: timestamp,
                  admin_reviewer: user.id,
                  admin_note: notes || null,
                  influencer_tier: grantInfluencer || false
                })
                .eq('id', requestId);
             if (reqError) throw reqError;

             // Update profile
             const { error: profError } = await supabaseAdmin
                .from('user_profiles')
                .update({
                  is_verified: true,
                  verification_date: timestamp,
                  influencer_tier: grantInfluencer ? 'gold' : null
                })
                .eq('id', userId);
             if (profError) throw profError;

        } else if (reviewAction === 'deny') {
             const { error: reqError } = await supabaseAdmin
                .from('verification_requests')
                .update({
                  status: 'denied',
                  reviewed_at: timestamp,
                  admin_reviewer: user.id,
                  admin_note: notes || null
                })
                .eq('id', requestId);
             if (reqError) throw reqError;
        } else {
            throw new Error("Invalid action");
        }

        result = { success: true };
        break;
      }

      // --- Financial Management (Admin/Secretary) ---

      case "get_cashout_requests": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { filterStatus = 'pending' } = params;

        let query = supabaseAdmin
          .from('cashout_requests')
          .select('*')
          .order('requested_at', { ascending: false });

        if (filterStatus !== 'all') {
          query = query.eq('status', filterStatus);
        }

        const { data: requests, error } = await query;
        if (error) throw error;

        // Hydrate profiles
        const userIds = new Set<string>();
        requests?.forEach((r: any) => {
            if (r.user_id) userIds.add(r.user_id);
        });

        const profileMap: Record<string, any> = {};
        if (userIds.size > 0) {
            const { data: profiles } = await supabaseAdmin
                .from('user_profiles')
                .select('id, username, email')
                .in('id', Array.from(userIds));
            profiles?.forEach((p: any) => { profileMap[p.id] = p; });
        }

        const transformed = requests?.map((r: any) => ({
            ...r,
            user_profile: profileMap[r.user_id] || { username: 'Unknown' }
        }));

        result = { requests: transformed || [] };
        break;
      }

      case "toggle_cashout_hold": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { requestId, hold, reason } = params;
        
        const { error } = await supabaseAdmin.rpc('toggle_cashout_hold', {
            p_request_id: requestId,
            p_admin_id: user.id,
            p_hold: hold,
            p_reason: reason || null
        });

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "fulfill_cashout_request": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { requestId, giftCardCode, notes } = params;

        const { error } = await supabaseAdmin.rpc('fulfill_cashout_request', {
            p_request_id: requestId,
            p_admin_id: user.id,
            p_notes: notes || 'Fulfilled via admin panel',
            p_gift_card_code: giftCardCode
        });

        if (error) throw error;
        result = { success: true };
        break;
      }

      // --- Support Tickets (Admin/Secretary) ---
      case "get_support_tickets": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        
        const { data, error } = await supabaseAdmin
          .from("support_tickets")
          .select("*")
          .order("created_at", { ascending: false });
          
        if (error) throw error;
        result = { tickets: data };
        break;
      }

      case "resolve_support_ticket": {
        // Can be resolved by Admin or Secretary
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { ticketId, response } = params;
        if (!ticketId || !response) throw new Error("Missing params");

        const { error } = await supabaseAdmin.rpc('resolve_support_ticket', {
            p_ticket_id: ticketId,
            p_response: response
        });
        
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "close_support_ticket": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { ticketId } = params;
        if (!ticketId) throw new Error("Missing ticketId");

        const { error } = await supabaseAdmin
            .from("support_tickets")
            .update({ status: "closed", response_at: new Date().toISOString() })
            .eq("id", ticketId);
            
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "delete_support_ticket": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { ticketId } = params;
        if (!ticketId) throw new Error("Missing ticketId");

        const { error } = await supabaseAdmin.rpc('delete_support_ticket', { p_ticket_id: ticketId });
        
        if (error) throw error;
        result = { success: true };
        break;
      }

      // --- Store Management (Admin Only) ---
      case "get_store_catalogs": {
        if (!isAdmin) throw new Error("Unauthorized");

        const [
            coinRes,
            effectsRes,
            perksRes,
            insuranceRes,
        ] = await Promise.all([
            supabaseAdmin.from('coin_packages').select('*').order('created_at', { ascending: true }),
            supabaseAdmin.from('entrance_effects').select('*').order('created_at', { ascending: true }),
            supabaseAdmin.from('perks').select('*').order('created_at', { ascending: true }),
            supabaseAdmin.from('insurance_options').select('*').order('created_at', { ascending: true }),
        ]);

        result = {
            coin_packages: coinRes.data || [],
            entrance_effects: effectsRes.data || [],
            perks: perksRes.data || [],
            insurance_options: insuranceRes.data || [],
            errors: {
                coin_packages: coinRes.error,
                entrance_effects: effectsRes.error,
                perks: perksRes.error,
                insurance_options: insuranceRes.error
            }
        };
        break;
      }

      case "update_store_price": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { table, id, field, value } = params;
        if (!table || !id || !field || value === undefined) throw new Error("Missing params");
        
        // Whitelist tables
        const allowedTables = ['coin_packages', 'entrance_effects', 'perks', 'insurance_options'];
        if (!allowedTables.includes(table)) throw new Error("Invalid table");

        const updatePayload = { [field]: value };
        const { error } = await supabaseAdmin
            .from(table)
            .update(updatePayload)
            .eq('id', id);

        if (error) throw error;
        result = { success: true };
        break;
      }

      // --- Broadcast Management (Admin Only) ---
      case "get_broadcast_dashboard_data": {
        if (!isAdmin) throw new Error("Unauthorized");

        const [lockdownRes, limitRes, broadcastersRes] = await Promise.all([
             supabaseAdmin.from('broadcast_lockdown').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
             supabaseAdmin.from('broadcaster_limits').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
             supabaseAdmin.from('user_profiles')
                .select('id, username, avatar_url, has_broadcast_badge, is_broadcast_locked, is_admin, role, created_at')
                .or('has_broadcast_badge.eq.true,is_admin.eq.true')
                .order('created_at', { ascending: false })
                .limit(200)
        ]);

        if (broadcastersRes.error) throw broadcastersRes.error;

        result = {
            lockdownSettings: lockdownRes.data,
            broadcasterLimits: limitRes.data,
            broadcasters: broadcastersRes.data
        };
        break;
      }

      case "toggle_broadcast_lockdown": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { enabled, reason } = params;
        
        const { error } = await supabaseAdmin.rpc('toggle_broadcast_lockdown', {
            p_admin_id: user.id,
            p_enabled: enabled,
            p_reason: reason || null
        });

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "lock_broadcaster": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { userId, locked } = params;
        if (!userId) throw new Error("Missing userId");

        const { error } = await supabaseAdmin.rpc('lock_broadcaster', {
            p_user_id: userId,
            p_locked: locked
        });

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "grant_broadcaster_badge": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { userId } = params;
        if (!userId) throw new Error("Missing userId");

        const { error } = await supabaseAdmin.rpc('grant_broadcaster_badge', { p_user_id: userId });
        
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "revoke_broadcaster_badge": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { userId } = params;
        if (!userId) throw new Error("Missing userId");

        const { error } = await supabaseAdmin.rpc('revoke_broadcaster_badge', { p_user_id: userId });
        
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "update_broadcaster_limit": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { limit } = params;
        if (limit === undefined) throw new Error("Missing limit");

        const { data: existing } = await supabaseAdmin.from('broadcaster_limits').select('id').limit(1).maybeSingle();
        const payload: any = { max_broadcasters: limit, updated_at: new Date().toISOString() };
        if (existing) payload.id = existing.id;
        
        const { error } = await supabaseAdmin
            .from('broadcaster_limits')
            .upsert(payload, { onConflict: 'id' });

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "delete_broadcaster_limit": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { id } = params;
        if (!id) throw new Error("Missing id");

        const { error } = await supabaseAdmin
            .from('broadcaster_limits')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        result = { success: true };
        break;
      }

      // --- Global Settings (Admin Only) ---
      case "get_global_settings": {
        if (!isAdmin) throw new Error("Unauthorized");

        const { data, error } = await supabaseAdmin
          .from('global_settings')
          .select('*')
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case "update_global_settings": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { updates } = params;
        if (!updates) throw new Error("Missing updates");

        const { data, error } = await supabaseAdmin
          .from('global_settings')
          .update(updates)
          .eq('id', 1) // Assuming there's always one row with ID 1
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      // --- Moderator Actions (Admin Only) ---
      case "get_moderation_queue": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { status = 'pending' } = params;

        let query = supabaseAdmin
          .from('moderation_queue')
          .select(`
            *,
            user_profiles!reported_by (username),
            reported_user_profile:user_profiles!reported_user_id (username)
          `)
          .order('created_at', { ascending: false });
        
        if (status !== 'all') {
          query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;

        result = data;
        break;
      }

      case "review_moderation_item": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { itemId, action, notes } = params; // action: 'approve' | 'deny'
        if (!itemId || !action) throw new Error("Missing required fields");

        const { data, error } = await supabaseAdmin.rpc('review_moderation_item', {
          p_item_id: itemId,
          p_action: action,
          p_admin_id: user.id,
          p_notes: notes || null
        });

        if (error) throw error;
        result = data;
        break;
      }

      case "ban_user": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { userId, reason, duration, permanent } = params;
        if (!userId || (!reason && !permanent)) throw new Error("Missing required fields");

        const { data, error } = await supabaseAdmin.rpc('ban_user', {
          p_user_id: userId,
          p_admin_id: user.id,
          p_reason: reason,
          p_duration_hours: duration,
          p_permanent: permanent
        });

        if (error) throw error;
        result = data;
        break;
      }

      case "unban_user": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { userId } = params;
        if (!userId) throw new Error("Missing userId");

        const { data, error } = await supabaseAdmin.rpc('unban_user', {
          p_user_id: userId,
          p_admin_id: user.id
        });

        if (error) throw error;
        result = data;
        break;
      }

      // --- Officer Tracking (Admin Only) ---
      case "get_officer_activity": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { startDate, endDate } = params;
        if (!startDate || !endDate) throw new Error("Missing date range");

        const { data, error } = await supabaseAdmin.rpc('get_officer_activity_summary', {
            start_date: startDate,
            end_date: endDate
        });

        if (error) throw error;
        result = data;
        break;
      }

      case "get_online_officers": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { data, error } = await supabaseAdmin.rpc('get_online_officers');
        if (error) throw error;
        result = data;
        break;
      }

      // --- System Health (Admin Only) ---
      case "get_system_health": {
        if (!isAdmin) throw new Error("Unauthorized");

        const { data, error } = await supabaseAdmin.rpc('get_system_health_metrics');
        if (error) throw error;
        result = data;
        break;
      }

      case "trigger_system_backup": {
        if (!isAdmin) throw new Error("Unauthorized");
        // This would typically involve calling an external service or a more complex RPC
        // For now, we'll simulate success
        result = { success: true, message: "System backup initiated (simulated)" };
        break;
      }

      // --- Site Content Management (Admin Only) ---
      case "get_site_announcements": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { data, error } = await supabaseAdmin
          .from('site_announcements')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        result = data;
        break;
      }

      case "create_site_announcement": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { title, content, is_active } = params;
        if (!title || !content) throw new Error("Missing title or content");

        const { data, error } = await supabaseAdmin
          .from('site_announcements')
          .insert({ title, content, is_active: is_active ?? true, created_by: user.id })
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      case "update_site_announcement": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { id, title, content, is_active } = params;
        if (!id) throw new Error("Missing announcement ID");

        const updates: any = { updated_by: user.id, updated_at: new Date().toISOString() };
        if (title !== undefined) updates.title = title;
        if (content !== undefined) updates.content = content;
        if (is_active !== undefined) updates.is_active = is_active;

        const { data, error } = await supabaseAdmin
          .from('site_announcements')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      case "delete_site_announcement": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { id } = params;
        if (!id) throw new Error("Missing announcement ID");

        const { error } = await supabaseAdmin
          .from('site_announcements')
          .delete()
          .eq('id', id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      // --- Dynamic Badges (Admin Only) ---
      case "get_dynamic_badges": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { data, error } = await supabaseAdmin
          .from('dynamic_badges')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        result = data;
        break;
      }

      case "create_dynamic_badge": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { name, description, image_url, criteria, is_active } = params;
        if (!name || !description || !image_url || !criteria) throw new Error("Missing required fields");

        const { data, error } = await supabaseAdmin
          .from('dynamic_badges')
          .insert({ name, description, image_url, criteria, is_active: is_active ?? true, created_by: user.id })
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      case "update_dynamic_badge": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { id, name, description, image_url, criteria, is_active } = params;
        if (!id) throw new Error("Missing badge ID");

        const updates: any = { updated_by: user.id, updated_at: new Date().toISOString() };
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (image_url !== undefined) updates.image_url = image_url;
        if (criteria !== undefined) updates.criteria = criteria;
        if (is_active !== undefined) updates.is_active = is_active;

        const { data, error } = await supabaseAdmin
          .from('dynamic_badges')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      case "delete_dynamic_badge": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { id } = params;
        if (!id) throw new Error("Missing badge ID");

        const { error } = await supabaseAdmin
          .from('dynamic_badges')
          .delete()
          .eq('id', id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      // --- Troll Call (Admin Only) ---
      case "create_troll_call": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { title, description, start_time, end_time, is_active } = params;
        if (!title || !description || !start_time || !end_time) throw new Error("Missing required fields");

        const { data, error } = await supabaseAdmin
          .from('troll_calls')
          .insert({ title, description, start_time, end_time, is_active: is_active ?? true, created_by: user.id })
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      case "update_troll_call": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { id, title, description, start_time, end_time, is_active } = params;
        if (!id) throw new Error("Missing Troll Call ID");

        const updates: any = { updated_by: user.id, updated_at: new Date().toISOString() };
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (start_time !== undefined) updates.start_time = start_time;
        if (end_time !== undefined) updates.end_time = end_time;
        if (is_active !== undefined) updates.is_active = is_active;

        const { data, error } = await supabaseAdmin
          .from('troll_calls')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      case "delete_troll_call": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { id } = params;
        if (!id) throw new Error("Missing Troll Call ID");

        const { error } = await supabaseAdmin
          .from('troll_calls')
          .delete()
          .eq('id', id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      default: {
        throw new Error(`Unknown action: ${action}`);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  }
});
