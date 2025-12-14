import React, { useState } from 'react'
import { supabase, isAdminEmail } from '../lib/supabase'
import { toast } from 'sonner'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react'

const Auth = () => {
  const [loading, setLoading] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState<boolean>(() => {
    try { return localStorage.getItem('pwa-installed') === 'true' } catch { return false }
  })
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile, setAuth, setProfile } = useAuthStore()
  const ADMIN_EMAIL = (import.meta as any).env?.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com'
  
  // Get referral code from URL
  const referralCode = searchParams.get('ref') || ''

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return // Prevent double submission
    setLoading(true)
    
    try {
      if (isLogin) {
        // Sign in with email/password
        console.log('Attempting email login...')
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        
        if (error) {
          console.error('Login error:', error)
          throw error
        }
        
        if (data.user && data.session) {
          console.log('Email login successful:', data.user.email)
          setAuth(data.user, data.session)
          
          // Check if profile exists
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle()
          
          if (profileData) {
            // Check if admin BEFORE setting profile
            if (isAdminEmail(data.user.email) && profileData.role !== 'admin') {
              try {
                const now = new Date().toISOString()
                const { data: updated } = await supabase
                  .from('user_profiles')
                  .update({ role: 'admin', updated_at: now })
                  .eq('id', data.user.id)
                  .select('*')
                  .single()
                setProfile(updated || profileData)
              } catch (err) {
                console.error('Failed to update admin role:', err)
                setProfile(profileData)
              }
            } else {
              setProfile(profileData)
            }
            
            if (profileData.username) {
              toast.success('Welcome back!')
              navigate('/')
            } else {
              toast.success('Login successful! Please complete your profile.')
              navigate('/profile-setup')
            }
          } else {
            // Profile doesn't exist, try polling for it
            let tries = 0
            let prof: any = null
            while (tries < 3 && !prof) {
              const { data: p } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', data.user.id)
                .maybeSingle()
              if (p) prof = p
              else {
                await new Promise(r => setTimeout(r, 500))
                tries++
              }
            }
            if (prof) {
              setProfile(prof)
              if (prof.username) {
                toast.success('Welcome back!')
                navigate('/')
              } else {
                toast.success('Login successful! Please complete your profile.')
                navigate('/profile-setup')
              }
            } else {
              toast.success('Login successful! Please complete your profile.')
              navigate('/profile-setup')
            }
          }
        } else {
          throw new Error('Login failed - no user data returned')
        }
      } else {
        if (!username.trim()) {
          toast.error('Username is required for sign up')
          setLoading(false)
          return
        }
        
        // Use our API endpoint to create user without sending confirmation email
        console.log('Creating new user account...')
        const signUpData = await (await import('../lib/api')).default.post('/auth/signup', {
          email,
          password,
          username: username.trim(),
          referral_code: referralCode || undefined,
          recruited_by: localStorage.getItem('recruited_by') || undefined
        })
        if (!signUpData.success) {
          console.error('Signup failed:', signUpData)
          throw new Error(signUpData.error || 'Signup failed')
        }
        
        console.log('User created, signing in...')

        // Now sign in the user
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) {
          console.error('Sign in error:', signInErr)
          throw new Error(signInErr.message || 'Login failed')
        }

        // Ensure session is available - wait for it if needed
        let session = signInData?.session
        if (!session) {
          // Try to get session, with retries
          for (let i = 0; i < 3; i++) {
            const { data: sessionData } = await supabase.auth.getSession()
            if (sessionData?.session) {
              session = sessionData.session
              break
            }
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }

        if (!session) {
          throw new Error('Failed to establish session after signup')
        }

        // Refresh the session to ensure it's fully established
        await supabase.auth.refreshSession()
        
        // Get the refreshed session
        const { data: { session: refreshedSession } } = await supabase.auth.getSession()
        const finalSession = refreshedSession || session
        
        setAuth(finalSession?.user ?? null, finalSession ?? null)
        
        if (session?.user) {
          console.log('Session established, loading profile...')
          let tries = 0
          let prof: any = null
          while (tries < 5 && !prof) {
            const { data: p, error: profErr } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle()
            
            if (profErr) {
              console.error(`Profile load attempt ${tries + 1} error:`, profErr)
            }
            
            if (p) {
              prof = p
              console.log('Profile loaded successfully')
              break
            } else {
              console.log(`Profile not found yet, attempt ${tries + 1}/5, waiting...`)
              await new Promise(r => setTimeout(r, 1000))
              tries++
            }
          }
          
          if (prof) {
            setProfile(prof)
            toast.success('Account created successfully!')
            navigate('/')
          } else {
            console.warn('Profile not found after 5 attempts, but user was created')
            toast.success('Account created! Please refresh the page.')
            navigate('/')
          }
        } else {
          throw new Error('Session not established')
        }
      }
    } catch (err: any) {
      console.error('Email auth error:', err)
      toast.error(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (user && profile) {
      if (profile.username) {
        navigate('/')
      } else {
        navigate('/profile/setup')
      }
    }
  }, [user, profile, navigate])

  

  React.useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    const handleInstalled = () => {
      try { localStorage.setItem('pwa-installed', 'true') } catch {}
      setInstalled(true)
      setInstallPrompt(null)
      toast.success('App installed')
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall as any)
    window.addEventListener('appinstalled', handleInstalled as any)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall as any)
      window.removeEventListener('appinstalled', handleInstalled as any)
    }
  }, [])

  const handleGoogle = async () => {
    setLoading(true)
    try {
      const envSiteUrl = (import.meta as any).env.VITE_PUBLIC_SITE_URL as string | undefined
      let redirectBase = window.location.origin
      if (envSiteUrl && !/localhost/i.test(envSiteUrl)) {
        try {
          redirectBase = new URL(envSiteUrl).origin
        } catch {
          redirectBase = window.location.origin
        }
      }
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider: 'google', 
        options: { 
          redirectTo: String(redirectBase).replace(/\/$/, '') + '/auth/callback',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        } 
      })
      if (error) throw error
    } catch (err: any) {
      toast.error(err.message || 'Google login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container flex items-center justify-center min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="bg-[#18181b] p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <span className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-[#FFC93C] via-[#FFD700] to-[#FFB300] bg-clip-text text-transparent drop-shadow-lg select-none tracking-wide">
            Troll City
          </span>
          <span className="block text-troll-gold text-lg font-semibold mt-1 tracking-widest">Welcome</span>
        </div>

        <div className="flex justify-center mb-6">
          <div className="flex bg-[#23232b] rounded-lg p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`px-4 py-2 rounded-md transition-colors ${
                isLogin ? 'bg-[#FFC93C] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`px-4 py-2 rounded-md transition-colors ${
                !isLogin ? 'bg-[#FFC93C] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#23232b] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#FFC93C] transition-colors"
            placeholder="Email address"
            autoComplete="email"
            required
          />
          </div>
          
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-12 py-3 bg-[#23232b] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#FFC93C] transition-colors"
            placeholder="Password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            required
            minLength={6}
          />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#23232b] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#FFC93C] transition-colors"
                placeholder="Username"
                autoComplete="username"
                required
              />
            </div>
          )}

          
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#FFC93C] to-[#FFD700] text-black font-semibold rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></div>
                Processing...
              </span>
            ) : (
              isLogin ? 'Sign In' : 'Sign Up'
            )}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[#18181b] text-gray-400">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#23232b] border border-gray-600 rounded-lg text-white hover:bg-[#23232b]/80 transition disabled:opacity-50"
          type="button"
        >
          <span className="text-lg font-bold">G</span>
          Continue with Google
        </button>

        {installPrompt && !installed && (
          <div className="mt-6">
            <div className="text-xs text-gray-400 mb-2 text-center">Install the app now. You’ll use the same login on web and app.</div>
            <button
              className="w-full py-3 bg-[#22c55e] text-black font-semibold rounded-lg hover:shadow-lg transition-all"
              type="button"
              onClick={async () => {
                try {
                  await installPrompt.prompt()
                  const choice = await installPrompt.userChoice
                  if (choice?.outcome === 'accepted') {
                    try { localStorage.setItem('pwa-installed', 'true') } catch {}
                    setInstalled(true)
                    setInstallPrompt(null)
                  }
                } catch {}
              }}
            >
              Install App
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Auth
