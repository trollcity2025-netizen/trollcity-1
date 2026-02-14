import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  Radio, 
  Shield, 
  Eye, 
  X, 
  MicOff, 
  MessageSquareOff, 
  Gavel, 
  StopCircle,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import UserNameWithAge from '@/components/UserNameWithAge';
import StreamWatchModal from '@/components/broadcast/StreamWatchModal';

// Types
interface OfficerLog {
  officer_id: string;
  actions_taken: number;
  joined_at: string;
  officer: {
    username: string;
    avatar_url: string;
  };
}

interface StreamRow {
  id: string;
  broadcaster_id: string;
  status: string;
  is_live: boolean;
  viewer_count: number;
  current_viewers?: number;
  title: string;
  hls_url?: string;
  broadcaster: {
    username: string;
    avatar_url: string;
  };
  active_officers?: OfficerLog[];
}

interface PodRow {
  id: string;
  host_id: string;
  title: string;
  is_live: boolean;
  viewer_count: number;
  current_viewers?: number;
  started_at: string;
  hls_url?: string;
  host?: {
      username: string;
      avatar_url: string;
  };
}

interface StreamParticipant {
  user_id: string;
  username: string;
  avatar_url?: string;
  is_active: boolean;
}

export default function GovernmentStreams() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'streams' | 'pods'>('streams');
  const [pods, setPods] = useState<PodRow[]>([]);
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStream, setSelectedStream] = useState<StreamRow | null>(null);
  const [summonModalOpen, setSummonModalOpen] = useState(false);
  const [summonTargetStream, setSummonTargetStream] = useState<StreamRow | null>(null);

  const [showAllStreams, setShowAllStreams] = useState(false);

  const fetchStreams = React.useCallback(async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('streams')
        .select(`
          id,
          broadcaster_id,
          status,
          is_live,
          hls_url,
          viewer_count,
          current_viewers,
          title,
          room_name,
          category,
          start_time,
          broadcaster:user_profiles!broadcaster_id(username, avatar_url)
        `)
        .order('created_at', { ascending: false }) // Show newest first
        .range(0, 49); // Limit to 50 for performance

      // Apply filters if not showing all
      if (!showAllStreams) {
        query = query
          .or('is_live.eq.true,status.eq.live')
          .order('current_viewers', { ascending: false });
      }

      const { data: streamsData, error } = await query;

      if (error) throw error;

      // Fetch active officers for these streams
      const streamIds = streamsData.map(s => s.id);
      const { data: officerLogs } = await supabase
        .from('officer_stream_logs')
        .select(`
          stream_id,
          officer_id,
          actions_taken,
          joined_at,
          officer:user_profiles!officer_id(username, avatar_url, created_at)
        `)
        .in('stream_id', streamIds)
        .is('left_at', null);

      // Merge data
      const streamsWithOfficers = streamsData.map(stream => ({
        ...stream,
        broadcaster: (Array.isArray(stream.broadcaster) ? stream.broadcaster[0] : stream.broadcaster) || { username: 'Unknown', avatar_url: '' },
        active_officers: officerLogs
          ?.filter(log => log.stream_id === stream.id)
          .map((log: any) => ({
            ...log,
            officer: (Array.isArray(log.officer) ? log.officer[0] : log.officer) || { username: 'Unknown', avatar_url: '' }
          })) || []
      }));

      setStreams(streamsWithOfficers);
    } catch (error) {
      console.error('Error fetching streams:', error);
      toast.error('Failed to load streams');
    } finally {
      setLoading(false);
    }
  }, [showAllStreams]);

  const fetchPods = React.useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('pod_rooms')
        .select(`
            id,
            host_id,
            title,
            is_live,
            viewer_count,
            started_at,
            host:user_profiles!host_id(username, avatar_url)
        `)
        .order('started_at', { ascending: false });

      if (!showAllStreams) {
          query = query.eq('is_live', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      const transformedPods = data.map(pod => ({
        ...pod,
        host: (Array.isArray(pod.host) ? pod.host[0] : pod.host) || { username: 'Unknown', avatar_url: '' }
      }));
      setPods(transformedPods as any); 
    } catch (err) {
        console.error(err);
        toast.error('Failed to load pods');
    } finally {
        setLoading(false);
    }
  }, [showAllStreams]);

  useEffect(() => {
    fetchStreams();
    fetchPods();

    const interval = setInterval(() => {
        fetchStreams();
        fetchPods();
    }, 10000); 
    return () => clearInterval(interval);
  }, [fetchStreams, fetchPods]);

  const handleEndPod = async (podId: string) => {
    if (!confirm('FORCE END this pod?')) return;
    try {
        const { error } = await supabase
            .from('pod_rooms')
            .update({ 
                is_live: false, 
                status: 'ended',
                ended_at: new Date().toISOString() 
            })
            .eq('id', podId);

        if (error) throw error;
        
        toast.success('Pod ended');
        fetchPods();
    } catch (e) {
        console.error(e);
        toast.error('Failed to end pod');
    }
  };

  const handleEndLive = async (streamId: string) => {
    if (!confirm('Are you sure you want to FORCE END this stream?')) return;
    try {
      const { error } = await supabase
        .from('streams')
        .update({ 
          status: 'ended', 
          is_live: false, 
          ended_at: new Date().toISOString() 
        })
        .eq('id', streamId);

      if (error) throw error;
      toast.success('Stream ended successfully');
      fetchStreams();
    } catch (error) {
      console.error('Error ending stream:', error);
      toast.error('Failed to end stream');
    }
  };

  const handleMuteBroadcaster = async (stream: StreamRow) => {
    if (!confirm(`Are you sure you want to MUTE broadcaster ${stream.broadcaster?.username || 'Unknown'}?`)) return;
    try {
      // Mute by disabling their chat capability in participants table (if they are a participant in their own stream logic)
      // Or if there is a specific 'is_muted' flag. 
      // Based on LivePage logic, we mute participants.
      // Broadcaster is also a participant usually.
      
      // Calculate 10 mins mute
      const until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      
      await supabase
        .from('streams_participants')
        .update({ can_chat: false, chat_mute_until: until })
        .eq('stream_id', stream.id)
        .eq('user_id', stream.broadcaster_id);
        
      toast.success(`Broadcaster muted for 10 minutes`);
    } catch (error) {
      console.error('Error muting broadcaster:', error);
      toast.error('Failed to mute broadcaster');
    }
  };

  const handleDisableAllChats = async (streamId: string) => {
    if (!confirm('Are you sure you want to DISABLE ALL CHATS for this stream?')) return;
    try {
      await supabase
        .from('streams_participants')
        .update({ can_chat: false, chat_mute_until: null }) // null means permanent/indefinite until cleared
        .eq('stream_id', streamId);
        
      toast.success('All chats disabled for this stream');
    } catch (error) {
      console.error('Error disabling chats:', error);
      toast.error('Failed to disable chats');
    }
  };

  const handleSummonClick = (stream: StreamRow) => {
    setSummonTargetStream(stream);
    setSummonModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 flex items-center gap-3">
              <Shield className="w-8 h-8 text-purple-400" />
              Government Control
            </h1>
            <p className="text-gray-400 mt-2">Monitor, Moderate, and Enforce Troll City Laws</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white/5 rounded-lg p-1 mr-2">
                <button
                    onClick={() => setViewMode('streams')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${viewMode === 'streams' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Streams
                </button>
                <button
                    onClick={() => setViewMode('pods')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${viewMode === 'pods' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Pods
                </button>
            </div>

            <button 
                onClick={() => setShowAllStreams(!showAllStreams)}
                className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                showAllStreams 
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300 hover:bg-purple-500/30' 
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-400'
                }`}
            >
                <Activity className="w-4 h-4" />
                {showAllStreams ? 'History' : 'Live'}
            </button>
            
            <button 
                onClick={viewMode === 'streams' ? fetchStreams : fetchPods}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
                <Activity className="w-4 h-4" />
                Refresh
            </button>
          </div>
        </div>

        {/* Grid */}
        {loading && ((viewMode === 'streams' && streams.length === 0) || (viewMode === 'pods' && pods.length === 0)) ? (
          <div className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Scanning frequencies...</p>
          </div>
        ) : (viewMode === 'streams' && streams.length === 0) || (viewMode === 'pods' && pods.length === 0) ? (
          <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
            <Radio className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-300">No Active {viewMode === 'streams' ? 'Broadcasts' : 'Pods'}</h3>
            <p className="text-gray-500 mt-2">The city is currently quiet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {viewMode === 'streams' ? streams.map(stream => (
              <StreamCard 
                key={stream.id} 
                stream={stream} 
                onWatch={() => setSelectedStream(stream)}
                onEndLive={() => handleEndLive(stream.id)}
                onMuteBroadcaster={() => handleMuteBroadcaster(stream)}
                onDisableChats={() => handleDisableAllChats(stream.id)}
                onSummon={() => handleSummonClick(stream)}
              />
            )) : pods.map(pod => (
                <PodCard 
                    key={pod.id}
                    pod={pod}
                    onWatch={() => navigate(`/pods/${pod.id}`)}
                    onEndPod={() => handleEndPod(pod.id)}
                />
            ))}
          </div>
        )}
      </div>

      {/* Watch Modal */}
      {selectedStream && (
        <StreamWatchModal 
          stream={selectedStream} 
          onClose={() => setSelectedStream(null)} 
        />
      )}

      {/* Summon Modal */}
      {summonModalOpen && summonTargetStream && (
        <SummonModal 
          stream={summonTargetStream} 
          onClose={() => {
            setSummonModalOpen(false);
            setSummonTargetStream(null);
          }} 
        />
      )}
    </div>
  );
}

function PodCard({ pod, onWatch, onEndPod }: { pod: PodRow, onWatch: () => void, onEndPod: () => void }) {
  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden group hover:border-purple-500/50 transition-colors">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-[2px]">
             <img src={pod.host?.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} className="w-full h-full rounded-full object-cover" />
          </div>
          <div>
             <h3 className="font-bold text-white group-hover:text-purple-400 transition-colors">{pod.title || 'Untitled Pod'}</h3>
             <p className="text-xs text-gray-400">Host: {pod.host?.username || 'Unknown'}</p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${pod.is_live ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-gray-500/20 text-gray-400'}`}>
           {pod.is_live ? 'LIVE' : 'ENDED'}
        </div>
      </div>
      
      <div className="p-4 space-y-4">
         <div className="flex items-center justify-between text-sm text-gray-400">
            <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{(pod.current_viewers || pod.viewer_count || 0)} Viewers</span>
            </div>
            <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span>{new Date(pod.started_at).toLocaleTimeString()}</span>
            </div>
         </div>

         <div className="flex gap-2 pt-2">
            <button onClick={onWatch} className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2">
                <Eye className="w-4 h-4" /> Watch
            </button>
            <button onClick={onEndPod} className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors" title="Force End Pod">
                <StopCircle className="w-4 h-4" />
            </button>
         </div>
      </div>
    </div>
  );
}

function StreamCard({ 
  stream, 
  onWatch, 
  onEndLive, 
  onMuteBroadcaster, 
  onDisableChats, 
  onSummon 
}: { 
  stream: StreamRow; 
  onWatch: () => void;
  onEndLive: () => void;
  onMuteBroadcaster: () => void;
  onDisableChats: () => void;
  onSummon: () => void;
}) {
  return (
    <div className="group bg-black/40 border border-purple-900/30 hover:border-purple-500/50 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col">
      {/* Header Info */}
      <div className="p-4 bg-gradient-to-r from-purple-900/20 to-transparent border-b border-white/5 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-900/50 p-0.5 border border-purple-500/30">
            <img 
              src={stream.broadcaster?.avatar_url || `https://ui-avatars.com/api/?name=${stream.broadcaster?.username}&background=random`} 
              alt={stream.broadcaster?.username}
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          <div>
            <h3 className="font-bold text-white truncate max-w-[150px]">{stream.title || 'Untitled Stream'}</h3>
            <div className="text-xs text-purple-300 font-medium">@{stream.broadcaster?.username}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-bold rounded-full animate-pulse">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
            LIVE
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Users className="w-3 h-3" />
            {(stream.current_viewers || stream.viewer_count || 0)} Viewers
          </span>
        </div>
      </div>

      {/* Officer Presence */}
      <div className="px-4 py-2 bg-black/60 border-b border-white/5 min-h-[40px] flex items-center">
        {stream.active_officers && stream.active_officers.length > 0 ? (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <Shield className="w-3 h-3 text-emerald-400 shrink-0" />
            {stream.active_officers.map(log => (
              <div key={log.officer_id} className="flex items-center gap-1.5 bg-emerald-900/20 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                <img src={log.officer?.avatar_url} className="w-4 h-4 rounded-full" />
                <UserNameWithAge
                  user={{
                    username: log.officer?.username || 'Unknown',
                    id: log.officer_id
                  }}
                  className="text-[10px] text-emerald-300 font-medium"
                />
                {log.actions_taken > 0 && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-200 px-1 rounded-full">{log.actions_taken} acts</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500 italic flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />
            No officers present
          </div>
        )}
      </div>

      {/* Actions Grid */}
      <div className="p-4 grid grid-cols-2 gap-2 mt-auto">
        <button 
          onClick={onWatch}
          className="col-span-2 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-xl transition-all shadow-[0_4px_12px_rgba(147,51,234,0.3)]"
        >
          <Eye className="w-4 h-4" />
          Watch Live
        </button>
        
        <button 
          onClick={onEndLive}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-200 text-xs font-semibold rounded-lg transition-colors"
        >
          <StopCircle className="w-3.5 h-3.5" />
          End Live
        </button>

        <button 
          onClick={onSummon}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-900/30 hover:bg-orange-900/50 border border-orange-500/30 text-orange-200 text-xs font-semibold rounded-lg transition-colors"
        >
          <Gavel className="w-3.5 h-3.5" />
          Summon
        </button>

        <button 
          onClick={onMuteBroadcaster}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-yellow-900/30 hover:bg-yellow-900/50 border border-yellow-500/30 text-yellow-200 text-xs font-semibold rounded-lg transition-colors"
        >
          <MicOff className="w-3.5 h-3.5" />
          Mute Host
        </button>

        <button 
          onClick={onDisableChats}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/30 text-blue-200 text-xs font-semibold rounded-lg transition-colors"
        >
          <MessageSquareOff className="w-3.5 h-3.5" />
          No Chat
        </button>
      </div>
    </div>
  );
}

// Summon Modal
function SummonModal({ stream, onClose }: { stream: StreamRow; onClose: () => void }) {
  const [participants, setParticipants] = useState<StreamParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [reason, setReason] = useState('Disorderly Conduct');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const { data } = await supabase
          .from('stream_participants')
          .select('user_id, username, is_active')
          .eq('stream_id', stream.id)
          .eq('is_active', true);

        if (data) {
          // Filter valid user IDs
          const userIds = data.map(p => p.user_id).filter(Boolean);
          
          let profiles: any[] = [];
          if (userIds.length > 0) {
            const { data: profilesData } = await supabase
              .from('user_profiles')
              .select('id, username, avatar_url')
              .in('id', userIds);
            profiles = profilesData || [];
          }
            
          const merged = data.map(p => {
            const profile = profiles.find(prof => prof.id === p.user_id);
            // If this is the broadcaster, prefer the stream.broadcaster info which is trusted
            if (p.user_id === stream.broadcaster_id && stream.broadcaster) {
              return {
                ...p,
                username: stream.broadcaster.username,
                avatar_url: stream.broadcaster.avatar_url
              };
            }
            
            // Fix "UN" bug: ensure we have a valid fallback
            let username = profile?.username || p.username;
            if (!username || username === 'UN' || username === 'Unknown User') {
                username = p.user_id ? `User ${p.user_id.slice(0, 6)}` : 'Unknown User';
            }
            
            return {
              ...p,
              username: username,
              avatar_url: profile?.avatar_url || `https://ui-avatars.com/api/?name=${username}&background=random`
            };
          });
          
          // Add broadcaster if not in list
          if (!merged.find(p => p.user_id === stream.broadcaster_id)) {
            merged.unshift({
              user_id: stream.broadcaster_id,
              username: stream.broadcaster?.username || 'Unknown Broadcaster',
              avatar_url: stream.broadcaster?.avatar_url,
              is_active: true
            });
          }
          
          setParticipants(merged);
        }
      } catch (err) {
        console.error('Error loading participants', err);
      } finally {
        setLoading(false);
      }
    };
    loadParticipants();
  }, [stream]);

  const handleSummon = async () => {
    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }
    setSubmitting(true);
    try {
      // Create a court case docket entry
      // Use upsert or insert. Assuming 'court_cases' is the correct table.
      // If direct insert fails due to RLS, we might need an RPC.
      // For now, we'll try to insert with minimal required fields.
      
      const { error } = await supabase.from('court_cases').insert({
        title: `Summon from Stream: ${stream.title || 'Untitled'}`,
        description: `User summoned by officer from stream ${stream.id}. Reason: ${reason}`,
        defendant_id: selectedUserId,
        status: 'waiting', 
        case_type: 'civil', 
        severity: '1',
        plaintiff_id: (await supabase.auth.getUser()).data.user?.id // Ensure plaintiff is set
      });

      if (error) {
          console.error('Summon error:', error);
          throw error;
      }

      toast.success('User summoned to court successfully');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to summon user: ${err.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] w-full max-w-md p-6 rounded-2xl border border-orange-500/30 shadow-[0_0_50px_rgba(249,115,22,0.1)]">
        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-900/20 p-2 rounded-lg border border-orange-500/20">
              <Gavel className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Summon to Court</h3>
              <p className="text-xs text-gray-400">Issue a court summons</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Defendant</label>
            {loading ? (
              <div className="text-center py-4 text-gray-500 text-sm">Loading participants...</div>
            ) : participants.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm border border-white/10 rounded-lg bg-black/20">
                No active participants found
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {participants.map(p => (
                  <button
                    key={p.user_id}
                    onClick={() => setSelectedUserId(p.user_id)}
                    className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
                      selectedUserId === p.user_id 
                        ? 'bg-orange-500/20 border-orange-500 text-white' 
                        : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <img 
                      src={p.avatar_url || `https://ui-avatars.com/api/?name=${p.username}&background=random`}
                      className="w-8 h-8 rounded-full bg-black"
                      alt={p.username}
                    />
                    <div className="text-left">
                      <div className="font-bold text-sm">{p.username}</div>
                      <div className="text-[10px] text-gray-400">{p.user_id?.slice(0, 8)}...</div>
                    </div>
                    {selectedUserId === p.user_id && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Reason</label>
            <select 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-orange-500 outline-none"
            >
              <option value="Disorderly Conduct">Disorderly Conduct</option>
              <option value="Hate Speech">Hate Speech</option>
              <option value="Harassment">Harassment</option>
              <option value="Trolling without License">Trolling without License</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <button
            onClick={handleSummon}
            disabled={submitting || !selectedUserId}
            className="w-full py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-900/20 mt-4 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Issuing Summons...
              </>
            ) : (
              <>
                <Gavel className="w-4 h-4" />
                Issue Summons
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
