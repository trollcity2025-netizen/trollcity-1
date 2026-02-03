import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Users, Radio, Shield, Eye } from 'lucide-react';
import { format12hr } from '../../utils/timeFormat';

interface StreamRow {
  id: string;
  broadcaster_id: string;
  status: string;
  is_live: boolean;
  current_viewers?: number;
  total_gifts_coins?: number;
  total_likes?: number;
  start_time?: string;
  title?: string;
  room_name?: string;
  category?: string;
  broadcaster?: {
    username: string;
    avatar_url: string;
  };
}

export default function OfficerStreamGrid() {
  const navigate = useNavigate();
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStreams = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('streams')
        .select(`
          *,
          broadcaster:user_profiles!broadcaster_id(username, avatar_url)
        `)
        .or('is_live.eq.true,status.eq.live')
        .order('current_viewers', { ascending: false });

      if (error) throw error;
      setStreams(data || []);
    } catch (error) {
      console.error('Error fetching streams:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading && streams.length === 0) {
    return (
      <div className="bg-black/40 border border-purple-900/50 rounded-xl p-6 text-center">
        <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
        <p className="text-gray-400">Scanning frequencies...</p>
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="bg-black/40 border border-purple-900/50 rounded-xl p-8 text-center">
        <Radio className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">No Active Streams</h3>
        <p className="text-gray-500">The city is quiet. Too quiet...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Radio className="w-5 h-5 text-red-500 animate-pulse" />
          Live Broadcasts
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">
            {streams.length} Active
          </span>
        </h2>
        <button 
          onClick={fetchStreams}
          className="text-xs text-purple-400 hover:text-purple-300"
        >
          Refresh Feed
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {streams.map((stream) => (
          <div 
            key={stream.id}
            className="group relative bg-black/60 border border-purple-900/50 hover:border-purple-500 rounded-xl overflow-hidden transition-all duration-300"
          >
            {/* Header */}
            <div className="p-3 border-b border-purple-900/30 flex items-start justify-between bg-black/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-900/50 flex items-center justify-center overflow-hidden border border-purple-500/30">
                  {stream.broadcaster?.avatar_url ? (
                    <img src={stream.broadcaster.avatar_url} alt={stream.broadcaster.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-purple-300">
                      {stream.broadcaster?.username?.substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-sm text-white group-hover:text-purple-300 transition-colors">
                    {stream.broadcaster?.username || 'Unknown'}
                  </div>
                  {stream.category && (
                    <div className="text-xs text-purple-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                      {stream.category}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-mono bg-red-900/20 text-red-400 px-2 py-1 rounded border border-red-900/30">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                LIVE
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              <h3 className="font-medium text-gray-200 line-clamp-1" title={stream.title}>
                {stream.title || 'Untitled Stream'}
              </h3>
              
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {stream.current_viewers || 0} watching
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {stream.start_time ? format12hr(stream.start_time) : '--:--'}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => navigate(`/live/${stream.id}`)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  WATCH
                </button>
                <button
                  onClick={() => navigate(`/live/${stream.id}?patrol=true`)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-900/50 hover:bg-blue-800/50 border border-blue-700/50 text-blue-200 text-xs font-bold rounded-lg transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  PATROL
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Clock({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
