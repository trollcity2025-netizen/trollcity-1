import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { creditCoins, creditFreeCoins } from "@/lib/coins";
import { toast } from "sonner";
import { notifyLevelUp } from "@/lib/notifications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

function RoleSelect({ value, onChange }) {
  const roles = ["user","broadcaster","troll_officer","admin"];
  return (
    <select value={value || "user"} onChange={(e) => onChange(e.target.value)} className="bg-[#0a0a0f] border border-[#2a2a3a] text-white rounded px-2 py-1 text-sm">
      {roles.map(r => <option key={r} value={r}>{r}</option>)}
    </select>
  );
}

export default function UserAdminPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [activeTab, setActiveTab] = useState("view");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [levelIncrement, setLevelIncrement] = useState(1);
  const [showCoinsModal, setShowCoinsModal] = useState(false);
  const [coinType, setCoinType] = useState("real");
  const [coinAmount, setCoinAmount] = useState(100);
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["adminUsers", limit, search],
    queryFn: async () => {
      if (!supabase.__isConfigured) return [];
      const term = (search || "").trim();
      let q = supabase.from("profiles").select("id,username,full_name,avatar,avatar_url,coins,free_coins,purchased_coins,level,role,is_troll_officer,is_admin,is_banned,created_at").order("created_at", { ascending: false }).limit(limit);
      if (term.length >= 2) {
        // Remote wide search includes all signed-up users
        q = q.or(`username.ilike.%${term}%,full_name.ilike.%${term}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(u => ({ ...u, avatar: u.avatar ?? u.avatar_url }));
    },
    staleTime: 5000,
  });

  useEffect(() => {
    if (!supabase.__isConfigured) return;
    try {
      const channel = supabase.channel("profiles_admin_realtime");
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        const row = payload?.new || null;
        if (!row) return;
        queryClient.setQueryData(["adminUsers", limit], (prev) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map(u => u.id === row.id ? { ...u, ...row } : u);
        });
      }).subscribe();
      return () => { try { channel.unsubscribe(); } catch (_) {} };
    } catch (_) {}
  }, [limit, queryClient]);

  // Debounced remote suggestions for search bar
  useEffect(() => {
    const term = (search || "").trim();
    if (!supabase.__isConfigured || term.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id,username,full_name,avatar,avatar_url')
          .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
          .order('created_at', { ascending: false })
          .limit(10);
        setSuggestions((data || []).map(u => ({ id: u.id, username: u.username, full_name: u.full_name, avatar: u.avatar || u.avatar_url })));
        setShowSuggestions(true);
      } catch (_) {
        setSuggestions([]); setShowSuggestions(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = Array.isArray(users) ? users : [];
    if (!q) return base;
    return base.filter(u => (u.username || u.full_name || "").toLowerCase().includes(q) || (u.id || "").includes(q));
  }, [users, search]);

  const addCoinsMutation = useMutation({
    mutationFn: async ({ userId, amount }) => {
      await creditCoins(userId, amount, { source: "admin_dashboard" });
      const { data: profileAfter } = await supabase.from("profiles").select("coins,purchased_coins").eq("id", userId).single();
      return { userId, coins: profileAfter?.coins || 0, purchased_coins: profileAfter?.purchased_coins || 0 };
    },
    onSuccess: ({ userId, coins, purchased_coins }) => {
      queryClient.setQueryData(["adminUsers", limit], (prev) => Array.isArray(prev) ? prev.map(u => (u.id === userId ? { ...u, coins, purchased_coins } : u)) : prev);
      queryClient.invalidateQueries(["coinsLive"]);
      toast.success("Coins added");
    },
    onError: (err) => toast.error(err?.message || "Failed to add coins")
  });

  const updateLevelMutation = useMutation({
    mutationFn: async ({ userId, level }) => {
      const attempts = [ { level }, { user_level: level } ];
      for (const payload of attempts) {
        const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
        if (!error) break;
      }
      return { userId, level };
    },
    onSuccess: async ({ userId, level }) => {
      queryClient.setQueryData(["adminUsers", limit], (prev) => Array.isArray(prev) ? prev.map(u => (u.id === userId ? { ...u, level } : u)) : prev);
      toast.success("Level updated");
      
      // Send level up notification
      try {
        await notifyLevelUp(userId, level);
      } catch (notificationError) {
        console.error('Failed to send level up notification:', notificationError);
      }
    },
    onError: (err) => toast.error(err?.message || "Failed to update level")
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }) => {
      const attempts = [ { role }, { user_role: role } ];
      for (const payload of attempts) {
        const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
        if (!error) break;
      }
      return { userId, role };
    },
    onSuccess: ({ userId, role }) => {
      queryClient.setQueryData(["adminUsers", limit], (prev) => Array.isArray(prev) ? prev.map(u => (u.id === userId ? { ...u, role } : u)) : prev);
      toast.success("Role updated");
    },
    onError: (err) => toast.error(err?.message || "Failed to update role")
  });

  const siteBanMutation = useMutation({
    mutationFn: async ({ userId, ban }) => {
      const stamp = new Date().toISOString();
      const attempts = ban
        ? [ { is_banned: true, banned_date: stamp }, { status: "banned", last_update: stamp } ]
        : [ { is_banned: false, unbanned_date: stamp }, { status: "active", last_update: stamp } ];
      let ok = false;
      for (const payload of attempts) {
        const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
        if (!error) { ok = true; break; }
      }
      try { await supabase.from("moderation_actions").insert({ user_id: userId, action: ban ? "site_ban" : "unban", created_date: stamp }); } catch (_) {}
      return { userId, is_banned: ban, ok };
    },
    onSuccess: ({ userId, is_banned }) => {
      queryClient.setQueryData(["adminUsers", limit], (prev) => Array.isArray(prev) ? prev.map(u => (u.id === userId ? { ...u, is_banned } : u)) : prev);
      toast.success(is_banned ? "User banned" : "User unbanned");
    },
    onError: (err) => toast.error(err?.message || "Failed to update ban")
  });

  const siteKickMutation = useMutation({
    mutationFn: async ({ userId }) => {
      const stamp = new Date().toISOString();
      const attempts = [ { status: "kicked", last_update: stamp }, { is_kicked: true, kicked_date: stamp } ];
      for (const payload of attempts) {
        const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
        if (!error) break;
      }
      try { await supabase.from("moderation_actions").insert({ user_id: userId, action: "site_kick", created_date: stamp }); } catch (_) {}
      return { userId };
    },
    onSuccess: () => toast.success("User kicked"),
    onError: (err) => toast.error(err?.message || "Failed to kick user")
  });

  const disableChatMutation = useMutation({
    mutationFn: async ({ userId, disable }) => {
      const stamp = new Date().toISOString();
      const attempts = disable
        ? [ { is_chat_disabled: true, chat_disabled_date: stamp }, { chat_disabled: true } ]
        : [ { is_chat_disabled: false, chat_disabled_date: null }, { chat_disabled: false } ];
      for (const payload of attempts) {
        const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
        if (!error) break;
      }
      try { await supabase.from("moderation_actions").insert({ user_id: userId, action: disable ? "chat_disabled" : "chat_enabled", created_date: stamp }); } catch (_) {}
      return { userId, disable };
    },
    onSuccess: ({ disable }) => toast.success(disable ? "Chat disabled" : "Chat enabled"),
    onError: (err) => toast.error(err?.message || "Failed to update chat")
  });

  const current = (Array.isArray(users) ? users : []).find(u => u.id === selectedUserId) || null;

  return (
    <div className="space-y-4">
      <div className="relative flex items-center gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => suggestions.length && setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} placeholder="Search all signed-up users by name" className="bg-[#0a0a0f] border-[#2a2a3a] text-white" />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-[28rem] max-w-[80vw] bg-[#0f0f14] border border-[#2a2a3a] rounded-lg shadow-lg z-20">
            {suggestions.map(s => (
              <button key={s.id} type="button" className="w-full text-left px-3 py-2 hover:bg-black/30 flex items-center gap-2" onMouseDown={() => { setSelectedUserId(s.id); setSearch(s.username || s.full_name || s.id); setShowSuggestions(false); }}>
                <img src={s.avatar || '/default-avatar.png'} alt="avatar" className="w-6 h-6 rounded-full object-cover" onError={(e) => { e.currentTarget.src = '/default-avatar.png'; }} />
                <span className="text-white">@{s.username || s.full_name || s.id.slice(0,6)}</span>
                <span className="text-xs text-gray-500 ml-2">{s.id.slice(0,8)}</span>
              </button>
            ))}
          </div>
        )}
        <select value={limit} onChange={(e) => setLimit(parseInt(e.target.value))} className="bg-[#0a0a0f] border border-[#2a2a3a] text-white rounded px-2 py-2 text-sm">
          {[50,100,200].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={selectedUserId || ""} onChange={(e) => setSelectedUserId(e.target.value)} className="bg-[#0a0a0f] border border-[#2a2a3a] text-white rounded px-2 py-2 text-sm">
          <option value="">Select user…</option>
          {(users || []).slice(0,200).map(u => (
            <option key={u.id} value={u.id}>@{u.username || u.full_name || u.id.slice(0,6)} ({u.id.slice(0,8)})</option>
          ))}
        </select>
        <Button type="button" variant="outline" className="border-[#2a2a3a] text-gray-300" onClick={() => refetch()}>Refresh</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-[#0f0f14] border-[#2a2a3a]">
          <TabsTrigger value="view" className="data-[state=active]:bg-[#2a2a3a]">All Users</TabsTrigger>
          <TabsTrigger value="levels" className="data-[state=active]:bg-[#2a2a3a]">Levels</TabsTrigger>
          <TabsTrigger value="coins" className="data-[state=active]:bg-[#2a2a3a]">Coins</TabsTrigger>
          <TabsTrigger value="moderation" className="data-[state=active]:bg-[#2a2a3a]">Moderation</TabsTrigger>
        </TabsList>

        <TabsContent value="view">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(u => (
              <Card key={u.id} className="p-4 bg-[#0f0f14] border-[#2a2a3a] hover:border-purple-500/40 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <img src={u.avatar || '/default-avatar.png'} alt="avatar" className="w-10 h-10 rounded-full object-cover" onError={(e) => { e.currentTarget.src = '/default-avatar.png'; }} />
                    <div>
                      <div className="text-white font-semibold">@{u.username || u.full_name || u.id.slice(0,6)}</div>
                      <div className="text-xs text-gray-500">{u.id}</div>
                    </div>
                  </div>
                  {u.is_banned ? <Badge className="bg-red-600 text-white">Banned</Badge> : null}
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                  <div className="bg-black/20 rounded p-2"><p className="text-gray-400">Coins</p><p className="text-yellow-400 font-bold">{(u.coins||0).toLocaleString()}</p></div>
                  <div className="bg-black/20 rounded p-2"><p className="text-gray-400">Level</p><p className="text-cyan-400 font-bold">{u.level||0}</p></div>
                  <div className="bg-black/20 rounded p-2"><p className="text-gray-400">Role</p><RoleSelect value={u.role} onChange={(r) => updateRoleMutation.mutate({ userId: u.id, role: r })} /></div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" className="border-[#2a2a3a]" onClick={() => { setSelectedUserId(u.id); setActiveTab('levels'); setShowLevelModal(true); }}>Level +</Button>
                  <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setSelectedUserId(u.id); setActiveTab('coins'); setShowCoinsModal(true); }}>Add Coins</Button>
                  <Button type="button" size="sm" variant="outline" className="border-red-500 text-red-400" onClick={() => siteBanMutation.mutate({ userId: u.id, ban: !u.is_banned })}>{u.is_banned ? 'Unban' : 'Ban'}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => siteKickMutation.mutate({ userId: u.id })}>Kick</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => disableChatMutation.mutate({ userId: u.id, disable: true })}>Disable Chat</Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="levels">
          <div className="flex items-center gap-2">
            <Button type="button" onClick={() => setShowLevelModal(true)} disabled={!selectedUserId}>Increase Level</Button>
            {current ? <Badge className="bg-cyan-600 text-white">Current: {current.level || 0}</Badge> : null}
          </div>
          <Dialog open={showLevelModal} onOpenChange={setShowLevelModal}>
            <DialogContent className="bg-[#1a1a24] border-[#2a2a3a]">
              <DialogHeader>
                <DialogTitle className="text-white">Increase Level</DialogTitle>
                <DialogDescription className="text-gray-400">Enter a single digit increment (1-9)</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input type="number" min="1" max="9" value={levelIncrement} onChange={(e) => setLevelIncrement(parseInt(e.target.value || "1"))} className="bg-[#0a0a0f] border-[#2a2a3a] text-white" />
                <div className="flex gap-2">
                  <Button type="button" onClick={() => {
                    if (!selectedUserId || !current) return;
                    const newLevel = (current.level || 0) + Math.max(1, Math.min(9, levelIncrement || 1));
                    updateLevelMutation.mutate({ userId: selectedUserId, level: newLevel });
                    setShowLevelModal(false);
                  }}>Save</Button>
                  <Button type="button" variant="outline" onClick={() => setShowLevelModal(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="coins">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <select value={coinType} onChange={(e) => setCoinType(e.target.value)} className="bg-[#0a0a0f] border border-[#2a2a3a] text-white rounded px-2 py-2 text-sm">
                <option value="real">Real Coins</option>
                <option value="free">Free Coins</option>
              </select>
              <Input type="number" min="1" value={coinAmount} onChange={(e) => setCoinAmount(parseInt(e.target.value || "0"))} className="bg-[#0a0a0f] border-[#2a2a3a] text-white w-32" />
              <Button type="button" onClick={() => setShowCoinsModal(true)} disabled={!selectedUserId || !coinAmount}>Add Coins</Button>
            </div>
            <Dialog open={showCoinsModal} onOpenChange={setShowCoinsModal}>
              <DialogContent className="bg-[#1a1a24] border-[#2a2a3a]">
                <DialogHeader>
                  <DialogTitle className="text-white">Confirm Coin Addition</DialogTitle>
                  <DialogDescription className="text-gray-400">This updates balances in real time</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-gray-300">Type: <span className="font-semibold text-yellow-300">{coinType}</span></p>
                  <p className="text-gray-300">Amount: <span className="font-semibold text-yellow-300">{coinAmount}</span></p>
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => {
                      if (!selectedUserId || !coinAmount) return;
                      const amt = Math.max(1, coinAmount);
                      if (coinType === 'real') {
                        addCoinsMutation.mutate({ userId: selectedUserId, amount: amt });
                      } else {
                        creditFreeCoins(selectedUserId, amt, { source: 'admin_dashboard' })
                          .then(({ newCoins, free_coins }) => {
                            queryClient.setQueryData(["adminUsers", limit], (prev) => Array.isArray(prev) ? prev.map(u => (u.id === selectedUserId ? { ...u, coins: newCoins, free_coins } : u)) : prev);
                            queryClient.invalidateQueries(["coinsLive"]);
                            toast.success("Free coins added");
                          })
                          .catch((err) => toast.error(err?.message || 'Failed to add free coins'));
                      }
                      setShowCoinsModal(false);
                    }}>Confirm</Button>
                    <Button type="button" variant="outline" onClick={() => setShowCoinsModal(false)}>Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        <TabsContent value="moderation">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="border-red-500 text-red-400" disabled={!selectedUserId} onClick={() => siteBanMutation.mutate({ userId: selectedUserId, ban: !(current?.is_banned) })}>{current?.is_banned ? "Unban" : "Ban"}</Button>
            <Button type="button" variant="outline" disabled={!selectedUserId} onClick={() => siteKickMutation.mutate({ userId: selectedUserId })}>Kick</Button>
            <Button type="button" variant="outline" disabled={!selectedUserId} onClick={() => disableChatMutation.mutate({ userId: selectedUserId, disable: true })}>Disable Chats</Button>
            <Button type="button" variant="outline" disabled={!selectedUserId} onClick={() => disableChatMutation.mutate({ userId: selectedUserId, disable: false })}>Enable Chats</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
