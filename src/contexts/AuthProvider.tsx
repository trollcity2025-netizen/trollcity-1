import React, { useEffect, useRef } from 'react'
import { initAuthAndData, useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'

// Placeholder auth provider to match desired provider stack.
// Auth state is managed via zustand in useAuthStore; this wrapper keeps provider structure consistent.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const lastRefreshRef = useRef<number>(0);

  useEffect(() => {
    void initAuthAndData()
  }, [])

  // Real-time balance updates for the current user - with debouncing to prevent loops
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          // Debounce: Only refresh if at least 5 seconds have passed since last refresh
          const now = Date.now();
          if (now - lastRefreshRef.current < 5000) {
            return;
          }
          
          // Only refresh for critical changes (coins, level, etc.) - not every field
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          if (
            newData?.troll_coins !== oldData?.troll_coins ||
            newData?.coins !== oldData?.coins ||
            newData?.level !== oldData?.level
          ) {
            lastRefreshRef.current = now;
            useAuthStore.getState().refreshProfile();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return <>{children}</>
}

