import React, { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { usePresidentSystem } from '@/hooks/usePresidentSystem';
import PresidentBadge from '@/components/president/PresidentBadge';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Vote,
  Calendar,
  Lock,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import SecretaryDashboard from './president/SecretaryDashboard';

export default function PresidentPage() {
  console.log('PresidentPage mounting...');
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  console.log('PresidentPage auth:', { user: !!user, profileRole: profile?.role, isAdmin: profile?.is_admin });

  const { 
    currentPresident, 
    currentVP, 
    currentElection, 
    voteForCandidate, 
    signupCandidate,
    loading 
  } = usePresidentSystem();
  
  const [slogan, setSlogan] = useState('');

  // Access Control
  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
  const isPresident = profile?.role === 'president';
  const isSecretary = profile?.role === 'secretary';

  // Show loading state while profile is loading
  if (user && !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto border border-slate-800">
            <Lock className="w-10 h-10 text-slate-500" />
          </div>
          <div>
             <h1 className="text-3xl font-bold mb-2">Restricted Access</h1>
             <p className="text-slate-400">
               You must be a citizen of Troll City to participate in elections.
             </p>
          </div>
          <button 
            onClick={() => navigate('/auth')} 
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-colors"
          >
            Login to Vote
          </button>
        </div>
      </div>
    );
  }

  const handleSignup = async () => {
    if (!currentElection) return;
    if (!slogan.trim()) {
      toast.error('Please enter a campaign slogan');
      return;
    }
    await signupCandidate(currentElection.id, slogan, '', '');
    setSlogan('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white pb-20">
      {/* Hero Section - Current Administration */}
      <div className="relative overflow-hidden bg-gradient-to-b from-purple-900/40 to-slate-950 pt-10 pb-20 px-4">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />

        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 mb-4">
            <PresidentBadge size="sm" />
            <span className="font-bold tracking-wide uppercase text-sm">Official Troll City Government</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 drop-shadow-[0_0_30px_rgba(234,179,8,0.3)]">
            Office of the President
          </h1>

          {/* Current President Display */}
          <div className="grid md:grid-cols-2 gap-8 mt-12">
            {/* President Card */}
            <div className="bg-gradient-to-br from-yellow-900/20 to-slate-900/80 backdrop-blur-xl border border-yellow-500/30 p-8 rounded-3xl relative overflow-hidden group hover:border-yellow-500/50 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <PresidentBadge size="lg" />
              </div>

              <div className="flex flex-col items-center">
                <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-yellow-600 to-yellow-300 mb-6 shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                  <img
                    src={currentPresident?.avatar_url || `https://ui-avatars.com/api/?name=${currentPresident?.username || 'President'}`}
                    alt="President"
                    className="w-full h-full rounded-full object-cover border-4 border-slate-900"
                  />
                </div>

                <h2 className="text-2xl font-bold text-yellow-100 mb-1">
                  {currentPresident?.username || 'Vacant'}
                </h2>
                <p className="text-yellow-500 font-medium tracking-wider text-sm uppercase mb-6">
                  President
                </p>

                {isPresident && (
                  <button
                    onClick={() => navigate('/president/secretary')}
                    className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl shadow-lg shadow-yellow-500/20 transition-all active:scale-95 flex items-center gap-2"
                  >
                    Manage Office <ChevronRight size={16} />
                  </button>
                )}

                {(isAdmin || isSecretary) && (
                  <button
                    onClick={() => navigate('/president/secretary')}
                    className="mt-3 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all active:scale-95 flex items-center gap-2"
                  >
                    Election Commission <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* VP Card */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 p-8 rounded-3xl relative overflow-hidden flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-slate-800 mb-4 overflow-hidden">
                {currentVP ? (
                    <img
                    src={currentVP.appointee?.avatar_url || `https://ui-avatars.com/api/?name=${currentVP.appointee?.username}`}
                    alt="VP"
                    className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <Users size={32} />
                    </div>
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-200">
                {currentVP?.appointee?.username || 'Vacant'}
              </h3>
              <p className="text-slate-500 font-medium text-sm uppercase">
                Vice President
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Election Center or President Dashboard */}
      {isPresident ? (
        <div className="min-h-screen">
          <SecretaryDashboard />
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 mt-8 relative z-20">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Vote className="text-purple-400" />
                  Election Center
                </h2>
                <p className="text-slate-400 mt-2">
                  Status: <span className="text-white font-medium capitalize">{currentElection?.status || 'No Active Election'}</span>
                </p>
              </div>
              {currentElection?.status === 'open' && (
                 <div className="px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-sm font-bold flex items-center gap-2 animate-pulse">
                   <div className="w-2 h-2 bg-green-400 rounded-full" />
                   Polls Open
                 </div>
              )}
            </div>

            {currentElection?.status === 'open' ? (
              <div className="space-y-8">
                 {/* Candidates Grid */}
                 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {currentElection.candidates?.map((candidate) => (
                     <div key={candidate.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-purple-500/50 transition-colors">
                       <div className="flex items-center gap-4 mb-4">
                         <img
                           src={candidate.avatar_url || `https://ui-avatars.com/api/?name=${candidate.username}`}
                           alt={candidate.username}
                           className="w-12 h-12 rounded-full bg-slate-700"
                         />
                         <div>
                           <h4 className="font-bold text-white">{candidate.username}</h4>
                           <p className="text-xs text-slate-400">Candidate</p>
                         </div>
                       </div>

                       <div className="bg-slate-950/50 p-3 rounded-xl mb-4 text-sm text-slate-300 italic border border-slate-800">
                         &quot;{candidate.slogan || 'No slogan provided'}&quot;
                       </div>

                       <div className="flex items-center justify-between mt-auto">
                          <div className="text-sm font-medium text-slate-400">
                              {candidate.vote_count} Votes
                          </div>
                          <button
                            onClick={() => voteForCandidate(candidate.id)}
                            disabled={loading}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Vote
                          </button>
                       </div>
                     </div>
                   ))}
                 </div>

                 {/* Candidate Signup (if eligible) */}
                 {/* Logic to check if user is already a candidate */}
                 {!currentElection.candidates?.some(c => c.user_id === user?.id) && (
                   <div className="mt-8 p-6 bg-purple-900/10 border border-purple-500/20 rounded-2xl">
                     <h3 className="text-xl font-bold text-white mb-4">Run for President</h3>
                     <div className="flex gap-4">
                       <input
                         type="text"
                         value={slogan}
                         onChange={(e) => setSlogan(e.target.value)}
                         placeholder="Enter your campaign slogan..."
                         className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                       />
                       <button
                         onClick={handleSignup}
                         disabled={loading}
                         className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                       >
                         Register
                       </button>
                     </div>
                     <p className="text-xs text-slate-500 mt-2">
                       * Requirements: Level 10+, No active warrants.
                     </p>
                   </div>
                 )}
              </div>
            ) : (
              <div className="text-center py-20 text-slate-500">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <h3 className="text-xl font-medium text-slate-300 mb-2">No Active Election</h3>
                <p>The next election cycle has not started yet.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
