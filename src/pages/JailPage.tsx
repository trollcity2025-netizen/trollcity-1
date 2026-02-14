import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { useJailMode } from '../hooks/useJailMode';
import { formatDuration } from '../utils/time';

const JailPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { isJailed, jailTimeRemaining, releaseTime } = useJailMode(user?.id);

  // Auto-redirect if no longer jailed
  useEffect(() => {
    if (user && !isJailed) {
      const timer = setTimeout(() => {
        navigate('/');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isJailed, navigate, user]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8 text-center border-t-4 border-red-600">
        <h1 className="text-4xl font-bold text-red-500 mb-4 uppercase tracking-widest">Incarcerated</h1>
        {isJailed ? (
          <div className="space-y-6">
            <div className="bg-red-900/20 p-4 rounded-lg border border-red-900/50">
              <p className="text-gray-300 mb-2">You are currently serving a sentence in Troll City Jail.</p>
              <p className="text-red-400 text-sm italic">Access to city services has been suspended.</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-gray-400 uppercase text-xs font-bold tracking-wider">Time Remaining</p>
              <div className="text-5xl font-mono py-6 bg-black/40 border-2 border-red-500/30 rounded-xl text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                {jailTimeRemaining !== null ? formatDuration(jailTimeRemaining) : 'Calculating...'}
              </div>
            </div>

            <div className="text-sm text-gray-500 bg-black/20 p-3 rounded-lg">
              <span className="block text-xs uppercase text-gray-600 mb-1">Scheduled Release</span>
              {releaseTime ? new Date(releaseTime).toLocaleString() : 'Processing...'}
            </div>

            <div className="pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500">Think about what you&apos;ve done.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="bg-green-900/20 p-6 rounded-lg border border-green-900/50">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-8 h-8 bg-green-500 rounded-full animate-ping opacity-20" />
                <div className="absolute w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                   <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                   </svg>
                </div>
              </div>
              <p className="text-xl font-bold text-green-400 mb-2">Sentence Completed!</p>
              <p className="text-gray-300">You have been processed for release.</p>
            </div>
            
            <button 
              onClick={() => navigate('/')}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-green-900/20"
            >
              Return to Society
            </button>
            <p className="text-xs text-gray-500">Redirecting in 3 seconds...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default JailPage;
