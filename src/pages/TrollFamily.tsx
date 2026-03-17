// src/pages/TrollFamily.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

export default function TrollFamily() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkFamilyAndRedirect = async () => {
      if (!user) {
        // No user, redirect to browse families
        navigate('/family/browse', { replace: true })
        return
      }

      try {
        // Check if user is in family_members table
        const { data: familyMember } = await supabase
          .from('family_members')
          .select('family_id')
          .eq('user_id', user.id)
          .maybeSingle()

        // Also check if user is a leader in troll_families
        const { data: leaderFamily } = await supabase
          .from('troll_families')
          .select('id')
          .eq('leader_id', user.id)
          .maybeSingle()

        if (familyMember?.family_id || leaderFamily?.id) {
          // User is already in a family or is a leader - redirect to their family home
          navigate('/family/home', { replace: true })
        } else {
          // User is not in a family - redirect to browse families
          navigate('/family/browse', { replace: true })
        }
      } catch (error) {
        console.error('Error checking family membership:', error)
        // On error, default to browse families
        navigate('/family/browse', { replace: true })
      } finally {
        setChecking(false)
      }
    }

    checkFamilyAndRedirect()
  }, [navigate, user])

  // Show loading while checking
  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return null
}
