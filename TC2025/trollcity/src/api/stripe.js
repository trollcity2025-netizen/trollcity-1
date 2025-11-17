import { supabase } from "@/api/supabaseClient";

function deriveFunctionsUrl(baseUrl) {
  try {
    const u = new URL(baseUrl);
    const host = u.hostname; // e.g., <ref>.supabase.co
    const isSupabaseCo = host.endsWith("supabase.co");
    if (!isSupabaseCo) return null;
    const [projectRef] = host.split(".");
    if (!projectRef) return null;
    return `https://${projectRef}.functions.supabase.co`;
  } catch (_) {
    return null;
  }
}

export function getFunctionsUrl() {
  const explicit = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  const base = import.meta.env.VITE_SUPABASE_URL;
  try {
    if (explicit) {
      const u = new URL(explicit);
      const host = u.hostname;
      const isSupabaseCo = host.endsWith("supabase.co");
      const isFunctionsHost = host.includes(".functions.");
      if (isSupabaseCo && !isFunctionsHost) {
        const [projectRef] = host.split(".");
        u.hostname = `${projectRef}.functions.supabase.co`;
        return u.toString().replace(/\/$/, "");
      }
      return explicit.replace(/\/$/, "");
    }
    const derived = deriveFunctionsUrl(base);
    return derived || undefined;
  } catch (_) {
    const derived = deriveFunctionsUrl(base);
    return derived || undefined;
  }
}

export async function isFunctionsHostReachable() {
  const url = getFunctionsUrl();
  if (!url) return false;
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch (_) {
    return false;
  }
}

export async function createStripeCheckout({ userId, coins, successUrl, cancelUrl }) {
  // Safe stub: attempt functions call if available; otherwise return a placeholder
  const base = getFunctionsUrl();
  if (!base) return { ok: false, error: "Functions URL not configured" };
  try {
    const res = await fetch(`${base}/create-stripe-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, coins, successUrl, cancelUrl })
    });
    const data = await res.json().catch(() => ({}));
    return data || { ok: false };
  } catch (e) {
    return { ok: false, error: e?.message || "Request failed" };
  }
}

export async function confirmStripePayment({ sessionId, userId, coinAmount }) {
  const base = getFunctionsUrl();
  if (!base) return { ok: false, error: "Functions URL not configured" };
  try {
    const res = await fetch(`${base}/confirm-stripe-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, userId, coinAmount })
    });
    const data = await res.json().catch(() => ({}));
    return data || { ok: false };
  } catch (e) {
    return { ok: false, error: e?.message || "Request failed" };
  }
}

export async function testStripeConnection() {
  const base = getFunctionsUrl();
  if (!base) return { ok: false, error: "Functions URL not configured" };
  try {
    const res = await fetch(`${base}/test-stripe`, { method: "GET" });
    const data = await res.json().catch(() => ({}));
    return data || { ok: false };
  } catch (e) {
    return { ok: false, error: e?.message || "Request failed" };
  }
}

