import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import MoneyRain from '../components/MoneyRain';
import LandingHero from '../components/LandingHero';
import { Play, Users, Coins, Trophy, Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PlatformStats {
  totalUsers: number;
  totalPaidOut: number;
  liveStreamsCount: number;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isEntering, setIsEntering] = useState(false);
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalPaidOut: 0,
    liveStreamsCount: 0
  });

  const handleEnterTrollCity = () => {
    setIsEntering(true);
    setTimeout(() => {
      if (user) {
        navigate('/');
      } else {
        navigate('/auth?mode=login');
      }
    }, 1000);
  };

  // Fetch and subscribe to real-time stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        // Fetch total users
        const { count: usersCount } = await supabase
          .from('user_profiles')
          .select('id', { count: 'exact' });

        // Fetch live streams count
        const { count: streamsCount } = await supabase
          .from('streams')
          .select('id', { count: 'exact' })
          .eq('is_live', true);

        // Fetch total paid out from payout_requests (completed)
        const { data: payoutData } = await supabase
          .from('payout_requests')
          .select('amount')
          .eq('status', 'completed');

        const totalPaidOut = payoutData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

        setStats({
          totalUsers: usersCount || 0,
          totalPaidOut: totalPaidOut,
          liveStreamsCount: streamsCount || 0
        });
      } catch (error) {
        console.error('Failed to load platform stats:', error);
      }
    };

    loadStats();

    // Subscribe to real-time changes
    const usersSubscription = supabase
      .channel('user_profiles_stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        () => loadStats()
      )
      .subscribe();

    const streamsSubscription = supabase
      .channel('streams_stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'streams' },
        () => loadStats()
      )
      .subscribe();

    const payoutSubscription = supabase
      .channel('payouts_stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payout_requests' },
        () => loadStats()
      )
      .subscribe();

    // Refresh stats every 10 seconds as fallback
    const interval = setInterval(loadStats, 10000);

    return () => {
      supabase.removeChannel(usersSubscription);
      supabase.removeChannel(streamsSubscription);
      supabase.removeChannel(payoutSubscription);
      clearInterval(interval);
    };
  }, []);

  const features = [
    {
      icon: Play,
      title: 'Go Live & Get Paid',
      description: 'Get Paid Daily'
    },
    {
      icon: Users,
      title: 'Build Your Squad',
      description: 'Connect with viewers and grow your community'
    },
    {
      icon: Coins,
      title: 'Earn Troll Coins',
      description: 'In-game currency for exclusive perks'
    },
    {
      icon: Trophy,
      title: 'Level Up & Compete',
      description: 'Gain XP, unlock rewards, and dominate'
    }
  ];

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-x-hidden relative font-sans">
      {/* Money Rain Effect */}
      {isEntering && <MoneyRain />}

      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(147,51,234,0.18),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(236,72,153,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.12),transparent)]" />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float-particle ${5 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Hero Section */}
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-7xl w-full">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Content */}
              <div className="text-center lg:text-left space-y-8 animate-fade-in-up">
                {/* Logo/Title */}
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full mb-4">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-400 font-semibold text-sm">Get Paid Daily</span>
                  </div>
                  
                  <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black">
                    <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                      TROLL CITY
                    </span>
                  </h1>
                  
                  <p className="text-xl sm:text-2xl md:text-3xl text-slate-300 font-bold">
                    Stream. Play. Earn. Dominate.
                  </p>
                  
                  <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto lg:mx-0">
                    The ultimate live streaming platform where creators get paid, viewers earn rewards, and everyone levels up. Join the most fun community in streaming.
                  </p>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <button
                    onClick={handleEnterTrollCity}
                    disabled={isEntering}
                    className="group px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 rounded-2xl font-bold text-lg text-white shadow-[0_10px_40px_rgba(147,51,234,0.4)] hover:shadow-[0_15px_50px_rgba(236,72,153,0.5)] transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isEntering ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Entering...
                      </>
                    ) : (
                      <>
                        Enter Troll City <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => navigate('/auth?mode=signup')}
                    className="px-8 py-4 bg-white/10 border border-white/20 rounded-2xl font-bold text-lg text-white hover:bg-white/20 transition-colors duration-300"
                  >
                    Sign Up
                  </button>
                </div>

                {/* Quick Stats */}
                <div className="flex flex-wrap gap-6 justify-center lg:justify-start pt-4">
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {stats.totalUsers > 0 ? (stats.totalUsers >= 1000 ? `${(stats.totalUsers / 1000).toFixed(1)}k+` : stats.totalUsers.toLocaleString()) : '10k+'}
                    </div>
                    <div className="text-sm text-slate-400">Active Users</div>
                  </div>
                  <div className="w-px bg-slate-700" />
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent">
                      ${(stats.totalPaidOut / 1000).toFixed(0)}k+
                    </div>
                    <div className="text-sm text-slate-400">Paid Out</div>
                  </div>
                  <div className="w-px bg-slate-700" />
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                      {stats.liveStreamsCount > 0 ? '24/7' : '24/7'}
                    </div>
                    <div className="text-sm text-slate-400">Live Streams</div>
                  </div>
                </div>
              </div>

              {/* Right: Hero Visual */}
              <div className="relative animate-fade-in-right">
                <LandingHero />
                
                {/* Floating Badge */}
                <div className="absolute -bottom-4 -right-4 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl shadow-[0_10px_40px_rgba(34,197,94,0.4)] animate-float">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                    <span className="text-white font-bold">LIVE NOW</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, idx) => (
                <div
                  key={idx}
                  className="group p-6 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl hover:border-purple-500/30 hover:bg-slate-800/70 transition-all duration-300 hover:-translate-y-1 shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
                  style={{
                    animation: `fade-in-up 0.6s ease-out forwards`,
                    animationDelay: `${idx * 0.1}s`,
                    opacity: 0
                  }}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-500 rounded-xl flex items-center justify-center mb-4 shadow-[0_8px_24px_rgba(147,51,234,0.3)] group-hover:shadow-[0_12px_32px_rgba(236,72,153,0.4)] transition-shadow">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes fade-in-right {
            from { opacity: 0; transform: translateX(30px); }
            to { opacity: 1; transform: translateX(0); }
          }
          
          @keyframes float-particle {
            0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0; }
            10% { opacity: 0.6; }
            90% { opacity: 0.6; }
            50% { transform: translateY(-100px) translateX(50px); }
          }
          
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          
          .animate-fade-in-up {
            animation: fade-in-up 0.8s ease-out forwards;
          }
          
          .animate-fade-in-right {
            animation: fade-in-right 0.8s ease-out forwards;
            animation-delay: 0.3s;
            opacity: 0;
          }
          
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  );
}
