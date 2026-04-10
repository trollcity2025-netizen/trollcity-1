import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Heart, Eye, RefreshCw, Settings, Sparkles, UserPlus, Grid3X3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { TMButton } from '../components/trollmatch/TMButton';
import { TMOnboarding } from '../components/trollmatch/TMOnboarding';
import { TMMatchCard } from '../components/trollmatch/TMMatchCard';
import { TMViewerCard } from '../components/trollmatch/TMViewerCard';
import { TMUserCard } from '../components/trollmatch/TMUserCard';
import { 
  useTMMatches, 
  useTMViewedMe, 
  useTMNeedsOnboarding, 
  useTMProfile,
  useTMUpdateProfile,
  useTMAllUsers 
} from '../hooks/useTrollMatch';
import { useAuthStore } from '../lib/store';
import { TMTab, TMMatch } from '../types/trollMatch';

export function MatchPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const { needsOnboarding, loading: onboardingLoading } = useTMNeedsOnboarding();
  const { interests, datingEnabled, gender, preference, messagePrice } = useTMProfile();
  
  const [activeTab, setActiveTab] = useState<TMTab>('all-users');
  const [showSettings, setShowSettings] = useState(false);

  // Friends matches
  const { 
    matches: friendsMatches, 
    loading: friendsLoading, 
    error: friendsError,
    refetch: refetchFriends 
  } = useTMMatches(false, 20);

  // Dating matches
  const { 
    matches: datingMatches, 
    loading: datingLoading, 
    error: datingError,
    refetch: refetchDating 
  } = useTMMatches(true, 20);

  // Viewed Me
  const { 
    viewers, 
    loading: viewersLoading, 
    error: viewersError,
    refetch: refetchViewers 
  } = useTMViewedMe(50);

  // All Users
  const { 
    users: allUsers, 
    loading: allUsersLoading, 
    error: allUsersError,
    refetch: refetchAllUsers,
    newUserIds 
  } = useTMAllUsers(100);

  // Handle onboarding completion
  const handleOnboardingComplete = () => {
    // Refresh matches after onboarding and navigate to TM main page
    refetchFriends();
    refetchDating();
    navigate('/match', { replace: true });
  };

  // Handle message from match card
  const handleMessage = useCallback((userId: string, price: number) => {
    // Navigate to TCPS with the recipient
    navigate(`/tcps?recipient=${userId}&source=troll_match&price=${price}`);
  }, [navigate]);

  // Handle refresh
  const handleRefresh = () => {
    if (activeTab === 'friends') {
      refetchFriends();
      toast.success('Finding new matches...');
    } else if (activeTab === 'dating') {
      refetchDating();
      toast.success('Finding new matches...');
    } else if (activeTab === 'viewed-me') {
      refetchViewers();
      toast.success('Refreshing viewers...');
    } else if (activeTab === 'all-users') {
      refetchAllUsers();
      toast.success('Refreshing all users...');
    }
  };

  // Show loading while checking onboarding
  if (onboardingLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show onboarding for new users
  if (needsOnboarding) {
    return <TMOnboarding onComplete={handleOnboardingComplete} />;
  }

  const currentMatches = activeTab === 'dating' ? datingMatches : friendsMatches;
  const isLoading = activeTab === 'viewed-me' ? viewersLoading : 
                   activeTab === 'dating' ? datingLoading : 
                   activeTab === 'all-users' ? allUsersLoading : friendsLoading;
  const error = activeTab === 'viewed-me' ? viewersError : 
               activeTab === 'dating' ? datingError :
               activeTab === 'all-users' ? allUsersError : friendsError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 relative overflow-hidden">
      {/* Galaxy Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Stars */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(2px 2px at 20px 30px, #ffffff, transparent),
            radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 90px 40px, #ffffff, transparent),
            radial-gradient(2px 2px at 160px 120px, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 230px 80px, #ffffff, transparent),
            radial-gradient(2px 2px at 300px 200px, rgba(255,255,255,0.7), transparent),
            radial-gradient(1px 1px at 350px 150px, #ffffff, transparent),
            radial-gradient(2px 2px at 420px 60px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 500px 180px, #ffffff, transparent),
            radial-gradient(2px 2px at 580px 100px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 650px 250px, #ffffff, transparent),
            radial-gradient(2px 2px at 700px 50px, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 800px 150px, #ffffff, transparent),
            radial-gradient(2px 2px at 900px 80px, rgba(255,255,255,0.7), transparent),
            radial-gradient(1px 1px at 1000px 200px, #ffffff, transparent),
            radial-gradient(1px 1px at 1100px 50px, rgba(255,255,255,0.8), transparent),
            radial-gradient(2px 2px at 1200px 120px, #ffffff, transparent),
            radial-gradient(1px 1px at 100px 300px, rgba(255,255,255,0.6), transparent),
            radial-gradient(2px 2px at 200px 400px, #ffffff, transparent),
            radial-gradient(1px 1px at 350px 350px, rgba(255,255,255,0.9), transparent),
            radial-gradient(2px 2px at 500px 450px, #ffffff, transparent),
            radial-gradient(1px 1px at 650px 380px, rgba(255,255,255,0.7), transparent),
            radial-gradient(2px 2px at 800px 420px, #ffffff, transparent),
            radial-gradient(1px 1px at 950px 300px, rgba(255,255,255,0.8), transparent),
            radial-gradient(2px 2px at 1100px 400px, #ffffff, transparent),
            radial-gradient(1px 1px at 1300px 350px, rgba(255,255,255,0.6), transparent)
          `,
          backgroundRepeat: 'repeat',
          backgroundSize: '1400px 500px',
          animation: 'twinkle-slow 4s ease-in-out infinite'
        }} />
        
        {/* Neon Glow Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-pink-900/20" />
        
        {/* Nebula effect */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" />
        
        {/* Stars with slow blinking animation */}
        <style>{`
          @keyframes twinkle-slow {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.8); }
          }
        `}</style>
      </div>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-lg border-b border-purple-500/20">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-purple-500" />
              <h1 className="text-2xl font-black text-white">Find Your People</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="font-medium">Find New Matches</span>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-xl bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <TabButton
              active={activeTab === 'all-users'}
              onClick={() => setActiveTab('all-users')}
              icon={<Grid3X3 className="w-4 h-4" />}
              label="All Users"
              count={allUsers.length}
            />
            <TabButton
              active={activeTab === 'friends'}
              onClick={() => setActiveTab('friends')}
              icon={<Users className="w-4 h-4" />}
              label="Friends"
            />
            <TabButton
              active={activeTab === 'dating'}
              onClick={() => setActiveTab('dating')}
              icon={<Heart className="w-4 h-4" />}
              label="Dating 💜"
            />
            <TabButton
              active={activeTab === 'viewed-me'}
              onClick={() => setActiveTab('viewed-me')}
              icon={<Eye className="w-4 h-4" />}
              label={`Viewed Me 👀`}
              count={viewers.length}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-20"
            >
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={handleRefresh}
                className="px-6 py-2 rounded-xl bg-purple-500 text-white"
              >
                Try Again
              </button>
            </motion.div>
          ) : activeTab === 'viewed-me' ? (
            <motion.div
              key="viewed-me"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {viewers.length === 0 ? (
                <EmptyState 
                  icon={<Eye className="w-12 h-12" />}
                  title="No Views Yet"
                  description="When someone views your profile, they'll appear here"
                />
              ) : (
                <div className="grid gap-3">
                  {viewers.map((viewer) => (
                    <TMViewerCard 
                      key={viewer.viewer_id} 
                      viewer={viewer}
                      onMessage={handleMessage}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : activeTab === 'all-users' ? (
            <motion.div
              key="all-users"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {allUsers.length === 0 ? (
                <EmptyState 
                  icon={<Grid3X3 className="w-12 h-12" />}
                  title="No Users Found"
                  description="No users have joined yet"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {allUsers.map((user) => (
                    <TMUserCard 
                      key={user.user_id} 
                      user={user}
                      isNew={newUserIds.has(user.user_id)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {currentMatches.length === 0 ? (
                <EmptyState 
                  icon={activeTab === 'dating' ? <Heart className="w-12 h-12" /> : <Users className="w-12 h-12" />}
                  title={activeTab === 'dating' ? "No Dating Matches" : "No Matches Found"}
                  description="Try adjusting your interests or check back later"
                  action={
                    <button
                      onClick={handleRefresh}
                      className="mt-4 px-6 py-2 rounded-xl bg-purple-500 text-white"
                    >
                      Find New Matches
                    </button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {currentMatches.map((match) => (
                    <TMMatchCard 
                      key={match.user_id} 
                      match={match}
                      type={activeTab as 'friends' | 'dating'}
                      onMessage={handleMessage}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <TMSettingsModal 
            interests={interests}
            datingEnabled={datingEnabled}
            gender={gender}
            preference={preference}
            messagePrice={messagePrice}
            onClose={() => setShowSettings(false)}
            onSave={() => {
              setShowSettings(false);
              refetchFriends();
              refetchDating();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Tab Button Component
function TabButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  count 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string; 
  count?: number;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all
        ${active 
          ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' 
          : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white'
        }
      `}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`
          px-2 py-0.5 text-xs rounded-full
          ${active ? 'bg-white/20' : 'bg-purple-500/20 text-purple-300'}
        `}>
          {count}
        </span>
      )}
    </motion.button>
  );
}

// Empty State Component
function EmptyState({ 
  icon, 
  title, 
  description,
  action 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-20">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400">{description}</p>
      {action}
    </div>
  );
}

// Settings Modal Component
import { TM_INTERESTS, TM_GENDERS, TM_PREFERENCES, TMInterest, TMGender, TMPreference } from '../types/trollMatch';

function TMSettingsModal({ 
  interests: currentInterests,
  datingEnabled: currentDatingEnabled,
  gender: currentGender,
  preference: currentPreference,
  messagePrice: currentMessagePrice,
  onClose,
  onSave
}: { 
  interests: string[];
  datingEnabled: boolean;
  gender: string | null;
  preference: string[];
  messagePrice: number;
  onClose: () => void;
  onSave: () => void;
}) {
  const { updateProfile } = useTMUpdateProfile();
  const [loading, setLoading] = useState(false);
  
  const [interests, setInterests] = useState<TMInterest[]>(currentInterests as TMInterest[]);
  const [datingEnabled, setDatingEnabled] = useState(currentDatingEnabled);
  const [gender, setGender] = useState<TMGender | null>(currentGender as TMGender | null);
  const [preference, setPreference] = useState<TMPreference[]>(currentPreference as TMPreference[]);
  const [messagePrice, setMessagePrice] = useState(currentMessagePrice);

  const toggleInterest = (interest: TMInterest) => {
    setInterests(prev => 
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const togglePreference = (pref: TMPreference) => {
    setPreference(prev =>
      pref === 'Everyone'
        ? ['Everyone']
        : prev.includes(pref)
          ? prev.filter(p => p !== pref)
          : [...prev.filter(p => p !== 'Everyone'), pref]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile({
        interests,
        datingEnabled,
        gender,
        preference,
        messagePrice
      });
      toast.success('Preferences updated!');
      onSave();
    } catch (err) {
      toast.error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-800 rounded-2xl border border-purple-500/20"
      >
        <div className="sticky top-0 bg-slate-800 p-6 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Edit Preferences</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Interests */}
          <div>
            <h3 className="font-bold text-white mb-3">Your Interests</h3>
            <div className="flex flex-wrap gap-2">
              {TM_INTERESTS.map((interest) => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium transition-all
                    ${interests.includes(interest)
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }
                  `}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          {/* Dating Toggle */}
          <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">Enable Dating</h3>
                <p className="text-sm text-slate-400">Appear in dating matches</p>
              </div>
              <button
                onClick={() => setDatingEnabled(!datingEnabled)}
                className={`relative w-14 h-8 rounded-full transition-colors ${datingEnabled ? 'bg-pink-500' : 'bg-slate-600'}`}
              >
                <motion.div
                  className="absolute top-1 w-6 h-6 bg-white rounded-full"
                  animate={{ left: datingEnabled ? '1.5rem' : '0.25rem' }}
                />
              </button>
            </div>
          </div>

          {/* Dating Options */}
          {datingEnabled && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-white mb-3">Your Gender</h3>
                <div className="flex flex-wrap gap-2">
                  {TM_GENDERS.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`
                        px-3 py-1.5 rounded-full text-sm font-medium transition-all
                        ${gender === g
                          ? 'bg-pink-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }
                      `}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-white mb-3">Interested In</h3>
                <div className="flex flex-wrap gap-2">
                  {TM_PREFERENCES.map((pref) => (
                    <button
                      key={pref}
                      onClick={() => togglePreference(pref)}
                      className={`
                        px-3 py-1.5 rounded-full text-sm font-medium transition-all
                        ${preference.includes(pref)
                          ? 'bg-pink-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }
                      `}
                    >
                      {pref}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Message Price */}
          <div>
            <h3 className="font-bold text-white mb-3">Message Price</h3>
            <p className="text-sm text-slate-400 mb-3">Set how many coins users must pay to message you</p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={messagePrice}
                onChange={(e) => setMessagePrice(Number(e.target.value))}
                className="flex-1"
              />
              <div className="w-24 p-3 bg-slate-700 rounded-xl text-center">
                <span className="text-xl font-bold text-white">{messagePrice}</span>
                <span className="text-slate-400"> 💰</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Set to 0 for free messaging</p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-800 p-6 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-300 bg-slate-700 hover:bg-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default MatchPage;
