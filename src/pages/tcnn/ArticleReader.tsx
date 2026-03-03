import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useTCNNTipping } from '@/hooks/useTCNNTipping';
import { useTCNNRoles } from '@/hooks/useTCNNRoles';
import { TCNNArticle } from '@/types/tcnn';

// Simple date formatting helper
function formatDistanceToNow(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

interface TCNNJournalistProfile {
  user_id: string;
  articles_published: number;
  total_views: number;
  total_tips_received: number;
}
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Coins, 
  Clock, 
  User, 
  TrendingUp, 
  ArrowLeft, 
  Share2,
  Flag,
  Bookmark,
  MessageCircle,
  Send
} from 'lucide-react';
import { toast } from 'sonner';

interface RelatedArticle {
  id: string;
  headline: string;
  featured_image_url: string | null;
  published_at: string;
  author: {
    stage_name: string;
    avatar_url: string | null;
  };
}

export default function ArticleReader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { canTip } = useTCNNTipping();
  const { hasAnyRole } = useTCNNRoles(user?.id);
  
  const [article, setArticle] = useState<TCNNArticle | null>(null);
  const [journalist, setJournalist] = useState<TCNNJournalistProfile | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState<string>('10');
  const [tipMessage, setTipMessage] = useState('');
  const [isTipping, setIsTipping] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    if (id) {
      loadArticle();
    }
  }, [id]);

  const loadArticle = async () => {
    setIsLoading(true);
    try {
      // Load article with author details
      const { data: articleData, error: articleError } = await supabase
        .from('tcnn_articles')
        .select(`
          *,
          author:user_id(
            id,
            stage_name,
            avatar_url,
            is_verified
          )
        `)
        .eq('id', id)
        .single();

      if (articleError) throw articleError;
      if (!articleData) {
        toast.error('Article not found');
        navigate('/tcnn');
        return;
      }

      setArticle(articleData);

      // Increment view count
      await supabase.rpc('increment_article_views', { article_id: id });

      // Load journalist profile
      const { data: profileData } = await supabase
        .from('tcnn_journalist_profiles')
        .select('*')
        .eq('user_id', articleData.user_id)
        .single();

      if (profileData) {
        setJournalist(profileData);
      }

      // Load related articles (same category or recent)
      const { data: relatedData } = await supabase
        .from('tcnn_articles')
        .select(`
          id,
          headline,
          featured_image_url,
          published_at,
          author:user_id(
            stage_name,
            avatar_url
          )
        `)
        .eq('status', 'published')
        .neq('id', id)
        .or(`category.eq.${articleData.category},status.eq.published`)
        .order('published_at', { ascending: false })
        .limit(4);

      if (relatedData) {
        setRelatedArticles(relatedData);
      }

      // Check if bookmarked
      if (user) {
        const { data: bookmarkData } = await supabase
          .from('tcnn_bookmarks')
          .select('id')
          .eq('article_id', id)
          .eq('user_id', user.id)
          .single();
        
        setIsBookmarked(!!bookmarkData);
      }
    } catch (error) {
      console.error('Error loading article:', error);
      toast.error('Failed to load article');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTip = async () => {
    if (!user || !article) return;
    
    const amount = parseInt(tipAmount);
    if (isNaN(amount) || amount < 1) {
      toast.error('Please enter a valid tip amount');
      return;
    }

    setIsTipping(true);
    try {
      const { data, error } = await supabase.rpc('tip_journalist', {
        p_article_id: article.id,
        p_journalist_id: article.user_id,
        p_tipper_id: user.id,
        p_amount: amount,
        p_message: tipMessage || null
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Tipped ${amount} coins to ${article.author.stage_name}!`);
        setShowTipModal(false);
        setTipAmount('10');
        setTipMessage('');
        
        // Update journalist stats locally
        if (journalist) {
          setJournalist({
            ...journalist,
            total_tips_received: (journalist.total_tips_received || 0) + amount
          });
        }
      } else {
        toast.error(data?.error || 'Failed to send tip');
      }
    } catch (error) {
      console.error('Error tipping:', error);
      toast.error('Failed to send tip');
    } finally {
      setIsTipping(false);
    }
  };

  const toggleBookmark = async () => {
    if (!user) {
      toast.error('Please sign in to bookmark articles');
      return;
    }

    try {
      if (isBookmarked) {
        await supabase
          .from('tcnn_bookmarks')
          .delete()
          .eq('article_id', id)
          .eq('user_id', user.id);
        setIsBookmarked(false);
        toast.success('Removed from bookmarks');
      } else {
        await supabase
          .from('tcnn_bookmarks')
          .insert({
            article_id: id,
            user_id: user.id
          });
        setIsBookmarked(true);
        toast.success('Added to bookmarks');
      }
    } catch (error) {
      toast.error('Failed to update bookmark');
    }
  };

  const shareArticle = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!article) return null;

  const quickTipAmounts = [5, 10, 25, 50, 100];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-white/10 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/tcnn')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to TCNN
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={toggleBookmark}
              className={`p-2 rounded-lg transition-colors ${
                isBookmarked ? 'bg-yellow-500/20 text-yellow-400' : 'hover:bg-white/10'
              }`}
            >
              <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={shareArticle}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <Flag className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Article Header */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full font-medium">
                  {article.category}
                </span>
                {article.is_featured && (
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm rounded-full font-medium flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Featured
                  </span>
                )}
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                {article.headline}
              </h1>
              
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {formatDistanceToNow(article.published_at || article.created_at)}
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  {article.view_count?.toLocaleString()} views
                </div>
              </div>
            </div>

            {/* Featured Image */}
            {article.featured_image_url && (
              <div className="rounded-xl overflow-hidden">
                <img
                  src={article.featured_image_url}
                  alt={article.headline}
                  className="w-full h-auto object-cover"
                />
              </div>
            )}

            {/* Author Card */}
            <Card className="bg-slate-900/50 border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {article.author.avatar_url ? (
                    <img
                      src={article.author.avatar_url}
                      alt={article.author.stage_name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <User className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{article.author.stage_name}</span>
                      {article.author.is_verified && (
                        <span className="text-blue-400">✓</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">
                      {journalist?.articles_published || 0} articles published
                    </p>
                  </div>
                </div>
                
                <Button
                  onClick={() => setShowTipModal(true)}
                  disabled={!canTip || user?.id === article.user_id}
                  className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400"
                >
                  <Coins className="w-4 h-4 mr-2" />
                  Tip Author
                </Button>
              </div>
            </Card>

            {/* Article Body */}
            <div className="prose prose-invert prose-lg max-w-none">
              <div 
                className="text-gray-300 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            </div>

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-slate-800 text-gray-300 text-sm rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Engagement Bar */}
            <div className="flex items-center justify-between py-4 border-t border-white/10">
              <div className="flex items-center gap-6">
                <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                  <MessageCircle className="w-5 h-5" />
                  <span>Comments</span>
                </button>
                <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                  <Share2 className="w-5 h-5" />
                  <span>Share</span>
                </button>
              </div>
              
              <Button
                onClick={() => setShowTipModal(true)}
                disabled={!canTip || user?.id === article.user_id}
                variant="outline"
                className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
              >
                <Coins className="w-4 h-4 mr-2" />
                Support with Coins
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Journalist Stats */}
            {journalist && (
              <Card className="bg-slate-900/50 border-white/10 p-6">
                <h3 className="text-lg font-semibold mb-4">About the Journalist</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Articles</span>
                    <span className="font-medium">{journalist.articles_published}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Views</span>
                    <span className="font-medium">{journalist.total_views?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tips Received</span>
                    <span className="font-medium text-yellow-400">
                      {journalist.total_tips_received?.toLocaleString()} coins
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* Related Articles */}
            <Card className="bg-slate-900/50 border-white/10 p-6">
              <h3 className="text-lg font-semibold mb-4">Related Articles</h3>
              <div className="space-y-4">
                {relatedArticles.map((related) => (
                  <button
                    key={related.id}
                    onClick={() => navigate(`/tcnn/article/${related.id}`)}
                    className="w-full text-left group"
                  >
                    <div className="flex gap-3">
                      {related.featured_image_url && (
                        <img
                          src={related.featured_image_url}
                          alt={related.headline}
                          className="w-20 h-14 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                          {related.headline}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {related.author.stage_name} • {formatDistanceToNow(related.published_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Tip Modal */}
      <Dialog open={showTipModal} onOpenChange={setShowTipModal}>
        <DialogContent className="bg-slate-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-400" />
              Tip {article.author.stage_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 pt-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Select Amount</label>
              <div className="grid grid-cols-5 gap-2">
                {quickTipAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setTipAmount(amount.toString())}
                    className={`py-2 rounded-lg font-medium transition-all ${
                      tipAmount === amount.toString()
                        ? 'bg-yellow-500 text-black'
                        : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">Custom Amount</label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-yellow-400" />
                <Input
                  type="number"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="pl-10 bg-slate-800 border-white/10"
                  placeholder="Enter amount"
                  min="1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">Message (Optional)</label>
              <Textarea
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                className="bg-slate-800 border-white/10 resize-none"
                placeholder="Say something nice..."
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowTipModal(false)}
                className="flex-1 border-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleTip}
                disabled={isTipping || !tipAmount || parseInt(tipAmount) < 1}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-semibold"
              >
                {isTipping ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Send Tip
                  </span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
