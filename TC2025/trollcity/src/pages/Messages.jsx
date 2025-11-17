import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Trash2, Archive } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { payFee, getUserMessageFee } from "@/lib/fees";
import { debitPurchasedCoins, debitPurchasedCoinsWithNegative } from "@/lib/coins";
import { notifyMessageReceived } from "@/lib/notifications";
import { useQueryClient } from "@tanstack/react-query";

function loadLS(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function saveLS(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }

export default function Messages() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [authUser, setAuthUser] = useState(null);
  const [authProfile, setAuthProfile] = useState(null);
  const [conversations, setConversations] = useState(() => loadLS("tc_conversations", []));
  const [messagesByConv, setMessagesByConv] = useState(() => loadLS("tc_messages", {}));
  const [selectedId, setSelectedId] = useState(null);
  const [composeText, setComposeText] = useState("");
  const [search, setSearch] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [archived, setArchived] = useState(() => loadLS("tc_archived_conversations", []));

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const u = data?.user || null;
        if (!mounted) return;
        setAuthUser(u);
        if (supabase.__isConfigured && u?.id) {
          try {
            const { data: p1 = [] } = await supabase.from("conversations").select("*").eq("participant1_id", u.id);
            const { data: p2 = [] } = await supabase.from("conversations").select("*").eq("participant2_id", u.id);
            const convs = [...p1, ...p2];
            const seen = new Set();
            const uniq = [];
            for (const c of convs) { if (!seen.has(c.id)) { seen.add(c.id); uniq.push(c); } }
            try {
              const { data: prof } = await supabase.from('profiles').select('id, role').eq('id', u.id).single();
              setAuthProfile(prof || null);
              if (prof?.role === 'admin') {
                const hasSupport = uniq.some(c => String(c.id) === 'support-admin');
                if (!hasSupport) uniq.unshift({ id: 'support-admin', title: 'Support Tickets' });
              }
            } catch {}
            if (uniq.length) {
              setConversations(uniq);
              saveLS("tc_conversations", uniq);
              
              // Check if there's a conversation parameter in URL
              const urlConversationId = searchParams.get('conversation');
              if (urlConversationId) {
                // Try to select the conversation from URL parameter
                const targetConv = uniq.find(c => c.id === urlConversationId);
                if (targetConv) {
                  setSelectedId(targetConv.id);
                } else if (!selectedId) {
                  setSelectedId(uniq[0]?.id);
                }
              } else if (!selectedId) {
                setSelectedId(uniq[0]?.id);
              }
            }
          } catch {}
        } else if (!conversations.length) {
          const demo = [
            { id: "demo-1", title: "Demo Chat", participant1_id: "demo", participant2_id: "you", unread_count_p1: 0, unread_count_p2: 0 },
          ];
          setConversations(demo);
          saveLS("tc_conversations", demo);
          const msgs = {
            "demo-1": [
              { id: "m1", from: "demo", text: "Welcome to Messages.", created_at: new Date().toISOString() },
            ],
          };
          setMessagesByConv(msgs);
          saveLS("tc_messages", msgs);
          setSelectedId("demo-1");
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [searchParams]);

  useEffect(() => {
    const loadForSelected = async () => {
      if (!authUser) return;
      if (!selectedId) return;
      setLoadingMessages(true);
      try {
        if (selectedId === "support") {
          const { data: oc = [], error } = await supabase.from("officer_chats").select("*").eq("sender_id", authUser.id).order("created_date", { ascending: true });
          if (!error) {
            // For user support view, show their own tickets with context
            const mapped = oc.map((r) => ({
              id: r.id || Math.random().toString(36),
              from: r.sender_id,
              text: r.message_type === 'support_ticket' 
                ? `Your Support Ticket: ${r.message}`
                : r.message,
              created_at: r.created_date || new Date().toISOString(),
              message_type: r.message_type
            }));
            setMessagesByConv((prev) => ({ ...prev, support: mapped }));
            saveLS("tc_messages", { ...messagesByConv, support: mapped });
          }
          return;
        }
        if (selectedId === 'support-admin' && authProfile?.role === 'admin') {
          const { data: oc = [], error } = await supabase.from('officer_chats').select('*').order('created_date', { ascending: true });
          if (!error) {
            // For admin view, show user issue details with username
            const mapped = await Promise.all(oc.map(async (r) => {
              // Get user details for this support ticket
              const { data: userProfile } = await supabase
                .from('profiles')
                .select('username, full_name')
                .eq('id', r.sender_id)
                .single();
              
              const username = userProfile?.username || 'Unknown User';
              const displayText = r.message_type === 'support_ticket' 
                ? `Support Ticket from @${username}: ${r.message}`
                : `${username}: ${r.message}`;
              
              return {
                id: r.id || Math.random().toString(36), 
                from: r.sender_id, 
                text: displayText, 
                created_at: r.created_date || new Date().toISOString(),
                original_message: r.message,
                username: username,
                message_type: r.message_type
              };
            }));
            
            setMessagesByConv((prev) => ({ ...prev, ['support-admin']: mapped }));
            saveLS('tc_messages', { ...messagesByConv, ['support-admin']: mapped });
          }
          return;
        }
        let loaded = false;
        // Prefer direct_messages for conversation threads
        try {
          const { data: dms, error: dmErr } = await supabase
            .from("direct_messages")
            .select("*")
            .eq("conversation_id", selectedId)
            .is("deleted", null) // Don't load deleted messages
            .order("created_date", { ascending: true });
          if (!dmErr && Array.isArray(dms)) {
            const mapped = dms.map((m) => ({ id: m.id || Math.random().toString(36), from: m.sender_id, text: m.message || m.content || "", created_at: m.created_date || m.created_at || new Date().toISOString() }));
            setMessagesByConv((prev) => ({ ...prev, [selectedId]: mapped }));
            saveLS("tc_messages", { ...messagesByConv, [selectedId]: mapped });
            loaded = true;
          }
        } catch {}
        if (!loaded) {
          const { data: msgs, error } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", selectedId)
            .is("deleted", null) // Don't load deleted messages
            .order("created_date", { ascending: true });
          if (!error && Array.isArray(msgs)) {
            const mapped = msgs.map((m) => ({ id: m.id || Math.random().toString(36), from: m.sender_id, text: m.content || m.message || "", created_at: m.created_date || m.created_at || new Date().toISOString() }));
            setMessagesByConv((prev) => ({ ...prev, [selectedId]: mapped }));
            saveLS("tc_messages", { ...messagesByConv, [selectedId]: mapped });
          }
        }
      } finally {
        setLoadingMessages(false);
      }
    };
    loadForSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, selectedId]);

  const selectedMessages = useMemo(() => messagesByConv[selectedId] || [], [messagesByConv, selectedId]);
  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = conversations.filter(c => !archived.includes(c.id));
    if (!q) return base;
    return base.filter(c => (c.title || String(c.id)).toLowerCase().includes(q));
  }, [conversations, search, archived]);

  const sendMessage = async () => {
    if (!selectedId || !composeText.trim()) return;
    const msg = { id: Math.random().toString(36).slice(2), from: authUser?.id || "you", text: composeText.trim(), created_at: new Date().toISOString() };
    const next = { ...messagesByConv, [selectedId]: [...selectedMessages, msg] };
    setMessagesByConv(next);
    saveLS("tc_messages", next);
    setComposeText("");
    if (supabase.__isConfigured) {
      try {
        if (selectedId === "support") {
          await supabase.from("officer_chats").insert({ sender_id: authUser?.id, message: msg.text, message_type: "support_ticket" });
          toast.success("Support ticket submitted");
        } else {
          // Fees: message admin or per-recipient fee (purchased coins only)
          try {
            const conv = (conversations || []).find((c) => c.id === selectedId) || null;
            let targetUserId = null;
            if (conv) {
              const p1 = conv.participant1_id;
              const p2 = conv.participant2_id;
              targetUserId = String(p1) === String(authUser?.id) ? p2 : p1;
            }
            if (targetUserId) {
              // Check if current user is admin - admin can message anyone for free
              const { data: currentUserProfile } = await supabase.from('profiles').select('role, is_admin').eq('id', authUser?.id).single();
              const isAdmin = currentUserProfile?.role === 'admin' || currentUserProfile?.is_admin === true;
              
              if (!isAdmin) {
                const { data: targetProfile } = await supabase.from('profiles').select('role').eq('id', targetUserId).single();
                if (targetProfile?.role === 'admin') {
                  await payFee(authUser?.id, 'message_admin', { reference: targetUserId });
                } else {
                  const fee = await getUserMessageFee(targetUserId);
                  if (fee > 0) {
                    const result = await debitPurchasedCoinsWithNegative(authUser?.id, fee, { reason: 'fee_message_user', reference: targetUserId });
                    if (result.needsStoreRedirect) {
                      toast.error("Insufficient coins. Redirecting to store...");
                      setTimeout(() => navigate('/store'), 2000);
                      throw new Error("Insufficient coins for message fee");
                    }
                  }
                }
              }
            }
          } catch (e) {
            throw e;
          }
          // Prefer direct_messages, fall back to messages
          const payload = { conversation_id: selectedId, sender_id: authUser?.id, message: msg.text, created_date: new Date().toISOString() };
          let sent = false;
          for (let attempt = 0; attempt < 3 && !sent; attempt++) {
            const { error } = await supabase.from("direct_messages").insert(payload);
            if (!error) { sent = true; break; }
            const m = String(error?.message || error);
            const colMatch = m.match(/column\s+"?(\w+)"?\s+does not exist/i);
            const col = colMatch?.[1];
            if (col && payload.hasOwnProperty(col)) { delete payload[col]; continue; }
            break;
          }
          if (!sent) {
            await supabase.from("messages").insert({ conversation_id: selectedId, sender_id: authUser?.id, content: msg.text });
          }
          toast.success("Message sent");
          try {
            const conv = (conversations || []).find((c) => c.id === selectedId) || null;
            let targetUserId = null;
            if (conv) {
              const p1 = conv.participant1_id;
              const p2 = conv.participant2_id;
              targetUserId = String(p1) === String(authUser?.id) ? p2 : p1;
            }
            if (targetUserId) {
              // Get the fee amount that was charged
              let coinsEarned = 0;
              try {
                const fee = await getUserMessageFee(targetUserId);
                coinsEarned = fee;
              } catch {}
              
              // Send notification with proper message info and earnings
              await notifyMessageReceived(
                targetUserId,
                authUser?.username || authUser?.full_name || 'Someone',
                authUser?.id,
                msg.text,
                coinsEarned
              );
            }
          } catch (_) {}
        }
      } catch (e) {
        toast.error(e?.message || "Failed to send message");
      }
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm("Delete this message?")) return;
    try {
      const currentMessages = selectedMessages;
      const messageToDelete = currentMessages.find(m => m.id === messageId);
      
      if (messageToDelete?.from === authUser?.id) {
        // Update local state immediately
        const updated = currentMessages.filter(m => m.id !== messageId);
        const next = { ...messagesByConv, [selectedId]: updated };
        setMessagesByConv(next);
        saveLS("tc_messages", next);
        
        // Force immediate UI update - prevent message from reappearing
        queryClient.setQueryData(['messages', selectedId], updated);
        
        // Soft delete from database
        try {
          const { error } = await supabase
            .from("direct_messages")
            .update({ deleted: true, deleted_at: new Date().toISOString() })
            .eq("id", messageId);
          if (error) throw error;
        } catch {
          try {
            const { error } = await supabase
              .from("messages")
              .update({ deleted: true, deleted_at: new Date().toISOString() })
              .eq("id", messageId);
            if (error) throw error;
          } catch {}
        }
        
        // Invalidate queries to ensure fresh data on next load
        queryClient.invalidateQueries(['messages', selectedId]);
        queryClient.invalidateQueries(['direct_messages', selectedId]);
        
        toast.success("Message deleted");
      } else {
        toast.error("You can only delete your own messages");
      }
    } catch (err) {
      toast.error("Failed to delete message");
    }
  };

  const handleUsernameClick = (userId) => {
    if (!userId) return;
    navigate(`${createPageUrl("PublicProfile")}?userId=${encodeURIComponent(userId)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && selectedId) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#120a1f] to-[#0a0a0f] py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Messages</h1>
          </div>
          <div className="flex items-center gap-3">
            <Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search conversations" className="w-64 bg-[#0f0f16] border-[#2a2a3a] text-white" />
            <Button className="bg-purple-600 hover:bg-purple-700">New</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-[#11121a] border-[#2a2a3a] p-0 lg:col-span-1 rounded-xl overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-[#1a0a2f] to-[#151226] border-b border-[#2a2a3a]">
              <p className="text-white text-sm">Conversations</p>
            </div>
            <div className="max-h-[65vh] overflow-y-auto">
              {filteredConversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[#1f2030] ${selectedId===c.id?"bg-[#1a1b25] text-white":"text-gray-300 hover:bg-[#161622]"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                      {(c.title || "C")[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold truncate">{c.title || `Conversation ${c.id}`}</span>
                        <Badge className="bg-red-500 text-white text-[10px]">{(c.unread_count_p1||0)+(c.unread_count_p2||0)}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{c.last_message_preview || ""}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
          <Card className="bg-[#11121a] border-[#2a2a3a] p-0 lg:col-span-2 rounded-xl overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-[#1a0a2f] to-[#151226] border-b border-[#2a2a3a] flex items-center justify-between">
              <p className="text-white font-semibold">{selectedId ? `Chat: ${selectedId}` : "Select a conversation"}</p>
              {selectedId && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!authUser || !selectedId) return;
                      if (!confirm("Delete all your messages in this conversation?")) return;
                      try {
                        // Clear local state immediately
                        const next = { ...messagesByConv, [selectedId]: [] };
                        setMessagesByConv(next);
                        saveLS("tc_messages", next);
                        
                        // Force immediate UI update
                        queryClient.setQueryData(['messages', selectedId], []);
                        
                        // Delete from database
                        if (supabase.__isConfigured) {
                          try { await supabase.from("direct_messages").delete().eq("conversation_id", selectedId).eq("sender_id", authUser.id); } catch {}
                          try { await supabase.from("messages").delete().eq("conversation_id", selectedId).eq("sender_id", authUser.id); } catch {}
                        }
                        
                        // Invalidate queries to ensure fresh data
                        queryClient.invalidateQueries(['messages', selectedId]);
                        queryClient.invalidateQueries(['direct_messages', selectedId]);
                        
                        toast.success("Messages deleted");
                      } catch {
                        toast.error("Failed to delete conversation messages");
                      }
                    }}
                    className="border-red-500 text-red-400 hover:bg-red-500/10"
                    variant="outline"
                    size="sm"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Delete Messages
                  </Button>

                  <Button
                    type="button"
                    onClick={async () => {
                      if (!selectedId) return;
                      if (!confirm("Archive this conversation? You can restore later.")) return;
                      try {
                        const nextArchived = Array.from(new Set([ ...archived, selectedId ]));
                        setArchived(nextArchived);
                        saveLS("tc_archived_conversations", nextArchived);
                        if (supabase.__isConfigured) {
                          // Try a few common archive shapes
                          const stamp = new Date().toISOString();
                          const attempts = [
                            { is_archived: true, archived_by: authUser?.id, archived_date: stamp },
                            { archived: true, archived_by: authUser?.id, archived_at: stamp },
                            { status: 'archived', last_message_time: stamp },
                          ];
                          for (const payload of attempts) {
                            try { await supabase.from("conversations").update(payload).eq("id", selectedId); break; } catch {}
                          }
                        }
                        // Deselect if archived
                        setSelectedId(null);
                        toast.success("Conversation archived");
                      } catch {
                        toast.error("Failed to archive conversation");
                      }
                    }}
                    className="border-[#2a2a3a] text-gray-300 hover:bg-white/5"
                    variant="outline"
                    size="sm"
                  >
                    <Archive className="w-4 h-4 mr-1" /> Archive
                  </Button>

                  <Button
                    type="button"
                    onClick={async () => {
                      if (!selectedId) return;
                      if (!confirm("Delete this conversation thread? This removes the record if allowed.")) return;
                      try {
                        // Local removal
                        const nextConvs = (conversations || []).filter(c => c.id !== selectedId);
                        setConversations(nextConvs);
                        saveLS("tc_conversations", nextConvs);
                        const { [selectedId]: _omit, ...nextMsgs } = messagesByConv;
                        setMessagesByConv(nextMsgs);
                        saveLS("tc_messages", nextMsgs);
                        setArchived((prev) => prev.filter(id => id !== selectedId));
                        saveLS("tc_archived_conversations", (archived || []).filter(id => id !== selectedId));
                        setSelectedId(null);

                        // Backend cleanup
                        if (supabase.__isConfigured) {
                          try { await supabase.from("direct_messages").delete().eq("conversation_id", selectedId); } catch {}
                          try { await supabase.from("messages").delete().eq("conversation_id", selectedId); } catch {}
                          // Try hard delete; fall back to soft delete
                          try { await supabase.from("conversations").delete().eq("id", selectedId); }
                          catch {
                            const stamp = new Date().toISOString();
                            const softs = [
                              { is_deleted: true, deleted_date: stamp },
                              { deleted: true, deleted_at: stamp },
                              { status: 'deleted', last_message_time: stamp },
                            ];
                            for (const payload of softs) {
                              try { await supabase.from("conversations").update(payload).eq("id", selectedId); break; } catch {}
                            }
                          }
                        }
                        toast.success("Conversation deleted");
                      } catch {
                        toast.error("Failed to delete conversation");
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700"
                    size="sm"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Delete Conversation
                  </Button>
                </div>
              )}
            </div>
            <div className="p-4 max-h-[55vh] overflow-y-auto space-y-4">
              {selectedMessages.map((m) => (
                <div key={m.id} className={`flex ${m.from===(authUser?.id||"you")?"justify-end":"justify-start"} group`}>
                  <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm relative ${m.from===(authUser?.id||"you")?"bg-gradient-to-r from-purple-600 to-pink-600 text-white":"bg-[#0f0f16] text-gray-200 border border-[#2a2a3a]"}`}>
                    <p className="text-sm leading-relaxed">{m.text}</p>
                    <p className="text-[10px] opacity-70 mt-1">{new Date(m.created_at).toLocaleTimeString()}</p>
                    {m.from && m.from !== (authUser?.id || "you") && (
                      <button
                        type="button"
                        onClick={() => handleUsernameClick(m.from)}
                        className="text-[10px] opacity-70 hover:opacity-100 hover:underline transition-opacity"
                      >
                        {m.from}
                      </button>
                    )}
                  </div>
                  {m.from === (authUser?.id || "you") && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(m.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-red-400 hover:text-red-500 flex-shrink-0 self-center"
                      title="Delete message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {selectedMessages.length===0 && (
                <p className="text-gray-500 text-sm">No messages yet.</p>
              )}
            </div>
            <div className="p-4 border-t border-[#2a2a3a] bg-[#0f0f16] flex items-center gap-3">
              <Textarea 
                value={composeText} 
                onChange={(e)=>setComposeText(e.target.value)} 
                onKeyDown={handleKeyDown}
                placeholder={selectedId==='support-admin' ? "Admin view: replies are not supported here" : selectedId==='support' ? "Describe your issue to support..." : "Type a message (Enter to send, Shift+Enter for newline)"}
                disabled={selectedId==='support-admin'}
                className="flex-1 bg-[#0f0f16] border-[#2a2a3a] text-white" 
              />
              <Button type="button" onClick={sendMessage} disabled={selectedId==='support-admin'} className="bg-purple-600 hover:bg-purple-700">
                {selectedId==='support' ? 'Submit Ticket' : 'Send'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
