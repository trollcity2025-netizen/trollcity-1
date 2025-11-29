import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, RefreshCw } from 'lucide-react';

export default function StreamEnded() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
      <div className="max-w-md mx-auto text-center p-8">
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-2xl">⏹️</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-4">Stream Ended</h1>
          <p className="text-gray-300 text-lg">
            The live stream has ended. Thanks for watching!
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => navigate('/')}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </button>

          <button
            onClick={() => window.location.reload()}
            className="w-full bg-gray-700 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh Page
          </button>
        </div>

        <p className="text-gray-500 text-sm mt-8">
          Looking for more streams? Check out the live streams on the home page.
        </p>
      </div>
    </div>
  );
}