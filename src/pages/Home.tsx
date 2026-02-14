
import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { subscribeToNtfyGlobal } from '../lib/ntfySubscribe'
import { trollCityTheme } from '@/styles/trollCityTheme'
import PWAInstallPrompt from '../components/PWAInstallPrompt'
import EventCountdown from '@/components/EventCountdown'
import LiveStreamsModule from '@/components/home/LiveStreamsModule'
import TrollWallFeed from '@/components/home/TrollWallFeed'
import TopRentPayersWidget from '@/components/home/TopRentPayersWidget'
import TrollPodsWidget from '@/components/home/TrollPodsWidget'

// Animated gradient background
const AnimatedGradient = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 animate-gradient-shift" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.18),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.14),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(140%_140%_at_90%_90%,rgba(236,72,153,0.12),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.08)_0%,rgba(14,165,233,0.06)_40%,rgba(236,72,153,0.08)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.06),transparent_35%)] mix-blend-screen" />
      <style>
        {`
          @keyframes gradient-shift {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.85; }
          }
          .animate-gradient-shift {
            animation: gradient-shift 12s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  );
};

// Floating particles effect
const FloatingParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-cyan-400/40 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.35)]"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float-particle ${5 + Math.random() * 10}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
      <style>
        {`
          @keyframes float-particle {
            0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0; }
            10% { opacity: 0.6; }
            90% { opacity: 0.6; }
            50% { transform: translateY(-100px) translateX(50px); }
          }
        `}
      </style>
    </div>
  );
};

export default function Home() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  // Auto-scroll to top and subscribe to push notifications on page load
  useEffect(() => {
    window.scrollTo(0, 0)
    subscribeToNtfyGlobal()
  }, [])

  const requireAuth = useCallback(
    (intent?: string) => {
      if (user) return true
      toast.info(`Sign in to ${intent || 'continue'}.`)
      navigate('/auth')
      return false
    },
    [navigate, user]
  )

  return (
    <div className={`relative min-h-dvh overflow-hidden ${trollCityTheme.backgrounds.primary}`}>
      {/* Event Countdown Banner */}
      <EventCountdown />

      {/* Animated Background */}
      <AnimatedGradient />
      <FloatingParticles />

      {/* PWA Install Prompt - Only on Landing Page */}
      <PWAInstallPrompt />

      {/* Content */}
      <div className="relative z-10 min-h-dvh px-4 md:px-6 py-6 safe-top">
        <div className="max-w-7xl mx-auto space-y-6">
          <section className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-3xl p-5 md:p-6`}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">City Feed</h1>
                <p className={`${trollCityTheme.text.muted} text-sm`}>Live streams happening right now.</p>
              </div>
            </div>
            <LiveStreamsModule onRequireAuth={requireAuth} />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <TrollWallFeed onRequireAuth={requireAuth} />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <TopRentPayersWidget onRequireAuth={requireAuth} />
              <TrollPodsWidget onRequireAuth={requireAuth} />
            </div>
          </div>
        </div>
        <div className="safe-bottom" />
      </div>

      {/* Animations */}
      <style>
        {`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes gradient-text {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          
          .animate-fade-in {
            animation: fade-in 1s ease-out forwards;
          }
          
          .animate-fade-in-up {
            animation: fade-in-up 0.8s ease-out forwards;
            opacity: 0;
          }
          
          .animate-gradient-text {
            background-size: 200% auto;
            animation: gradient-text 3s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  )
}
