import { useAuthStore } from '../lib/store';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../lib/supabase';

/**
 * Optimized auth hooks that use narrow selectors to prevent unnecessary re-renders.
 * 
 * IMPORTANT: Always use these hooks instead of `useAuthStore()` directly.
 * Using `const { user, profile } = useAuthStore()` subscribes to the ENTIRE store,
 * causing re-renders whenever ANY property changes (isLoading, isRefreshing, etc.).
 * 
 * These hooks use narrow selectors so components only re-render when the
 * specific values they care about change.
 */

/** Get the current user - only re-renders when user changes */
export function useUser(): User | null {
  return useAuthStore((s) => s.user);
}

/** Get the current profile - only re-renders when profile changes */
export function useProfile(): UserProfile | null {
  return useAuthStore((s) => s.profile);
}

/** Get both user and profile - only re-renders when either changes */
export function useAuth(): { user: User | null; profile: UserProfile | null } {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  return { user, profile };
}

/** Get the refreshProfile function - stable reference */
export function useRefreshProfile() {
  return useAuthStore((s) => s.refreshProfile);
}

/** Get the logout function - stable reference */
export function useLogout() {
  return useAuthStore((s) => s.logout);
}

/** Get the setProfile function - stable reference */
export function useSetProfile() {
  return useAuthStore((s) => s.setProfile);
}

/** Get the setAuth function - stable reference */
export function useSetAuth() {
  return useAuthStore((s) => s.setAuth);
}

/** Check if user is an admin - only re-renders when isAdmin changes */
export function useIsAdmin(): boolean | null {
  return useAuthStore((s) => s.isAdmin);
}

/** Get loading state - only re-renders when isLoading changes */
export function useIsLoading(): boolean {
  return useAuthStore((s) => s.isLoading);
}

/** Get refreshing state - only re-renders when isRefreshing changes */
export function useIsRefreshing(): boolean {
  return useAuthStore((s) => s.isRefreshing);
}