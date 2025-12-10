import { supabase } from "@/lib/supabaseClient";

export async function callLeadAction(action, payload) {
  const { data: userData } = await supabase.auth.getUser();
  const lead_id = userData?.user?.id;

  const { data, error } = await supabase.functions.invoke(
    "lead-panel-actions",
    {
      body: { action, payload, lead_id },
    }
  );

  if (error) {
    console.error("lead-panel error", error);
    throw error;
  }

  return data;
}