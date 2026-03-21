import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Heart, Sparkles } from 'lucide-react';
import { useTMUpdateProfile } from '../../hooks/useTrollMatch';
import { useAuthStore } from '../../lib/store';
import { TM_INTERESTS, TM_GENDERS, TM_PREFERENCES, TMInterest, TMGender, TMPreference } from '../../types/trollMatch';
import { toast } from 'sonner';

interface TMOnboardingProps {
  onComplete?: () => void;
}

export function TMOnboarding({ onComplete }: TMOnboardingProps) {
  const { profile } = useAuthStore();
  const { updateProfile } = useTMUpdateProfile();
  
  const [step, setStep] = useState<'interests' | 'dating'>('interests');
  const [selectedInterests, setSelectedInterests] = useState<TMInterest[]>([]);
  const [datingEnabled, setDatingEnabled] = useState(false);
  const [gender, setGender] = useState<TMGender | null>(null);
  const [preferences, setPreferences] = useState<TMPreference[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleInterest = (interest: TMInterest) => {
    setSelectedInterests(prev => 
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const togglePreference = (pref: TMPreference) => {
    setPreferences(prev =>
      pref === 'Everyone'
        ? ['Everyone']
        : prev.includes(pref)
          ? prev.filter(p => p !== pref)
          : [...prev.filter(p => p !== 'Everyone'), pref]
    );
  };

  const handleInterestsSubmit = async () => {
    if (selectedInterests.length === 0) {
      toast.error('Please select at least one interest');
      return;
    }

    if (!datingEnabled) {
      // Save interests and complete
      setLoading(true);
      try {
        await updateProfile({ interests: selectedInterests });
        toast.success('Preferences saved!');
        onComplete?.();
      } catch (err) {
        toast.error('Failed to save preferences');
      } finally {
        setLoading(false);
      }
    } else {
      setStep('dating');
    }
  };

  const handleDatingSubmit = async () => {
    if (!gender) {
      toast.error('Please select your gender');
      return;
    }
    if (preferences.length === 0) {
      toast.error('Please select who you\'re interested in');
      return;
    }

    setLoading(true);
    try {
      await updateProfile({
        interests: selectedInterests,
        datingEnabled: true,
        gender,
        preference: preferences
      });
      toast.success('Preferences saved!');
      onComplete?.();
    } catch (err) {
      toast.error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const interestCategories = {
    'Music': TM_INTERESTS.filter(i => i.startsWith('Music')),
    'Entertainment': ['Gaming', 'Singing', 'Movies', 'Comedy', 'Just Chatting'],
    'Lifestyle': ['Sports', 'Content Creation', 'Art & Design', 'Cooking', 'Travel', 'Reading', 'Fitness'],
    'Other': ['Technology', 'Fashion', 'Photography', 'Dancing', 'Nature', 'Science', 'History', 'Politics', 'Spirituality', 'Pets'],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/50 via-slate-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-purple-500/20 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-black text-white">
              {step === 'interests' ? 'Tell Us About Yourself' : 'Dating Preferences 💜'}
            </h1>
          </div>
          <p className="text-purple-100">
            {step === 'interests' 
              ? 'Select your interests to find your people' 
              : 'Help others find you (optional)'}
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 p-4 bg-slate-900/50">
          <div className="flex-1 h-2 rounded-full bg-purple-500" />
          <div className={`flex-1 h-2 rounded-full ${step === 'dating' ? 'bg-purple-500' : 'bg-slate-700'}`} />
        </div>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 'interests' ? (
              <motion.div
                key="interests"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {/* Interest Categories */}
                {Object.entries(interestCategories).map(([category, interests]) => (
                  <div key={category} className="mb-6">
                    <h3 className="text-lg font-bold text-white mb-3">{category}</h3>
                    <div className="flex flex-wrap gap-2">
                      {interests.map((interest) => (
                        <button
                          key={interest}
                          onClick={() => toggleInterest(interest as TMInterest)}
                          className={`
                            px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                            ${selectedInterests.includes(interest as TMInterest)
                              ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }
                          `}
                        >
                          {selectedInterests.includes(interest as TMInterest) && (
                            <Check className="w-4 h-4 inline mr-1" />
                          )}
                          {interest}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Dating Toggle */}
                <div className="mt-8 p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        <Heart className="w-5 h-5 text-pink-500" />
                        Looking for Dates 💜
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        Enable to appear in dating matches
                      </p>
                    </div>
                    <button
                      onClick={() => setDatingEnabled(!datingEnabled)}
                      className={`
                        relative w-14 h-8 rounded-full transition-colors duration-200
                        ${datingEnabled ? 'bg-pink-500' : 'bg-slate-600'}
                      `}
                    >
                      <motion.div
                        className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                        animate={{ left: datingEnabled ? '1.5rem' : '0.25rem' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="dating"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {/* Gender Selection */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3">Your Gender</h3>
                  <div className="flex flex-wrap gap-2">
                    {TM_GENDERS.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGender(g)}
                        className={`
                          px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                          ${gender === g
                            ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }
                        `}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preference Selection */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3">Interested In</h3>
                  <div className="flex flex-wrap gap-2">
                    {TM_PREFERENCES.map((pref) => (
                      <button
                        key={pref}
                        onClick={() => togglePreference(pref)}
                        className={`
                          px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                          ${preferences.includes(pref)
                            ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }
                        `}
                      >
                        {pref}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-slate-400 mt-4">
                  💡 Your gender and preferences are only used for matching and are never displayed publicly.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-900/50 border-t border-slate-700">
          <div className="flex gap-3">
            {step === 'dating' && (
              <button
                onClick={() => setStep('interests')}
                className="px-6 py-3 rounded-xl font-bold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={step === 'interests' ? handleInterestsSubmit : handleDatingSubmit}
              disabled={loading}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                'Start Matching'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default TMOnboarding;
