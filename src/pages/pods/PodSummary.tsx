import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Home, Users, Mic, MicOff, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

export default function PodSummary() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<{
    title: string;
    listeners: number;
    speakers: number;
    duration: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPodStats = async () => {
      try {
        // Fetch pod room stats
        const { data: podRoom, error } = await supabase
          .from('pod_rooms')
          .select('title, viewer_count, current_viewers, started_at, ended_at')
          .eq('id', roomId)
          .single();

        if (error) throw error;

        // Calculate duration
        const started = new Date(podRoom.started_at);
        const ended = new Date(podRoom.ended_at || new Date());
        const durationMinutes = Math.round((ended.getTime() - started.getTime()) / 60000);

        // Get speaker count from participants
        const { count: speakerCount } = await supabase
          .from('pod_room_participants')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', roomId)
          .in('role', ['host', 'speaker', 'officer']);

        setStats({
          title: podRoom.title || 'Pod Ended',
          listeners: podRoom.current_viewers || podRoom.viewer_count || 0,
          speakers: speakerCount || 0,
          duration: durationMinutes
        });
      } catch (err) {
        console.error('Error fetching pod stats:', err);
        setStats({ title: 'Pod Ended', listeners: 0, speakers: 0, duration: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchPodStats();
  }, [roomId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  const displayStats = stats || { title: 'Pod Ended', listeners: 0, speakers: 0, duration: 0 };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full bg-zinc-900 border border-white/10 rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
        <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-purple-500/50">
          <Mic size={40} className="text-purple-500" />
        </div>
        
        <h1 className="text-3xl font-bold mb-2">Pod Ended</h1>
        <p className="text-zinc-400 mb-8">{displayStats.title || "Great pod! Here's how it went:"}</p>

        <div className="grid grid-cols-3 gap-4 w-full mb-8">
          <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-white/5">
            <Users className="text-blue-400 mb-2" size={24} />
            <span className="text-2xl font-bold">{displayStats.listeners}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Listeners</span>
          </div>
          <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-white/5">
            <Mic className="text-green-400 mb-2" size={24} />
            <span className="text-2xl font-bold">{displayStats.speakers}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Speakers</span>
          </div>
          <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-white/5">
            <MicOff className="text-yellow-400 mb-2" size={24} />
            <span className="text-2xl font-bold">{displayStats.duration}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Minutes</span>
          </div>
        </div>

        <button 
            onClick={() => navigate('/pods')}
            className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition flex items-center justify-center gap-2"
        >
            <Home size={20} />
            Back to Pods
        </button>
      </div>
    </div>
  );
}
