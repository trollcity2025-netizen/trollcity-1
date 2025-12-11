// src/supabaseClient.ts (FRONTEND CLIENT)
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// never use service role here — frontend must use anon key.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Optional: expose globally for debugging
if (typeof window !== "undefined") {
  // @ts-ignore
  window.supabase = supabase;
}