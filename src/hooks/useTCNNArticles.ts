/**
 * useTCNNArticles Hook
 * 
 * Custom hook for managing TCNN articles (create, edit, submit, approve, publish)
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { TCNNArticle, TCNNArticleInput, ArticleStatus } from '@/types/tcnn';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

interface UseTCNNArticlesOptions {
  status?: ArticleStatus;
  authorId?: string;
  limit?: number;
  onlyMine?: boolean;
}

interface UseTCNNArticlesReturn {
  articles: TCNNArticle[];
  loading: boolean;
  error: string | null;
  createArticle: (input: TCNNArticleInput) => Promise<{ success: boolean; articleId?: string; error?: string }>;
  updateArticle: (id: string, input: Partial<TCNNArticleInput>) => Promise<{ success: boolean; error?: string }>;
  submitForReview: (id: string) => Promise<{ success: boolean; error?: string }>;
  approveArticle: (id: string) => Promise<{ success: boolean; error?: string }>;
  rejectArticle: (id: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  publishArticle: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteArticle: (id: string) => Promise<{ success: boolean; error?: string }>;
  refresh: () => Promise<void>;
}

export function useTCNNArticles(options: UseTCNNArticlesOptions = {}): UseTCNNArticlesReturn {
  const { user } = useAuthStore();
  const { status, authorId, limit = 50, onlyMine = false } = options;
  
  const [articles, setArticles] = useState<TCNNArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('tcnn_articles')
        .select(`
          *,
          author:author_id(username, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      if (onlyMine) {
        query = query.eq('author_id', user.id);
      } else if (authorId) {
        query = query.eq('author_id', authorId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const formattedArticles: TCNNArticle[] = (data || []).map((item: any) => ({
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
        viewCount: item.view_count || 0,
        tipCount: item.tip_count || 0,
        tipTotalCoins: item.tip_total_coins || 0,
        metaDescription: item.meta_description,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));

      setArticles(formattedArticles);
    } catch (err: any) {
      console.error('Error fetching articles:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, status, authorId, limit, onlyMine]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const createArticle = useCallback(async (input: TCNNArticleInput): Promise<{ success: boolean; articleId?: string; error?: string }> => {
    if (!user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      const { data, error: createError } = await supabase
        .from('tcnn_articles')
        .insert({
          title: input.title,
          slug: `${slug}-${Date.now()}`,
          excerpt: input.excerpt,
          content: input.content,
          category: input.category,
          author_id: user.id,
          status: 'draft',
          is_breaking: input.category === 'breaking',
          featured_image_url: input.featuredImageUrl,
          tags: input.tags || [],
        })
        .select()
        .single();

      if (createError) throw createError;

      toast.success('Article created successfully');
      await fetchArticles();
      return { success: true, articleId: data.id };
    } catch (err: any) {
      console.error('Error creating article:', err);
      toast.error('Failed to create article');
      return { success: false, error: err.message };
    }
  }, [user?.id, fetchArticles]);

  const updateArticle = useCallback(async (id: string, input: Partial<TCNNArticleInput>): Promise<{ success: boolean; error?: string }> => {
    try {
      const updates: any = {};
      if (input.title) updates.title = input.title;
      if (input.excerpt !== undefined) updates.excerpt = input.excerpt;
      if (input.content) updates.content = input.content;
      if (input.category) {
        updates.category = input.category;
        updates.is_breaking = input.category === 'breaking';
      }
      if (input.featuredImageUrl !== undefined) updates.featured_image_url = input.featuredImageUrl;
      if (input.tags) updates.tags = input.tags;
      updates.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('tcnn_articles')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;

      toast.success('Article updated successfully');
      await fetchArticles();
      return { success: true };
    } catch (err: any) {
      console.error('Error updating article:', err);
      toast.error('Failed to update article');
      return { success: false, error: err.message };
    }
  }, [fetchArticles]);

  const submitForReview = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: updateError } = await supabase
        .from('tcnn_articles')
        .update({
          status: 'pending_review',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      toast.success('Article submitted for review');
      await fetchArticles();
      return { success: true };
    } catch (err: any) {
      console.error('Error submitting article:', err);
      toast.error('Failed to submit article');
      return { success: false, error: err.message };
    }
  }, [fetchArticles]);

  const approveArticle = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { error: updateError } = await supabase
        .from('tcnn_articles')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      toast.success('Article approved');
      await fetchArticles();
      return { success: true };
    } catch (err: any) {
      console.error('Error approving article:', err);
      toast.error('Failed to approve article');
      return { success: false, error: err.message };
    }
  }, [user?.id, fetchArticles]);

  const rejectArticle = useCallback(async (id: string, reason: string): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { error: updateError } = await supabase
        .from('tcnn_articles')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          rejection_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      toast.success('Article rejected');
      await fetchArticles();
      return { success: true };
    } catch (err: any) {
      console.error('Error rejecting article:', err);
      toast.error('Failed to reject article');
      return { success: false, error: err.message };
    }
  }, [user?.id, fetchArticles]);

  const publishArticle = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: updateError } = await supabase
        .from('tcnn_articles')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      toast.success('Article published');
      await fetchArticles();
      return { success: true };
    } catch (err: any) {
      console.error('Error publishing article:', err);
      toast.error('Failed to publish article');
      return { success: false, error: err.message };
    }
  }, [fetchArticles]);

  const deleteArticle = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: deleteError } = await supabase
        .from('tcnn_articles')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      toast.success('Article deleted');
      await fetchArticles();
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting article:', err);
      toast.error('Failed to delete article');
      return { success: false, error: err.message };
    }
  }, [fetchArticles]);

  return {
    articles,
    loading,
    error,
    createArticle,
    updateArticle,
    submitForReview,
    approveArticle,
    rejectArticle,
    publishArticle,
    deleteArticle,
    refresh: fetchArticles,
  };
}

export default useTCNNArticles;
