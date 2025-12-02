import React, { useState } from "react";

const STORE_DEBUG_URL =
  "https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1/paypal-create-order";

export default function StoreDebug() {
  const [log, setLog] = useState<string>("Ready…");

  const write = (msg: any) =>
    setLog((prev) => prev + "\n\n" + JSON.stringify(msg, null, 2));

  const testSupabasePing = async () => {
    write("Testing Supabase function reachability…");

    try {
      const res = await fetch(STORE_DEBUG_URL, {
        method: "OPTIONS",
      });
      write({ status: res.status, headers: Object.fromEntries(res.headers.entries()) });
    } catch (e) {
      write({ error: "OPTIONS request failed", details: e });
    }
  };

  const testSupabaseCreateOrder = async () => {
    write("Testing Supabase PayPal Create Order…");

    try {
      const res = await fetch(STORE_DEBUG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 10 }),
      });

      const data = await res.json().catch(() => "Non-JSON Response");
      write({ status: res.status, response: data });
    } catch (e) {
      write({ error: "POST request failed", details: e });
    }
  };

  const testBrowserPayPal = async () => {
    write("Testing raw PayPal token (browser)…");

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
        note: "If this returns anything, browser-to-PayPal is working.",
      });
    } catch (e) {
      write({ error: "Browser cannot reach PayPal", details: e });
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Store Debug Panel</h1>

      <button onClick={testSupabasePing}>1. Test Supabase (OPTIONS)</button>
      <button onClick={testSupabaseCreateOrder}>2. Test Supabase Create Order (POST)</button>
      <button onClick={testBrowserPayPal}>3. Test Browser → PayPal Direct</button>

      <pre
        style={{
          marginTop: 20,
          background: "#111",
          color: "#0f0",
          padding: 20,
          height: 500,
          overflowY: "scroll",
          fontSize: 12,
        }}
      >
        {log}
      </pre>
    </div>
  );
}

