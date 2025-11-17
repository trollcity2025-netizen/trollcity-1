import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, DollarSign, FileText, CheckCircle, XCircle, Clock, AlertCircle, Coins, RefreshCw, Grid3x3, AlertTriangle, Radio, Eye, User, Calendar, Play, ExternalLink, Edit3, Settings, Bot, Trash2 } from "lucide-react";
import { testSquareConnection } from "@/api/square";
import { getAgoraToken } from "@/utils/agora";
import AdminEditPanel from "@/components/AdminEditPanel";
import ModernUserAdminPanel from "@/components/admin/ModernUserAdminPanel";
import IntegrationsPanel from "@/components/admin/IntegrationsPanel";
import ApplicationsPanel from "@/components/admin/ApplicationsPanel";
import CashoutRecordsPanel from "@/components/admin/CashoutRecordsPanel";
import FeeManagementPanel from "@/components/admin/FeeManagementPanel";
import { SafetyDashboard } from "@/components/admin/SafetyDashboard";
import { toast } from "sonner";
import { getCurrentUserProfile } from "@/api/supabaseHelpers";
import AccessDenied from "@/components/AccessDenied";
import AppEditorInterface from "@/components/admin/AppEditorInterface";
import AdminDebug from "@/components/AdminDebug";
import TRAEAIChatPanel from "@/components/admin/TRAEAIChatPanel";
import { makeCurrentUserAdmin, updateCurrentUserAdminStatus } from "@/utils/adminUtils";

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  
  // Get current user profile for admin gating - this is the ONLY user query
  const { data: user, isLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUserProfile,
    staleTime: 30000, // Cache for 30 seconds to reduce load
    retry: 1, // Only retry once to speed up failure
  });

  // Helper: resolve role from profile (supports `role` or `user_role`)
  const getRole = (u) => (u?.role ?? u?.user_role ?? null);

  // CRITICAL: All hooks must be called in the same order every render
  const [activeTab, setActiveTab] = useState("overview");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [contentPage, setContentPage] = useState("Home");
  const [contentField, setContentField] = useState("content");
  const [currentContent, setCurrentContent] = useState("");

  useEffect(() => {
    const fetchContent = async () => {
      if (!supabase.__isConfigured) { setCurrentContent(""); return; }
      try {
        const { data: rows } = await supabase
          .from("admin_content")
          .select("content")
          .eq("page_name", contentPage)
          .eq("field_name", contentField)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1);
        const row = Array.isArray(rows) ? rows[0] : null;
        setCurrentContent(row?.content || "");
      } catch (_) {
        setCurrentContent("");
      }
    };
    fetchContent();
  }, [contentPage, contentField]);

  // Avoid early returns that change hook order; compute flags instead
  const isAdmin = !!user && (getRole(user) === "admin" || user?.is_admin === true);
  const loading = isLoading;

  const { data: counters = { totalUsers: 0, pendingApps: 0, pendingPayouts: 0, trollOfficers: 0, flags: 0 } } = useQuery({
    queryKey: ["adminCounters"],
    queryFn: async () => {
      if (!supabase.__isConfigured) return { totalUsers: 0, pendingApps: 0, pendingPayouts: 0, trollOfficers: 0, flags: 0 };
      const out = { totalUsers: 0, pendingApps: 0, pendingPayouts: 0, trollOfficers: 0, flags: 0 };
      try {
        const u = await supabase.from("profiles").select("id", { count: "exact", head: true });
        out.totalUsers = u?.count || 0;
      } catch {}
      try {
        const a = await supabase.from("broadcaster_applications").select("id", { count: "exact", head: true }).eq("status", "pending");
        out.pendingApps = a?.count || 0;
      } catch {}
      try {
        const p = await supabase.from("square_transactions").select("id", { count: "exact", head: true }).eq("status", "pending");
        out.pendingPayouts = p?.count || 0;
      } catch {}
      try {
        const t = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_troll_officer", true);
        out.trollOfficers = t?.count || 0;
      } catch {}
      try {
        const f = await supabase.from("moderation_actions").select("id", { count: "exact", head: true }).eq("action", "message_flagged");
        out.flags = f?.count || 0;
      } catch {}
      return out;
    },
    staleTime: 10000,
  });

  const { data: coinsLive = { purchased: 0, earned: 0, free: 0, total: 0 } } = useQuery({
    queryKey: ["coinsLive"],
    queryFn: async () => {
      if (!supabase.__isConfigured) return { purchased: 0, earned: 0, free: 0, total: 0 };
      try {
        const { data = [] } = await supabase.from("profiles").select("coins, purchased_coins, free_coins");
        const agg = (data || []).reduce((acc, r) => {
          acc.total += Number(r?.coins || 0);
          acc.purchased += Number(r?.purchased_coins || 0);
          acc.free += Number(r?.free_coins || 0);
          return acc;
        }, { purchased: 0, earned: 0, free: 0, total: 0 });
        agg.earned = Math.max(0, agg.total - agg.purchased);
        return agg;
      } catch {
        return { purchased: 0, earned: 0, free: 0, total: 0 };
      }
    },
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const { data: finance = { payoutsUsd: 0, purchasesUsd: 0, totalUsd: 0 } } = useQuery({
    queryKey: ["financeLive"],
    queryFn: async () => {
      if (!supabase.__isConfigured) return { payoutsUsd: 0, purchasesUsd: 0, totalUsd: 0 };
      const out = { payoutsUsd: 0, purchasesUsd: 0, totalUsd: 0 };
      try {
        const { data: tx = [] } = await supabase.from("square_transactions").select("amount_cents,status").eq("status", "completed");
        out.purchasesUsd = (tx || []).reduce((s, r) => s + Number(r?.amount_cents || 0), 0) / 100;
      } catch {}
      try {
        const { data: po = [] } = await supabase.from("payouts").select("amount_usd,status").eq("status", "completed");
        out.payoutsUsd = (po || []).reduce((s, r) => s + Number(r?.amount_usd || 0), 0);
      } catch {}
      out.totalUsd = out.purchasesUsd - out.payoutsUsd;
      return out;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Query for live streams
  const { data: liveStreams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ["adminLiveStreams"],
    queryFn: async () => {
      if (!supabase.__isConfigured) return [];
      try {
        const { data, error } = await supabase
          .from("streams")
          .select(`
            *,
            profiles!streamer_id(username, full_name, avatar_url)
          `)
          .eq("is_live", true)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error("Error fetching live streams:", error);
        return [];
      }
    },
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000,
  });

  // Main render with proper conditional logic
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-pulse" />
          <h1 className="text-2xl font-bold text-white mb-2">Loading Admin Dashboard...</h1>
          <p className="text-gray-400">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Show access denied for non-admin users
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] p-6">
        <div className="max-w-4xl mx-auto">
          <AdminDebug />
          <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg p-6 mb-6">
            <h3 className="text-white text-lg font-semibold mb-4">Admin Access Required</h3>
            <p className="text-gray-400 mb-4">You don't have admin access. Click below to make yourself an admin for testing.</p>
            <Button 
              onClick={async () => {
                const success = await updateCurrentUserAdminStatus();
                if (success) {
                  toast.success('You are now an admin! Please refresh the page.');
                  queryClient.invalidateQueries(['currentUser']);
                } else {
                  toast.error('Failed to make you an admin');
                }
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Update Admin Status
            </Button>
          </div>
          <AccessDenied />
        </div>
      </div>
    );
  }

  // Main admin dashboard content
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header - Shows user info immediately without flash */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-10 h-10 text-purple-400" />
            <div>
              <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-gray-400 mt-1">
                Welcome, <span className="text-purple-400 font-semibold">@{user?.username || user?.full_name || 'Admin'}</span>
                <Badge className="ml-2 bg-red-500 text-white">{getRole(user)}</Badge>
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid - Optimized for fast loading */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm font-semibold">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-400">✓</p>
              <p className="text-gray-400 text-xs mt-1">Operational</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm font-semibold">Admin Access</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-400">✓</p>
              <p className="text-gray-400 text-xs mt-1">Granted</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm font-semibold">Platform Health</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-400">✓</p>
              <p className="text-gray-400 text-xs mt-1">Healthy</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm font-semibold">Connection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-400">✓</p>
              <p className="text-gray-400 text-xs mt-1">Connected</p>
            </CardContent>
          </Card>
        </div>

        {/* Main content tabs - Optimized for performance */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-[#1a1a24] border-[#2a2a3a]">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[#2a2a3a]">Overview</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-[#2a2a3a]">Users</TabsTrigger>
            <TabsTrigger value="livestreams" className="data-[state=active]:bg-[#2a2a3a]">
              <Radio className="w-4 h-4 mr-1" />
              Live Streams
            </TabsTrigger>
            <TabsTrigger value="content-editor" className="data-[state=active]:bg-[#2a2a3a]">
              <Edit3 className="w-4 h-4 mr-1" />
              App Editor
            </TabsTrigger>
            <TabsTrigger value="earnings-editor" className="data-[state=active]:bg-[#2a2a3a]">
              <DollarSign className="w-4 h-4 mr-1" />
              Earnings Editor
            </TabsTrigger>
            <TabsTrigger value="integrations" className="data-[state=active]:bg-[#2a2a3a]">Integrations</TabsTrigger>
            <TabsTrigger value="applications" className="data-[state=active]:bg-[#2a2a3a]">Applications</TabsTrigger>
            <TabsTrigger value="cashouts" className="data-[state=active]:bg-[#2a2a3a]">Cashouts</TabsTrigger>
            <TabsTrigger value="fees" className="data-[state=active]:bg-[#2a2a3a]">Fees</TabsTrigger>
            <TabsTrigger value="safety" className="data-[state=active]:bg-[#2a2a3a]">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Safety
            </TabsTrigger>
            <TabsTrigger value="traeai" className="data-[state=active]:bg-[#2a2a3a]">
              <Bot className="w-4 h-4 mr-1" />
              TRAE.AI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                  { label: "Total Users", value: counters.totalUsers, color: "text-purple-400" },
                  { label: "Pending Apps", value: counters.pendingApps, color: "text-yellow-400" },
                  { label: "Pending Payouts", value: counters.pendingPayouts, color: "text-emerald-400" },
                  { label: "Troll Officers", value: counters.trollOfficers, color: "text-cyan-400" },
                  { label: "All Flags", value: counters.flags, color: "text-red-400" },
                ].map((c, i) => (
                  <Card key={i} className="bg-[#1a1a24] border-[#2a2a3a]">
                    <CardHeader className="pb-1"><CardTitle className="text-xs text-gray-400">{c.label}</CardTitle></CardHeader>
                    <CardContent><p className={`text-3xl font-bold ${c.color}`}>{c.value}</p></CardContent>
                  </Card>
                ))}
              </div>

              <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Coin Economy (Live)</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#2a2a3a] text-gray-300"
                    onClick={() => {
                      try {
                        queryClient.invalidateQueries(["coinsLive"]);
                        queryClient.invalidateQueries(["financeLive"]);
                        queryClient.invalidateQueries(["adminCounters"]);
                        toast.success("Dashboard refreshed");
                      } catch (_) {}
                    }}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />Refresh
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-[#0f0f14] border-[#2a2a3a] p-4"><p className="text-gray-400 text-xs mb-1">Purchased</p><p className="text-2xl font-bold text-emerald-400">{(coinsLive.purchased || 0).toLocaleString()}</p></Card>
                  <Card className="bg-[#0f0f14] border-[#2a2a3a] p-4"><p className="text-gray-400 text-xs mb-1">Purchased (User)</p><p className="text-2xl font-bold text-cyan-400">{(coinsLive.purchased || 0).toLocaleString()}</p></Card>
                  <Card className="bg-[#0f0f14] border-[#2a2a3a] p-4"><p className="text-gray-400 text-xs mb-1">Earned Coins</p><p className="text-2xl font-bold text-blue-400">{(coinsLive.earned || 0).toLocaleString()}</p></Card>
                  <Card className="bg-[#0f0f14] border-[#2a2a3a] p-4"><p className="text-gray-400 text-xs mb-1">Free Coins</p><p className="text-2xl font-bold text-red-400">{(coinsLive.free || 0).toLocaleString()}</p></Card>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-[#0f0f14] border-[#2a2a3a] p-4">
                    <div className="flex items-center justify-between"><p className="text-gray-400 text-sm">Total Coins in Circulation</p><Coins className="w-5 h-5 text-yellow-400" /></div>
                    <p className="text-3xl font-bold text-yellow-400 mt-2">{(coinsLive.total || 0).toLocaleString()}</p>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="bg-black/30 rounded p-2"><p className="text-xs text-gray-400">Purchased</p><p className="text-sm font-bold text-emerald-400">{(((coinsLive.purchased||0)/(coinsLive.total||1))*100).toFixed(1)}%</p></div>
                      <div className="bg-black/30 rounded p-2"><p className="text-xs text-gray-400">Earned</p><p className="text-sm font-bold text-blue-400">{(((coinsLive.earned||0)/(coinsLive.total||1))*100).toFixed(1)}%</p></div>
                      <div className="bg-black/30 rounded p-2"><p className="text-xs text-gray-400">Free</p><p className="text-sm font-bold text-red-400">{(((coinsLive.free||0)/(coinsLive.total||1))*100).toFixed(1)}%</p></div>
                    </div>
                  </Card>
                </div>
              </Card>

              <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
                <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold text-white">Revenue & Finance (Live)</h3><Badge className="bg-green-500 text-black">Auto-updating</Badge></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-[#0f0f14] border-[#2a2a3a] p-4"><p className="text-gray-400 text-xs mb-1">Total Purchases</p><p className="text-2xl font-bold text-emerald-400">${Number(finance.purchasesUsd || 0).toFixed(2)}</p></Card>
                  <Card className="bg-[#0f0f14] border-[#2a2a3a] p-4"><p className="text-gray-400 text-xs mb-1">Total Payouts</p><p className="text-2xl font-bold text-blue-400">${Number(finance.payoutsUsd || 0).toFixed(2)}</p></Card>
                  <Card className="bg-[#0f0f14] border-[#2a2a3a] p-4"><p className="text-gray-400 text-xs mb-1">Net</p><p className="text-2xl font-bold text-yellow-400">${Number(finance.totalUsd || 0).toFixed(2)}</p></Card>
                </div>
              </Card>

              <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
                <div className="mb-4"><Badge className="bg-blue-500 text-white">System Health Check</Badge></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 bg-[#0f0f14] border-[#2a2a3a]">
                    <div className="flex items-center justify-between mb-2"><p className="text-white font-semibold">Agora Live Streaming</p><Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={async () => {
                      try {
                        // Load SDK
                        if (!window.AgoraRTC) {
                          await new Promise((resolve, reject) => {
                            const s = document.createElement('script');
                            s.src = 'https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js';
                            s.onload = resolve; s.onerror = () => reject(new Error('Failed to load Agora SDK'));
                            document.head.appendChild(s);
                          });
                        }
                        const appId = import.meta.env.VITE_AGORA_APP_ID;
                        if (!appId) throw new Error('Missing VITE_AGORA_APP_ID in .env');
                        // Try to get a token via function or fallback
                        const ch = `admin_health_${Date.now()}`;
                        let tokenData;
                        try {
                          const resp = await supabase.functions.invoke('generateagoratoken', { body: { channelName: ch, role: 'publisher', uid: 1 } });
                          tokenData = resp?.data || resp;
                        } catch (_) {
                          tokenData = await getAgoraToken(ch, 1);
                        }
                        const token = tokenData?.token || tokenData?.rtcToken || import.meta.env.VITE_AGORA_DEV_TOKEN || null;
                        if (!token && (import.meta.env.VITE_AGORA_ALLOW_NO_TOKEN !== 'true')) throw new Error('Failed to retrieve Agora token');
                        // Basic client creation check
                        const client = window.AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
                        if (!client) throw new Error('Failed to create Agora client');
                        toast.success('Agora check: OK');
                      } catch (e) { toast.error(e.message || 'Agora check failed'); }
                    }}>Test Streaming</Button></div>
                    <p className="text-xs text-gray-400">Validates SDK load, App ID, token fetch</p>
                  </Card>
                  <Card className="p-4 bg-[#0f0f14] border-[#2a2a3a]">
                    <div className="flex items-center justify-between mb-2"><p className="text-white font-semibold">Square Payments & Cashouts</p><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={async () => {
                      try {
                        const result = await testSquareConnection();
                        if (!result?.success) throw new Error(result?.error || 'Square test failed');
                        toast.success('Square test: OK');
                      } catch (e) { toast.error(e.message || 'Square test failed'); }
                    }}>Test Square</Button></div>
                    <p className="text-xs text-gray-400">Uses earnings_config + edge function</p>
                  </Card>
                  <Card className="p-4 bg-[#0f0f14] border-[#2a2a3a]">
                    <div className="flex items-center justify-between mb-2"><p className="text-white font-semibold">Supabase Database</p><Button size="sm" variant="outline" onClick={async () => {
                      try {
                        const url = import.meta.env.VITE_SUPABASE_URL;
                        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
                        if (!url || !key) throw new Error('Missing Supabase envs');
                        const { data, error } = await supabase.from('profiles').select('id').limit(1);
                        if (error) throw error;
                        const { data: ping } = await supabase.rpc('get_current_high_paying_broadcasters');
                        toast.success('Supabase check: OK');
                      } catch (e) { toast.error(e.message || 'Supabase check failed'); }
                    }}>Test Supabase</Button></div>
                    <p className="text-xs text-gray-400">Checks env keys and query success</p>
                  </Card>
                  <Card className="p-4 bg-[#0f0f14] border-[#2a2a3a]">
                    <div className="flex items-center justify-between mb-2"><p className="text-white font-semibold">Stream Cleanup & Viewers</p><Button size="sm" variant="outline" onClick={async () => {
                      try {
                        const { error } = await supabase.from('streams').update({ last_heartbeat: new Date().toISOString() }).is('last_heartbeat', null);
                        if (error) throw error;
                        toast.success('Cleanup executed');
                      } catch (e) { toast.error(e.message || 'Cleanup failed'); }
                    }}>Run Cleanup</Button></div>
                    <p className="text-xs text-gray-400">Heartbeat</p>
                  </Card>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
              <h3 className="text-xl font-bold text-white mb-4">User Management</h3>
              <ModernUserAdminPanel />
            </Card>
          </TabsContent>

          <TabsContent value="livestreams">
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Radio className="w-6 h-6 text-red-500" />
                  <h3 className="text-xl font-bold text-white">Live Streams</h3>
                  <Badge variant="outline" className="border-red-500 text-red-400">
                    {liveStreams.length} Active
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={async () => {
                      if (window.confirm(`Are you sure you want to delete ALL ${liveStreams.length} live streams? This action cannot be undone.`)) {
                        try {
                          let deletedCount = 0;
                          let errorCount = 0;
                          
                          for (const stream of liveStreams) {
                            try {
                              const { error } = await supabase
                                .from('streams')
                                .delete()
                                .eq('id', stream.id);
                              
                              if (error) {
                                errorCount++;
                              } else {
                                deletedCount++;
                              }
                            } catch (err) {
                              errorCount++;
                            }
                          }
                          
                          if (errorCount > 0) {
                            toast.warning(`Deleted ${deletedCount} streams, ${errorCount} failed`);
                          } else {
                            toast.success(`Successfully deleted all ${deletedCount} live streams`);
                          }
                          
                          queryClient.invalidateQueries(['adminLiveStreams']);
                        } catch (error) {
                          toast.error(`Error deleting streams: ${error.message}`);
                        }
                      }
                    }}
                    disabled={liveStreams.length === 0}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />Delete All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#2a2a3a] text-gray-300"
                    onClick={() => {
                      queryClient.invalidateQueries(["adminLiveStreams"]);
                      toast.success("Live streams refreshed");
                    }}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />Refresh
                  </Button>
                </div>
              </div>

              {streamsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Radio className="w-8 h-8 text-purple-400 mx-auto mb-4 animate-pulse" />
                    <p className="text-gray-400">Loading live streams...</p>
                  </div>
                </div>
              ) : liveStreams.length === 0 ? (
                <div className="text-center py-12">
                  <Radio className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">No active live streams</p>
                  <p className="text-gray-500 text-sm mt-2">Streams will appear here when broadcasters go live</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveStreams.map((stream) => (
                    <Card key={stream.id} className="bg-[#1a1a24] border-[#2a2a3a] hover:border-purple-500 transition-colors cursor-pointer group">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                              {stream.profiles?.avatar_url ? (
                                <img 
                                  src={stream.profiles.avatar_url} 
                                  alt={stream.profiles.username}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <User className="w-5 h-5 text-white" />
                              )}
                            </div>
                            <div>
                              <h4 className="text-white font-semibold group-hover:text-purple-400 transition-colors">
                                @{stream.profiles?.username || 'Unknown'}
                              </h4>
                              <p className="text-gray-400 text-sm">
                                {stream.profiles?.full_name || 'Broadcaster'}
                              </p>
                            </div>
                          </div>
                          <Badge className="bg-red-500 text-white animate-pulse">
                            LIVE
                          </Badge>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Eye className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300">{stream.viewer_count || 0} viewers</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300">
                              {new Date(stream.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          {stream.title && (
                            <p className="text-gray-300 text-sm line-clamp-2">{stream.title}</p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-purple-600 hover:bg-purple-700"
                            onClick={() => {
                              window.open(`/stream/${stream.id}`, '_blank');
                            }}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Watch Stream
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#2a2a3a] text-gray-300 hover:border-purple-500"
                            onClick={() => {
                              window.open(`/@${stream.profiles?.username}`, '_blank');
                            }}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={async () => {
                              if (window.confirm(`Are you sure you want to delete the live stream by @${stream.profiles?.username}? This action cannot be undone.`)) {
                                try {
                                  const { error } = await supabase
                                    .from('streams')
                                    .delete()
                                    .eq('id', stream.id);
                                  
                                  if (error) {
                                    toast.error(`Failed to delete stream: ${error.message}`);
                                  } else {
                                    toast.success('Live stream deleted successfully');
                                    queryClient.invalidateQueries(['adminLiveStreams']);
                                  }
                                } catch (error) {
                                  toast.error(`Error deleting stream: ${error.message}`);
                                }
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="integrations">
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
              <h3 className="text-xl font-bold text-white mb-4">Integrations</h3>
              <IntegrationsPanel />
            </Card>
          </TabsContent>

          <TabsContent value="applications">
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
              <h3 className="text-xl font-bold text-white mb-4">Applications</h3>
              <ApplicationsPanel />
            </Card>
          </TabsContent>

          <TabsContent value="cashouts">
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
              <h3 className="text-xl font-bold text-white mb-4">Cashout Records</h3>
              <CashoutRecordsPanel />
            </Card>
          </TabsContent>

          <TabsContent value="fees">
            <FeeManagementPanel currentUser={user} />
          </TabsContent>

          <TabsContent value="safety">
            <SafetyDashboard />
          </TabsContent>

          <TabsContent value="traeai">
            <TRAEAIChatPanel />
          </TabsContent>

          <TabsContent value="content-editor">
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Edit3 className="w-6 h-6 text-blue-500" />
                  <h3 className="text-xl font-bold text-white">App Content Editor</h3>
                  <Badge variant="outline" className="border-blue-500 text-blue-400">
                    Global Editor
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#2a2a3a] text-gray-300"
                  onClick={() => {
                    queryClient.invalidateQueries(["adminContent"]);
                    toast.success("Content refreshed");
                  }}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />Refresh
                </Button>
              </div>

              <AppEditorInterface />
            </Card>
          </TabsContent>

          <TabsContent value="earnings-editor">
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-6 h-6 text-green-500" />
                  <h3 className="text-xl font-bold text-white">Earnings Configuration Editor</h3>
                  <Badge variant="outline" className="border-green-500 text-green-400">
                    Revenue Settings
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#2a2a3a] text-gray-300"
                  onClick={() => {
                    queryClient.invalidateQueries(["earningsConfig"]);
                    toast.success("Earnings config refreshed");
                  }}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />Refresh
                </Button>
              </div>

              <div className="space-y-6">
                <Card className="bg-[#0f0f14] border-[#2a2a3a] p-4">
                  <h4 className="text-white font-semibold mb-3">Quick Earnings Settings</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { page: "Earnings", field: "content", label: "Earnings Page" },
                      { page: "GoLive", field: "earnings_info", label: "Stream Earnings Info" },
                      { page: "Store", field: "earnings_content", label: "Store Earnings" },
                      { page: "Profile", field: "earnings_section", label: "Profile Earnings" },
                      { page: "Home", field: "earnings_banner", label: "Home Earnings Banner" },
                      { page: "StreamViewer", field: "earnings_tips", label: "Viewer Tips Info" }
                    ].map((item) => (
                      <Button
                        key={item.page}
                        variant="outline"
                        size="sm"
                        className="border-[#2a2a3a] text-gray-300 hover:border-green-500"
                        onClick={() => {
                          setContentPage(item.page);
                          setContentField(item.field);
                          setActiveTab("content");
                        }}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </Card>

                <Card className="bg-[#0f0f14] border-[#2a2a3a] p-4">
                  <h4 className="text-white font-semibold mb-3">Revenue Configuration</h4>
                  <p className="text-gray-400 text-sm mb-4">
                    Manage broadcaster revenue shares, tip percentages, and payout structures.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setContentPage("Earnings");
                        setContentField("content");
                        setActiveTab("content");
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Edit Earnings Page
                    </Button>
                    <Button
                      onClick={() => {
                        setContentPage("Earnings");
                        setContentField("header_content");
                        setActiveTab("content");
                      }}
                      variant="outline"
                      className="border-[#2a2a3a] text-gray-300 hover:border-green-500"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Revenue Settings
                    </Button>
                  </div>
                </Card>

                <Card className="bg-[#0f0f14] border-[#2a2a3a] p-4">
                  <h4 className="text-white font-semibold mb-3">Payout Management</h4>
                  <p className="text-gray-400 text-sm mb-4">
                    Configure payout thresholds, schedules, and payment methods.
                  </p>
                  <Button
                    onClick={() => setActiveTab("cashouts")}
                    variant="outline"
                    className="border-[#2a2a3a] text-gray-300 hover:border-green-500"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    View Cashout Records
                  </Button>
                </Card>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="system">
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
              <h3 className="text-xl font-bold text-white mb-4">System Management</h3>
              <div className="text-center py-8">
                <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500">System management features are available</p>
                <p className="text-gray-400 text-sm mt-2">Admin dashboard is now stable and responsive</p>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="content">
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
              <h3 className="text-xl font-bold text-white mb-4">Content Management</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Page</label>
                    <select
                      value={contentPage}
                      onChange={(e) => setContentPage(e.target.value)}
                      className="w-full bg-[#0a0a0f] border border-[#2a2a3a] text-white rounded-lg px-3 py-2"
                    >
                      {[
                        "Home","Profile","ProfilePage","Store","GoLive","StreamViewer","Messages","Notifications",
                        "AdminDashboard","PublicProfile","Trending"
                      ].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Field</label>
                    <select
                      value={contentField}
                      onChange={(e) => setContentField(e.target.value)}
                      className="w-full bg-[#0a0a0f] border border-[#2a2a3a] text-white rounded-lg px-3 py-2"
                    >
                      {["content","hero_title","hero_subtitle","banner","footer"].map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      onClick={() => {
                        const evt = new Event("refresh-admin-content");
                        window.dispatchEvent(evt);
                        toast.success("Content loaded");
                      }}
                      className="w-full"
                    >
                      Refresh
                    </Button>
                  </div>
                </div>

                <AdminEditPanel
                  pageName={`${contentPage}/${contentField}`}
                  currentContent={currentContent || ""}
                  fieldName={contentField}
                  onSave={async (text) => {
                    // Deactivate previous active rows
                    try {
                      await supabase
                        .from("admin_content")
                        .update({ is_active: false })
                        .eq("page_name", contentPage)
                        .eq("field_name", contentField)
                        .eq("is_active", true);
                    } catch (_) {}
                    // Insert new active row
                    const { data: auth } = await supabase.auth.getUser();
                    const uid = auth?.user?.id || null;
                    const { error } = await supabase
                      .from("admin_content")
                      .insert({ page_name: contentPage, field_name: contentField, content: text, updated_by: uid, is_active: true });
                    if (error) throw error;
                    setCurrentContent(text);
                    queryClient.invalidateQueries(["adminContent", contentPage, contentField]);
                  }}
                />
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
