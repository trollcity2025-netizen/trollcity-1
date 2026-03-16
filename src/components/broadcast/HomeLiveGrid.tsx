import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Users, Video, Radio, Star } from 'lucide-react';

interface Stream {
  id: string;
  user_id: string;
  title: string;
  status: string;
  viewer_count?: number;
  current_viewers: number;
  thumbnail_url?: string;
  user_profiles?: {
    username: string;
    avatar_url: string;
    ghost_mode_until?: string;
    featured_broadcaster_until?: string;
  };
}

export default function HomeLiveGrid() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { profile } = useAuthStore();

  const fetchStreams = async () => {
    try {
      const now = new Date().toISOString();
      
      // First get all live streams
      const { data, error } = await supabase
        .from('streams')
        .select(`
          id,
          title,
          status,
          viewer_count,
          current_viewers,
          thumbnail_url,
          user_id,
          user_profiles:user_profiles!streams_user_id_fkey (
            username,
            avatar_url,
            ghost_mode_until,
            featured_broadcaster_until
          )
        `)
        .eq('is_live', true)
        .order('current_viewers', { ascending: false })
        .range(0, 49);

      if (error) throw error;
      
      // Filter out ghost mode users (unless current user is admin)
      let filteredStreams = (data as any[]) || [];
      const isAdmin = profile?.role === 'admin' || profile?.is_admin;
      
      if (!isAdmin) {
        filteredStreams = filteredStreams.filter((stream: any) => {
          const ghostUntil = stream.user_profiles?.ghost_mode_until;
          if (ghostUntil && new Date(ghostUntil) > new Date()) {
            return false; // Filter out ghost mode users
          }
          return true;
        });
      }
      
      // Sort to prioritize featured broadcasters
      filteredStreams.sort((a: any, b: any) => {
        const aFeatured = a.user_profiles?.featured_broadcaster_until;
        const bFeatured = b.user_profiles?.featured_broadcaster_until;
        const aIsFeatured = aFeatured && new Date(aFeatured) > new Date();
        const bIsFeatured = bFeatured && new Date(bFeatured) > new Date();
        
        if (aIsFeatured && !bIsFeatured) return -1;
        if (!aIsFeatured && bIsFeatured) return 1;
        return (b.current_viewers || 0) - (a.current_viewers || 0);
      });
      
      setStreams(filteredStreams);
    } catch (err) {
      console.error('Error fetching streams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();

    // Poll every 15 seconds instead of Realtime subscription to save costs
    const interval = setInterval(fetchStreams, 15000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-900/50 rounded-xl aspect-video animate-pulse border border-white/5" />
        ))}
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-white/5 backdrop-blur-sm">
        <div className="bg-slate-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Radio className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-xl font-semibold text-slate-300 mb-2">No Live Streams</h3>
        <p className="text-slate-500 max-w-sm mx-auto">
          It&apos;s quiet in Troll City right now. Be the first to go live!
        </p>
        <button
          onClick={() => navigate('/broadcast/setup')}
          className="mt-6 px-6 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Start Streaming
        </button>
      </div>
    );
  }

  return (
    <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {streams.map((stream) => (
          <div
            key={stream.id}
            onClick={() => navigate(`/stream/${stream.id}`)}
            className="group cursor-pointer bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-1"
          >
            {/* Thumbnail / Preview Area */}
          <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
            {stream.thumbnail_url ? (
              <img
                src={stream.thumbnail_url}
                alt={stream.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : stream.user_profiles?.avatar_url ? (
              <img
                src={stream.user_profiles.avatar_url}
                alt={stream.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-cyan-900/20 group-hover:from-purple-900/40 group-hover:to-cyan-900/40 transition-colors">
                <Video className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 text-white/20 group-hover:text-white/40 transition-colors" />
              </div>
            )}
            
            {/* Featured Badge */}
            {stream.user_profiles?.featured_broadcaster_until && new Date(stream.user_profiles.featured_broadcaster_until) > new Date() && (
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-bold rounded shadow-lg">
                <Star className="w-3 h-3" />
                FEATURED
              </div>
            )}

            {/* Live Badge */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1 shadow-lg shadow-red-900/20 animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full" />
                LIVE
              </span>
            </div>

            {/* Viewer Count */}
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-medium text-white/90">
              <Users className="w-3 h-3" />
              {stream.current_viewers || stream.viewer_count || 0}
            </div>
          </div>

          {/* Stream Info */}
          <div className="p-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-white/10">
                  {stream.user_profiles?.avatar_url ? (
                    <img
                      src={stream.user_profiles.avatar_url}
                      alt={stream.user_profiles.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600 text-white font-bold text-lg">
                      {stream.user_profiles?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate group-hover:text-cyan-400 transition-colors">
                  {stream.title || 'Untitled Stream'}
                </h3>
                <p className="text-slate-400 text-sm truncate">
                  {stream.user_profiles?.username || 'Unknown User'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
