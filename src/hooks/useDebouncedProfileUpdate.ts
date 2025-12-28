import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../lib/store';

export const useDebouncedProfileUpdate = (userId?: string) => {
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const debouncedUpdate = useCallback(
    async (delayMs: number = 500) => {
      if (!userId) return;

      // Debounce the update
      const timeoutId = setTimeout(async () => {
        try {
          await refreshProfile();
        } catch (error) {
          console.error('Debounced profile update error:', error);
        }
      }, delayMs);

      return () => clearTimeout(timeoutId);
    },
    [userId, refreshProfile]
  );

  useEffect(() => {
    if (userId) {
      debouncedUpdate();
    }
  }, [userId, debouncedUpdate]);
};