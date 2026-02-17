import { useEffect, useRef } from 'react';

/**
 * DISABLED - This hook was causing unnecessary profile refreshes on every page load.
 * Profile refreshes are now handled by:
 * 1. AuthProvider on auth state change
 * 2. Real-time subscriptions for critical updates
 * 3. Manual refresh on user actions
 * 
 * Keeping the hook to avoid breaking imports, but it no longer triggers refreshes.
 */
export const useDebouncedProfileUpdate = (_userId?: string) => {
  // Track if we've already logged the disabled message
  const loggedRef = useRef(false);
  
  useEffect(() => {
    // Log once in development that this hook is disabled
    if (!loggedRef.current && process.env.NODE_ENV === 'development') {
      loggedRef.current = true;
      console.debug('[useDebouncedProfileUpdate] Hook is disabled - profile refreshes handled elsewhere');
    }
  }, []);
  
  // No longer triggers profile refreshes
};