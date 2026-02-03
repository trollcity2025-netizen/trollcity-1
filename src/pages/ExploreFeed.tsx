import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { trollCityTheme } from '../styles/trollCityTheme';
import UserNameWithAge from '../components/UserNameWithAge';
import { toast } from 'sonner';

interface Broadcast {
  id: string;
  broadcaster_id: string;
  title: string;
  category: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url?: string;
  user_profiles: {
    username: string;
    avatar_url?: string;
    level?: number;
    created_at?: string;
  };
}

export default function ExploreFeed() {
  const navigate = useNavigate();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'gaming' | 'irl' | 'music'>('all');

  // Auto-scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [_page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 20;

  const fetchBroadcasts = useCallback(async (targetPage: number, isLoadMore?: boolean) => {
    try {
      if (targetPage === 0) setLoading(true);
      const from = targetPage * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('streams')
        .select(`
          *,
          user_profiles:broadcaster_id (
            username,
            avatar_url,
            level,
            created_at
          )
        `, { count: 'exact' })
        .eq('is_live', true)
        .order('current_viewers', { ascending: false })
        .range(from, to);

      if (filter !== 'all') {
        query = query.eq('category', filter);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      if (isLoadMore) {
        setBroadcasts(prev => [...prev, ...(data || [])]);
        setPage(targetPage);
      } else {
        setBroadcasts(data || []);
        setPage(0);
      }

      // Check if we reached the end
      if (count !== null) {
        setHasMore(to < count);
      } else {
        setHasMore((data?.length || 0) === ITEMS_PER_PAGE);
      }

    } catch (error: any) {
      console.error('Error fetching broadcasts:', error);
      toast.error('Failed to load broadcasts');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Initial load
  useEffect(() => {
    fetchBroadcasts(0, false);
    
    // Polling every 30s - resets list to keep "Top" fresh
    const interval = setInterval(() => {
       if (window.scrollY < 500) {
         fetchBroadcasts(0, false);
       }
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [filter, fetchBroadcasts]);

  const getTimeSince = (timestamp: string) => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const handleBroadcastClick = (broadcast: Broadcast) => {
    navigate(`/live/${broadcast.id}`);
  };

  return (
    <div className={`min-h-screen w-full ${trollCityTheme.backgrounds.primary} relative overflow-x-hidden`}>
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute inset-0 ${trollCityTheme.overlays.radialPurple}`} />
        <div className={`absolute inset-0 ${trollCityTheme.overlays.radialPink}`} />
        <div className={`absolute inset-0 ${trollCityTheme.overlays.radialCyan}`} />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float-particle ${5 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 space-y-4">
          <div>
            <h1 className={`text-4xl md:text-5xl font-black ${trollCityTheme.text.gradient} mb-2`}>
              Explore Live Streams
            </h1>
            <p className={`text-lg ${trollCityTheme.text.secondary}`}>
              Discover amazing live content from creators around Troll City
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            {['all', 'irl', 'music'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat as typeof filter)}
                className={`px-6 py-3 rounded-xl font-semibold capitalize transition-all duration-300 ${
                  filter === cat
                    ? `${trollCityTheme.gradients.primary} text-white ${trollCityTheme.shadows.glow}`
                    : `${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} ${trollCityTheme.text.secondary} hover:border-purple-500/30`
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Stats Bar */}
          <div className={`flex flex-wrap items-center gap-6 p-4 ${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl`}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className={trollCityTheme.text.primary}>
                <span className="font-bold">{broadcasts.length}</span> Live Now
              </span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className={trollCityTheme.text.secondary}>
                {broadcasts.reduce((sum, b) => sum + b.viewer_count, 0).toLocaleString()} Total Viewers
              </span>
            </div>
          </div>
        </div>

        {/* Broadcasts Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl overflow-hidden animate-pulse`}>
                <div className="aspect-video bg-slate-800/50" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-slate-800/50 rounded" />
                  <div className="h-3 bg-slate-800/50 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : broadcasts.length === 0 ? (
          <div className={`text-center py-20 ${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-3xl`}>
            <Radio className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className={`text-2xl font-bold ${trollCityTheme.text.primary} mb-2`}>No Live Streams</h3>
            <p className={trollCityTheme.text.muted}>Check back later or be the first to go live!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {broadcasts.map((broadcast) => (
              <div
                key={broadcast.id}
                onClick={() => handleBroadcastClick(broadcast)}
                className={`group cursor-pointer ${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl overflow-hidden ${trollCityTheme.interactive.hover} ${trollCityTheme.borders.glassHover} ${trollCityTheme.shadows.card}`}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-cyan-900/20 overflow-hidden">
                  {broadcast.thumbnail_url ? (
                    <img
                      src={broadcast.thumbnail_url}
                      alt={broadcast.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-16 h-16 text-white/30" />
                    </div>
                  )}
                  
                  {/* Live Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-red-600/90 backdrop-blur-sm rounded-full shadow-lg">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-white font-bold text-xs uppercase">Live</span>
                  </div>

                  {/* Viewer Count */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full">
                    <Eye className="w-3 h-3 text-white" />
                    <span className="text-white font-semibold text-xs">
                      {broadcast.viewer_count.toLocaleString()}
                    </span>
                  </div>

                  {/* Hover Play Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className={`w-16 h-16 ${trollCityTheme.gradients.primary} rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform`}>
                      <Play className="w-8 h-8 text-white ml-1" fill="white" />
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 space-y-3">
                  {/* Streamer Info */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-500 flex-shrink-0 overflow-hidden border-2 border-white/10">
                      {broadcast.user_profiles?.avatar_url ? (
                        <img src={broadcast.user_profiles.avatar_url} alt={broadcast.user_profiles.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold ${trollCityTheme.text.primary} truncate`}>
                        <UserNameWithAge 
                          user={{
                            username: broadcast.user_profiles?.username || 'Unknown',
                            id: broadcast.broadcaster_id,
                            ...broadcast.user_profiles
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {broadcast.user_profiles?.level && (
                          <span className={`px-2 py-0.5 ${trollCityTheme.gradients.primary} rounded text-white font-bold`}>
                            Lvl {broadcast.user_profiles.level}
                          </span>
                        )}
                        <span className={trollCityTheme.text.muted}>
                          {getTimeSince(broadcast.started_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className={`font-bold ${trollCityTheme.text.primary} line-clamp-2 group-hover:text-cyan-400 transition-colors`}>
                    {broadcast.title || 'Untitled Stream'}
                  </h3>

                  {/* Category */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-3 py-1 ${trollCityTheme.backgrounds.glass} ${trollCityTheme.borders.glass} rounded-full ${trollCityTheme.text.muted} capitalize`}>
                      {broadcast.category}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && !loading && broadcasts.length > 0 && (
          <div className="mt-12 flex justify-center">
            <button
              onClick={() => fetchBroadcasts(_page + 1, true)}
              className={`px-8 py-3 rounded-xl font-bold text-white ${trollCityTheme.gradients.primary} ${trollCityTheme.shadows.glow} hover:scale-105 transition-transform duration-300`}
            >
              Load More Streams
            </button>
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes float-particle {
            0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0; }
            10% { opacity: 0.6; }
            90% { opacity: 0.6; }
            50% { transform: translateY(-100px) translateX(50px); }
          }
        `}
      </style>
    </div>
  );
}
