import React from 'react'
import { supabase } from '../lib/supabase'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '../lib/store'
import ProfileSetup from './ProfileSetup'

const AuthCallback = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAuth, setProfile } = useAuthStore()
  const ADMIN_EMAIL = (import.meta as any).env?.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com'

  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setReady(true)
    }, 4000)

    const run = async () => {
      try {
        const params = new URLSearchParams(location.search)
        const code = params.get('code') || undefined
        const errorDesc = params.get('error_description') || undefined
        
        if (errorDesc) {
          toast.error('Authentication error: ' + errorDesc)
          console.error('OAuth error:', errorDesc)
        }
        
        if (code) {
          console.log('Processing OAuth code...')
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          
          if (error) {
            console.error('Session exchange error:', error)
            toast.error('Failed to complete sign in: ' + error.message)
            navigate('/auth')
            return
          }
          
          if (data?.session?.user) {
            const u = data.session.user
            console.log('User authenticated:', u.email)
            setAuth(u as any, data.session)
            
            // Check for existing profile
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', u.id)
              .single()
              
            if (profile) {
              console.log('Existing profile found:', profile.username)
              if (u.email === ADMIN_EMAIL && profile.role !== 'admin') {
                try {
                  const now = new Date().toISOString()
                  await supabase.from('user_profiles').update({ role: 'admin', updated_at: now }).eq('id', u.id)
                  const { data: refreshed } = await supabase.from('user_profiles').select('*').eq('id', u.id).single()
                  if (refreshed) setProfile(refreshed as any)
                } catch {}
              } else {
                setProfile(profile as any)
              }
              localStorage.setItem(`tc-profile-${u.id}`, JSON.stringify({ data: profile, timestamp: Date.now() }))
              
              if (!profile.username) {
                console.log('Profile needs setup - redirecting to setup')
                setReady(true)
                clearTimeout(safetyTimer)
                return
              }
              
              // Profile is complete - redirect to home
              toast.success('Welcome back!')
              navigate('/')
              clearTimeout(safetyTimer)
              return
            } else {
              console.log('No profile found - creating new profile')
              // Auto-create profile with Google account info
              const emailUsername = u.email ? u.email.split('@')[0] : 'user'
              const suggestedUsername = emailUsername.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 20)
              
              const { data: inserted } = await supabase
                .from('user_profiles')
                .insert({ 
                  id: u.id, 
                  username: '', // Keep empty to force profile setup
                  bio: null,
                  role: u.email === ADMIN_EMAIL ? 'admin' : 'user', 
                  troll_coins: 0, 
                  free_coin_balance: 0, 
                  avatar_url: u.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${suggestedUsername}`,
                  created_at: new Date().toISOString(), 
                  updated_at: new Date().toISOString() 
                })
                .select()
                .single()
                
              if (inserted) {
                console.log('Profile created successfully')
                setProfile(inserted as any)
                localStorage.setItem(`tc-profile-${u.id}`, JSON.stringify({ data: inserted, timestamp: Date.now() }))
                setReady(true)
                clearTimeout(safetyTimer)
                return
              }
            }
          }
        }
        
        // Fallback: check existing session
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          console.log('Existing session found')
          setAuth(session.user as any, session)
          setReady(true)
          clearTimeout(safetyTimer)
        } else {
          console.log('No session found')
          toast.error('No session from provider')
          navigate('/auth')
          clearTimeout(safetyTimer)
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        toast.error('Authentication failed')
        navigate('/auth')
        clearTimeout(safetyTimer)
      }
    }
    
    console.log('AuthCallback mounted, processing...')
    run()
    return () => {
      clearTimeout(safetyTimer)
    }
  }, [navigate, setAuth, setProfile, location.search])

  if (ready) {
    return <ProfileSetup />
  }
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="bg-[#18181b] p-8 rounded-xl shadow-lg w-full max-w-md text-center space-y-4">
        <div className="text-lg">Processing sign in…</div>
        <button
          onClick={() => setReady(true)}
          className="w-full py-2 mt-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white font-semibold rounded hover:shadow-lg"
        >
          Continue to Profile Setup
        </button>
        <button
          onClick={() => navigate('/auth')}
          className="w-full py-2 mt-2 bg-[#23232b] border border-gray-600 text-white font-semibold rounded hover:bg-[#23232b]/80"
        >
          Return to Login
        </button>
      </div>
    </div>
  )
}

export default AuthCallback
