import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Home, ArrowLeft, AlertCircle } from 'lucide-react';

export default function StreamEndedPage() {
  const { streamId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertIcon className="w-10 h-10 text-red-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">Live Stream Ended</h1>
        <p className="text-zinc-400 mb-8">
          This broadcast has ended. Thanks for watching!
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/live')}
            className="w-full py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold rounded-full flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Go to Live
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-full flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}