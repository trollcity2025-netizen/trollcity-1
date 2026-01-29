import React, { useState } from "react";
import { supabase } from '../../lib/supabase';
import { Activity, CreditCard, Globe, Terminal } from 'lucide-react';

const STORE_DEBUG_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-create-order`;

export default function StoreDebug() {
  const [log, setLog] = useState<string>("System Ready...\nWaiting for diagnostics...");
  const [loading, setLoading] = useState(false);

  const write = (msg: any) =>
    setLog((prev) => prev + "\n\n" + "> " + JSON.stringify(msg, null, 2));

  const testSupabasePing = async () => {
    setLoading(true);
    write("Testing Supabase function reachability (OPTIONS)...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(STORE_DEBUG_URL, {
        method: "OPTIONS",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      write({ status: res.status, headers: Object.fromEntries(res.headers.entries()) });
    } catch (e) {
      write({ error: "OPTIONS request failed", details: e });
    } finally {
      setLoading(false);
    }
  };

  const testSupabaseCreateOrder = async () => {
    setLoading(true);
    write("Testing Supabase PayPal Create Order (POST)...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        write({ error: "No active session", message: "Please log in first" });
        setLoading(false);
        return;
      }

      const res = await fetch(STORE_DEBUG_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: 10, debug: true }),
      });

      const data = await res.json().catch(() => "Non-JSON Response");
      write({ status: res.status, response: data });
    } catch (e) {
      write({ error: "POST request failed", details: e });
    } finally {
      setLoading(false);
    }
  };

  const testBrowserPayPal = async () => {
    setLoading(true);
    write("Testing raw PayPal token (browser connectivity check)...");

    try {
      const res = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + btoa("INVALID:INVALID"), // Always fails → tells if PayPal reachable
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });

      write({
        status: res.status,
        note: "If this returns 401 (Unauthorized), connectivity is GOOD. If it returns network error, connectivity is BAD.",
      });
    } catch (e) {
      write({ error: "Browser cannot reach PayPal", details: e });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm text-gray-400 uppercase tracking-[0.4em]">Diagnostics</p>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="text-blue-500" />
            Store Payment Diagnostics
          </h1>
          <p className="text-sm text-gray-400">
            Use these tools to verify connectivity between the client, Supabase Edge Functions, and PayPal APIs.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={testSupabasePing}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-[#1A1A1A] border border-blue-900/50 hover:border-blue-500 p-6 rounded-xl transition-all group"
          >
            <Globe className="w-6 h-6 text-blue-400 group-hover:text-blue-300" />
            <div className="text-left">
              <div className="font-bold text-blue-100">Test Connectivity</div>
              <div className="text-xs text-blue-400/60">Ping Edge Function</div>
            </div>
          </button>

          <button 
            onClick={testSupabaseCreateOrder}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-[#1A1A1A] border border-green-900/50 hover:border-green-500 p-6 rounded-xl transition-all group"
          >
            <CreditCard className="w-6 h-6 text-green-400 group-hover:text-green-300" />
            <div className="text-left">
              <div className="font-bold text-green-100">Test Order Creation</div>
              <div className="text-xs text-green-400/60">Simulate $10 Transaction</div>
            </div>
          </button>

          <button 
            onClick={testBrowserPayPal}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-[#1A1A1A] border border-yellow-900/50 hover:border-yellow-500 p-6 rounded-xl transition-all group"
          >
            <Activity className="w-6 h-6 text-yellow-400 group-hover:text-yellow-300" />
            <div className="text-left">
              <div className="font-bold text-yellow-100">Test PayPal API</div>
              <div className="text-xs text-yellow-400/60">Direct Browser Check</div>
            </div>
          </button>
        </div>

        <div className="bg-[#050505] border border-[#222] rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-[#111] px-4 py-2 border-b border-[#222] flex items-center gap-2">
            <Terminal className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-mono text-gray-400">Diagnostic Terminal</span>
          </div>
          <pre className="p-4 h-[500px] overflow-y-auto font-mono text-xs md:text-sm text-green-400/90 whitespace-pre-wrap leading-relaxed scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
            {log}
          </pre>
        </div>
      </div>
    </div>
  );
}

