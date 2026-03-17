/**
 * useTCNNTipping Hook
 * 
 * Custom hook for tipping journalists and TCNN live broadcasts
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { TCNNTip, TipInput } from '@/types/tcnn';

export interface UseTCNNTippingReturn {
  tips: TCNNTip[];
  loading: boolean;
  error: string | null;
  canTip: boolean;
  checkCanTip: (tipperId: string, recipientId: string) => Promise<boolean>;
  sendTip: (input: TipInput) => Promise<{ success: boolean; error: string | null; tipId?: string }>;
  fetchTipsForRecipient: (recipientId: string) => Promise<void>;
  fetchTipsForArticle: (articleId: string) => Promise<void>;
}

export function useTCNNTipping(): UseTCNNTippingReturn {
  const [tips, setTips] = useState<TCNNTip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canTip, setCanTip] = useState(true);

  // Check if user can tip (has enough coins and is not tipping themselves)
  const checkCanTip = useCallback(async (tipperId: string, recipientId: string): Promise<boolean> => {
    try {
      // Can't tip yourself
      if (tipperId === recipientId) {
        setCanTip(false);
        return false;
      }

      // Get tipper's coin balance
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', tipperId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setCanTip(false);
        return false;
      }

      // Minimum 1 coin needed to tip
      const hasEnoughCoins = (profile?.troll_coins || 0) >= 1;
      setCanTip(hasEnoughCoins);
      return hasEnoughCoins;
    } catch (err) {
      console.error('Error checking tip eligibility:', err);
      setCanTip(false);
      return false;
    }
  }, []);

  const sendTip = useCallback(async (input: TipInput): Promise<{ success: boolean; error: string | null; tipId?: string }> => {
    try {
      setLoading(true);
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Call the database function to process the tip
      const { data, error: tipError } = await supabase.rpc('tip_journalist', {
        p_tipper_id: userData.user.id,
        p_recipient_id: input.recipientId,
        p_amount: input.amount,
        p_coin_type: input.coinType,
        p_article_id: input.articleId || null,
        p_message: input.message || null,
      });

      if (tipError) throw tipError;

      // The function returns a record with success, error, and tip_id fields
      const result = data as any;
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { 
        success: true, 
        error: null, 
        tipId: result.tip_id 
      };
    } catch (err: any) {
      console.error('Error sending tip:', err);
      setError(err.message || 'Failed to send tip');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTipsForRecipient = useCallback(async (recipientId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('tcnn_tips')
        .select(`
          *,
          tipper:tipper_id(username),
          recipient:recipient_id(username)
        `)
        .eq('recipient_id', recipientId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedTips: TCNNTip[] = (data || []).map((item: any) => ({
        id: item.id,
        tipperId: item.tipper_id,
        tipperName: item.tipper?.username || item.tipper_name || 'Anonymous',
        recipientId: item.recipient_id,
        recipientName: item.recipient?.username || item.recipient_name || 'Unknown',
        amount: item.amount,
        coinType: item.coin_type,
        articleId: item.article_id,
        streamId: item.stream_id,
        message: item.message,
        createdAt: item.created_at,
      }));

      setTips(formattedTips);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tips');
      console.error('Error fetching tips:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTipsForArticle = useCallback(async (articleId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('tcnn_tips')
        .select(`
          *,
          tipper:tipper_id(username)
        `)
        .eq('article_id', articleId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedTips: TCNNTip[] = (data || []).map((item: any) => ({
        id: item.id,
        tipperId: item.tipper_id,
        tipperName: item.tipper?.username || item.tipper_name || 'Anonymous',
        recipientId: item.recipient_id,
        recipientName: item.recipient_name,
        amount: item.amount,
        coinType: item.coin_type,
        articleId: item.article_id,
        streamId: item.stream_id,
        message: item.message,
        createdAt: item.created_at,
      }));

      setTips(formattedTips);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tips');
      console.error('Error fetching tips:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    tips,
    loading,
    error,
    canTip,
    checkCanTip,
    sendTip,
    fetchTipsForRecipient,
    fetchTipsForArticle,
  };
}

export default useTCNNTipping;