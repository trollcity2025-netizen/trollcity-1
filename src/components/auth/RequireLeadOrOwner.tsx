import { ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase, UserRole, validateProfile } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'

type Props = {
  children: ReactNode
  fallbackPath?: string
}

export function RequireLeadOrOwner({ children, fallbackPath = "/" }: Props) {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const { profile } = useAuthStore()

  useEffect(() => {
    const load = async () => {
      // Use cached profile if available for better performance
      if (profile) {
        const validation = validateProfile(profile)
        if (!validation.isValid) {
          console.error('Cached profile validation failed:', validation.errors)
          setAllowed(false)
          setLoading(false)
          return
        }

        // Check if user is owner (admin) or lead officer
        const isAdmin = profile.role === UserRole.ADMIN || profile.is_admin
        const isLeadOfficer = Boolean(profile.is_lead_officer)

        setAllowed(isAdmin || isLeadOfficer)
        setLoading(false)
        return
      }

      // Fallback to database query if no cached profile
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setAllowed(false)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('role, is_lead_officer, is_admin')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error checking officer role:', error)
        setAllowed(false)
      } else {
        // Production-ready lead officer check
        const isAdmin = data?.role === UserRole.ADMIN || data?.is_admin === true
        const isLeadOfficer = data?.is_lead_officer === true

        setAllowed(isAdmin || isLeadOfficer)
      }
      setLoading(false)
    }

    load()
  }, [profile])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
            Loading...
          </div>
        </div>
      </div>
    )
  }

  if (!allowed) {
    console.warn('Lead officer access denied:', {
      profileRole: profile?.role,
      isLeadOfficer: profile?.is_lead_officer,
      isAdmin: profile?.is_admin
    })
    return <Navigate to={fallbackPath} replace />
  }

  return <>{children}</>
}

