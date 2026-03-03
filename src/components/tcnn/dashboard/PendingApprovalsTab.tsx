/**
 * PendingApprovalsTab Component
 * 
 * Dashboard tab for Chief News Casters to review pending articles
 */
import { useTCNNArticles } from '@/hooks/useTCNNArticles';
import { CheckCircle, Eye, FileText } from 'lucide-react';

export default function PendingApprovalsTab() {
  const { articles, loading, approveArticle, publishArticle } = useTCNNArticles({ 
    status: 'pending_review',
    limit: 50 
  });

  const handleApprove = async (id: string) => {
    await approveArticle(id);
  };

  const handlePublish = async (id: string) => {
    await publishArticle(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Pending Approvals</h2>
        <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm rounded-full">
          {articles.length} pending
        </span>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
          <CheckCircle className="w-12 h-12 text-green-500/50 mx-auto mb-4" />
          <p className="text-white/50">No articles pending review</p>
          <p className="text-sm text-white/30 mt-1">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => (
            <div 
              key={article.id}
              className="p-4 bg-white/5 rounded-xl border border-yellow-500/20 hover:border-yellow-500/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-1">{article.title}</h3>
                  <p className="text-sm text-white/60 line-clamp-2 mb-3">{article.excerpt}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      By {article.authorName}
                    </span>
                    <span>
                      Submitted {new Date(article.submittedAt || '').toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleApprove(article.id)}
                    className="p-2 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded-lg transition-colors"
                    title="Approve"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handlePublish(article.id)}
                    className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors"
                  >
                    Publish
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}