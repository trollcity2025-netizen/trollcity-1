import React, { useState, useEffect } from 'react'
import { AuthApiError } from '@supabase/supabase-js'
import { supabase, isAdminEmail } from '../lib/supabase'
import { post, API_ENDPOINTS } from '../lib/api'
import { toast } from 'sonner'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { Mail, Lock, User, Eye, EyeOff, AlertTriangle } from 'lucide-react'
// import InstallButton from '../components/InstallButton';
import { trollCityTheme } from '../styles/trollCityTheme';
import { generateUUID } from '../lib/uuid';

interface AuthProps {
  embedded?: boolean;
  onClose?: () => void;
  initialMode?: 'login' | 'signup';
}

const Auth = ({ embedded = false, onClose: _onClose, initialMode }: AuthProps = {}) => {
  const [loading, setLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const initialIsLogin = initialMode 
    ? initialMode === 'login'
    : searchParams.get('mode') === 'signup' ? false : true
  const [isLogin, setIsLogin] = useState(initialIsLogin)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showAlertAdmin, setShowAlertAdmin] = useState(false)
  const [alertEmail, setAlertEmail] = useState('')
  const [alertDetails, setAlertDetails] = useState('')
  const [alertSubmitting, setAlertSubmitting] = useState(false)
  const [dailyLimitReached, setDailyLimitReached] = useState(false)
  const [activeEvent, setActiveEvent] = useState<any>(null)
  const [inQueue, setInQueue] = useState(false)
  const [queueEmail, setQueueEmail] = useState('')
  const [queueUsername, setQueueUsername] = useState('')
  const [nextWindow, setNextWindow] = useState<Date | null>(null)
  const navigate = useNavigate()
  const { user, profile, setAuth, setProfile } = useAuthStore()
  
  // Check active event and signup limits
  useEffect(() => {
    const checkEventAndLimits = async () => {
      try {
        // 1. Get Active Event
        const { data: eventData } = await supabase.rpc('get_active_event')
        const event = eventData?.[0]
        setActiveEvent(event)

        if (event) {
          // 2. Get Signup Count for this event
          const { data: count } = await supabase.rpc('get_active_event_signup_count')

          if (count !== null && count >= event.signup_cap) {
            setDailyLimitReached(true)
            // Calculate end of event
            const startTime = new Date(event.start_time)
            const endTime = new Date(startTime.getTime() + event.duration_hours * 60 * 60 * 1000)
            setNextWindow(endTime)
          } else {
            setDailyLimitReached(false)
          }
        } else {
        // Fallback to old daily limit logic if no event
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)
        
        const { count, error: countError } = await supabase
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today.toISOString())
        
        if (countError) {
            console.warn('[Auth] Error fetching user count, assuming limit not reached:', countError)
            setDailyLimitReached(false)
        } else if (count !== null && count >= 100) {
          setDailyLimitReached(true)
          const tomorrow = new Date(today)
          tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
          setNextWindow(tomorrow)
        } else {
          setDailyLimitReached(false)
        }
      }
      } catch (err) {
        console.error('Error checking limits:', err)
      }
    }
    
    checkEventAndLimits()
    const interval = setInterval(checkEventAndLimits, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('signup_queue').insert({
        email: queueEmail || email,
        username: queueUsername || username
      })
      if (error) throw error
      setInQueue(true)
      toast.success('You have been added to the queue!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to join queue')
    } finally {
      setLoading(false)
    }
  }

  // Timer countdown
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    if (!nextWindow || !dailyLimitReached) return
    
    const updateTimer = () => {
      const now = new Date()
      const diff = nextWindow.getTime() - now.getTime()
      
      if (diff <= 0) {
        setDailyLimitReached(false)
        return
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
    }
    
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [nextWindow, dailyLimitReached])
  
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

      if (profileData && !profileData.username) {
        const metadataUsername = data.user.user_metadata?.username
        if (metadataUsername) {
          const { data: updatedProfile, error: updateError } = await supabase
            .from('user_profiles')
            .update({ username: metadataUsername })
            .eq('id', data.user.id)
            .select('*')
            .maybeSingle()

          if (!updateError && updatedProfile) {
            profileData = updatedProfile
          }
        }
      }

      if (profileData) {
        // Check if admin BEFORE setting profile
        const _isAdmin = profileData.role === 'admin' || profileData.is_admin === true;
        if (isAdminEmail(data.user.email) && profileData.role !== 'admin') {
          try {
            const now = new Date().toISOString()
            const { data: updated } = await supabase
              .from('user_profiles')
              .update({ role: 'admin', updated_at: now })
              .eq('id', data.user.id)
              .select('*')
              .maybeSingle()
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
              const ipRes = await fetch('https://api.ipify.org?format=json');
              const ipJson = await ipRes.json();
              const userIP = ipJson.ip;

              if (userIP && data.user?.id) {
                  supabase.functions.invoke('vpn-detect', {
                      body: { ip: userIP, user_id: data.user.id },
                  });
              }

              const { data: current } = await supabase
                .from('user_profiles')
                .select('ip_address_history')
                .eq('id', data.user.id)
                .maybeSingle();
              const history = current?.ip_address_history || [];
              const entry = { ip: userIP, timestamp: new Date().toISOString() };
              const updated = [...history, entry].slice(-10);
              await supabase
                .from('user_profiles')
                .update({ last_known_ip: userIP, ip_address_history: updated })
                .eq('id', data.user.id);
            } catch (e) {
                console.error('Error during IP tracking on auth:', e);
            }
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
          if (!prof.username) {
            const metadataUsername = data.user.user_metadata?.username
            if (metadataUsername) {
              const { data: updatedProfile, error: updateError } = await supabase
                .from('user_profiles')
                .update({ username: metadataUsername })
                .eq('id', data.user.id)
                .select('*')
                .maybeSingle()

              if (!updateError && updatedProfile) {
                prof = updatedProfile
              }
            }
          }
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
                .maybeSingle()
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

        if (!acceptedTerms) {
          toast.error('You must accept the terms and agreements to sign up')
          setLoading(false)
          return
        }
        
        // Use Edge Function for signup
        console.log('Creating new user account...')
        
        const { success, error: signUpError } = await post(API_ENDPOINTS.auth.signup, {
          email,
          password,
          username: username.trim(),
          referral_code: referralCode || localStorage.getItem('recruited_by') || undefined,
          data: {
            terms_accepted: true,
            accepted_at: new Date().toISOString()
          }
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

  useEffect(() => {
    if (user && profile) {
      if (profile.username) {
        navigate('/')
      } else {
        navigate('/profile/setup')
      }
    }
  }, [user, profile, navigate])

  return (
    <>
    <div className={embedded ? "w-full text-white font-sans" : `auth-container flex items-center justify-center min-h-screen ${trollCityTheme.backgrounds.primary} text-white overflow-x-hidden relative font-sans`}>
      {/* Animated Background Gradients */}
      {!embedded && (
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute inset-0 ${trollCityTheme.overlays.radialPurple}`} />
        <div className={`absolute inset-0 ${trollCityTheme.overlays.radialPink}`} />
        <div className={`absolute inset-0 ${trollCityTheme.overlays.radialCyan}`} />
      </div>
      )}

      {/* Floating Particles */}
      {!embedded && (
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
      )}

      {/* Auth Card */}
      <div className={embedded ? "w-full p-6" : "relative z-10 w-full max-w-md px-4 py-8"}>
        <div className={embedded ? "" : "backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] p-8"}>
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
            <div className="grid grid-cols-2 w-full max-w-xs bg-slate-800/50 border border-white/5 rounded-xl p-1 gap-1">
              <button
                onClick={() => setIsLogin(true)}
                className={`px-6 py-2 rounded-lg font-semibold transition-all duration-300 ${
                  isLogin 
                    ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white shadow-[0_4px_12px_rgba(147,51,234,0.3)]' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`px-6 py-2 rounded-lg font-semibold transition-all duration-300 ${
                  !isLogin 
                    ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white shadow-[0_4px_12px_rgba(147,51,234,0.3)]' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-5 mb-6">
            {!isLogin && dailyLimitReached ? (
              <div className="text-center p-6 bg-slate-800/50 rounded-xl border border-purple-500/30 animate-in fade-in zoom-in duration-300">
                <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">
                  {activeEvent ? 'Event Sign-Up Cap Reached' : 'Daily Sign-Up Limit Reached'}
                </h3>
                <p className="text-slate-300 mb-6 text-sm">
                  {activeEvent 
                    ? `Early access for "${activeEvent.event_name}" is limited to ${activeEvent.signup_cap} participants. We've reached the limit for early access! You can join the waitlist or wait for the full public launch in 48 hours.` 
                    : "We limit new registrations to 100 users per day to ensure the best experience for our citizens."}
                </p>
                
                {inQueue ? (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
                    <p className="text-green-400 font-bold mb-1">You&apos;re in the queue!</p>
                    <p className="text-xs text-green-400/80">We&apos;ll notify you when a spot opens up.</p>
                  </div>
                ) : (
                  <div className="bg-slate-900/80 rounded-xl p-4 mb-6 border border-white/5 text-left">
                    <p className="text-slate-400 text-xs uppercase tracking-widest mb-3 text-center">Join the Waitlist</p>
                    <div className="space-y-3">
                      <div className="relative group">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                        <input 
                          type="email" 
                          placeholder="Email" 
                          value={queueEmail}
                          onChange={(e) => setQueueEmail(e.target.value)}
                          className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500/50"
                          required
                        />
                      </div>
                      <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                        <input 
                          type="text" 
                          placeholder="Username" 
                          value={queueUsername}
                          onChange={(e) => setQueueUsername(e.target.value)}
                          className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500/50"
                          required
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={handleJoinQueue}
                        disabled={loading}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-lg transition-colors text-sm"
                      >
                        {loading ? 'Joining...' : 'Join Queue'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-slate-950/50 rounded-lg p-4 mb-6 border border-white/5">
                  <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">
                    {activeEvent ? 'Registration opens in' : 'Next Registration Window'}
                  </p>
                  <div className="text-3xl font-mono text-cyan-400 font-bold tracking-wider">
                    {timeLeft}
                  </div>
                </div>
                <p className="text-sm text-slate-400">
                  Already have an account? <button type="button" onClick={() => setIsLogin(true)} className="text-purple-400 hover:text-purple-300 hover:underline">Sign in here</button>
                </p>
              </div>
            ) : (
              <>
                {/* Email Input */}
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400/60 group-focus-within:text-cyan-400 transition-colors" />
                  <input
                    type="email"
                    id="email"
                    name="email"
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
                    id="password"
                    name="password"
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
                  <>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400/60 group-focus-within:text-cyan-400 transition-colors" />
                      <input
                        type="text"
                        id="username"
                        name="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/40 focus:bg-slate-800/70 transition-all focus:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                        placeholder="Username"
                        autoComplete="username"
                        required
                      />
                    </div>

                    {/* Terms Acceptance */}
                    <div className="flex items-start gap-3 px-1">
                      <div className="relative flex items-center pt-1">
                        <input
                          type="checkbox"
                          id="accept-terms"
                          checked={acceptedTerms}
                          onChange={(e) => setAcceptedTerms(e.target.checked)}
                          className="peer h-5 w-5 appearance-none rounded border border-purple-500/30 bg-slate-800/50 checked:bg-purple-600 checked:border-purple-600 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition-all cursor-pointer"
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white opacity-0 peer-checked:opacity-100 transition-opacity">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                      <label htmlFor="accept-terms" className="text-sm text-slate-300 cursor-pointer select-none">
                        I accept the{' '}
                        <Link to="/legal/terms" target="_blank" className="text-purple-400 hover:text-purple-300 hover:underline">
                          Terms and Agreements
                        </Link>
                        {' '}and acknowledge the{' '}
                        <Link to="/legal/privacy" target="_blank" className="text-purple-400 hover:text-purple-300 hover:underline">
                          Privacy Policy
                        </Link>.
                      </label>
                    </div>
                  </>
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
              </>
            )}
          </form>

        {/* Helper Links - HIDDEN FOR MAINTENANCE
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
        */}

        {/* Install Button - HIDDEN FOR MAINTENANCE
        <div className="mt-6">
          <InstallButton 
            text="Install App"
            showInstalledBadge={true}
            className="w-full"
          />
        </div>
        */}
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
              Tell our team about the issue and we&apos;ll help you fix it.
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