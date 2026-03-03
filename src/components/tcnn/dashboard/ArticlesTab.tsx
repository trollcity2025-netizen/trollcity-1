/**
 * ArticlesTab Component
 *
 * Dashboard tab for managing articles (create, edit, drafts, submit)
 */
import { useState } from 'react';
import { useTCNNArticles } from '@/hooks/useTCNNArticles';
import { useTCNNRoles } from '@/hooks/useTCNNRoles';
import { useAuthStore } from '@/lib/store';
import { Plus, Edit2, Send, Clock, CheckCircle, X } from 'lucide-react';
import { TCNNArticleInput } from '@/types/tcnn';

export default function ArticlesTab() {
  const { user } = useAuthStore();
  const { articles, loading, createArticle, submitForReview } = useTCNNArticles({
    status: undefined, // Get all my articles
    limit: 50
  });
  const { isJournalist, isNewsCaster, isChiefNewsCaster } = useTCNNRoles(user?.id);
  const canCreateArticles = isJournalist || isNewsCaster || isChiefNewsCaster;
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newArticle, setNewArticle] = useState<TCNNArticleInput>({
    title: '',
    content: '',
    excerpt: '',
    category: 'general',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!newArticle.title || !newArticle.content) return;
    
    setSubmitting(true);
    const result = await createArticle(newArticle);
    setSubmitting(false);
    
    if (result.success) {
      setShowCreateModal(false);
      setNewArticle({ title: '', content: '', excerpt: '', category: 'general' });
    }
  };

  const handleSubmitForReview = async (articleId: string) => {
    await submitForReview(articleId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded">Draft</span>;
      case 'pending_review':
        return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">Pending</span>;
      case 'approved':
        return <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">Approved</span>;
      case 'published':
        return <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Published</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">My Articles</h2>
        {canCreateArticles && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Article
          </button>
        )}
      </div>

      {/* Articles List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
          <p className="text-white/50">No articles yet</p>
          {canCreateArticles && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-red-400 hover:text-red-300 text-sm font-medium"
            >
              Create your first article
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <div 
              key={article.id}
              className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusBadge(article.status)}
                  {article.isBreaking && (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Breaking</span>
                  )}
                </div>
                <h3 className="text-white font-medium truncate">{article.title}</h3>
                <p className="text-sm text-white/50 line-clamp-1">{article.excerpt}</p>
              </div>

              <div className="flex items-center gap-2">
                {article.status === 'draft' && (
                  <>
                    <button 
                      className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleSubmitForReview(article.id)}
                      className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded-lg transition-colors"
                      title="Submit for Review"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </>
                )}
                
                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-white/40 ml-4 border-l border-white/10 pl-4">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {article.viewCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(article.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Article Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-[#1A1A1A] rounded-2xl border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">Create New Article</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Title</label>
                <input
                  type="text"
                  value={newArticle.title}
                  onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder-white/30 focus:border-red-500 focus:outline-none"
                  placeholder="Enter article title..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Excerpt</label>
                <input
                  type="text"
                  value={newArticle.excerpt}
                  onChange={(e) => setNewArticle({ ...newArticle, excerpt: e.target.value })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder-white/30 focus:border-red-500 focus:outline-none"
                  placeholder="Brief summary of the article..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Content</label>
                <textarea
                  value={newArticle.content}
                  onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder-white/30 focus:border-red-500 focus:outline-none min-h-[200px] resize-none"
                  placeholder="Write your article content here..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Category</label>
                <select
                  value={newArticle.category}
                  onChange={(e) => setNewArticle({ ...newArticle, category: e.target.value })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white focus:border-red-500 focus:outline-none"
                >
                  <option value="general">General</option>
                  <option value="breaking">Breaking News</option>
                  <option value="local">Local</option>
                  <option value="politics">Politics</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="sports">Sports</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-white/70 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newArticle.title || !newArticle.content || submitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                {submitting ? 'Creating...' : 'Create Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}