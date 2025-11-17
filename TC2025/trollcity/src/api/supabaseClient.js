import { createClient } from "@supabase/supabase-js";
import { attachIntegrations } from "./integrationCore";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseFunctionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL; // Optional override for dev/tunnels

// Derive the dedicated functions host from the main Supabase URL if not explicitly provided.
// Example: https://<ref>.supabase.co -> https://<ref>.functions.supabase.co
function deriveFunctionsUrl(baseUrl) {
  try {
    const u = new URL(baseUrl);
    const host = u.hostname; // e.g., qaffpsbiciegxxonsxzl.supabase.co
    const isSupabaseCo = host.endsWith("supabase.co");
    if (!isSupabaseCo) return null;
    const [projectRef] = host.split(".");
    if (!projectRef) return null;
    return `https://${projectRef}.functions.supabase.co`;
  } catch (_) {
    return null;
  }
}

// If an explicit functions URL is provided but points to the main Supabase domain,
// normalize it to the dedicated functions subdomain.
function normalizeFunctionsUrl(explicitUrl, baseUrl) {
  try {
    if (explicitUrl) {
      const u = new URL(explicitUrl);
      const host = u.hostname;
      const isSupabaseCo = host.endsWith("supabase.co");
      const isFunctionsHost = host.includes(".functions.");
      if (isSupabaseCo && !isFunctionsHost) {
        const [projectRef] = host.split(".");
        u.hostname = `${projectRef}.functions.supabase.co`;
        return u.toString().replace(/\/$/, "");
      }
      return explicitUrl.replace(/\/$/, "");
    }
    const derived = deriveFunctionsUrl(baseUrl);
    return derived ? derived : undefined;
  } catch (_) {
    const derived = deriveFunctionsUrl(baseUrl);
    return derived ? derived : undefined;
  }
}

// Build a safe stub when env vars are missing to avoid crashing the app.
function buildSupabaseStub() {
  const result = { data: null, error: new Error("Supabase not configured") };
  const makeQuery = () => {
    const thenable = {
      select: () => thenable,
      insert: () => thenable,
      update: () => thenable,
      delete: () => thenable,
      match: () => thenable,
      eq: () => thenable,
      order: () => thenable,
      limit: () => thenable,
      single: async () => result,
      then: (resolve) => resolve(result),
      catch: () => thenable,
    };
    return thenable;
  };

  const stub = {
    __isConfigured: false,
    auth: {
      getUser: async () => ({ data: { user: null }, error: new Error("Supabase not configured") }),
      signOut: async () => ({ error: null }),
      // Provide a safe no-op auth.me that returns null
      me: async () => null,
      // Provide a redirect helper used by pages to route to login
      redirectToLogin: () => {
        try {
          if (typeof window !== "undefined") {
            window.location.href = "/Login";
          }
        } catch (_) {}
      },
      onAuthStateChange: (_cb) => ({
        data: {
          subscription: {
            unsubscribe: () => {}
          }
        }
      }),
    },
    from: () => makeQuery(),
    rpc: async () => ({ data: null, error: new Error("Supabase not configured") }),
    storage: {
      from: () => ({
        upload: async () => ({ error: new Error("Supabase not configured") }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
        createSignedUrl: async () => ({ data: { signedUrl: "" }, error: new Error("Supabase not configured") }),
      }),
    },
    integrations: {},
    entities: {
      TrollFamilyApplication: {
        list: async () => [], filter: async () => [], update: async () => null, create: async () => null, delete: async () => null,
      },
      Payout: {
        list: async () => [], filter: async () => [], update: async () => null, create: async () => null, delete: async () => null,
      },
      User: {
        list: async () => [], filter: async () => [], update: async () => null, create: async () => null, delete: async () => null,
      },
      CoinPurchase: {
        list: async () => [], filter: async () => [], update: async () => null, create: async () => null, delete: async () => null,
      },
      ModerationAction: {
        list: async () => [], filter: async () => [], update: async () => null, create: async () => null, delete: async () => null,
      },
      ModerationSettings: {
        list: async () => [], filter: async () => [], update: async () => null, create: async () => null, delete: async () => null,
      },
      Stream: {
        list: async () => [], filter: async () => [], update: async () => null, create: async () => null, delete: async () => null,
      },
      StreamGift: {
        list: async () => [], filter: async () => [], update: async () => null, create: async () => null, delete: async () => null,
      },
      ChatMessage: {
        list: async () => [], filter: async () => [], update: async () => null, create: async () => null, delete: async () => null,
      },
      StreamLike: {
        list: async () => [], filter: async () => [], update: async () => null, create: async () => null, delete: async () => null,
      },
      Notification: {
        list: async () => [], filter: async () => [], update: async () => null, create: async () => null, delete: async () => null,
      },
    },
  };
  console.error(
    "Supabase URL or Anon Key is missing. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment."
  );
  if (typeof window !== "undefined") {
    window.__SUPABASE_CONFIG_ERROR__ = true;
  }
  return stub;
}

// Create real client when configured; otherwise use stub
let client;
if (supabaseUrl && supabaseAnonKey) {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    functions: normalizeFunctionsUrl(supabaseFunctionsUrl, supabaseUrl)
      ? { url: normalizeFunctionsUrl(supabaseFunctionsUrl, supabaseUrl) }
      : undefined,
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  client.__isConfigured = true;
  // Attach convenience helpers expected by the app
  try {
    client.auth.me = async () => {
      try {
        const { data: auth } = await client.auth.getUser();
        const userId = auth?.user?.id;
        if (!userId) return null;
        const { data, error } = await client
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .limit(1)
          .single();
        if (error) {
          console.error('Error fetching profile:', error);
          return { id: userId, is_admin: false, level: 1 };
        }
        const u = data || { id: userId, is_admin: false, level: 1 };
        return { ...u, avatar: u.avatar ?? u.avatar_url ?? u.user_metadata?.avatar_url ?? null };
      } catch (_) {
        return null;
      }
    };
    client.auth.redirectToLogin = () => {
      try {
        if (typeof window !== 'undefined') {
          window.location.href = '/Login';
        }
      } catch (_) {}
    };
  } catch (_) {}
  try {
    const tableMap = {
      TrollFamilyApplication: 'troll_family_applications',
      Payout: 'payouts',
      User: 'profiles',
      CoinPurchase: 'coin_purchases',
      ModerationAction: 'moderation_actions',
      ModerationSettings: 'moderation_settings',
      Stream: 'streams',
      StreamGift: 'stream_gifts',
      ChatMessage: 'messages',
      StreamLike: 'stream_likes',
      Notification: 'notifications',
    };
    const makeOps = (table) => ({
      list: async (order = null, limit = null) => {
        if (!table) return [];
        let q = client.from(table).select('*');
        if (order && typeof order === 'string') {
          if (order.startsWith('-')) q = q.order(order.slice(1), { ascending: false });
          else q = q.order(order, { ascending: true });
        }
        if (limit) q = q.limit(limit);
        const { data } = await q;
        return data || [];
      },
      filter: async (conds = {}) => {
        if (!table) return [];
        let q = client.from(table).select('*');
        Object.entries(conds || {}).forEach(([k, v]) => { q = q.eq(k, v); });
        const { data } = await q;
        return data || [];
      },
      update: async (id, fields) => {
        if (!table) return null;
        const { data } = await client.from(table).update(fields).eq('id', id).select().single();
        return data || null;
      },
      create: async (fields) => {
        if (!table) return null;
        const { data } = await client.from(table).insert(fields).select().single();
        return data || null;
      },
      delete: async (id) => {
        if (!table) return null;
        const { data } = await client.from(table).delete().eq('id', id).select().single();
        return data || null;
      },
    });
    const entities = {};
    Object.entries(tableMap).forEach(([k, v]) => { entities[k] = makeOps(v); });
    client.entities = entities;
  } catch (_) {}
  try {
    console.info("[Supabase] URL:", supabaseUrl);
    const fnUrl = normalizeFunctionsUrl(supabaseFunctionsUrl, supabaseUrl);
    if (fnUrl) console.info("[Supabase] Functions URL:", fnUrl);
  } catch (_) {}
} else {
  client = buildSupabaseStub();
}

export const supabase = client;

// Attach local integrations (Core) if not provided
attachIntegrations(supabase);
