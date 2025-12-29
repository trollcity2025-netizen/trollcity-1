import React, { useEffect } from 'react'
import { initAuthAndData } from '../lib/store'

// Placeholder auth provider to match desired provider stack.
// Auth state is managed via zustand in useAuthStore; this wrapper keeps provider structure consistent.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initAuthAndData()
  }, [])

  return <>{children}</>
}

