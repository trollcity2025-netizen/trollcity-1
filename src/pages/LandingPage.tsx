import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';

import MoneyRain from '../components/MoneyRain';
import { Play, Users, Coins, Trophy, Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { trollCityTheme } from '../styles/trollCityTheme';
import HomeLiveGrid from '@/components/broadcast/HomeLiveGrid';
import AppLayout from '@/components/layout/AppLayout';
import EventCountdown from '@/components/EventCountdown';

interface PlatformStats {
  totalUsers: number;
  totalPaidOut: number;
  liveStreamsCount: number;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  // Theme audio disabled - entrance effect should not play on landing page
  // const { playTheme } = useThemeAudio();
  const [isEntering, setIsEntering] = useState(false);
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalPaidOut: 0,
    liveStreamsCount: 0
  });

  useEffect(() => {
    // Theme audio disabled - entrance effect should not play on landing page
    // playTheme();
  }, []);


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

    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const features = [
    {
      icon: Play,
      title: 'Go Live & Get Paid',
      description: 'Get Paid Every Friday'
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
    <AppLayout showSidebar={true} showHeader={true} showBottomNav={true}>
      <div className={`min-h-screen w-full ${trollCityTheme.backgrounds.primary} overflow-x-hidden relative font-sans`}>
        {/* Event Countdown Banner */}
        <EventCountdown />

        {/* Money Rain Effect */}
        {isEntering && <MoneyRain />}

        {/* Animated Background - No Video */}
        <div className="fixed inset-0 overflow-hidden z-0">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900" />
          
          {/* Animated Radial Gradients */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(147,51,234,0.25),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(236,72,153,0.2),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.15),transparent_50%)]" />
          
          {/* Animated Grid */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `
              linear-gradient(rgba(147,51,234,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(147,51,234,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            animation: 'grid-flow 20s linear infinite'
          }} />
          
          {/* Floating Particles */}
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-purple-400/40 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float-particle ${8 + Math.random() * 12}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 8}s`,
              }}
            />
          ))}
        </div>
        
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/60 pointer-events-none" />

        {/* Main Content */}
        <div className="relative z-10 min-h-screen flex flex-col">
          {/* Hero Section */}
          <div className="flex-1 flex items-center justify-center px-4 py-12 pt-24">
            <div className="max-w-7xl w-full">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                {/* Left: Content */}
                <div className="text-center lg:text-left space-y-8 animate-fade-in-up">
                  {/* Logo/Title */}
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full mb-4">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-purple-400 font-semibold text-sm">Get Paid Every Friday</span>
                    </div>
                    
                    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black">
                      <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                        TROLL CITY
                      </span>
                    </h1>
                    
                    <p className="text-xl sm:text-2xl md:text-3xl text-slate-200 font-bold">
                      Stream. Play. Earn. Dominate.
                    </p>
                    
                    <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0">
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

                {/* Right: Hero Visual - Hidden on mobile since video is background */}
                <div className="hidden lg:block relative animate-fade-in-right">
                  <div className="relative w-full h-full min-h-[400px] bg-gradient-to-br from-slate-900/80 via-purple-900/40 to-slate-900/80 rounded-3xl overflow-hidden border border-white/10 shadow-[0_20px_70px_rgba(147,51,234,0.3)]">
                    {/* Animated Background Grid */}
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute inset-0" style={{
                        backgroundImage: `
                          linear-gradient(rgba(147,51,234,0.3) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(147,51,234,0.3) 1px, transparent 1px)
                        `,
                        backgroundSize: '50px 50px',
                        animation: 'grid-flow 20s linear infinite'
                      }} />
                    </div>

                    {/* Gradient Orbs */}
                    <div className="absolute top-20 left-20 w-64 h-64 bg-purple-600/30 rounded-full blur-3xl animate-pulse-slow" />
                    <div className="absolute bottom-20 right-20 w-80 h-80 bg-pink-600/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />

                    {/* Main Content */}
                    <div className="relative z-10 h-full flex flex-col items-center justify-center p-8">
                      {/* Center Stage - Mock Streaming Interface */}
                      <div className="w-full max-w-2xl space-y-6">
                        {/* Top Bar - Live Indicator */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 px-4 py-2 bg-red-600/90 backdrop-blur-sm rounded-full shadow-[0_8px_24px_rgba(239,68,68,0.4)]">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            <span className="text-white font-bold text-sm">LIVE</span>
                            <span className="text-white/80 text-sm">1.2K watching</span>
                          </div>
                          
                          <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                            <Users className="w-4 h-4 text-cyan-400" />
                            <span className="text-white font-semibold text-sm">10.5K</span>
                          </div>
                        </div>

                        {/* Main Video Area Mockup */}
                        <div className="relative aspect-video bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                          {/* Simulated Video Content */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative group">
                              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 rounded-full blur-2xl opacity-50 group-hover:opacity-75 transition-opacity" />
                              <div className="relative w-24 h-24 bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-500 rounded-full flex items-center justify-center shadow-[0_20px_60px_rgba(147,51,234,0.6)] group-hover:scale-110 transition-transform cursor-pointer">
                                <Play className="w-12 h-12 text-white ml-1" fill="white" />
                              </div>
                            </div>
                          </div>

                          {/* Floating Stats */}
                          <div className="absolute top-4 left-4 animate-float">
                            <div className="px-4 py-2 bg-purple-600/90 backdrop-blur-sm rounded-xl border border-purple-400/30">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-bold text-sm">+50 XP</span>
                              </div>
                            </div>
                          </div>

                          <div className="absolute bottom-4 left-4 animate-float" style={{ animationDelay: '1s' }}>
                            <div className="px-4 py-2 bg-pink-600/90 backdrop-blur-sm rounded-xl border border-pink-400/30">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-bold text-sm">New Sub!</span>
                              </div>
                            </div>
                          </div>

                          {/* Bottom Chat Bar Mockup */}
                          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900/95 to-transparent">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                                <span className="text-slate-400 text-sm">Join the conversation...</span>
                              </div>
                              <button className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold text-white text-sm">
                                Send
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Info Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-500 rounded-full border-2 border-white/20" />
                            <div>
                              <div className="text-white font-bold">@YourUsername</div>
                              <div className="text-slate-400 text-sm">Level 25 • 10K Trolls</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <button className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 rounded-full font-bold text-white shadow-[0_8px_24px_rgba(239,68,68,0.4)] hover:shadow-[0_10px_30px_rgba(249,115,22,0.5)] transition-all hover:scale-105">
                              Go Live
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-purple-900/20 pointer-events-none" />
                  </div>
                  
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

          {/* Live Now Section */}
          <div className="px-4 py-8">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                  🔴 Live Now
                </h2>
                <p className="text-slate-400">
                  Join the action in Troll City
                </p>
              </div>
              <HomeLiveGrid />
            </div>
          </div>

          {/* Features Section */}
          <div className="py-16 px-4">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  Everything You Need
                </h2>
                <p className="text-xl text-slate-400">
                  A complete platform for creators and community members
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map((feature, idx) => (
                  <div
                    key={idx}
                    className={`group ${trollCityTheme.components.card}`}
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

          {/* Footer */}
          <div className="py-10 border-t border-white/10">
            <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
              <div>© 2026 Troll City, LLC. All rights reserved.</div>
              <div className="flex items-center gap-6">
                <Link to="/about" className="hover:text-white transition-colors">About us</Link>
                <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
                <Link to="/career" className="hover:text-white transition-colors">Careers</Link>
              </div>
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
            10% { opacity: 0.5; }
            90% { opacity: 0.5; }
            50% { transform: translateY(-150px) translateX(30px); }
          }
          
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          
          @keyframes grid-flow {
            0% { transform: translateY(0); }
            100% { transform: translateY(50px); }
          }
          
          @keyframes pulse-slow {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.1); }
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

          .animate-pulse-slow {
            animation: pulse-slow 4s ease-in-out infinite;
          }
        `}
      </style>
    </AppLayout>
  );
}
