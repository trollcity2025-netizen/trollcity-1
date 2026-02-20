import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { trollCityTheme } from '../../styles/trollCityTheme';
import { Mic, Users, Plus, Radio, Headphones } from 'lucide-react';
import { toast } from 'sonner';
import { emitEvent } from '../../lib/events';
import { generateUUID } from '../../lib/uuid';
// import { getHlsUrl } from '../../lib/hls'; // Removed as unused

interface PodRoom {
  id: string;
  title: string;
  host_id: string;
  viewer_count: number;
  current_viewers?: number;
  started_at: string;
  agora_channel_name?: string;
  host?: {
    username: string;
    avatar_url: string;
  };
}

export default function TrollPodsListing() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [rooms, setRooms] = useState<PodRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');

  const fetchRooms = async () => {
    try {
      // Fetch rooms first
      const { data: roomsData, error: roomsError } = await supabase
        .from('pod_rooms')
        .select('*')
        .eq('is_live', true)
        .gte('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .order('viewer_count', { ascending: false });

      if (roomsError) throw roomsError;
      if (!roomsData || roomsData.length === 0) {
        setRooms([]);
        return;
      }

      // Fetch host profiles manually to avoid join errors if FK is missing
      const hostIds = [...new Set(roomsData.map(r => r.host_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', hostIds);
      
      if (profilesError) {
        console.error('Error fetching host profiles:', profilesError);
        // Continue without host data if profile fetch fails
      }

      const roomsWithHosts = roomsData.map(room => ({
        ...room,
        host: profiles?.find(p => p.id === room.host_id)
      }));

      setRooms(roomsWithHosts);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    
    // Switch to polling for room list to prevent thundering herd on viewer count updates
    const interval = setInterval(fetchRooms, 15000); // 15s polling

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomTitle.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to start a pod');
        return;
      }

      // Check permissions via RPC
      const { data: canStartData, error: canStartError } = await supabase
        .rpc('can_start_pod', { p_user_id: user.id });

      if (canStartError) {
        console.error('Error checking pod permission:', canStartError);
      } else if (canStartData && canStartData.can_start === false) {
        toast.error(canStartData.message || 'City bandwidth exhausted.');
        setIsCreating(false);
        return;
      }

      setIsCreating(false);
      const agoraChannelName = `pod_${generateUUID()}`;

      const { data, error } = await supabase
        .from('pod_rooms')
        .insert({
          title: newRoomTitle,
          host_id: user.id,
          is_live: true,
          started_at: new Date().toISOString(),
          agora_channel_name: agoraChannelName,
        })
        .select()
        .single();

      if (error) throw error;

      // Ensure host is a participant for RLS-protected reads
      await supabase.from('pod_room_participants').insert({
        room_id: data.id,
        user_id: user.id,
        role: 'host',
        is_hand_raised: false
      });

      // Broadcast Pod Start (Global Banner)
      // Fire and forget
      const channel = supabase.channel('global_pod_notifications');
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'pod_started',
            payload: {
              id: generateUUID(),
              room_id: data.id,
              title: newRoomTitle,
              host_id: user.id,
              host_username: profile?.username || 'Unknown',
              host_avatar_url: profile?.avatar_url || ''
            }
          });
          setTimeout(() => supabase.removeChannel(channel), 1000);
        }
      });

      // Trigger Task Event
      emitEvent('pod_started', user.id, {
        roomId: data.id,
        title: newRoomTitle
      });

      toast.success('Pod started!');
      navigate(`/pods/${data.id}`);
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to start pod');
    }
  };

  return (
    <div className={`min-h-screen w-full ${trollCityTheme.backgrounds.primary} relative overflow-x-hidden p-4 md:p-8`}>
       {/* Background Effects */}
       <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute inset-0 ${trollCityTheme.overlays.radialPurple}`} />
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-3">
              <Mic className="w-10 h-10 text-purple-400" />
              Troll Pods
            </h1>
            <p className="text-white/60 text-lg">Live voice conversations happening now</p>
          </div>
          
          <button
            onClick={() => {
              if (!profile) {
                navigate('/auth?mode=signup');
              } else {
                setIsCreating(true);
              }
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-white hover:shadow-lg hover:shadow-purple-500/25 transition-all transform hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Start a Pod
          </button>
        </div>

        {/* Create Room Modal */}
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className={`w-full max-w-md ${trollCityTheme.backgrounds.card} border border-white/10 rounded-2xl p-6 shadow-2xl`}>
              <h2 className="text-2xl font-bold text-white mb-4">Start Your Pod</h2>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Topic</label>
                  <input
                    type="text"
                    value={newRoomTitle}
                    onChange={(e) => setNewRoomTitle(e.target.value)}
                    placeholder="What are we talking about?"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-semibold text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold text-white transition-colors"
                  >
                    Go Live
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Room Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white/5 rounded-3xl border border-white/10">
            <Radio className="w-16 h-16 text-white/20 mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">No active pods</h3>
            <p className="text-white/60">Be the first to start a conversation!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div
                key={room.id}
                onClick={() => navigate(`/pods/${room.id}`)}
                className={`group cursor-pointer ${trollCityTheme.backgrounds.card} border border-white/10 hover:border-purple-500/50 rounded-2xl p-6 transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-0.5">
                       <img 
                        src={room.host?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${room.host_id}`} 
                        alt={room.host?.username}
                        className="w-full h-full rounded-full bg-black object-cover"
                       />
                    </div>
                    <div>
                      <div className="text-xs text-purple-300 font-bold uppercase tracking-wider mb-0.5">Host</div>
                      <div className="text-sm font-medium text-white">{room.host?.username || 'Unknown'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    LIVE
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-6 line-clamp-2 group-hover:text-purple-300 transition-colors">
                  {room.title}
                </h3>

                <div className="flex items-center justify-between text-white/50 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{(room.current_viewers || room.viewer_count || 0)} listening</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Headphones className="w-4 h-4" />
                    <span>Join Pod</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
