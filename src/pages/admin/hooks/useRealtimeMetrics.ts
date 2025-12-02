import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface Metrics {
  totalUsers: number;
  totalStreams: number;
  activeStreams: number;
  totalCoins: number;
  totalRevenue: number;
  [key: string]: number;
}

export const useRealtimeMetrics = (): Metrics => {
  const [metrics, setMetrics] = useState<Metrics>({
    totalUsers: 0,
    totalStreams: 0,
    activeStreams: 0,
    totalCoins: 0,
    totalRevenue: 0,
  });

  const loadMetrics = async () => {
    try {
      const [
        usersRes,
        streamsRes,
        activeStreamsRes,
        coinsRes,
        revenueRes,
      ] = await Promise.all([
        supabase.from('user_profiles').select('id'),
        supabase.from('streams').select('id'),
        supabase.from('streams').select('id').eq('is_live', true), // Use is_live for consistency
        supabase.from('coin_transactions').select('amount'),
        supabase.from('coin_transactions').select('metadata').eq('type', 'purchase'),
      ]);

      const totalUsers = usersRes.data?.length || 0;
      const totalStreams = streamsRes.data?.length || 0;
      const activeStreams = activeStreamsRes.data?.length || 0;
      const totalCoins = coinsRes.data?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;
      const totalRevenue = revenueRes.data?.reduce((sum, tx) => {
        const meta = tx.metadata || {};
        return sum + (meta.amount_paid || 0);
      }, 0) || 0;

      setMetrics({
        totalUsers,
        totalStreams,
        activeStreams,
        totalCoins,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  useEffect(() => {
    loadMetrics();

    // Refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000);

    // Real-time subscriptions
    const usersChannel = supabase
      .channel('metrics-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, loadMetrics)
      .subscribe();

    const streamsChannel = supabase
      .channel('metrics-streams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, loadMetrics)
      .subscribe();

    const coinsChannel = supabase
      .channel('metrics-coins')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coin_transactions' }, loadMetrics)
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(streamsChannel);
      supabase.removeChannel(coinsChannel);
    };
  }, []);

  return metrics;
};