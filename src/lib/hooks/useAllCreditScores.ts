import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export function useAllCreditScores(currentUserId) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScores() {
      setLoading(true);
      try {
        // Fetch all profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url');

        if (profilesError) throw profilesError;

        // Fetch all credit scores from user_credit (single source of truth)
        const { data: creditData, error: creditError } = await supabase
          .from('user_credit')
          .select('user_id, score, tier, trend_7d, updated_at');

        if (creditError) throw creditError;

        // Build a map of user_id -> credit data
        const creditMap = new Map(
          (creditData || []).map(d => [d.user_id, d])
        );

        // Only show users that have a profile (skip orphaned credit entries)
        const allScores = (profiles || []).map(profile => {
          const credit = creditMap.get(profile.id);
          return {
            user_id: profile.id,
            score: credit?.score ?? 400,
            tier: credit?.tier ?? 'Building',
            trend_7d: credit?.trend_7d ?? 0,
            updated_at: credit?.updated_at ?? new Date().toISOString(),
            users: {
              username: profile.username || 'Unknown',
              avatar_url: profile.avatar_url
            }
          };
        });

        // Sort by score descending
        allScores.sort((a, b) => b.score - a.score);

        // Move current user to top
        const mine = allScores.find((row) => row.user_id === currentUserId);
        const others = allScores.filter((row) => row.user_id !== currentUserId);
        setScores(mine ? [mine, ...others] : others);
      } catch (err: any) {
        console.error('Error fetching all credit scores:', err);
        // Handle JSON coercion errors gracefully
        if (err.message?.includes('cannot coerce') || err.code === '22P02') {
          setScores([]);
        }
      } finally {
        setLoading(false);
      }
    }
    if (currentUserId) fetchScores();
  }, [currentUserId]);

  return { scores, loading };
}
