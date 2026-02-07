
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { useEffect } from 'react';
import { subscribeToNtfyGlobal } from '../lib/ntfySubscribe';
import { trollCityTheme } from '@/styles/trollCityTheme';
import { 
  Gamepad2, 
  Users, 
  ShoppingCart, 
  Coins,
  Shield,
  Zap,
  Star,
  ArrowRight,
  Sparkles,
  Play,
  Crown
} from 'lucide-react';
import HomeLiveGrid from '@/components/broadcast/HomeLiveGrid';
import BroadcastLockdownControl from '@/components/admin/BroadcastLockdownControl';
import PresidentialCampaignGrid from '@/components/president/PresidentialCampaignGrid';
import PresidentInaugurationCard from '@/components/president/PresidentInaugurationCard';

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

// Feature card component
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  delay: number;
}

const FeatureCard = ({ icon, title, description, gradient, delay }: FeatureCardProps) => {
  return (
    <div 
      className={`group relative p-6 ${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl hover:border-cyan-400/50 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20 animate-fade-in-up`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl bg-gradient-to-br ${gradient} blur-xl`} />
      <div className="relative z-10">
        <div className="mb-4 p-3 bg-gradient-to-br from-purple-600/20 to-cyan-600/20 rounded-xl w-fit group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <h3 className="text-xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
          {title}
        </h3>
        <p className={`${trollCityTheme.text.muted} leading-relaxed`}>
          {description}
        </p>
      </div>
    </div>
  );
};

// Stats component - Replaced by TopBroadcasters component with real-time database data
const _StatsSection = () => {
  return null;
};

export default function Home() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  // Auto-scroll to top and subscribe to push notifications on page load
  useEffect(() => {
    window.scrollTo(0, 0);
    subscribeToNtfyGlobal();
  }, []);

  const features = [
    {
      icon: <Crown className="w-8 h-8 text-amber-400" />,
      title: "Presidential Office",
      description: "Vote for the Troll City President! The elected President manages the treasury and boosts payouts for everyone.",
      gradient: "from-amber-600/20 to-orange-600/20",
    },
    {
      icon: <Users className="w-8 h-8 text-cyan-400" />,
      title: "Join Families",
      description: "Create or join families to build your community. Compete for top rankings and exclusive rewards.",
      gradient: "from-cyan-600/20 to-blue-600/20",
    },
    {
      icon: <ShoppingCart className="w-8 h-8 text-pink-400" />,
      title: "Troll Mart",
      description: "Shop for exclusive items, apartments, and customizations. Build your virtual empire in Troll City.",
      gradient: "from-pink-600/20 to-purple-600/20",
    },
    {
      icon: <Gamepad2 className="w-8 h-8 text-purple-400" />,
      title: "Troll Family Battles",
      description: "Compete in Troll Family Battles! Join or create a family, challenge others, and climb the leaderboard.",
      gradient: "from-purple-600/20 to-cyan-600/20",
    },
    {
      icon: <Coins className="w-8 h-8 text-yellow-400" />,
      title: "Daily Login Posts",
      description: "Post once daily to the Troll City Wall and earn 0-100 random Troll Coins. Come back every day for rewards!",
      gradient: "from-yellow-600/20 to-cyan-600/20",
    },
    {
      icon: <Shield className="w-8 h-8 text-cyan-400" />,
      title: "Safe Community",
      description: "Moderated community with family-friendly content. Report features and active moderation team.",
      gradient: "from-cyan-600/20 to-teal-600/20",
    },
  ];

  return (
    <div className={`relative min-h-dvh overflow-hidden ${trollCityTheme.backgrounds.primary}`}>
      {/* Animated Background */}
      <AnimatedGradient />
      <FloatingParticles />

      {/* Content */}
      <div className="relative z-10 min-h-dvh flex flex-col">
        
        {/* Hero Section */}
        <section className="flex-1 flex items-center px-4 py-20 safe-top">
          <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-1 gap-10 items-center">
            {/* Main Heading */}
            <div className="space-y-8 text-center animate-fade-in">
              <div className="space-y-4">
                <h1 className="text-5xl md:text-6xl xl:text-7xl font-black leading-tight bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent animate-gradient-text drop-shadow-[0_10px_40px_rgba(124,58,237,0.35)]">
                  Welcome to Troll City
                </h1>
                <p className="text-xl md:text-2xl text-slate-200">
                  Stream, Play, Connect & Earn in the Ultimate Online Community
                </p>
                <p className="text-lg text-slate-400">
                  Join thousands of creators and viewers in Troll City - where live streaming meets gaming, shopping, and social connection.
                </p>
              </div>

              {/* CTA Buttons */}
              {user && (
                <div className="flex flex-wrap gap-4 items-center animate-fade-in-up" style={{ animationDelay: '180ms' }}>
                  <button
                    onClick={() => navigate('/go-live')}
                    className="md:hidden group relative px-8 py-4 rounded-2xl font-semibold text-lg text-white bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 shadow-[0_10px_40px_rgba(236,72,153,0.4)] hover:shadow-[0_15px_50px_rgba(251,146,60,0.35)] transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    Go Live Now
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-600/0 via-white/8 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={() => navigate('/explore')}
                    className="px-8 py-4 rounded-2xl font-semibold text-lg text-slate-50 bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 hover:bg-slate-800/70 transition-all duration-300 hover:-translate-y-0.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                  >
                    Explore Feed
                  </button>
                  <button
                    onClick={() => navigate('/president')}
                    className="px-8 py-4 rounded-2xl font-semibold text-lg text-amber-100 bg-amber-900/40 backdrop-blur-xl border border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-900/60 transition-all duration-300 hover:-translate-y-0.5 shadow-[0_10px_30px_rgba(245,158,11,0.15)] flex items-center gap-2"
                  >
                    <Crown className="w-5 h-5 text-amber-400" />
                    President&apos;s Office
                  </button>
                </div>
              )}

              {/* Quick Features Preview */}
              <div className="flex flex-wrap gap-3 text-sm text-slate-300 animate-fade-in-up" style={{ animationDelay: '320ms' }}>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 shadow-[0_8px_25px_rgba(59,130,246,0.15)]">
                  <Zap className="w-4 h-4 text-yellow-300" />
                  Free to Join
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 shadow-[0_8px_25px_rgba(56,189,248,0.15)]">
                  <Star className="w-4 h-4 text-cyan-300" />
                  Earn Rewards
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 shadow-[0_8px_25px_rgba(168,85,247,0.15)]">
                  <Shield className="w-4 h-4 text-purple-300" />
                  Safe & Moderated
                </div>
              </div>

              {/* Admin-only Broadcast Lockdown Control */}
              {user?.role === 'admin' && (
                <div className="mt-8 max-w-xl mx-auto animate-fade-in-up" style={{ animationDelay: '380ms' }}>
                  <BroadcastLockdownControl />
                </div>
              )}
            </div>

            {/* Live Broadcasters Grid */}
            <div className="w-full animate-fade-in-up" style={{ animationDelay: '240ms' }}>
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                  🔴 Live Now
                </h2>
                <p className="text-slate-400">
                  Join the action in Troll City
                </p>
              </div>
              <PresidentInaugurationCard />
              <HomeLiveGrid />
            </div>

            {/* Presidential Election Section */}
            <div className="w-full mt-20">
               <PresidentialCampaignGrid />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-4 py-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Everything You Need
              </h2>
              <p className="text-xl text-slate-400">
                A complete platform for creators and community members
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <FeatureCard
                  key={index}
                  {...feature}
                  delay={index * 100}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="py-8 text-center text-slate-500 text-sm">
          © 2026 Troll City, LLC. All rights reserved.
        </div>

        {/* Footer safe area */}
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
  );
}
