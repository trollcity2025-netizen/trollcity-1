import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import api, { API_ENDPOINTS } from "../../../lib/api";
import { toast } from "sonner";
import { RefreshCw, Users, Clock, Database, Video, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import StreamWatchModal, { WatchableStream } from "../../../components/broadcast/StreamWatchModal";

const StreamMonitor = () => {
  const [liveKitRooms, setLiveKitRooms] = useState<any[]>([]);
  const [dbStreams, setDbStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStream, setSelectedStream] = useState<any | null>(null);
  const [viewingStream, setViewingStream] = useState<WatchableStream | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch real LiveKit rooms via Edge Function
      const response = await api.request(API_ENDPOINTS.livekit.api, {
        method: 'POST',
        body: JSON.stringify({ action: 'list_rooms' })
      });
      
      const { data: rooms, error: lkError } = response;
      
      if (lkError) throw new Error(lkError);
      setLiveKitRooms(rooms || []);

      // 2. Fetch DB streams
      const { data: dbData, error: dbError } = await supabase
        .from("streams")
        .select("id, title, broadcaster_id, status, created_at")
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

  // Fetch participants when a room is selected
  useEffect(() => {
    if (selectedStream && selectedStream.source === 'livekit') {
      fetchParticipants(selectedStream.roomName);
    } else {
      setParticipants([]);
    }
  }, [selectedStream]);

  const fetchParticipants = async (roomName: string) => {
    setLoadingParticipants(true);
    try {
      const response = await api.request(API_ENDPOINTS.livekit.api, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_participants', room: roomName })
      });
      const { data, error } = response;
      if (error) throw new Error(error);
      setParticipants(data || []);
    } catch (err) {
      console.error('Error fetching participants:', err);
      toast.error('Failed to load participants');
    } finally {
      setLoadingParticipants(false);
    }
  };

  // Merge data for display
  const mergedStreams = React.useMemo(() => {
    const combined = new Map();

    // Add LiveKit rooms first
    liveKitRooms.forEach(room => {
      combined.set(room.name, {
        id: room.name, // assuming room.name is stream.id
        roomName: room.name,
        liveKitData: room,
        dbData: null,
        source: 'livekit',
        status: 'active'
      });
    });

    // Merge DB streams
    dbStreams.forEach(stream => {
      if (combined.has(stream.id)) {
        const existing = combined.get(stream.id);
        existing.dbData = stream;
        existing.source = 'both';
      } else {
        combined.set(stream.id, {
          id: stream.id,
          roomName: stream.id,
          liveKitData: null,
          dbData: stream,
          source: 'db_only',
          status: 'zombie' // In DB but not in LiveKit
        });
      }
    });

    return Array.from(combined.values());
  }, [liveKitRooms, dbStreams]);

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
                        {stream.dbData?.title || stream.liveKitData?.name || 'Untitled Stream'}
                      </h5>
                      <p className="text-xs text-gray-400">
                        Broadcaster: <span className="text-purple-300">{stream.dbData?.broadcaster_id || 'Unknown'}</span>
                      </p>
                    </div>
                    {stream.source === 'both' && <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 border border-green-500/30">Healthy</span>}
                    {stream.source === 'db_only' && <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 border border-red-500/30">DB Zombie</span>}
                    {stream.source === 'livekit' && <span className="px-2 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Ghost (No DB)</span>}
                  </div>

                  <div className="flex gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {stream.liveKitData?.numParticipants || 0} Viewers
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {stream.liveKitData?.creationTime ? formatDistanceToNow(new Date(stream.liveKitData.creationTime * 1000)) : 'N/A'}
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
                            title: selectedStream.dbData?.title
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
                        {selectedStream.source === 'both' ? (
                          <>
                            <Video className="w-4 h-4 text-green-400" />
                            <Database className="w-4 h-4 text-green-400" />
                            <span className="text-sm">Synced</span>
                          </>
                        ) : selectedStream.source === 'db_only' ? (
                          <>
                            <Database className="w-4 h-4 text-red-400" />
                            <span className="text-sm text-red-400">DB Only</span>
                          </>
                        ) : (
                          <>
                            <Video className="w-4 h-4 text-yellow-400" />
                            <span className="text-sm text-yellow-400">LiveKit Only</span>
                          </>
                        )}
                      </div>
                   </div>
                   <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                      <div className="text-xs text-gray-500 mb-1">Uptime</div>
                      <div className="text-sm font-mono">
                        {selectedStream.liveKitData?.creationTime 
                          ? formatDistanceToNow(new Date(selectedStream.liveKitData.creationTime * 1000))
                          : 'Not Live'}
                      </div>
                   </div>
                </div>

                {/* Raw Data Toggle */}
                <details className="group">
                  <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300 mb-2 select-none">
                    Show Raw LiveKit Data
                  </summary>
                  <pre className="text-[10px] bg-black/50 p-2 rounded overflow-x-auto text-green-400 font-mono">
                    {JSON.stringify(selectedStream.liveKitData, null, 2)}
                  </pre>
                </details>

                {/* Participants List */}
                <div>
                  <h5 className="font-semibold text-white mb-3 flex items-center justify-between">
                    <span>Participants</span>
                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-400">
                      {participants.length}
                    </span>
                  </h5>
                  
                  {loadingParticipants ? (
                    <div className="flex justify-center p-4"><RefreshCw className="w-5 h-5 animate-spin text-gray-500" /></div>
                  ) : participants.length === 0 ? (
                    <div className="text-sm text-gray-500 italic">No participants found</div>
                  ) : (
                    <div className="space-y-2">
                      {participants.map((p: any) => (
                        <div key={p.sid} className="bg-black/20 p-2 rounded flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${p.state === 'CONNECTED' ? 'bg-green-500' : 'bg-gray-500'}`} />
                             <span className="text-gray-300">{p.identity}</span>
                             {p.permission?.canPublish && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1 rounded">PUB</span>}
                          </div>
                          <span className="text-xs text-gray-500 font-mono">{p.sid.substring(0, 8)}...</span>
                        </div>
                      ))}
                    </div>
                  )}
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