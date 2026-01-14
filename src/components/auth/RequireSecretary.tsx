import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'

export default function RequireSecretary({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthStore()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAccess = async () => {
      if (!profile) {
        setIsAuthorized(false)
        return
      }

      // Admin always has access
      if (profile.role === 'admin' || profile.troll_role === 'admin') {
        setIsAuthorized(true)
        return
      }

      // Check secretary assignment
      try {
        const { data } = await supabase
          .from('secretary_assignments')
          .select('id')
          .eq('secretary_id', profile.id)
          .maybeSingle()
        
        setIsAuthorized(!!data)
      } catch (error) {
        console.error('Error checking secretary access:', error)
        setIsAuthorized(false)
      }
    }

    checkAccess()
  }, [profile])

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0814] text-white">
        <div className="animate-pulse">Checking access...</div>
      </div>
    )
  }

  if (!isAuthorized) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
