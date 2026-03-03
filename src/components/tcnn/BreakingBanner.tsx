/**
 * BreakingBanner Component
 * 
 * Displays breaking news headline with prominent styling
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';

interface BreakingArticle {
  id: string;
  title: string;
  slug: string;
}

export default function BreakingBanner() {
  const navigate = useNavigate();
  const [breakingArticle, setBreakingArticle] = useState<BreakingArticle | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchBreakingNews = async () => {
      const { data } = await supabase
        .from('tcnn_articles')
        .select('id, title, slug')
        .eq('status', 'published')
        .eq('is_breaking', true)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setBreakingArticle({
          id: data.id,
          title: data.title,
          slug: data.slug,
        });
      }
    };

    fetchBreakingNews();
    
    // Subscribe to breaking news updates
    const channel = supabase
      .channel('tcnn-breaking')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'tcnn_articles',
          filter: 'is_breaking=eq.true'
        },
        () => fetchBreakingNews()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleClick = () => {
    if (breakingArticle) {
      navigate(`/tcnn/article/${breakingArticle.id}`);
    }
  };

  if (!breakingArticle || dismissed) {
    return null;
  }

  return (
    <div 
      className="relative overflow-hidden rounded-xl bg-gradient-to-r from-red-900 via-red-800 to-red-900 border border-red-500/50 shadow-lg shadow-red-500/20 cursor-pointer group"
      onClick={handleClick}
    >
      {/* Animated background stripes */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)] animate-pulse" />
      </div>
      
      {/* Content */}
      <div className="relative px-4 py-3 flex items-center gap-3">
        <div className="shrink-0">
          <div className="w-8 h-8 rounded-full bg-red-500/30 flex items-center justify-center animate-pulse">
            <AlertTriangle className="w-5 h-5 text-red-200" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold text-red-200 uppercase tracking-wider bg-red-500/30 px-2 py-0.5 rounded">
              Breaking News
            </span>
          </div>
          <p className="text-sm md:text-base font-semibold text-white truncate group-hover:text-red-100 transition-colors">
            {breakingArticle.title}
          </p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
          }}
          className="shrink-0 p-1.5 text-red-300 hover:text-white hover:bg-red-500/30 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}