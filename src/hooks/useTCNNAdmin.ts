/**
 * useTCNNAdmin Hook
 * 
 * Admin override functions for TCNN management
 * Provides capabilities for admins to:
 * - Remove TCNN roles from users
 * - Disable/enable TCNN broadcasts
 * - Remove ticker messages
 * - Remove articles
 * - Override article approvals
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';

interface AdminActionResult {
  success: boolean;
  message: string;
}

interface UseTCNNAdminReturn {
  removeTCNNRole: (userId: string, role: 'journalist' | 'news_caster' | 'chief_news_caster') => Promise<AdminActionResult>;
  disableTCNNBroadcast: (broadcastId: string, reason?: string) => Promise<AdminActionResult>;
  enableTCNNBroadcast: (broadcastId: string) => Promise<AdminActionResult>;
  removeTickerMessage: (tickerId: string) => Promise<AdminActionResult>;
  removeArticle: (articleId: string, reason?: string) => Promise<AdminActionResult>;
  overrideArticleApproval: (articleId: string, approved: boolean, reason?: string) => Promise<AdminActionResult>;
  forcePublishBreakingNews: (message: string) => Promise<AdminActionResult>;
  banFromTCNN: (userId: string, duration: '1d' | '7d' | '30d' | 'permanent', reason: string) => Promise<AdminActionResult>;
  unbanFromTCNN: (userId: string) => Promise<AdminActionResult>;
  loading: boolean;
  error: string | null;
}

export function useTCNNAdmin(): UseTCNNAdminReturn {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAdmin = useCallback((): boolean => {
    // In production, this would check admin roles from user metadata or database
    // For now, we'll check if the user is logged in
    return !!user;
  }, [user]);

  /**
   * Remove a TCNN role from a user
   */
  const removeTCNNRole = useCallback(async (
    userId: string,
    role: 'journalist' | 'news_caster' | 'chief_news_caster'
  ): Promise<AdminActionResult> => {
    setLoading(true);
    setError(null);

    try {
      if (!checkAdmin()) {
        throw new Error('Admin privileges required');
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          [`is_${role}`]: false,
          tcnn_role_removed_at: new Date().toISOString(),
          tcnn_role_removed_by: user?.id,
          tcnn_role_removed_reason: 'Admin action'
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Log the admin action
      await supabase.from('admin_action_logs').insert({
        admin_id: user?.id,
        action_type: 'remove_tcnn_role',
        target_user_id: userId,
        details: { role },
        created_at: new Date().toISOString()
      });

      return {
        success: true,
        message: `Successfully removed ${role.replace('_', ' ')} role from user`
      };
    } catch (err: any) {
      setError(err.message);
      return {
        success: false,
        message: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [user, checkAdmin]);

  /**
   * Disable a TCNN broadcast
   */
  const disableTCNNBroadcast = useCallback(async (
    broadcastId: string,
    reason?: string
  ): Promise<AdminActionResult> => {
    setLoading(true);
    setError(null);

    try {
      if (!checkAdmin()) {
        throw new Error('Admin privileges required');
      }

      const { error: updateError } = await supabase
        .from('streams')
        .update({
          status: 'disabled_by_admin',
          disabled_at: new Date().toISOString(),
          disabled_by: user?.id,
          disabled_reason: reason || 'Admin action'
        })
        .eq('id', broadcastId)
        .eq('category', 'tcnn');

      if (updateError) throw updateError;

      // Log the admin action
      await supabase.from('admin_action_logs').insert({
        admin_id: user?.id,
        action_type: 'disable_tcnn_broadcast',
        target_stream_id: broadcastId,
        details: { reason },
        created_at: new Date().toISOString()
      });

      return {
        success: true,
        message: 'TCNN broadcast has been disabled'
      };
    } catch (err: any) {
      setError(err.message);
      return {
        success: false,
        message: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [user, checkAdmin]);

  /**
   * Re-enable a disabled TCNN broadcast
   */
  const enableTCNNBroadcast = useCallback(async (
    broadcastId: string
  ): Promise<AdminActionResult> => {
    setLoading(true);
    setError(null);

    try {
      if (!checkAdmin()) {
        throw new Error('Admin privileges required');
      }

      const { error: updateError } = await supabase
        .from('streams')
        .update({
          status: 'live',
          disabled_at: null,
          disabled_by: null,
          disabled_reason: null
        })
        .eq('id', broadcastId);

      if (updateError) throw updateError;

      // Log the admin action
      await supabase.from('admin_action_logs').insert({
        admin_id: user?.id,
        action_type: 'enable_tcnn_broadcast',
        target_stream_id: broadcastId,
        created_at: new Date().toISOString()
      });

      return {
        success: true,
        message: 'TCNN broadcast has been re-enabled'
      };
    } catch (err: any) {
      setError(err.message);
      return {
        success: false,
        message: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [user, checkAdmin]);

  /**
   * Remove a ticker message from the queue
   */
  const removeTickerMessage = useCallback(async (
    tickerId: string
  ): Promise<AdminActionResult> => {
    setLoading(true);
    setError(null);

    try {
      if (!checkAdmin()) {
        throw new Error('Admin privileges required');
      }

      const { error: deleteError } = await supabase
        .from('tcnn_ticker_queue')
        .delete()
        .eq('id', tickerId);

      if (deleteError) throw deleteError;

      // Log the admin action
      await supabase.from('admin_action_logs').insert({
        admin_id: user?.id,
        action_type: 'remove_ticker_message',
        target_ticker_id: tickerId,
        created_at: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Ticker message has been removed'
      };
    } catch (err: any) {
      setError(err.message);
      return {
        success: false,
        message: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [user, checkAdmin]);

  /**
   * Remove/delete an article
   */
  const removeArticle = useCallback(async (
    articleId: string,
    reason?: string
  ): Promise<AdminActionResult> => {
    setLoading(true);
    setError(null);

    try {
      if (!checkAdmin()) {
        throw new Error('Admin privileges required');
      }

      // Soft delete - update status instead of actually deleting
      const { error: updateError } = await supabase
        .from('tcnn_articles')
        .update({
          status: 'removed_by_admin',
          removed_at: new Date().toISOString(),
          removed_by: user?.id,
          removal_reason: reason || 'Admin action'
        })
        .eq('id', articleId);

      if (updateError) throw updateError;

      // Log the admin action
      await supabase.from('admin_action_logs').insert({
        admin_id: user?.id,
        action_type: 'remove_article',
        target_article_id: articleId,
        details: { reason },
        created_at: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Article has been removed'
      };
    } catch (err: any) {
      setError(err.message);
      return {
        success: false,
        message: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [user, checkAdmin]);

  /**
   * Override article approval status
   */
  const overrideArticleApproval = useCallback(async (
    articleId: string,
    approved: boolean,
    reason?: string
  ): Promise<AdminActionResult> => {
    setLoading(true);
    setError(null);

    try {
      if (!checkAdmin()) {
        throw new Error('Admin privileges required');
      }

      const newStatus = approved ? 'approved' : 'rejected';
      
      const { error: updateError } = await supabase
        .from('tcnn_articles')
        .update({
          status: newStatus,
          admin_override: true,
          admin_override_by: user?.id,
          admin_override_at: new Date().toISOString(),
          admin_override_reason: reason || 'Admin override'
        })
        .eq('id', articleId);

      if (updateError) throw updateError;

      // Log the admin action
      await supabase.from('admin_action_logs').insert({
        admin_id: user?.id,
        action_type: approved ? 'approve_article_override' : 'reject_article_override',
        target_article_id: articleId,
        details: { reason },
        created_at: new Date().toISOString()
      });

      return {
        success: true,
        message: `Article has been ${approved ? 'approved' : 'rejected'} (admin override)`
      };
    } catch (err: any) {
      setError(err.message);
      return {
        success: false,
        message: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [user, checkAdmin]);

  /**
   * Force publish a breaking news ticker immediately
   */
  const forcePublishBreakingNews = useCallback(async (
    message: string
  ): Promise<AdminActionResult> => {
    setLoading(true);
    setError(null);

    try {
      if (!checkAdmin()) {
        throw new Error('Admin privileges required');
      }

      if (!message.trim() || message.length > 200) {
        throw new Error('Message must be between 1 and 200 characters');
      }

      const { error: insertError } = await supabase
        .from('tcnn_ticker_queue')
        .insert({
          message: message.trim(),
          priority: 'breaking',
          status: 'active',
          submitted_by: user?.id,
          admin_override: true,
          created_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      // Log the admin action
      await supabase.from('admin_action_logs').insert({
        admin_id: user?.id,
        action_type: 'force_publish_breaking_news',
        details: { message: message.substring(0, 100) },
        created_at: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Breaking news has been published immediately'
      };
    } catch (err: any) {
      setError(err.message);
      return {
        success: false,
        message: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [user, checkAdmin]);

  /**
   * Ban a user from TCNN activities
   */
  const banFromTCNN = useCallback(async (
    userId: string,
    duration: '1d' | '7d' | '30d' | 'permanent',
    reason: string
  ): Promise<AdminActionResult> => {
    setLoading(true);
    setError(null);

    try {
      if (!checkAdmin()) {
        throw new Error('Admin privileges required');
      }

      let bannedUntil: string | null = null;
      if (duration !== 'permanent') {
        const days = duration === '1d' ? 1 : duration === '7d' ? 7 : 30;
        const date = new Date();
        date.setDate(date.getDate() + days);
        bannedUntil = date.toISOString();
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          tcnn_banned: true,
          tcnn_banned_at: new Date().toISOString(),
          tcnn_banned_by: user?.id,
          tcnn_banned_reason: reason,
          tcnn_banned_until: bannedUntil,
          // Remove all TCNN roles
          is_journalist: false,
          is_news_caster: false,
          is_chief_news_caster: false
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Log the admin action
      await supabase.from('admin_action_logs').insert({
        admin_id: user?.id,
        action_type: 'ban_from_tcnn',
        target_user_id: userId,
        details: { duration, reason },
        created_at: new Date().toISOString()
      });

      return {
        success: true,
        message: `User has been banned from TCNN${duration !== 'permanent' ? ` for ${duration}` : ' permanently'}`
      };
    } catch (err: any) {
      setError(err.message);
      return {
        success: false,
        message: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [user, checkAdmin]);

  /**
   * Unban a user from TCNN
   */
  const unbanFromTCNN = useCallback(async (
    userId: string
  ): Promise<AdminActionResult> => {
    setLoading(true);
    setError(null);

    try {
      if (!checkAdmin()) {
        throw new Error('Admin privileges required');
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          tcnn_banned: false,
          tcnn_banned_at: null,
          tcnn_banned_by: null,
          tcnn_banned_reason: null,
          tcnn_banned_until: null
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Log the admin action
      await supabase.from('admin_action_logs').insert({
        admin_id: user?.id,
        action_type: 'unban_from_tcnn',
        target_user_id: userId,
        created_at: new Date().toISOString()
      });

      return {
        success: true,
        message: 'User has been unbanned from TCNN'
      };
    } catch (err: any) {
      setError(err.message);
      return {
        success: false,
        message: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [user, checkAdmin]);

  return {
    removeTCNNRole,
    disableTCNNBroadcast,
    enableTCNNBroadcast,
    removeTickerMessage,
    removeArticle,
    overrideArticleApproval,
    forcePublishBreakingNews,
    banFromTCNN,
    unbanFromTCNN,
    loading,
    error
  };
}
