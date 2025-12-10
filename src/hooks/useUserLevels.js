// src/hooks/useUserLevels.js
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useUserLevels() {
  const [levels, setLevels] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription;

    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setLevels(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_levels")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!error && data) setLevels(data);
      setLoading(false);

      // Realtime subscription
      subscription = supabase
        .channel(`user_levels_${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "user_levels", filter: `user_id=eq.${userId}` },
          (payload) => {
            setLevels((prev) => ({
              ...(prev || {}),
              ...payload.new,
            }));
          }
        )
        .subscribe();
    };

    load();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  return { levels, loading };
}