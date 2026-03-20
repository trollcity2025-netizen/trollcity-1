/**
 * TCNNMainPage Component
 * 
 * Public page for Troll City News Network
 * Displays live broadcasts, breaking headlines, articles, and journalist leaderboard
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import {
  Radio,
  Users,
  Play,
  TrendingUp,
  Newspaper,
  Award
} from 'lucide-react';
import { TCNNArticle, JournalistStats } from '@/types/tcnn';

// Components
import BreakingBanner from '@/components/tcnn/BreakingBanner';
import ArticleCard from '@/components/tcnn/ArticleCard';
import JournalistLeaderboard from '@/components/tcnn/JournalistLeaderboard';

interface TCNNStream {
  id: string;
  title: string;
  streamerName: string;
  streamerAvatar: string | null;
  viewerCount: number;
  isLive: boolean;
  streamChannel: string;
}

export default function TCNNMainPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [activeStream, setActiveStream] = useState<TCNNStream | null>(null);
  const [trendingArticles, setTrendingArticles] = useState<TCNNArticle[]>([]);
  const [recentArticles, setRecentArticles] = useState<TCNNArticle[]>([]);
  const [journalists, setJournalists] = useState<JournalistStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

   // Check if user has permission to view TCNN content on mount
   useEffect(() => {
     // Only approved TCNN roles (News Casters, Chief News Casters) and Admins can view TCNN
     if (!user || !profile) {
       // Not logged in, redirect to auth
       navigate('/auth?mode=signup');
       return;
     }
     
     // Check if user is an approved TCNN role (News Caster or Chief News Caster) OR an Admin
     const isApprovedTCNNRole = profile?.is_news_caster || profile?.is_chief_news_caster;
     const isAdmin = profile?.role === 'admin' || profile?.is_admin || 
                     profile?.role === 'superadmin' || profile?.is_superadmin;
     
     // If user is neither an approved TCNN role nor an admin, deny access
     if (!isApprovedTCNNRole && !isAdmin) {
       toast.error('Access denied: TCNN is only available to approved News Casters, Chief News Casters, and Admins');
       navigate('/');
       return;
     }
     
     // Additional explicit check to block Troll Officers and Lead Troll Officers
     // Even if they somehow have TCNN flags, these roles should not access TCNN
     const isTrollOfficer = profile?.is_troll_officer || profile?.is_lead_troll_officer || 
                           profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer';
                           
     if (isTrollOfficer && !isAdmin) {
       toast.error('Access denied: Troll Officers cannot access TCNN. Apply for News Caster role.');
       navigate('/');
       return;
     }
   }, [user, profile, navigate, toast]);

  useEffect(() => {
    let mounted = true;

    const fetchTCNNData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch active TCNN stream
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

        if (streamError) {
          console.error('Stream fetch error:', streamError);
        }

        if (streamData && mounted) {
          const broadcaster = Array.isArray(streamData.broadcaster) 
            ? streamData.broadcaster[0] 
            : streamData.broadcaster;

          setActiveStream({
            id: streamData.id,
            title: streamData.title || 'TCNN Live Broadcast',
            streamerName: broadcaster?.username || 'TCNN News Caster',
            streamerAvatar: broadcaster?.avatar_url || null,
            viewerCount: streamData.current_viewers || streamData.viewer_count || 0,
            isLive: streamData.is_live,
            streamChannel: streamData.agora_channel,
          });
        }

        // Fetch trending articles (most views)
        const { data: trendingData, error: trendingError } = await supabase
          .from('tcnn_articles')
          .select(`
            *,
            author:author_id(username, avatar_url)
          `)
          .eq('status', 'published')
          .order('view_count', { ascending: false })
          .limit(4);

        if (trendingError) {
          console.error('Trending articles fetch error:', trendingError);
        }

        if (trendingData && mounted) {
          setTrendingArticles(trendingData.map(formatArticle));
        }

        // Fetch recent articles
        const { data: recentData, error: recentError } = await supabase
          .from('tcnn_articles')
          .select(`
            *,
            author:author_id(username, avatar_url)
          `)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(6);

        if (recentError) {
          console.error('Recent articles fetch error:', recentError);
        }

        if (recentData && mounted) {
          setRecentArticles(recentData.map(formatArticle));
        }

        // Fetch journalist leaderboard
        const { data: journalistData, error: journalistError } = await supabase
          .from('user_profiles')
          .select(`
            id,
            username,
            avatar_url
          `)
          .or('is_journalist.eq.true,is_news_caster.eq.true,is_chief_news_caster.eq.true')
          .limit(5);

        if (journalistError) {
          console.error('Journalist fetch error:', journalistError);
        }

        if (journalistData && mounted) {
          setJournalists(journalistData.map((j: any) => ({
            userId: j.id,
            username: j.username,
            avatarUrl: j.avatar_url,
            articlesCount: 0,
            totalViews: 0,
            totalTips: 0,
            totalTipAmount: 0,
          })));
        }
      } catch (err: any) {
        console.error('Error fetching TCNN data:', err);
        if (mounted) {
          setError(err.message || 'Failed to load TCNN data');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchTCNNData();
    const interval = setInterval(fetchTCNNData, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const formatArticle = (item: any): TCNNArticle => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    excerpt: item.excerpt,
    content: item.content,
    featuredImageUrl: item.featured_image_url,
    authorId: item.author_id,
    authorName: item.author?.username || item.author_name || 'Unknown',
    authorAvatar: item.author?.avatar_url || null,
    status: item.status,
    submittedAt: item.submitted_at,
    reviewedAt: item.reviewed_at,
    publishedAt: item.published_at,
    reviewedBy: item.reviewed_by,
    category: item.category,
    tags: item.tags || [],
    isBreaking: item.is_breaking,
    viewCount: item.view_count,
    tipCount: item.tip_count,
    tipTotalCoins: item.tip_total_coins,
    metaDescription: item.meta_description,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  });

  const handleWatchStream = () => {
    if (activeStream) {
      navigate(`/broadcast/${activeStream.id}`);
    }
  };

  const handleArticleClick = (articleId: string) => {
    navigate(`/tcnn/article/${articleId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-20 bg-white/5 rounded-2xl" />
            <div className="h-96 bg-white/5 rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-48 bg-white/5 rounded-2xl" />
              <div className="h-48 bg-white/5 rounded-2xl" />
              <div className="h-48 bg-white/5 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <Radio className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Error Loading TCNN</h2>
            <p className="text-white/60">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Troll City News Network</h1>
              <p className="text-xs text-white/50">Official City Broadcast Station</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {activeStream?.isLive && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 rounded-full border border-red-500/30">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-red-400 uppercase">On Air</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Welcome Message */}
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to TCNN</h2>
          <p className="text-white/60">Troll City&apos;s Official News Network</p>
        </div>

        {/* Breaking Banner */}
        <BreakingBanner />

        {/* Live Broadcast Section */}
        {activeStream?.isLive && (
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Play className="w-5 h-5 text-red-500" fill="currentColor" />
              <h2 className="text-lg font-bold text-white">Live Now</h2>
              <span className="ml-auto text-xs text-white/50">
                {activeStream.viewerCount.toLocaleString()} watching
              </span>
            </div>

            <div 
              className="relative rounded-xl overflow-hidden cursor-pointer group"
              onClick={handleWatchStream}
            >
              {/* Official Broadcast Overlay */}
              <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-red-900/95 via-red-800/95 to-red-900/95 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-red-100 uppercase tracking-wider">
                    Official Broadcast
                  </span>
                </div>
                <span className="text-xs text-red-200/80">TCNN Channel</span>
              </div>

              {/* Video Placeholder */}
              <div className="aspect-video bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-red-600/90 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-xl shadow-red-500/30">
                    <Play className="w-10 h-10 text-white ml-1" fill="white" />
                  </div>
                  <p className="text-lg font-medium text-white/90">{activeStream.title}</p>
                  <p className="text-sm text-white/60 mt-1">with {activeStream.streamerName}</p>
                </div>
              </div>

              {/* Viewer Count */}
              <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/70 px-3 py-2 rounded-lg">
                <Users className="w-4 h-4 text-white/70" />
                <span className="text-sm font-medium text-white">
                  {activeStream.viewerCount.toLocaleString()}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Trending Articles */}
        {trendingArticles.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">Trending Stories</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {trendingArticles.map((article) => (
                <ArticleCard 
                  key={article.id} 
                  article={article} 
                  onClick={() => handleArticleClick(article.id)}
                  variant="compact"
                />
              ))}
            </div>
          </section>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Articles */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold text-white">Latest News</h2>
            </div>
            
            <div className="space-y-4">
              {recentArticles.map((article) => (
                <ArticleCard 
                  key={article.id} 
                  article={article} 
                  onClick={() => handleArticleClick(article.id)}
                  variant="full"
                />
              ))}
            </div>

            {recentArticles.length === 0 && (
              <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
                <Newspaper className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/50">No articles published yet.</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Journalist Leaderboard */}
            <JournalistLeaderboard journalists={journalists} />

            {/* Quick Stats */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-yellow-400" />
                <h3 className="font-bold text-white">TCNN Stats</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Active Journalists</span>
                  <span className="font-medium text-white">{journalists.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Articles Published</span>
                  <span className="font-medium text-white">{recentArticles.length + trendingArticles.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Currently Live</span>
                  <span className="font-medium text-white">{activeStream?.isLive ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
