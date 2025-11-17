import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Trash2, Slash } from "lucide-react";
import UserBadges from "@/components/UserBadges";
import AdminUserActions from "@/components/admin/AdminUserActions";
import { safetyMonitor } from "@/utils/safetyMonitor";

// Function to check and ban users for repeated AI-detected offenses
const checkAndBanUserForRepeatedOffenses = async (userId, streamId, moderationResult) => {
  try {
    // Get recent kicks for this user (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentKicks, error: kicksError } = await supabase
      .from('user_kicks')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });

    if (kicksError) {
      console.warn('Failed to check recent kicks:', kicksError);
      return;
    }

    // Count AI-detected offenses
    const aiOffenses = recentKicks.filter(kick => kick.kicked_by === 'trae_ai_system');
    
    // Ban user for 3+ AI-detected offenses in 24 hours
    if (aiOffenses.length >= 2) {
      console.log(`Auto-banning user ${userId} for repeated AI-detected offenses (${aiOffenses.length} in 24h)`);
      
      // Get streamer ID for the ban
      const { data: stream, error: streamError } = await supabase
        .from('streams')
        .select('streamer_id')
        .eq('id', streamId)
        .single();

      if (streamError || !stream) {
        console.warn('Failed to get streamer ID for ban:', streamError);
        return;
      }

      // Create stream ban
      const { error: banError } = await supabase
        .from('user_stream_bans')
        .insert({
          user_id: userId,
          streamer_id: stream.streamer_id,
          reason: `TRAE.AI: Repeated safety violations (${moderationResult.category}) - ${aiOffenses.length + 1} offenses in 24h`,
          banned_by: 'trae_ai_system',
          is_active: true,
          created_date: new Date().toISOString()
        });

      if (banError) {
        console.warn('Failed to create auto-ban:', banError);
        return;
      }

      // Remove from current stream
      await supabase
        .from('stream_viewers')
        .delete()
        .eq('stream_id', streamId)
        .eq('user_id', userId);

      // Log the auto-ban action
      await supabase.from("moderation_actions").insert({
        stream_id: streamId,
        user_id: userId,
        action_type: "user_banned",
        reason: `TRAE.AI auto-ban: Repeated safety violations (${moderationResult.category})`,
        status: "completed",
        flagged_by: "trae_ai_system",
        ai_severity: moderationResult.severity
      });

      console.log(`User ${userId} auto-banned for repeated offenses`);
    }
  } catch (error) {
    console.error('Error checking repeated offenses:', error);
  }
};

export default function ChatBox({ stream, user, canModerate, isStreamer }) {
  const navigate = useNavigate();
  const streamId = stream?.id;
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  // Fetch currently active stream bans for this streamer
  const { data: streamBans = [] } = useQuery({
    queryKey: ["streamBans", stream?.id],
    queryFn: async () => {
      if (!stream?.streamer_id) return [];
      const { data, error } = await supabase
        .from('user_stream_bans')
        .select('*')
        .eq('streamer_id', stream.streamer_id)
        .eq('is_active', true);
      if (error) { console.warn('Failed to fetch stream bans:', error.message); return []; }
      return data || [];
    },
    enabled: !!stream?.streamer_id,
    refetchInterval: 5000,
  });

  const isUserBanned = (userId) => {

    const unkickMutation = useMutation({
      mutationFn: async (targetUserId) => {
        if (!streamId) throw new Error('Missing stream id');
        const { data: authData } = await supabase.auth.getUser();
        const current = authData?.user || null;
        if (!current) throw new Error('Not authenticated');
        if (current.id !== (stream?.streamer_id || stream?.broadcaster_id)) throw new Error('Only the broadcaster can unkick');

        const { error } = await supabase
          .from('user_stream_bans')
          .update({ is_active: false, removed_date: new Date().toISOString() })
          .eq('streamer_id', current.id)
          .eq('user_id', targetUserId)
          .eq('is_active', true);
        if (error) throw error;
        return targetUserId;
      },
      onSuccess: () => {
        queryClient.invalidateQueries(["streamBans", stream?.id]);
        toast.success('User unbanned from this stream');
      },
      onError: (err) => {
        console.error('Unkick failed', err);
        toast.error(err?.message || 'Failed to unkick user');
      }
    });
    if (!userId) return false;
    return Array.isArray(streamBans) && streamBans.some(b => String(b.user_id) === String(userId) && b.is_active);
  };

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["streamChat", streamId],
    queryFn: async () => {
      if (!streamId) return [];
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("stream_id", streamId)
        .is("deleted", null) // Don't load deleted messages
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!streamId,
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: async (text) => {
      if (!streamId || !user) throw new Error("Missing stream or user");
      const payload = {
        stream_id: streamId,
        user_id: user.id,
        username: user.username || user.full_name || "Anon",
        message_type: "text",
        message: text,
      };
      const { error } = await supabase.from("chat_messages").insert(payload);
      if (error) throw error;
      return payload;
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries(["streamChat", streamId]);
    },
    onError: (err) => {
      console.error("send message failed", err);
      toast.error("Failed to send message");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (messageId) => {
      const { error } = await supabase
        .from("chat_messages")
        .update({ deleted: true, deleted_at: new Date().toISOString() }) // Soft delete instead of hard delete
        .eq("id", messageId);
      if (error) throw error;
      return messageId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["streamChat", streamId]);
      toast.success("Message deleted");
    },
    onError: (err) => {
      console.error("delete message failed", err);
      toast.error("Failed to delete message");
    }
  });

  const permanentKickMutation = useMutation({
    mutationFn: async (targetUserId) => {
      if (!streamId) throw new Error('Missing stream id');
      const { data: authData } = await supabase.auth.getUser();
      const current = authData?.user || null;
      if (!current) throw new Error('Not authenticated');
      if (current.id !== (stream?.streamer_id || stream?.broadcaster_id)) throw new Error('Only the broadcaster can perform a permanent kick');

      const { error: rpcErr } = await supabase.rpc('perform_permanent_kick', {
        broadcaster_id: current.id,
        target_user_id: targetUserId,
        stream_id: streamId || null,
        coin_cost: 500,
      });
      if (rpcErr) throw rpcErr;

      return { targetUserId };
    },
    onSuccess: async () => {
      queryClient.invalidateQueries(["streamChat", streamId]);
      queryClient.invalidateQueries(["viewerStreamBans", streamId]);
      queryClient.invalidateQueries(["streamByIdOrStreamer", streamId]);
      queryClient.invalidateQueries(["streamBans", stream?.id]);
      queryClient.invalidateQueries(["currentUser"]);
      toast.success('✅ Permanent kick applied — user removed from this broadcast until you unkick them');
    },
    onError: (err) => {
      console.error('Permanent kick failed', err);
      toast.error(err?.message || 'Failed to apply permanent kick — ensure you have 500 purchased coins');
    }
  });

  const handleDeleteMessage = (messageId) => {
    if (confirm("Delete this message?")) {
      deleteMutation.mutate(messageId);
    }
  };

  const handleUsernameClick = (username) => {
    if (!username) return;
    // Find the user by username to get their ID
    navigate(`${createPageUrl("PublicProfile")}?username=${encodeURIComponent(username)}`);
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    // Check if user has chat disabled
    if (user?.chat_disabled) {
      toast.error("Your chat has been disabled by moderators");
      return;
    }

    // Safety Monitoring: Check for dangerous keywords
    const safetyCheck = safetyMonitor.scanText(message.trim(), user?.id, streamId, {
      source: 'chat',
      timestamp: new Date().toISOString(),
      ipAddress: null, // Will be filled by backend
      userAgent: navigator.userAgent
    });

    if (!safetyCheck.isSafe && safetyCheck.highestSeverity >= 4) {
      // High-severity safety incident detected
      toast.error("🚨 SAFETY ALERT: Your message contains concerning content and has been flagged for immediate review.");
      
      // Don't send the message, but create incident
      setMessage("");
      return;
    }

    // AI Moderation: Check message for inappropriate content
    try {
      // Enhanced TRAE.AI safety monitoring for suicide threats and serious threats
      const safetyResponse = await supabase.functions.invoke("openaiResponse", {
        body: {
          prompt: `You are TRAE.AI, an advanced safety monitoring system. Analyze this chat message for safety threats including suicide threats, self-harm, violence threats, or serious safety concerns.

Message: "${message.trim()}"

Respond with JSON format only:
{
  "action": "approved|delete|emergency",
  "reason": "brief explanation",
  "severity": 1-5,
  "category": "general|suicide_threat|self_harm|violence_threat|emergency"
}

Rules:
- "emergency" for suicide threats, violence threats, or immediate danger (severity 4-5)
- "delete" for inappropriate content, harassment, or rule violations (severity 2-3)  
- "approved" for safe content (severity 1)
- Always prioritize user safety and mental health`,
          model: "gpt-4o",
          max_tokens: 150
        }
      });

      let moderationResult;
      try {
        moderationResult = JSON.parse(safetyResponse?.data?.choices?.[0]?.message?.content || '{"action":"approved","reason":"parse_error","severity":1,"category":"general"}');
      } catch {
        moderationResult = { action: "approved", reason: "parse_error", severity: 1, category: "general" };
      }

      // Handle emergency situations (suicide threats, violence, etc.)
      if (moderationResult.action === "emergency" || moderationResult.severity >= 4) {
        // Block message and create safety incident
        toast.error("🚨 EMERGENCY: Message blocked for safety concerns. Help is being contacted.");
        
        try {
          // Create safety incident for emergency response
          await supabase.from("safety_incidents").insert({
            user_id: user?.id,
            stream_id: streamId,
            incident_type: 'ai_detected_threat',
            severity_level: moderationResult.severity,
            context_text: message.trim(),
            is_emergency: true,
            threat_category: moderationResult.category,
            ai_reason: moderationResult.reason,
            created_at: new Date().toISOString()
          });

          // Auto-kick user for emergency threats
          if (moderationResult.severity >= 4) {
            await supabase.from("stream_viewers").delete()
              .eq("stream_id", streamId)
              .eq("user_id", user?.id);
            
            // Add to user kicks for repeated offenses tracking
            await supabase.from("user_kicks").insert({
              user_id: user?.id,
              stream_id: streamId,
              reason: `AI detected ${moderationResult.category} - ${moderationResult.reason}`,
              kicked_by: "trae_ai_system",
              created_at: new Date().toISOString()
            });

            // Check for repeated offenses and auto-ban if necessary
            await checkAndBanUserForRepeatedOffenses(user?.id, streamId, moderationResult);
          }
        } catch (err) {
          console.error("Failed to create safety incident:", err);
        }
        
        setMessage("");
        return;
      }

      if (moderationResult.action === "delete") {
        toast.error(`❌ Message blocked: ${moderationResult.reason}`);
        
        // Log to moderation actions for review
        try {
          await supabase.from("moderation_actions").insert({
            stream_id: streamId,
            user_id: user?.id,
            action_type: "message_blocked",
            reason: `TRAE.AI: ${moderationResult.reason}`,
            message_content: message.trim(),
            status: "ai_blocked",
            flagged_by: "trae_ai_system",
            ai_severity: moderationResult.severity
          });
        } catch (err) {
          console.warn("Failed to log moderation action", err);
        }
        
        setMessage("");
        return;
      }

      // Message approved, send it
      sendMutation.mutate(message.trim());
    } catch (err) {
      console.error("AI moderation error", err);
      // Fallback: allow message if moderation service fails
      toast.warning("⚠️ Moderation check skipped, message sent");
      sendMutation.mutate(message.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isChatDisabled = user?.chat_disabled;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-3 bg-[#07070a]">
        {isLoading ? (
          <div className="text-gray-500">Loading chat…</div>
        ) : messages.length === 0 ? (
          <div className="text-gray-500">No messages yet</div>
        ) : (
          <div className="flex flex-col-reverse gap-2">
            {messages.map((m) => (
              <div key={m.id} className="text-sm flex items-start justify-between gap-2 group hover:bg-[#1a1a24] p-1 rounded transition-colors">
                <div className="flex-1 min-w-0">
                  <AdminUserActions 
                    username={m.username} 
                    userId={m.user_id}
                    isInLive={true}
                  >
                    <button
                      type="button"
                      onClick={() => handleUsernameClick(m.username)}
                      className="text-white hover:text-blue-400 hover:underline font-semibold cursor-pointer mr-2 transition-colors flex items-center gap-1"
                    >
                      {m.username}
                      <UserBadges user={m} size="xs" />
                    </button>
                  </AdminUserActions>
                  <span className="text-gray-300 break-words">{m.message}</span>
                </div>
                <div className="flex items-center gap-2">
                  {(user?.id === m.user_id || canModerate) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(m.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-500 flex-shrink-0"
                      title="Delete message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Streamer-only: pay 500 purchased coins to permanently kick this user from your broadcast */}
                  {isStreamer && m.user_id && m.user_id !== user?.id && (
                    isUserBanned(m.user_id) ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm('Unkick this user from your broadcast? They will be allowed to rejoin. Proceed?')) return;
                          unkickMutation.mutate(m.user_id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-green-400 hover:text-green-500 flex-shrink-0"
                        title="Unkick user"
                      >
                        <Slash className="w-4 h-4 rotate-180" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm('Permanently kick this user from your broadcast for 1000 paid coins? They will remain kicked until you unkick them. Proceed?')) return;
                          permanentKickMutation.mutate(m.user_id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-yellow-400 hover:text-yellow-500 flex-shrink-0"
                        title="Permanent Kick (1000 paid coins)"
                      >
                        <Slash className="w-4 h-4" />
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-[#222] bg-[#040405] sticky bottom-0 z-10" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {isChatDisabled ? (
          <div className="text-red-400 text-sm p-3 bg-red-900/20 rounded">
            ⚠️ Your chat has been disabled by moderators.
          </div>
        ) : (
          <div className="flex gap-2">
            <Input 
              value={message} 
              onChange={(e) => setMessage(e.target.value)} 
              onKeyDown={handleKeyDown}
              placeholder="Say something… (Enter to send, Shift+Enter for newline)" 
              className="flex-1"
            />
            <Button type="button" onClick={handleSend} disabled={!message.trim()} className="flex-none">Send</Button>
          </div>
        )}
      </div>
    </div>
  );
}
