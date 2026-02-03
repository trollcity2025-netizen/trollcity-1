import React, { useEffect } from 'react'
import { initAuthAndData, useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'

// Placeholder auth provider to match desired provider stack.
// Auth state is managed via zustand in useAuthStore; this wrapper keeps provider structure consistent.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshProfile } = useAuthStore();

  useEffect(() => {
    void initAuthAndData()
  }, [])

  // Real-time balance updates for the current user
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
        () => {
          refreshProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshProfile]);

  return <>{children}</>
}

