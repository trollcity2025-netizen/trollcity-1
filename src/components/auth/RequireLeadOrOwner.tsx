import { ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Props = {
  children: ReactNode
}

export function RequireLeadOrOwner({ children }: Props) {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const load = async () => {
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
        // Check if user is owner (admin) or lead officer
        setAllowed(
          data?.role === 'admin' ||
          data?.is_admin === true ||
          data?.is_lead_officer === true ||
          data?.role === 'lead_officer'
        )
      }
      setLoading(false)
    }

    load()
  }, [])

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
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

