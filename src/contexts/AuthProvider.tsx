import React, { useEffect } from 'react'
import { initAuthAndData, useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useBackgroundSessionRefresh } from '../hooks/useBackgroundSessionRefresh'

// Placeholder auth provider to match desired provider stack.
// Auth state is managed via zustand in useAuthStore; this wrapper keeps provider structure consistent.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshProfile } = useAuthStore();

  // Background session refresh to prevent staleness after ~10 minutes
  useBackgroundSessionRefresh()

  useEffect(() => {
    void initAuthAndData()
  }, [])

  // Real-time balance updates for the current user
  useEffect(() => {
    if (!user) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null

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
          try {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
              try {
                const next = (payload as any)?.new
                if (!next || next.id !== user.id) {
                  void refreshProfile()
                  return
                }

                const current = useAuthStore.getState().profile
                // Merge realtime payload into store without a refetch to avoid loops/churn
                useAuthStore.getState().setProfile({ ...(current as any), ...(next as any) })
              } catch {
                void refreshProfile()
              }
            }, 250)
          } catch {
            void refreshProfile()
          }
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel);
    };
  }, [user, refreshProfile]);

  return <>{children}</>
}

