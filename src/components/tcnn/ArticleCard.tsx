/**
 * ArticleCard Component
 * 
 * Displays article preview in compact or full variant
 */
import { TCNNArticle } from '@/types/tcnn';
import { Clock, Eye, Coins, User } from 'lucide-react';

interface ArticleCardProps {
  article: TCNNArticle;
  onClick: () => void;
  variant?: 'compact' | 'full';
}

export default function ArticleCard({ article, onClick, variant = 'compact' }: ArticleCardProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (variant === 'compact') {
    return (
      <div 
        onClick={onClick}
        className="group cursor-pointer rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all"
      >
        {/* Image */}
        <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
          {article.featuredImageUrl ? (
            <img 
              src={article.featuredImageUrl} 
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                <span className="text-2xl">📰</span>
              </div>
            </div>
          )}
          {article.isBreaking && (
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold uppercase rounded">
              Breaking
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-3">
          <h3 className="text-sm font-semibold text-white line-clamp-2 group-hover:text-cyan-400 transition-colors">
            {article.title}
          </h3>
          <div className="flex items-center justify-between mt-2 text-xs text-white/50">
            <span>{formatDate(article.publishedAt)}</span>
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span>{article.viewCount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div 
      onClick={onClick}
      className="group cursor-pointer flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all"
    >
      {/* Image */}
      <div className="w-24 h-24 md:w-32 md:h-32 shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900">
        {article.featuredImageUrl ? (
          <img 
            src={article.featuredImageUrl} 
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl">📰</span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          {article.isBreaking && (
            <span className="shrink-0 px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[9px] font-bold uppercase rounded">
              Breaking
            </span>
          )}
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            {article.category}
          </span>
        </div>
        
        <h3 className="text-base font-semibold text-white line-clamp-2 group-hover:text-cyan-400 transition-colors mb-2">
          {article.title}
        </h3>
        
        <p className="text-sm text-white/60 line-clamp-2 mb-3">
          {article.excerpt}
        </p>
        
        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-white/50">
          <div className="flex items-center gap-1.5">
            {article.authorAvatar ? (
              <img 
                src={article.authorAvatar} 
                alt={article.authorName}
                className="w-5 h-5 rounded-full"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                <User className="w-3 h-3" />
              </div>
            )}
            <span className="truncate max-w-[100px]">{article.authorName}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatDate(article.publishedAt)}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            <span>{article.viewCount.toLocaleString()}</span>
          </div>
          
          {article.tipCount > 0 && (
            <div className="flex items-center gap-1 text-yellow-400">
              <Coins className="w-3 h-3" />
              <span>{article.tipCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}