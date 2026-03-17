import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { RefreshCw, Users, Clock, Database, Video, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import StreamWatchModal, { WatchableStream } from "../../../components/broadcast/StreamWatchModal";

const StreamMonitor = () => {
  const [dbStreams, setDbStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStream, setSelectedStream] = useState<any | null>(null);
  const [viewingStream, setViewingStream] = useState<WatchableStream | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch DB streams
      const { data: dbData, error: dbError } = await supabase
        .from("streams")
        .select("id, title, broadcaster_id, status, created_at, mux_playback_id")
        .eq("status", "live");

      if (dbError) throw dbError;
      setDbStreams(dbData || []);

    } catch (err: any) {
      console.error('Error fetching stream data:', err);
      toast.error('Failed to refresh stream data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Merge data for display (now only from DB)
  const mergedStreams = React.useMemo(() => {
    return dbStreams.map(stream => ({
      id: stream.id,
      roomName: stream.id,
      dbData: stream,
      source: 'db_only',
      status: 'active' // Assuming if it's in DB and live, it's active
    }));
  }, [dbStreams]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Video className="w-5 h-5 text-purple-400" />
          Live Stream Monitor
        </h3>
        <button 
          onClick={fetchData} 
          disabled={loading}
          className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stream List */}
        <div className="space-y-2">
          <h4 className="font-semibold text-gray-400 text-sm uppercase tracking-wider">
            Active Rooms ({mergedStreams.length})
          </h4>
          <div className="bg-zinc-900/50 rounded-xl border border-white/10 max-h-[600px] overflow-y-auto">
            {mergedStreams.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No active streams detected</div>
            ) : (
              mergedStreams.map((stream) => (
                <div
                  key={stream.id}
                  className={`p-4 border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5 ${
                    selectedStream?.id === stream.id ? 'bg-white/10' : ''
                  }`}
                  onClick={() => setSelectedStream(stream)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className="font-semibold text-white">
                        {stream.dbData?.title || 'Untitled Stream'}
                      </h5>
                      <p className="text-xs text-gray-400">
                        Broadcaster: <span className="text-purple-300">{stream.dbData?.broadcaster_id || 'Unknown'}</span>
                      </p>
                    </div>
                    {stream.source === 'db_only' && <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 border border-green-500/30">Healthy</span>}
                  </div>

                  <div className="flex gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      
                      {stream.dbData?.participants || 0} Viewers
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {stream.dbData?.created_at ? formatDistanceToNow(new Date(stream.dbData.created_at)) : 'N/A'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stream Details Panel */}
        <div className="space-y-2">
          <h4 className="font-semibold text-gray-400 text-sm uppercase tracking-wider">
            Stream Inspector
          </h4>
          <div className="bg-zinc-900/50 rounded-xl border border-white/10 h-[600px] p-4 overflow-y-auto">
            {selectedStream ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {selectedStream.dbData?.title || 'Unknown Title'}
                  </h3>
                  <div className="text-sm text-gray-400 flex flex-wrap gap-2 items-center">
                    <span className="font-mono bg-black/30 px-2 py-1 rounded text-xs">{selectedStream.id}</span>
                    <button
                        onClick={() => setViewingStream({
                            id: selectedStream.id,
                            room_name: selectedStream.roomName,
                            title: selectedStream.dbData?.title,
                            agora_channel: selectedStream.dbData?.id, // Agora channel uses stream ID
                            mux_playback_id: selectedStream.dbData?.mux_playback_id,
                            broadcaster_id: selectedStream.dbData?.broadcaster_id
                        })}
                        className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded transition-colors"
                    >
                        <Eye className="w-3 h-3" /> Monitor Feed
                    </button>
                  </div>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                      <div className="text-xs text-gray-500 mb-1">Source</div>
                      <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-green-400" />
                          <span className="text-sm">DB Only</span>
                      </div>
                   </div>
                   <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                      <div className="text-xs text-gray-500 mb-1">Uptime</div>
                      <div className="text-sm font-mono">
                        {selectedStream.dbData?.created_at
                          ? formatDistanceToNow(new Date(selectedStream.dbData.created_at))
                          : 'Not Live'}
                      </div>
                   </div>
                </div>

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <Video className="w-12 h-12 mb-2 opacity-20" />
                <p>Select a stream to inspect</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Modal for viewing stream */}
      {viewingStream && (
        <StreamWatchModal 
          stream={viewingStream} 
          onClose={() => setViewingStream(null)} 
        />
      )}
    </div>
  );
};

export default StreamMonitor;