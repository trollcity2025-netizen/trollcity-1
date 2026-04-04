import React from 'react'
import { supabase } from '../lib/supabase'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '../lib/store'
import { generateUUID } from '../lib/uuid'
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
            
            const sessionId = generateUUID()
            // Store session ID for device enforcement
            try {
              localStorage.setItem('current_device_session_id', sessionId)
            } catch (e) {
              console.error('Failed to store session ID', e)
            }

            // Register this session
            try {
              const deviceInfo = {
                browser: navigator.userAgent,
                platform: navigator.platform,
                screen: { width: window.screen.width, height: window.screen.height }
              }
              
              if (sessionId) {
                await supabase
                  .rpc('register_session', {
                    p_user_id: u.id,
                    p_session_id: sessionId,
                    p_device_info: JSON.stringify(deviceInfo),
                    p_ip_address: null,
                    p_user_agent: navigator.userAgent
                  })
              } else {
                console.warn('[AuthCallback] Skipping register_session because session access_token is missing')
              }
            } catch (sessionError) {
              console.error('Error registering session:', sessionError)
              // Continue with login even if session registration fails
            }
            
            setAuth(u as any, data.session, sessionId)
             
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
                  const { data: refreshed } = await supabase.from('user_profiles').select('*').eq('id', u.id).maybeSingle()
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
              toast.success('Welcome back!', { duration: 2000 })
              try {
                const ipRes = await fetch('https://api.ipify.org?format=json')
                const ipJson = await ipRes.json()
                const userIP = ipJson.ip
                const { data: current } = await supabase
                  .from('user_profiles')
                  .select('ip_address_history')
                  .eq('id', u.id)
                  .single()
                const history = current?.ip_address_history || []
                const entry = { ip: userIP, timestamp: new Date().toISOString() }
                const updated = [...history, entry].slice(-10)
                await supabase
                  .from('user_profiles')
                  .update({ last_known_ip: userIP, ip_address_history: updated })
                  .eq('id', u.id)
              } catch {}
              navigate('/', { replace: true })
              clearTimeout(safetyTimer)
              return
            } else {
              console.log('No profile found - waiting for trigger...')
              // Poll for profile creation (trigger latency)
              let retries = 0
              while (retries < 5) {
                await new Promise(r => setTimeout(r, 1000))
                const { data: retryProfile } = await supabase
                  .from('user_profiles')
                  .select('*')
                  .eq('id', u.id)
                  .maybeSingle()
                  
                if (retryProfile) {
                   console.log('Profile found after wait')
                   setProfile(retryProfile as any)
                   localStorage.setItem(`tc-profile-${u.id}`, JSON.stringify({ data: retryProfile, timestamp: Date.now() }))
                   setReady(true)
                   clearTimeout(safetyTimer)
                   
                 if (!retryProfile.username) {
                      navigate('/profile/setup')
                    } else {
                      navigate('/', { replace: true })
                    }
                   return
                }
                retries++
              }
              
              // If still no profile, redirect to setup but DO NOT create
              console.warn('Profile creation trigger timed out or failed')
              setReady(true)
              clearTimeout(safetyTimer)
              navigate('/profile/setup') 
              return
            }
          }
        }
        
        // Fallback: check existing session
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          console.log('Existing session found')
          setAuth(session.user as any, session, null)
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
  }, [navigate, setAuth, setProfile, location.search, ADMIN_EMAIL])

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
