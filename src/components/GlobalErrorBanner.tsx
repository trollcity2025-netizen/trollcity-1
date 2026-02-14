import React from 'react';
import { useGlobalApp } from '../contexts/GlobalAppContext';
import { reportError } from '../lib/supabase';

import { useAuthStore } from '../lib/store';

const GlobalErrorBanner: React.FC = () => {
  const { error, clearError } = useGlobalApp();
  const { user, profile } = useAuthStore();

  // Do not show errors for unauthenticated users (likely RLS disabled errors on landing page)
  if (!user || !error) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => reportError({ message: `User reported error: ${error}`, context: { username: profile?.username } })}
            className="flex-shrink-0 ml-4 p-1 rounded hover:bg-red-700 transition-colors"
            aria-label="Send to admin"
          >
            Send to Admin
          </button>
          <button
            onClick={clearError}
            className="flex-shrink-0 ml-4 p-1 rounded hover:bg-red-700 transition-colors"
            aria-label="Dismiss error"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalErrorBanner;
