import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export function useAllCreditScores(currentUserId) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScores() {
      setLoading(true);
      try {
        // Fetch all profiles with credit_score from user_profiles table
        const { data: profiles, error } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, credit_score')
          .order('credit_score', { ascending: false });

        if (error) throw error;

        // Map and format
        const allScores = (profiles || []).map(p => ({
          user_id: p.id,
          score: p.credit_score ?? 400,
          updated_at: new Date().toISOString(),
          users: {
            username: p.username || 'Unknown',
            avatar_url: p.avatar_url
          }
        }));

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
