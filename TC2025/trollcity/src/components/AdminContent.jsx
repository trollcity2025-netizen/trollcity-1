import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";

export default function AdminContent({ pageName, fieldName = "content", defaultText = "" }) {
  const { data, isLoading } = useQuery({
    queryKey: ["adminContent", pageName, fieldName],
    queryFn: async () => {
      if (!supabase.__isConfigured) return defaultText;
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc("get_admin_content", {
          page_name_param: pageName,
          field_name_param: fieldName,
        });
        if (!rpcErr && typeof rpcData === "string" && rpcData.length > 0) return rpcData;
      } catch (_) {}
      try {
        const { data: rows } = await supabase
          .from("admin_content")
          .select("content")
          .eq("page_name", pageName)
          .eq("field_name", fieldName)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1);
        const row = Array.isArray(rows) ? rows[0] : null;
        return row?.content || defaultText;
      } catch (_) {
        return defaultText;
      }
    },
    staleTime: 60000,
  });

  if (isLoading) return <span>{defaultText}</span>;
  return <span>{data || defaultText}</span>;
}
