import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const StreamMonitor = () => {
  const [streams, setStreams] = useState<any[]>([]);
  const [selectedStream, setSelectedStream] = useState<any | null>(null);

  const loadStreams = async () => {
    const { data } = await supabase
      .from("streams")
      .select("id, title, broadcaster_id, status, created_at")
      .eq("status", "live");
    setStreams(data || []);
  };

  useEffect(() => {
    loadStreams();

    const channel = supabase
      .channel("admin-stream-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "streams" }, loadStreams)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Live Stream Monitor</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold mb-2">Active Streams</h4>
          <div className="bg-black/40 rounded p-3 max-h-64 overflow-auto">
            {streams.map((stream) => (
              <div
                key={stream.id}
                className="border-b border-gray-700 py-2 cursor-pointer hover:bg-gray-700"
                onClick={() => setSelectedStream(stream)}
              >
                <p className="font-semibold">{stream.title}</p>
                <p className="text-sm">@{stream.broadcaster_id}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-2">Stream Viewer</h4>
          <div className="bg-black/40 rounded p-3 h-64 flex items-center justify-center">
            {selectedStream ? (
              <div className="text-center">
                <p className="font-semibold">{selectedStream.title}</p>
                <p>@{selectedStream.broadcaster_id}</p>
                <p className="text-sm text-gray-400">LiveKit HLS Stream</p>
                {/* Placeholder for HLS player */}
                <div className="bg-gray-800 rounded mt-2 p-4">
                  <p className="text-sm">HLS Player would go here</p>
                  <p className="text-xs text-gray-500">Stream Key: {selectedStream.stream_key}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-400">Select a stream to monitor</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamMonitor;