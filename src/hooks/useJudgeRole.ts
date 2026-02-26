
import { useAuthStore } from '@/lib/store';

export const useJudgeRole = () => {
  const { profile } = useAuthStore();

  // For now, we'll check a simple boolean on the profile.
  // This can be expanded later to check for a specific role in a specific show.
  const isJudge = profile?.is_judge || profile?.role === 'admin';

  return { isJudge };
};
