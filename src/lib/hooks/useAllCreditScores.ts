import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export function useAllCreditScores(currentUserId) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScores() {
      setLoading(true);
      try {
        // 1. Fetch all profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url');

        if (profilesError) throw profilesError;

        // 2. Fetch all credit scores from user_credit
        const { data: creditData, error: creditError } = await supabase
          .from('user_credit')
          .select('user_id, score, updated_at');

        if (creditError) throw creditError;

        const creditMap = new Map(creditData?.map(d => [d.user_id, d]) || []);

        // 3. Merge
        const allScores = (profiles || []).map(p => {
          const credit = creditMap.get(p.id);
          return {
            user_id: p.id,
            score: credit?.score ?? 400,
            updated_at: credit?.updated_at ?? null,
            users: {
              username: p.username || 'Unknown',
              avatar_url: p.avatar_url
            }
          };
        });

        // 4. Sort
        allScores.sort((a, b) => b.score - a.score);

        // 5. Move current user to top
        const mine = allScores.find((row) => row.user_id === currentUserId);
        const others = allScores.filter((row) => row.user_id !== currentUserId);
        setScores(mine ? [mine, ...others] : others);
      } catch (err) {
        console.error('Error fetching all credit scores:', err);
        setScores([]);
      } finally {
        setLoading(false);
      }
    }
    if (currentUserId) fetchScores();
  }, [currentUserId]);

  return { scores, loading };
}
