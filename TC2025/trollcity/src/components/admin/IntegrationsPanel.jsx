import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { testSquareConnection } from "@/api/square";
import { getAgoraToken } from "@/utils/agora";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function IntegrationsPanel() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const agoraAppId = import.meta.env.VITE_AGORA_APP_ID;
  const devToken = import.meta.env.VITE_AGORA_DEV_TOKEN;

  const [liveCfg, setLiveCfg] = useState(null);
  const { data: earningsCfg } = useQuery({
    queryKey: ["earningsConfigForAdmin"],
    queryFn: async () => {
      try {
        const { data } = await supabase.from("earnings_config").select("*").eq("id", 1).single();
        return data || null;
      } catch (_) {
        return null;
      }
    },
    staleTime: 5000,
    refetchInterval: 5000,
  });

  useEffect(() => { setLiveCfg(earningsCfg || null); }, [earningsCfg]);

  useEffect(() => {
    try {
      const channel = supabase.channel("earnings_config_admin_rt");
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "earnings_config", filter: "id=eq.1" }, (payload) => {
        const row = payload?.new || null;
        if (row) setLiveCfg(row);
      }).subscribe();
      return () => { try { channel.unsubscribe(); } catch (_) {} };
    } catch (_) {}
  }, []);

  const supabasePresence = {
    url: !!supabaseUrl,
    key: !!supabaseKey,
    configured: !!supabase.__isConfigured,
  };

  const agoraPresence = {
    appId: !!agoraAppId,
    devToken: !!devToken,
  };

  const squarePresence = {
    active: !!liveCfg?.square_account_active,
    appId: !!liveCfg?.square_application_id,
    location: !!liveCfg?.square_location_id,
    accessToken: !!liveCfg?.square_access_token,
    environment: !!liveCfg?.square_environment,
  };

  const runSupabaseTest = async () => {
    try {
      if (!supabasePresence.url || !supabasePresence.key) throw new Error("Supabase env missing");
      const { data, error } = await supabase.from("profiles").select("id").limit(1);
      if (error) throw error;
      toast.success("Supabase: OK");
    } catch (e) {
      toast.error(e?.message || "Supabase test failed");
    }
  };

  const runAgoraTest = async () => {
    try {
      if (!agoraPresence.appId) throw new Error("Missing VITE_AGORA_APP_ID");
      if (!window.AgoraRTC) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js";
          s.onload = resolve; s.onerror = () => reject(new Error("Failed to load Agora SDK"));
          document.head.appendChild(s);
        });
      }
      const ch = `admin_integrations_${Date.now()}`;
      let tokenData;
      try {
        const resp = await supabase.functions.invoke("generateagoratoken", { body: { channelName: ch, role: "publisher", uid: 1 } });
        tokenData = resp?.data || resp;
      } catch (_) {
        tokenData = await getAgoraToken(ch, 1);
      }
      const token = tokenData?.token || tokenData?.rtcToken || devToken || null;
      if (!token && import.meta.env.VITE_AGORA_ALLOW_NO_TOKEN !== "true") throw new Error("Agora token missing");
      const client = window.AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      if (!client) throw new Error("Client create failed");
      toast.success("Agora: OK");
    } catch (e) {
      toast.error(e?.message || "Agora test failed");
    }
  };

  const runSquareTest = async () => {
    try {
      const res = await testSquareConnection();
      if (!res?.success) throw new Error(res?.error || "Square test failed");
      toast.success("Square: OK");
    } catch (e) {
      toast.error(e?.message || "Square test failed");
    }
  };

  const Item = ({ label, ok }) => (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
      <span className="text-gray-300 text-sm">{label}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-[#0f0f14] border-[#2a2a3a]">
          <div className="flex items-center justify-between mb-3"><h3 className="text-white font-semibold">Supabase</h3><Badge className="bg-blue-500 text-white">Core</Badge></div>
          <div className="space-y-2">
            <Item label="URL present" ok={supabasePresence.url} />
            <Item label="Anon key present" ok={supabasePresence.key} />
            <Item label="Client configured" ok={supabasePresence.configured} />
          </div>
          <div className="mt-3"><Button size="sm" variant="outline" onClick={runSupabaseTest}>Run Test</Button></div>
        </Card>
        <Card className="p-4 bg-[#0f0f14] border-[#2a2a3a]">
          <div className="flex items-center justify-between mb-3"><h3 className="text-white font-semibold">Agora</h3><Badge className="bg-purple-500 text-white">Streaming</Badge></div>
          <div className="space-y-2">
            <Item label="App ID present" ok={agoraPresence.appId} />
            <Item label="Dev token available" ok={agoraPresence.devToken} />
          </div>
          <div className="mt-3"><Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={runAgoraTest}>Run Test</Button></div>
        </Card>
        <Card className="p-4 bg-[#0f0f14] border-[#2a2a3a]">
          <div className="flex items-center justify-between mb-3"><h3 className="text-white font-semibold">Square</h3><Badge className="bg-emerald-500 text-black">Payments</Badge></div>
          <div className="space-y-2">
            <Item label="Account active" ok={squarePresence.active} />
            <Item label="Application ID" ok={squarePresence.appId} />
            <Item label="Access token" ok={squarePresence.accessToken} />
            <Item label="Environment" ok={squarePresence.environment} />
            <Item label="Location ID" ok={squarePresence.location} />
          </div>
          <div className="mt-3"><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={runSquareTest}>Run Test</Button></div>
        </Card>
      </div>
    </div>
  );
}
