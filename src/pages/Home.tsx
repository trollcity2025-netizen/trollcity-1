import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Crown, Video } from 'lucide-react';

interface Stream {
  id: string;
  title: string;
  streamer: string;
  viewers: number;
  thumbnail: string;
  isLive: boolean;
}

interface User {
  id: string;
  username: string;
  level: number;
  coins: number;
  avatar: string;
  isNew?: boolean;
}

const NeonParticle: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  return (
    <div
      className="absolute w-2 h-2 rounded-full animate-float"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 10px ${color}`,
        animationDelay: `${delay}s`
      }}
    />
  );
};

export default function Home() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadLive = async () => {
      setLoadingLive(true);
      try {
        const { data, error } = await supabase
          .from('streams')
          .select('id, title, category, current_viewers, status')
          .eq('status', 'live')
          .order('start_time', { ascending: false });
        if (error) throw error;
        setLiveStreams(data || []);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load live streams');
      } finally {
        setLoadingLive(false);
      }
    };
    loadLive();

    const channel = supabase
      .channel('home-live-streams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, () => {
        loadLive();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white relative overflow-hidden">
      
      {/* Floating Neon Particles */}
      <div className="absolute inset-0 pointer-events-none">
        <NeonParticle delay={0} color="#00FFFF" />
        <NeonParticle delay={2} color="#FF00C8" />
        <NeonParticle delay={4} color="#00B8FF" />
        <NeonParticle delay={1} color="#FFC93C" />
        <NeonParticle delay={3} color="#FF00C8" />
        <NeonParticle delay={5} color="#00FFFF" />
      </div>

      {/* Light Streaks Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-1 h-full bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent transform rotate-12 animate-pulse" />
        <div className="absolute top-0 right-1/3 w-1 h-full bg-gradient-to-b from-transparent via-pink-400/20 to-transparent transform -rotate-12 animate-pulse" />
        <div className="absolute top-1/3 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-400/20 to-transparent animate-pulse" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Hero Banner */}
        <div className="mb-12 animate-fade-in-up">
          <div className="relative bg-gradient-to-r from-purple-600/80 via-pink-600/80 to-magenta-600/80 rounded-3xl p-12 overflow-hidden border border-[#FFD700] shadow-[0_0_18px_rgba(255,215,0,0.7)]">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 via-pink-400/20 to-purple-400/20 animate-pulse" />
            <div className="absolute inset-0">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 animate-pulse" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 animate-pulse" />
            </div>

            <div className="relative z-10 text-center">
              <div className="flex justify-center mb-6">
                <div className="animate-spin-slow">
                  <Crown className="text-yellow-400" size={64} style={{ filter: 'drop-shadow(0 0 20px #FFC93C)' }} />
                </div>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                MAI Introduces Troll City
              </h1>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                A new line of reinventions. Join the live experience, send gifts, and be a part of the chaos.
              </p>
            </div>
          </div>
        </div>

        {/* Live Now */}
        <div className="mb-12 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <h2 className="text-3xl font-bold text-white">Live Now</h2>
              </div>
              <span className="bg-gradient-to-r from-cyan-400/20 to-pink-400/20 text-cyan-400 px-3 py-1 rounded-full text-sm font-medium border border-[#FFD700] shadow-[0_0_12px_rgba(255,215,0,0.5)]">
                Auto-updating
              </span>
            </div>
            <button
              onClick={() => navigate('/go-live')}
              className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-pink-500/30 transition-all duration-300 flex items-center gap-2 transform hover:scale-105 active:scale-95"
              aria-label="Go Live - open broadcaster setup"
            >
              <Video size={20} />
              Go Live
            </button>
          </div>

          {loadingLive ? (
            <div className="text-gray-400">Loading live streams…</div>
          ) : liveStreams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveStreams.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/stream/${s.id}`)}
                  className="text-left bg-[#1A1A1A] rounded-2xl p-4 border border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.6)] hover:shadow-[0_0_25px_rgba(255,215,0,0.9)] hover:border-[#fffa8b] transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm text-white">Live</span>
                    </div>
                    <span className="text-xs text-gray-400">{s.current_viewers || 0} watching</span>
                  </div>
                  <div className="text-white font-semibold truncate">{s.title || 'Untitled Stream'}</div>
                  <div className="text-xs text-gray-400">{s.category || 'General'}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] rounded-2xl p-12 text-center border border-[#FFD700] shadow-[0_0_18px_rgba(255,215,0,0.6)]">
              <div className="text-6xl mb-4">🌙</div>
              <h3 className="text-xl font-semibold text-white mb-2">No one's live right now</h3>
              <p className="text-gray-400">Be the first to go live!</p>
            </div>
          )}
        </div>

        {/* Top Trollers */}
        <div className="mb-12 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] rounded-2xl p-8 border border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.6)]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Crown className="text-yellow-400" size={32} style={{ filter: 'drop-shadow(0 0 10px #FFC93C)' }} />
                <h2 className="text-3xl font-bold text-white">Top Trollers</h2>
              </div>
              <button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 transform hover:scale-105">
                View All
              </button>
            </div>
            <div className="p-6 text-center text-gray-400">No leaderboard data yet</div>
          </div>
        </div>

        {/* New Trollerz */}
        <div className="mb-12 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
          <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] rounded-2xl p-8 border border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.6)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-3xl">🆕</div>
              <h2 className="text-3xl font-bold text-white">New Trollerz</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg-grid-cols-4 gap-4">
              <div className="col-span-full p-6 text-center text-gray-400">No new users yet</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
