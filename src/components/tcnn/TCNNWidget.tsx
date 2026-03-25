/**
 * TCNNWidget Component
 * 
 * Live media player card for Troll City News Network
 * Displayed on the Home page under Pods
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { 
  Radio, 
  Users, 
  Play, 
  Newspaper,
  ChevronRight,
  Maximize2 
} from 'lucide-react';
import { trollCityTheme } from '@/styles/trollCityTheme';

interface TCNNStream {
  id: string;
  title: string;
  streamerName: string;
  streamerAvatar: string | null;
  viewerCount: number;
  isLive: boolean;
  streamChannel: string;
}

interface TCNNHeadline {
  id: string;
  title: string;
  isBreaking: boolean;
  publishedAt: string;
}

interface TCNNWidgetProps {
  onRequireAuth: (intent?: string) => boolean;
}

export default function TCNNWidget({ onRequireAuth }: TCNNWidgetProps) {
  const navigate = useNavigate();
  const [stream, setStream] = useState<TCNNStream | null>(null);
  const [headlines, setHeadlines] = useState<TCNNHeadline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchTCNNData = async () => {
      try {
        // Check for active TCNN stream
        const { data: streamData, error: streamError } = await supabase
          .from('streams')
          .select(`
            id,
            title,
            user_id,
            is_live,
            viewer_count,
            current_viewers,
            agora_channel,
            broadcaster:user_profiles!user_id(username, avatar_url)
          `)
          .eq('category', 'tcnn')
          .eq('is_live', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (streamError) throw streamError;

        if (streamData && mounted) {
          const broadcaster = Array.isArray(streamData.broadcaster) 
            ? streamData.broadcaster[0] 
            : streamData.broadcaster;

          setStream({
            id: streamData.id,
            title: streamData.title || 'TCNN Live Broadcast',
            streamerName: broadcaster?.username || 'TCNN News Caster',
            streamerAvatar: broadcaster?.avatar_url || null,
            viewerCount: streamData.current_viewers || streamData.viewer_count || 0,
            isLive: streamData.is_live,
            streamChannel: streamData.agora_channel,
          });
        }

        // Fetch recent headlines
        const { data: headlinesData, error: headlinesError } = await supabase
          .from('tcnn_articles')
          .select('id, title, is_breaking, published_at')
          .eq('status', 'published')
          .order('is_breaking', { ascending: false })
          .order('published_at', { ascending: false })
          .limit(3);

        if (headlinesError) throw headlinesError;

        if (headlinesData && mounted) {
          setHeadlines(headlinesData.map(h => ({
            id: h.id,
            title: h.title,
            isBreaking: h.is_breaking,
            publishedAt: h.published_at,
          })));
        }
      } catch (err) {
        console.error('Error fetching TCNN data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchTCNNData();
    
    // Poll every 15 seconds for updates
    const interval = setInterval(fetchTCNNData, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleWatchClick = () => {
    if (!onRequireAuth('watch TCNN')) return;
    
    if (stream?.isLive) {
      navigate(`/tcnn/viewer/${stream.id}`);
    } else {
      navigate('/tcnn');
    }
  };

  const handleGoToTCNN = () => {
    if (!onRequireAuth('view TCNN')) return;
    navigate('/tcnn');
  };

  const handleHeadlineClick = (articleId: string) => {
    if (!onRequireAuth('read article')) return;
    navigate(`/tcnn/article/${articleId}`);
  };

  if (loading) {
    return (
      <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <Radio className="h-5 w-5 text-red-500" />
          <h3 className="text-lg font-semibold text-white">Troll City News Network</h3>
        </div>
        <div className="space-y-2">
          <div className="h-32 rounded-xl bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-4 overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative">
          <Radio className="h-5 w-5 text-red-500" />
          {stream?.isLive && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-white">Troll City News Network</h3>
        {stream?.isLive && (
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-red-500 text-white rounded animate-pulse">
            LIVE
          </span>
        )}
      </div>

      {/* Live Stream Player Card */}
      {stream?.isLive ? (
        <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border border-red-500/30 mb-4 group cursor-pointer"
          onClick={handleWatchClick}
        >
          {/* Official Broadcast Banner */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-red-900/90 via-red-800/90 to-red-900/90 px-3 py-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-red-100 uppercase tracking-wider">
              Official Broadcast
            </span>
          </div>

          {/* Player Area */}
          <div className="aspect-video bg-black flex items-center justify-center relative">
            {/* Thumbnail or placeholder */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
            
            {/* Play Button Overlay */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-red-600/90 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-red-500/30">
                <Play className="w-8 h-8 text-white ml-1" fill="white" />
              </div>
              <span className="text-sm font-medium text-white/80">Click to Watch</span>
            </div>

            {/* Viewer Count */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-lg">
              <Users className="w-3.5 h-3.5 text-white/70" />
              <span className="text-xs font-medium text-white/90">
                {stream.viewerCount.toLocaleString()}
              </span>
            </div>

            {/* Streamer Info */}
            <div className="absolute bottom-2 left-2 flex items-center gap-2">
              {stream.streamerAvatar ? (
                <img 
                  src={stream.streamerAvatar} 
                  alt={stream.streamerName}
                  className="w-8 h-8 rounded-full border-2 border-red-500/50"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center">
                  <Radio className="w-4 h-4 text-red-400" />
                </div>
              )}
              <div className="bg-black/60 px-2 py-1 rounded-lg">
                <p className="text-xs font-medium text-white/90 truncate max-w-[120px]">
                  {stream.title}
                </p>
                <p className="text-[10px] text-white/60">
                  {stream.streamerName}
                </p>
              </div>
            </div>
          </div>

          {/* Hover Actions */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGoToTCNN();
              }}
              className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-white/80 hover:text-white transition-colors"
              title="Go to TCNN"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Offline State */
        <div 
          className="relative rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 mb-4 cursor-pointer group"
          onClick={handleGoToTCNN}
        >
          <div className="aspect-video bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-white/10 transition-colors">
                <Radio className="w-8 h-8 text-white/40" />
              </div>
              <p className="text-sm font-medium text-white/60">TCNN is Offline</p>
              <p className="text-xs text-white/40 mt-1">Click to view recent news</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Headlines Preview */}
      {headlines.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-white/60">
            <Newspaper className="w-3.5 h-3.5" />
            <span className="text-xs font-medium uppercase tracking-wider">Latest Headlines</span>
          </div>
          <div className="space-y-1.5">
            {headlines.map((headline) => (
              <div
                key={headline.id}
                onClick={() => handleHeadlineClick(headline.id)}
                className="flex items-start gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors group"
              >
                {headline.isBreaking && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded shrink-0 mt-0.5">
                    BREAKING
                  </span>
                )}
                <p className="text-xs text-white/80 group-hover:text-white line-clamp-2 flex-1">
                  {headline.title}
                </p>
                <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View All Button */}
      <button
        onClick={handleGoToTCNN}
        className="mt-3 w-full text-xs font-semibold text-red-300 hover:text-red-200 flex items-center justify-center gap-1 transition-colors"
      >
        View TCNN Main Page
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}