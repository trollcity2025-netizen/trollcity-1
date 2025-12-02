// StreamsPanel.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const StreamsPanel = () => {
  const [streams, setStreams] = useState<any[]>([]);

  const loadStreams = async () => {
    const { data } = await supabase
      .from("streams")
      .select("id, title, broadcaster_id, status, current_viewers, created_at")
      .eq("is_live", true); // Use is_live for consistency
    setStreams(data || []);
  };

  useEffect(() => {
    loadStreams();

    const channel = supabase
      .channel("admin_live_streams")
      .on("postgres_changes", { event: "*", schema: "public", table: "streams" }, loadStreams)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Active Live Streams</h2>
      {streams.map((stream) => (
        <div key={stream.id} className="p-3 bg-black/40 rounded-lg mb-3">
          <p className="text-purple-400">{stream.title}</p>
          <p>Streamer: @{stream.broadcaster_id}</p>
          <p>Viewers: {stream.current_viewers || 0}</p>
          <button
            className="bg-red-600 px-3 py-1 mt-2 rounded"
            onClick={async () => {
              await supabase
                .from("streams")
                .update({
                  is_live: false,
                  status: "ended",
                  end_time: new Date().toISOString(),
                })
                .eq("id", stream.id);
              loadStreams();
            }}
          >
            Force End
          </button>
        </div>
      ))}
    </div>
  );
};

export default StreamsPanel;