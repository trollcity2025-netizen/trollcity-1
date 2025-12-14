import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Crown, Video, PartyPopper } from 'lucide-react';
import { isBirthdayToday } from '../lib/birthdayUtils';
import BanPage from '../components/BanPage';
import KickPage from '../components/KickPage';

interface Stream {
  id: string;
  title: string;
  streamer: string;
  viewers: number;
  thumbnail: string;
  isLive: boolean;
}

interface User {
  id: string;
  username: string;
  level: number;
  coins: number;
  avatar: string;
  isNew?: boolean;
}

const NeonParticle: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  return (
    <div
      className="absolute w-2 h-2 rounded-full animate-float"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 10px ${color}`,
        animationDelay: `${delay}s`
      }}
    />
  );
};

export default function Home() {
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  const [newUsers, setNewUsers] = useState<any[]>([]);
  const [loadingNewUsers, setLoadingNewUsers] = useState(false);
  const [topTrollers, setTopTrollers] = useState<any[]>([]);
  const [loadingTop, setLoadingTop] = useState(false);
  const [homeFeature, setHomeFeature] = useState<any>(null);
  const [cycleTimeLeft, setCycleTimeLeft] = useState<number>(0);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Dev mode test displays
  const [showBanPage, setShowBanPage] = useState(false);
  const [showKickPage, setShowKickPage] = useState(false);
  const isDev = import.meta.env.DEV;

  // Check for seller application submission success
  useEffect(() => {
    if (location.state?.submitted === 'seller') {
      toast.success('✅ Seller application submitted successfully! Please wait for admin approval.', {
        duration: 6000,
        description: 'You will receive a notification when your application is reviewed.'
      });
      // Clear the state to prevent re-showing on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const loadLive = async (showLoading = true) => {
      if (showLoading) setLoadingLive(true);
      try {
        const { data, error } = await supabase
          .from('streams')
          .select(`
            id,
            title,
            category,
            current_viewers,
            is_live,
            room_name,
            livekit_url,
            start_time,
            broadcaster_id,
            thumbnail_url,
            user_profiles!broadcaster_id (
              username,
              avatar_url,
              date_of_birth
            )
          `)
          .eq('is_live', true)
          .order('start_time', { ascending: false });
        if (error) throw error;
        
        // Sort: birthday users first, then by start_time
        const today = new Date()
        const sortedStreams = (data || []).sort((a, b) => {
          const aBirthday = a.user_profiles?.date_of_birth
          const bBirthday = b.user_profiles?.date_of_birth
          
          const aIsBirthday = aBirthday ? 
            new Date(aBirthday).getMonth() === today.getMonth() && 
            new Date(aBirthday).getDate() === today.getDate() : false
          const bIsBirthday = bBirthday ? 
            new Date(bBirthday).getMonth() === today.getMonth() && 
            new Date(bBirthday).getDate() === today.getDate() : false
          
          if (aIsBirthday && !bIsBirthday) return -1
          if (!aIsBirthday && bIsBirthday) return 1
          return 0 // Keep original order for non-birthday users
        })
        
        setLiveStreams(sortedStreams);
      } catch (e) {
        console.error(e);
        if (showLoading) toast.error('Failed to load live streams');
      } finally {
        if (showLoading) setLoadingLive(false);
      }
    };
    loadLive(true);

    // Auto-refresh every 10 seconds (background, no loading state)
    const interval = setInterval(() => {
      loadLive(false);
    }, 10000);

    // Real-time subscription - reload when streams are created, updated, or deleted
    // This ensures streams disappear immediately when is_live becomes false
    const channel = supabase
      .channel('home-live-streams')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'streams',
        filter: 'is_live=eq.true' // Only listen to changes on live streams
      }, (payload) => {
        // Reload live streams list when any change occurs
        // If is_live becomes false, the filter will exclude it on next load
        loadLive(false);
      })
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const loadNewUsers = async (showLoading = true) => {
      if (showLoading) setLoadingNewUsers(true);
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, tier, free_coin_balance, paid_coin_balance, created_at, role')
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (error) {
          console.error('Error loading new users:', error);
          throw error;
        }
        
        // Separate admin and regular users
        const adminUser = (data || []).find(user => user.role === 'admin');
        
        // Show ALL users (no filtering by avatar or profile completion)
        // Only exclude obvious test/demo accounts
        const realUsers = (data || []).filter(user => {
          if (user.role === 'admin') return false; // Admin handled separately
          
          const username = (user.username || '').toLowerCase();
          
          // Only exclude test/demo users
          const isRealUser = !username.includes('test') &&
                            !username.includes('demo') &&
                            !username.includes('mock');
          
          return isRealUser;
        });
        
        // Combine: admin first, then all real users (up to 7 more for total of 8)
        const displayUsers = adminUser 
          ? [adminUser, ...realUsers.slice(0, 7)]
          : realUsers.slice(0, 8);
        
        console.log(`Loaded ${displayUsers.length} users (all profiles shown)`);
        setNewUsers(displayUsers);
      } catch (e: any) {
        console.error('Failed to load new users:', e);
        // Don't show error toast on initial load, just log it
        // toast.error('Failed to load new users');
        setNewUsers([]); // Set empty array instead of leaving it undefined
      } finally {
        if (showLoading) setLoadingNewUsers(false);
      }
    };
    loadNewUsers(true);

    // Auto-refresh every 15 seconds (background, no loading state)
    const interval = setInterval(() => {
      loadNewUsers(false);
    }, 15000);

    // Real-time subscription for new user inserts
    const channel = supabase
      .channel('home-new-users')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_profiles' }, () => {
        loadNewUsers(false);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_profiles' }, () => {
        loadNewUsers(false);
      })
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const loadTopTrollers = async (showLoading = true) => {
      if (showLoading) setLoadingTop(true);
      try {
        const { data, error } = await supabase
          .from('coin_transactions')
          .select(`
            id,
            amount,
            type,
            created_at,
            user: user_id (
              id,
              username,
              avatar_url
            )
          `)
          .eq('type', 'gift_received')
          .order('created_at', { ascending: false })
          .limit(1000);
        if (error) throw error;

        const totals: Record<string, { user_id: string; total: number; username?: string; avatar_url?: string }> = {};
        for (const tx of (data || []) as any[]) {
          const uid = tx.user_id;
          const amt = Number(tx.amount || 0);
          if (!totals[uid]) {
            totals[uid] = {
              user_id: uid,
              total: 0,
              username: tx.user?.username,
              avatar_url: tx.user?.avatar_url,
            };
          }
          if (amt > 0) totals[uid].total += amt;
        }

        const list = Object.values(totals)
          .filter((u) => {
            const name = (u.username || '').toLowerCase();
            const real = !name.includes('test') && !name.includes('demo') && !name.includes('mock');
            return real && u.total > 0;
          })
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);

        setTopTrollers(list);
      } catch (e) {
        console.error('Failed to load top trollers', e);
        if (showLoading) toast.error('Failed to load leaderboard');
        setTopTrollers([]);
      } finally {
        if (showLoading) setLoadingTop(false);
      }
    };

    loadTopTrollers(true);

    const interval = setInterval(() => {
      loadTopTrollers(false);
    }, 20000);

    const channel = supabase
      .channel('home-top-trollers')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coin_transactions' }, () => {
        loadTopTrollers(false);
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const loadHomeFeature = async () => {
      try {
        const { data, error } = await supabase
          .from('home_feature_cycles')
          .select(`
            id,
            end_time,
            total_spent_coins,
            winner_user_id,
            user_profiles!winner_user_id (
              username,
              avatar_url
            )
          `)
          .order('start_time', { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setHomeFeature(data);
        }
      } catch (e) {
        console.error('Failed to load home feature', e);
      }
    };

    loadHomeFeature();

    // Real-time subscription for home feature updates
    const channel = supabase
      .channel('home-feature-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'home_feature_cycles' }, () => {
        loadHomeFeature();
      })
      .subscribe();

    // Update countdown every second
    const interval = setInterval(() => {
      if (homeFeature?.end_time) {
        const now = new Date().getTime();
        const end = new Date(homeFeature.end_time).getTime();
        const left = Math.max(0, end - now);
        setCycleTimeLeft(Math.floor(left / 1000));
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [homeFeature?.end_time]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white relative overflow-hidden">
      
      {/* Floating Neon Particles */}
      <div className="absolute inset-0 pointer-events-none">
        <NeonParticle delay={0} color="#00FFFF" />
        <NeonParticle delay={2} color="#FF00C8" />
        <NeonParticle delay={4} color="#00B8FF" />
        <NeonParticle delay={1} color="#FFC93C" />
        <NeonParticle delay={3} color="#FF00C8" />
        <NeonParticle delay={5} color="#00FFFF" />
      </div>

      {/* Light Streaks Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-1 h-full bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent transform rotate-12 animate-pulse" />
        <div className="absolute top-0 right-1/3 w-1 h-full bg-gradient-to-b from-transparent via-pink-400/20 to-transparent transform -rotate-12 animate-pulse" />
        <div className="absolute top-1/3 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-400/20 to-transparent animate-pulse" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Hero Banner */}
        <div className="mb-12 animate-fade-in-up">
          <div className="relative bg-gradient-to-r from-purple-600/80 via-pink-600/80 to-magenta-600/80 rounded-3xl p-12 overflow-hidden border border-[#FFD700] shadow-[0_0_18px_rgba(255,215,0,0.7)]">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 via-pink-400/20 to-purple-400/20 animate-pulse" />
            <div className="absolute inset-0">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 animate-pulse" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 animate-pulse" />
            </div>

            <div className="relative z-10 text-center">
              <div className="flex justify-center mb-6">
                <div className="animate-spin-slow">
                  <Crown className="text-yellow-400" size={64} style={{ filter: 'drop-shadow(0 0 20px #FFC93C)' }} />
                </div>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                MAI Introduces Troll City
              </h1>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                A new line of reinventions. Join the live experience, send gifts, and be a part of the chaos.
              </p>
            </div>
          </div>
        </div>

        {/* Home Feature King */}
        <div className="mb-12 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="bg-gradient-to-r from-yellow-600/80 via-orange-600/80 to-red-600/80 rounded-3xl p-8 border border-yellow-400 shadow-[0_0_18px_rgba(255,215,0,0.7)]">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <Crown className="text-yellow-400 animate-bounce" size={48} style={{ filter: 'drop-shadow(0 0 20px #FFC93C)' }} />
              </div>
              <h2 className="text-2xl font-bold mb-2">30-Minute King of the Home Page</h2>
              {homeFeature?.user_profiles ? (
                <div className="flex items-center justify-center gap-4 mb-4">
                  <img
                    src={homeFeature.user_profiles.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${homeFeature.user_profiles.username}`}
                    className="w-12 h-12 rounded-full border-2 border-yellow-400"
                  />
                  <div>
                    <p className="text-lg font-bold">{homeFeature.user_profiles.username}</p>
                    <p className="text-sm text-yellow-300">Current King!</p>
                  </div>
                </div>
              ) : (
                <p className="text-lg mb-4 text-yellow-300">Crown Available - Spend to Win!</p>
              )}
              <div className="flex justify-center items-center gap-4 mb-4">
                <div className="text-center">
                  <p className="text-sm text-gray-300">Time Left</p>
                  <p className="text-xl font-bold text-white">{formatTime(cycleTimeLeft)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-300">Total Spent</p>
                  <p className="text-xl font-bold text-green-400">{(homeFeature?.total_spent_coins || 0).toLocaleString()}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300">Spend coins to become the featured King!</p>
            </div>
          </div>
        </div>

        {/* Live Now */}
        <div className="mb-12 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <h2 className="text-3xl font-bold text-white">Live Now</h2>
              </div>
              <span className="bg-gradient-to-r from-cyan-400/20 to-pink-400/20 text-cyan-400 px-3 py-1 rounded-full text-sm font-medium border border-[#FFD700] shadow-[0_0_12px_rgba(255,215,0,0.5)]">
                Auto-updating
              </span>
            </div>
          </div>

          {loadingLive ? (
            <div className="text-gray-400">Loading live streams…</div>
          ) : liveStreams.length === 0 ? (
            <div className="bg-[#111] p-10 rounded-xl border border-gray-700 text-center">
              <p className="text-gray-400 text-lg">No one is live right now…</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveStreams.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/stream/${s.id}`)}
                  className="relative rounded-xl overflow-hidden shadow-lg bg-[#111]/70 border border-purple-500/30 hover:shadow-purple-500/50 transition-all duration-300"
                >
                  {s.thumbnail_url ? (
                    <img
                      src={s.thumbnail_url}
                      className="w-full h-48 object-cover"
                      alt="Stream preview"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-purple-900 to-black flex items-center justify-center text-gray-500">
                      🎥 No preview
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-white">LIVE NOW</span>
                    {s.user_profiles?.date_of_birth && isBirthdayToday(s.user_profiles.date_of_birth) && (
                      <div className="ml-2 bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-500 rounded-full px-3 py-1 flex items-center gap-1 animate-pulse">
                        <PartyPopper className="w-3 h-3 text-white" />
                        <span className="text-xs font-bold text-white">BIRTHDAY!</span>
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-0 left-0 w-full p-3 bg-black/70 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold">{s.title || 'Untitled Stream'}</p>
                      <p className="text-xs text-gray-300 flex items-center gap-1">
                        <img src={s.user_profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.user_profiles?.username || 'troll'}`} className="w-5 h-5 rounded-full" />
                        {s.user_profiles?.username || 'Unknown'}
                      </p>
                    </div>
                    <span className="text-xs text-red-400">{s.current_viewers || 0} viewing</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Top Trollers */}
        <div className="mb-12 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] rounded-2xl p-8 border border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.6)]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Crown className="text-yellow-400" size={32} style={{ filter: 'drop-shadow(0 0 10px #FFC93C)' }} />
                <h2 className="text-3xl font-bold text-white">Top Trollers</h2>
              </div>
              <span className="text-xs text-gray-300">Auto-updating</span>
            </div>

            {loadingTop ? (
              <div className="p-6 text-center text-gray-400">Loading leaderboard…</div>
            ) : topTrollers.length === 0 ? (
              <div className="p-6 text-center text-gray-400">No earners yet</div>
            ) : (
              <div className="space-y-3">
                {topTrollers.map((u, idx) => (
                  <button
                    key={u.user_id}
                    onClick={() => {
                      const route = u.username ? `/profile/${u.username}` : `/profile/id/${u.user_id}`;
                      navigate(route);
                    }}
                    className="w-full flex items-center gap-3 bg-[#121212] border border-[#2C2C2C] rounded-xl p-3 hover:border-yellow-400/50 hover:shadow-[0_0_18px_rgba(255,215,0,0.25)] transition"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-yellow-400/50">
                      <img src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username || 'troller'}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-400/40 text-yellow-300">#{idx + 1}</span>
                        <span className="font-semibold">{u.username || 'Unknown'}</span>
                      </div>
                    </div>
                    <div className="text-sm text-yellow-300 font-bold">{u.total.toLocaleString()} coins</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* New Trollerz */}
        <div className="mb-12 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
          <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] rounded-2xl p-8 border border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.6)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-3xl">🆕</div>
              <h2 className="text-3xl font-bold text-white">New Trollerz</h2>
            </div>
            {loadingNewUsers ? (
              <div className="p-6 text-center text-gray-400">Loading...</div>
            ) : newUsers.length === 0 ? (
              <div className="col-span-full p-6 text-center text-gray-400">No new users yet</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {newUsers.map((user) => {
                  const displayName = user.username || 'User';
                  const isAdmin = user.role === 'admin';
                  // Use username if available, otherwise use user ID
                  const profileRoute = user.username ? `/profile/${user.username}` : `/profile/id/${user.id}`;
                  console.log('Rendering user:', { id: user.id, username: user.username, displayName, profileRoute, role: user.role });
                  
                  return (
                    <div
                      key={user.id}
                      onClick={() => navigate(profileRoute)}
                      className={`bg-gradient-to-br from-[#2A2A2A] to-[#1A1A1A] rounded-xl p-4 border transition-all duration-300 cursor-pointer hover:scale-105 ${
                        isAdmin 
                          ? 'border-yellow-400/50 hover:border-yellow-400 hover:shadow-[0_0_20px_rgba(255,215,0,0.5)]'
                          : 'border-cyan-500/30 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(0,255,255,0.3)]'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                          <img
                            src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`}
                            alt={displayName}
                            className={`w-20 h-20 rounded-full border-2 ${
                              isAdmin 
                                ? 'border-yellow-400 shadow-[0_0_15px_rgba(255,215,0,0.5)]'
                                : 'border-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.5)]'
                            }`}
                          />
                          {isAdmin ? (
                            <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-bold shadow-lg flex items-center gap-1">
                              <Crown size={12} />
                              ADMIN
                            </div>
                          ) : (
                            <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                              NEW
                            </div>
                          )}
                        </div>
                        <div className="text-center">
                          <h3 className="font-bold text-white text-lg">
                            {displayName}
                          </h3>
                        <p className="text-sm text-gray-400">{user.tier || 'Bronze'}</p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <span className="text-yellow-400 text-sm">
                            🪙 {(user.free_coin_balance || 0) + (user.paid_coin_balance || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
