import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import api, { API_ENDPOINTS } from "../../../lib/api";
import { toast } from "sonner";
import { RefreshCw, Users, Clock, Database, Video, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import MuxViewer from "../../../components/broadcast/MuxViewer";

const StreamMonitor = () => {
  const [dbStreams, setDbStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStream, setSelectedStream] = useState<any | null>(null);

  const fetchStreams = async () => {
    setLoading(true);
    try {
      const { data: dbData, error: dbError } = await supabase
        .from("streams")
        .select("id, title, broadcaster_id, status, created_at, hls_url")
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
    fetchStreams();
    const interval = setInterval(fetchStreams, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);



  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Video className="w-5 h-5 text-purple-400" />
          Live Stream Monitor
        </h3>
        <button 
          onClick={fetchStreams} 
          disabled={loading}
          className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stream List */}
        <div className="space-y-2 md:col-span-2">
          <h4 className="font-semibold text-gray-400 text-sm uppercase tracking-wider">
            Active Streams ({dbStreams.length})
          </h4>
          <div className="bg-zinc-900/50 rounded-xl border border-white/10 max-h-[600px] overflow-y-auto">
            {dbStreams.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No active streams detected</div>
            ) : (
              dbStreams.map((stream) => (
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
                        {stream.title || 'Untitled Stream'}
                      </h5>
                      <p className="text-xs text-gray-400">
                        Broadcaster: <span className="text-purple-300">{stream.broadcaster_id || 'Unknown'}</span>
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 border border-green-500/30">Live</span>
                  </div>

                  <div className="flex gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {stream.created_at ? formatDistanceToNow(new Date(stream.created_at)) : 'N/A'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedStream && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <button 
              onClick={() => setSelectedStream(null)}
              className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-red-600 rounded-full text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <MuxViewer playbackId={selectedStream.hls_url?.split('.m3u8')[0].split('/').pop() || ''} />
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamMonitor;