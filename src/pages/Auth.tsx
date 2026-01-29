import React, { useState } from 'react'
import { AuthApiError } from '@supabase/supabase-js'
import { supabase, isAdminEmail } from '../lib/supabase'
import { post, API_ENDPOINTS } from '../lib/api'
import { toast } from 'sonner'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { Mail, Lock, User, Eye, EyeOff, AlertTriangle } from 'lucide-react'

const Auth = () => {
  const [loading, setLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const initialIsLogin = searchParams.get('mode') === 'signup' ? false : true
  const [isLogin, setIsLogin] = useState(initialIsLogin)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showAlertAdmin, setShowAlertAdmin] = useState(false)
  const [alertEmail, setAlertEmail] = useState('')
  const [alertDetails, setAlertDetails] = useState('')
  const [alertSubmitting, setAlertSubmitting] = useState(false)
  const navigate = useNavigate()
  const { user, profile, setAuth, setProfile } = useAuthStore()
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState(() => {
    try { return localStorage.getItem('pwa-installed') === 'true' } catch { return false }
  })
  
  // Get referral code from URL
  const referralCode = searchParams.get('ref') || ''

  const executeLogin = async (loginEmail: string, loginPassword: string) => {
    console.log('Attempting email login...')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })
    
    if (error) {
      console.error('Login error:', error)
      // Handle specific auth errors
      if (error.message.includes('Email not confirmed')) {
        throw new Error('Login failed. Please try again or contact support if the issue persists.')
      }
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password.')
      }
      throw error
    }
    
    if (data.user && data.session) {
      console.log('Email login successful:', data.user.email)
      
      const sessionId = crypto.randomUUID()
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
              p_user_id: data.user.id,
              p_session_id: sessionId,
              p_device_info: JSON.stringify(deviceInfo),
              p_ip_address: null,
              p_user_agent: navigator.userAgent
            })
        } else {
          console.warn('[Auth] Skipping register_session because session access_token is missing')
        }
      } catch (sessionError) {
        console.error('Error registering session:', sessionError)
        // Continue with login even if session registration fails
      }
      
      setAuth(data.user, data.session)
      
      // Check if profile exists
      let profileData = null
      const { data: fetchedProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle()
      
      if (profileError) {
         console.error('Error fetching profile:', profileError)
         // Don't throw here, try to recover or redirect to setup
      }
      profileData = fetchedProfile

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
          toast.success('Welcome back!', { duration: 2000 })
          try {
            const ipRes = await fetch('https://api.ipify.org?format=json')
            const ipJson = await ipRes.json()
            const userIP = ipJson.ip
            const { data: current } = await supabase
              .from('user_profiles')
              .select('ip_address_history')
              .eq('id', data.user.id)
              .single()
            const history = current?.ip_address_history || []
            const entry = { ip: userIP, timestamp: new Date().toISOString() }
            const updated = [...history, entry].slice(-10)
            await supabase
              .from('user_profiles')
              .update({ last_known_ip: userIP, ip_address_history: updated })
              .eq('id', data.user.id)
          } catch {}
          navigate('/')
        } else {
          toast.success('Login successful! Please complete your profile.')
          navigate('/profile/setup')
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
            toast.success('Welcome back!', { duration: 2000 })
            try {
              const ipRes = await fetch('https://api.ipify.org?format=json')
              const ipJson = await ipRes.json()
              const userIP = ipJson.ip
              const { data: current } = await supabase
                .from('user_profiles')
                .select('ip_address_history')
              .eq('id', data.user.id)
                .single()
              const history = current?.ip_address_history || []
              const entry = { ip: userIP, timestamp: new Date().toISOString() }
              const updated = [...history, entry].slice(-10)
              await supabase
                .from('user_profiles')
                .update({ last_known_ip: userIP, ip_address_history: updated })
                .eq('id', data.user.id)
            } catch {}
            navigate('/')
          } else {
            toast.success('Login successful! Please complete your profile.')
            navigate('/profile/setup')
          }
        } else {
          // Still no profile found - redirect to setup to let it handle creation/fetching
          console.log('No profile found after polling, redirecting to setup')
          toast.success('Login successful! Please complete your profile.')
          navigate('/profile/setup')
        }
      }
    } else if (data.user && !data.session) {
      throw new Error('Login failed. Please try again or contact support if the issue persists.')
    } else {
      throw new Error('Login failed - no user data returned')
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return // Prevent double submission
    setLoading(true)
    
    try {
      if (isLogin) {
        await executeLogin(email, password)
      } else {
        if (!username.trim()) {
          toast.error('Username is required for sign up')
          setLoading(false)
          return
        }
        
        // Use Edge Function for signup
        console.log('Creating new user account...')
        
        const { success, error: signUpError } = await post(API_ENDPOINTS.auth.signup, {
          email,
          password,
          username: username.trim(),
          referral_code: referralCode || localStorage.getItem('recruited_by') || undefined
        })

        if (!success || signUpError) {
          console.error('Signup failed:', signUpError)
          toast.error(signUpError || 'Signup failed')
          setLoading(false)
          return
        }
        
        toast.success('Account created! Logging you in...')
        await executeLogin(email, password)
      }
    } catch (err: any) {
      console.error('Email auth error:', err)
      if (err instanceof AuthApiError) {
        const msg = String(err.message || '')
        const lowerMsg = msg.toLowerCase()
        if (lowerMsg.includes('invalid refresh token') || lowerMsg.includes('refresh token not found')) {
          try {
            await supabase.auth.signOut()
          } catch {}
          try {
            useAuthStore.getState().logout()
          } catch {}
          toast.error('Your session has expired. Please sign in again.')
          navigate('/auth')
          return
        }
      }
      const rawMessage = String(err?.message || '')
      const lower = rawMessage.toLowerCase()
      if (err?.name === 'AbortError' || lower.includes('aborted')) {
        toast.error('Request was interrupted. Please check your connection and try again.')
      } else {
        toast.error(rawMessage || 'Authentication failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAlertAdminSubmit = async () => {
    if (alertSubmitting) return
    const trimmedDetails = alertDetails.trim()
    const emailToSend = alertEmail.trim() || email.trim()
    if (!emailToSend) {
      toast.error('Please enter your email so we can contact you')
      return
    }
    if (!trimmedDetails) {
      toast.error('Please describe the issue you are having')
      return
    }
    setAlertSubmitting(true)
    try {
      const { error } = await supabase.from('critical_alerts').insert({
        message: `AUTH LOGIN ISSUE from ${emailToSend}: ${trimmedDetails}`,
        severity: 'critical',
        resolved: false,
        source: 'auth_login_issue'
      })
      if (error) {
        throw error
      }
      toast.success('Alert sent. Please check your email within 5 minutes.')
      setShowAlertAdmin(false)
      setAlertDetails('')
    } catch (err: any) {
      console.error('Failed to send login alert:', err)
      toast.error(err?.message || 'Failed to send alert, please try again')
    } finally {
      setAlertSubmitting(false)
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
    <>
    <div className="auth-container flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-x-hidden relative font-sans">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(147,51,234,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(236,72,153,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.1),transparent)]" />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/20 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float-particle ${5 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Auth Card */}
      <div className="relative z-10 w-full max-w-md px-4 py-8">
        <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <h1 className="text-4xl md:text-5xl font-black">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Troll City
              </span>
            </h1>
            <p className="text-slate-400 text-sm mt-2 font-semibold tracking-widest">
              {isLogin ? 'Welcome Back' : 'Join the City'}
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="flex bg-slate-800/50 border border-white/5 rounded-xl p-1">
              <button
                onClick={() => setIsLogin(true)}
                className={`px-6 py-2 rounded-lg font-semibold transition-all duration-300 ${
                  isLogin 
                    ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`px-6 py-2 rounded-lg font-semibold transition-all duration-300 ${
                  !isLogin 
                    ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-5 mb-6">
            {/* Email Input */}
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400/60 group-focus-within:text-cyan-400 transition-colors" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/40 focus:bg-slate-800/70 transition-all focus:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                placeholder="Email address"
                autoComplete="email"
                required
              />
            </div>

            {/* Password Input */}
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400/60 group-focus-within:text-cyan-400 transition-colors" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/40 focus:bg-slate-800/70 transition-all focus:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                placeholder="Password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Username Input (Sign Up Only) */}
            {!isLogin && (
              <div className="relative group">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400/60 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/40 focus:bg-slate-800/70 transition-all focus:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                  placeholder="Username"
                  autoComplete="username"
                  required
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white font-semibold rounded-xl hover:shadow-[0_15px_40px_rgba(147,51,234,0.3)] transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
            {loading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white mr-2"></div>
                Processing...
              </span>
            ) : (
              isLogin ? 'Sign In' : 'Sign Up'
            )}
          </button>
        </form>

        {/* Helper Links */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <Link
              to={email ? `/reset-password?email=${encodeURIComponent(email)}` : "/reset-password"}
              className="text-cyan-400/80 hover:text-cyan-300 transition-colors"
            >
              Forgot password?
            </Link>
            <button
              type="button"
              onClick={() => {
                setShowAlertAdmin(true)
                if (!alertEmail && email) {
                  setAlertEmail(email)
                }
              }}
              className="text-cyan-400/80 hover:text-cyan-300 transition-colors flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3" />
              Need help?
            </button>
          </div>
        </div>

        {installPrompt && !installed && (
          <div className="mt-6 p-4 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-xl">
            <div className="text-xs text-slate-300 mb-3 text-center">Install the app now. Use the same login on web and app.</div>
            <button
              className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-[0_10px_30px_rgba(34,197,94,0.3)] transition-all duration-300"
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
      {/* Alert Admin Modal */}
      {showAlertAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-4">
          <div className="w-full max-w-md rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.4)] p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Need help?</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAlertAdmin(false)}
                className="text-slate-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Tell our team about the issue and we'll help you fix it.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Email</label>
                <input
                  type="email"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/40 focus:bg-slate-800/70 transition-all"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-2">Describe the issue</label>
                <textarea
                  value={alertDetails}
                  onChange={(e) => setAlertDetails(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/40 focus:bg-slate-800/70 transition-all resize-none h-24"
                  placeholder="Example: Password reset not working..."
                />
              </div>
              <button
                type="button"
                onClick={handleAlertAdminSubmit}
                disabled={alertSubmitting}
                className="w-full py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white font-semibold rounded-xl hover:shadow-[0_15px_40px_rgba(147,51,234,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {alertSubmitting ? 'Sending...' : 'Send help request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {React.createElement('style', { dangerouslySetInnerHTML: { __html: `
        @keyframes float-particle {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0; }
          50% { transform: translateY(-30px) translateX(10px); opacity: 0.6; }
        }
      ` } })}
    </div>
  </>
  )
}

export default Auth
