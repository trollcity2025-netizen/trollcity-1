import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useCoins } from '@/lib/hooks/useCoins';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import UserNameWithAge from '@/components/UserNameWithAge';
import { toast } from 'sonner';
import { Play, Upload, Star, Trophy, Video, AlertCircle } from 'lucide-react';

interface Audition {
  id: string;
  user_id: string;
  talent_name: string;
  category: string;
  description: string;
  clip_url?: string;
  stream_url?: string;
  status: string;
  total_votes: number;
  user?: {
    username: string;
    avatar_url: string;
    created_at?: string;
  };
}

export default function MaiTalentPage() {
  const { profile } = useAuthStore();
  const { spendCoins } = useCoins();
  const [auditions, setAuditions] = useState<Audition[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'watch' | 'audition' | 'leaderboard' | 'dashboard'>('watch');
  const [isJudge, setIsJudge] = useState(false);

  const [isStaff, setIsStaff] = useState(false);

  // Form State
  const [talentName, setTalentName] = useState('');
  const [category, setCategory] = useState('singing');
  const [description, setDescription] = useState('');
  const [clipUrl, setClipUrl] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);
  const [showActive, setShowActive] = useState(false);

  // Access Control: Under Construction for non-admins
  // Allow public access now that feature is launching
  const isAdmin = true; // profile?.role === 'admin' || profile?.is_admin === true;

  // Function definitions must come before useEffect
  const fetchShowStatus = async () => {
    try {
      const { data, error: _error } = await supabase
        .from('mai_talent_config')
        .select('is_live')
        .eq('id', 1)
        .single();
      
      if (data) {
        setShowActive(data.is_live);
      }
    } catch (err) {
      console.error('Error fetching show status:', err);
    }
  };

  const toggleShowStatus = async () => {
    try {
      const newState = !showActive;
      const { error } = await supabase
        .from('mai_talent_config')
        .update({ is_live: newState, updated_by: profile?.id })
        .eq('id', 1);

      if (error) throw error;
      
      setShowActive(newState);
      toast.success(newState ? 'Show is now LIVE!' : 'Show has ended');
    } catch (err) {
      console.error('Error toggling show status:', err);
      toast.error('Failed to update show status');
    }
  };

  const checkStaffStatus = async () => {
    if (!profile) return;
    if (profile.role === 'admin' || profile.role === 'moderator' || profile.role === 'troll_officer' || profile.role === 'lead_troll_officer' || profile.is_admin) {
      setIsStaff(true);
      setIsJudge(true);
      return;
    }
    
    const { data } = await supabase
      .from('mai_talent_judges')
      .select('id')
      .eq('user_id', profile.id)
      .maybeSingle();
      
    setIsJudge(!!data);
  };

  const fetchAuditions = async () => {
    setLoading(true);
    try {
      let finalData = null;

      // 1. Try fetching from the View first (Preferred)
      let viewData = null;
      let viewError = null;

      try {
        const result = await supabase
          .from('mai_talent_leaderboard')
          .select('*')
          .order('total_votes', { ascending: false });
        viewData = result.data;
        viewError = result.error;
      } catch {
        console.warn('View access failed, falling back to table');
      }

      if (!viewError && viewData) {
        finalData = viewData;
      } else {
        // 2. Fallback: Try raw table
        console.warn('mai_talent_leaderboard view missing or error. Attempting fallback to raw table.');
        
        const { data: rawData, error: rawError } = await supabase
          .from('mai_talent_auditions')
          .select(`
            *,
            user:user_profiles!mai_talent_auditions_user_id_fkey(username, avatar_url, created_at)
          `)
          .in('status', ['approved', 'featured']);
        
        if (rawError) {
           // If raw table also missing, feature is not deployed.
           if (rawError.code === '42P01' || rawError.message?.includes('does not exist')) {
              console.error('CRITICAL: mai_talent_auditions table missing. Feature unavailable.');
              setAuditions([]); // Empty state
              setFeatureUnavailable(true); // Stop polling
              return; // Stop here, do not throw
           }
           throw rawError;
        }
        
        // Manually calculate votes if needed (mock for now if table empty)
        finalData = rawData ? rawData.map(a => ({
          ...a,
          total_votes: 0 // Fetch votes separately if needed, or 0
        })) : [];
      }

      setAuditions((finalData || []) as Audition[]);
    } catch (err) {
      console.error('Error fetching auditions:', err);
      // Do NOT show toast on every poll failure to avoid spam
    } finally {
      setLoading(false);
    }
  };

  // Hooks must be called unconditionally at the top level
  useEffect(() => {
    fetchAuditions();
    checkStaffStatus();
    fetchShowStatus();

    // Polling instead of Realtime for leaderboard to reduce DB load
    const interval = setInterval(() => {
      if (!featureUnavailable) {
        fetchAuditions();
      }
    }, 15000); // 15 seconds

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, featureUnavailable]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-purple-900/20 p-8 rounded-3xl border border-purple-500/30 max-w-md w-full backdrop-blur-sm">
          <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Star className="w-10 h-10 text-purple-400 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black text-white mb-4">MAI TALENT</h1>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-200 rounded-full text-sm font-bold mb-6 border border-yellow-500/20">
            <AlertCircle size={16} />
            UNDER CONSTRUCTION
          </div>
          <p className="text-slate-400 mb-8">
            We are currently building the ultimate talent showcase platform. 
            Check back soon to show off your skills!
          </p>
          <Button 
            onClick={() => window.history.back()}
            variant="outline"
            className="border-white/10 hover:bg-white/5 text-white w-full"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const handleAuditionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      toast.error('You must be logged in to audition');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('mai_talent_auditions').insert({
        user_id: profile.id,
        talent_name: talentName,
        category,
        description,
        clip_url: clipUrl,
        stream_url: streamUrl,
        status: 'pending' // Default to pending
      });

      if (error) throw error;

      toast.success('Audition submitted successfully! Waiting for approval.');
      setTalentName('');
      setDescription('');
      setClipUrl('');
      setStreamUrl('');
      setActiveTab('watch'); // Redirect to watch
    } catch (err: any) {
      console.error('Error submitting audition:', err);
      toast.error(err.message || 'Failed to submit audition');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (auditionId: string, amount: number) => {
    if (!profile) {
      toast.error('Please login to vote');
      return;
    }

    try {
      // 1. Spend Coins
      const success = await spendCoins({
        senderId: profile.id,
        amount,
        source: 'mai_talent_vote',
        item: auditionId
      });

      if (!success) return; // spendCoins handles toast error

      // 2. Record Vote
      const { error } = await supabase.from('mai_talent_votes').insert({
        audition_id: auditionId,
        voter_id: profile.id,
        amount
      });

      if (error) throw error;

      toast.success(`Voted ${amount} coins!`);
      fetchAuditions(); // Refresh leaderboard
    } catch (err) {
      console.error('Error voting:', err);
      toast.error('Failed to record vote');
    }
  };

  const handleAdminAction = async (auditionId: string, action: 'approve' | 'reject' | 'feature') => {
    try {
      const status = action === 'approve' ? 'approved' : action === 'feature' ? 'featured' : 'rejected';
      const { error } = await supabase
        .from('mai_talent_auditions')
        .update({ status })
        .eq('id', auditionId);

      if (error) throw error;
      toast.success(`Audition ${status}`);
      fetchAuditions();
    } catch (err) {
      console.error('Admin action failed:', err);
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20 overflow-y-auto">
      {/* Hero Section */}
      <div className="relative h-[400px] w-full bg-gradient-to-b from-purple-900 via-slate-900 to-slate-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('/assets/textures/rockn.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
        
        <div className="relative z-10 text-center space-y-6 max-w-3xl px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-sm font-medium mb-2">
            <Star className="w-4 h-4" /> Mai Talent Competition
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-cyan-400 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]">
            MAI TALENT
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Showcase your skills, win Troll Coins, and become the next star of Troll City. 
            Audition now or vote for your favorites!
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
            <Button 
              size="lg" 
              className="bg-pink-600 hover:bg-pink-700 text-white font-bold px-8 shadow-[0_0_20px_rgba(236,72,153,0.4)]"
              onClick={() => setActiveTab('audition')}
            >
              <Upload className="w-5 h-5 mr-2" /> Audition Now
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-950/30 font-bold px-8"
              onClick={() => setActiveTab('watch')}
            >
              <Play className="w-5 h-5 mr-2" /> Watch Performances
            </Button>
            <Button 
              size="lg" 
              variant="secondary"
              className="bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 border border-purple-500/20 font-bold px-8"
              onClick={() => setActiveTab('leaderboard')}
            >
              <Trophy className="w-5 h-5 mr-2" /> Leaderboard
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-10 relative z-20">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md p-2 rounded-2xl border border-white/10 w-fit mx-auto mb-10 shadow-xl">
          <button 
            onClick={() => setActiveTab('watch')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'watch' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            Watch
          </button>
          <button 
            onClick={() => setActiveTab('audition')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'audition' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            Audition
          </button>
          <button 
            onClick={() => setActiveTab('leaderboard')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'leaderboard' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            Leaderboard
          </button>
          {isStaff && (
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              Staff Dashboard
            </button>
          )}
        </div>

        {/* WATCH SECTION */}
        {activeTab === 'watch' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Video className="text-cyan-400" /> Featured Performances
            </h2>
            
            {loading ? (
              <div className="text-center py-20 text-slate-500">Loading performances...</div>
            ) : auditions.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-white/5">
                <p className="text-slate-400 text-lg">No approved auditions yet.</p>
                <Button variant="link" onClick={() => setActiveTab('audition')} className="text-pink-400">
                  Be the first to audition!
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {auditions.map((audition) => (
                  <Card key={audition.id} className="bg-slate-900/80 border-white/10 overflow-hidden hover:border-pink-500/30 transition-all group">
                    <div className="aspect-video bg-black relative">
                      {audition.stream_url ? (
                        <iframe 
                          src={audition.stream_url.replace('watch?v=', 'embed/')} 
                          className="w-full h-full" 
                          allowFullScreen
                          title={audition.talent_name}
                        />
                      ) : audition.clip_url ? (
                          <video src={audition.clip_url} controls className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-950">
                          <Video size={48} />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-white border border-white/10">
                        {audition.category}
                      </div>
                    </div>
                    
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-lg text-white group-hover:text-pink-400 transition-colors">{audition.talent_name}</h3>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <img src={audition.user?.avatar_url || 'https://ui-avatars.com/api/?background=random'} className="w-5 h-5 rounded-full" />
                            <UserNameWithAge 
                              user={{
                                username: audition.user?.username || 'Unknown',
                                id: audition.user_id,
                                created_at: audition.user?.created_at
                              }}
                              className="font-medium"
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Total Support</div>
                          <div className="font-bold text-yellow-400 flex items-center justify-end gap-1">
                            <Trophy size={14} /> {audition.total_votes?.toLocaleString() || 0}
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-slate-400 mb-6 line-clamp-2">{audition.description}</p>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <Button 
                          size="sm" 
                          className="bg-white/5 hover:bg-yellow-500/20 hover:text-yellow-400 border border-white/10"
                          onClick={() => handleVote(audition.id, 10)}
                        >
                          <Star size={14} className="mr-1" /> 10
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-white/5 hover:bg-yellow-500/20 hover:text-yellow-400 border border-white/10"
                          onClick={() => handleVote(audition.id, 50)}
                        >
                          <Star size={14} className="mr-1" /> 50
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white border-none"
                          onClick={() => handleVote(audition.id, 100)}
                        >
                          <Trophy size={14} className="mr-1" /> 100
                        </Button>
                      </div>

                      {isJudge && (
                        <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
                          <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleAdminAction(audition.id, 'reject')}>Reject</Button>
                          <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleAdminAction(audition.id, 'feature')}>Feature</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AUDITION SECTION */}
        {activeTab === 'audition' && (
          <div className="max-w-2xl mx-auto">
             <Card className="bg-slate-900/80 border-white/10">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Submit Your Audition</CardTitle>
                <CardDescription>Show us what you got! Winners get massive coin prizes and fame.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAuditionSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Stage Name</label>
                    <input 
                      type="text" 
                      value={talentName}
                      onChange={e => setTalentName(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                      placeholder="e.g. The Troll Magician"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Category</label>
                    <select 
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                    >
                      <option value="singing">Singing</option>
                      <option value="comedy">Comedy</option>
                      <option value="magic">Magic</option>
                      <option value="gaming">Gaming Skills</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Description</label>
                    <textarea 
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none h-24"
                      placeholder="Tell us about your performance..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Video Link (YouTube/Twitch) or Clip URL</label>
                    <input 
                      type="url" 
                      value={streamUrl || clipUrl}
                      onChange={e => setStreamUrl(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                      placeholder="https://youtube.com/..."
                    />
                    <p className="text-xs text-slate-500">Paste a link to your performance video.</p>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-6 text-lg"
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : 'Submit Audition'}
                  </Button>
                </form>
              </CardContent>
             </Card>
          </div>
        )}

        {/* LEADERBOARD SECTION */}
        {activeTab === 'leaderboard' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Trophy className="text-yellow-400" /> Current Rankings
            </h2>
            
            <div className="bg-slate-900/80 rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="p-4">Rank</th>
                    <th className="p-4">Performer</th>
                    <th className="p-4">Category</th>
                    <th className="p-4 text-right">Votes</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {auditions.map((audition, index) => (
                    <tr key={audition.id} className="hover:bg-white/5">
                      <td className="p-4">
                        <span className={`font-bold ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-slate-400'}`}>
                          #{index + 1}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img src={audition.user?.avatar_url || 'https://ui-avatars.com/api/?background=random'} className="w-8 h-8 rounded-full" />
                          <div>
                            <div className="font-bold text-white">{audition.talent_name}</div>
                            <UserNameWithAge 
                              user={{
                                username: audition.user?.username || 'Unknown',
                                id: audition.user_id,
                                created_at: audition.user?.created_at
                              }}
                              className="text-xs text-slate-500"
                              prefix="@"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 text-xs font-medium">{audition.category}</span>
                      </td>
                      <td className="p-4 text-right font-bold text-yellow-400">{audition.total_votes?.toLocaleString() || 0}</td>
                      <td className="p-4 text-right">
                        <Button size="sm" onClick={() => handleVote(audition.id, 10)} className="bg-purple-600 hover:bg-purple-700">
                          Vote 10
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* STAFF DASHBOARD */}
        {activeTab === 'dashboard' && isStaff && (
          <div className="max-w-4xl mx-auto space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-slate-900/80 border-white/10">
                   <CardHeader>
                     <CardTitle className="text-white">Live Show Control</CardTitle>
                     <CardDescription>Manage the active talent show state</CardDescription>
                   </CardHeader>
                   <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-slate-300">Show Status:</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${showActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                           {showActive ? 'LIVE' : 'OFFLINE'}
                        </span>
                      </div>
                      <Button 
                        onClick={toggleShowStatus}
                        className={`w-full font-bold ${showActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                      >
                        {showActive ? 'End Show' : 'Start Live Show'}
                      </Button>
                   </CardContent>
                </Card>
                
                <Card className="bg-slate-900/80 border-white/10">
                   <CardHeader>
                     <CardTitle className="text-white">Quick Actions</CardTitle>
                     <CardDescription>Manage auditions and users</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-2">
                      <Button variant="outline" className="w-full border-white/10 text-white hover:bg-white/5 justify-start">
                         <Star className="w-4 h-4 mr-2 text-yellow-400" /> Review Pending Auditions
                      </Button>
                      <Button variant="outline" className="w-full border-white/10 text-white hover:bg-white/5 justify-start">
                         <Trophy className="w-4 h-4 mr-2 text-purple-400" /> Reset Leaderboard
                      </Button>
                   </CardContent>
                </Card>
             </div>

             <Card className="bg-slate-900/80 border-white/10">
               <CardHeader>
                 <CardTitle className="text-white">Pending Auditions</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="text-center py-8 text-slate-500">
                   No pending auditions found.
                 </div>
               </CardContent>
             </Card>
          </div>
        )}

      </div>
    </div>
  );
}
