import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Trophy, Users, Heart, Gift } from 'lucide-react';

export default function StreamSummary() {
  const location = useLocation();
  const navigate = useNavigate();
  // We expect stats to be passed via state, or we could fetch them if we had the ID.
  // For now, let's assume they are passed or we show a generic "Stream Ended" message.
  const stats = location.state as {
    duration?: string;
    viewers?: number;
    likes?: number;
    gifts?: number;
    title?: string;
  } | null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center text-center space-y-6 relative overflow-hidden">
        
        {/* Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-purple-500/20 blur-[100px]" />

        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent z-10">
          Stream Ended
        </h1>
        
        {stats?.title && <p className="text-zinc-400 text-lg">{stats.title}</p>}

        <div className="grid grid-cols-2 gap-4 w-full z-10">
          <div className="bg-zinc-800/50 p-4 rounded-xl flex flex-col items-center gap-2">
            <Users className="text-blue-400" />
            <span className="text-2xl font-bold">{stats?.viewers || 0}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Viewers</span>
          </div>
          <div className="bg-zinc-800/50 p-4 rounded-xl flex flex-col items-center gap-2">
            <Heart className="text-red-400" />
            <span className="text-2xl font-bold">{stats?.likes || 0}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Likes</span>
          </div>
          <div className="bg-zinc-800/50 p-4 rounded-xl flex flex-col items-center gap-2">
            <Gift className="text-yellow-400" />
            <span className="text-2xl font-bold">{stats?.gifts || 0}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Gifts</span>
          </div>
          <div className="bg-zinc-800/50 p-4 rounded-xl flex flex-col items-center gap-2">
            <Trophy className="text-green-400" />
            <span className="text-2xl font-bold">{stats?.duration || "00:00"}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Duration</span>
          </div>
        </div>

        <button 
          onClick={() => navigate('/')}
          className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition-colors z-10 flex items-center justify-center gap-2"
        >
          <Home size={20} />
          Return Home
        </button>

      </div>
    </div>
  );
}
