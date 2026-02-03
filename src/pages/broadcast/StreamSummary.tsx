import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Trophy, Users, Heart, Gift } from 'lucide-react';

export default function StreamSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const stats = location.state || { viewers: 0, likes: 0, gifts: 0 };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full bg-zinc-900 border border-white/10 rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
        <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-yellow-500/50">
          <Trophy size={40} className="text-yellow-500" />
        </div>
        
        <h1 className="text-3xl font-bold mb-2">Broadcast Ended</h1>
        <p className="text-zinc-400 mb-8">{stats.title || "Great stream! Here's how it went:"}</p>

        <div className="grid grid-cols-3 gap-4 w-full mb-8">
            <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-white/5">
                <Users className="text-blue-400 mb-2" size={24} />
                <span className="text-2xl font-bold">{stats.viewers || 0}</span>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Viewers</span>
            </div>
            <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-white/5">
                <Heart className="text-pink-500 mb-2" size={24} />
                <span className="text-2xl font-bold">{stats.likes || 0}</span>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Likes</span>
            </div>
            <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-white/5">
                <Gift className="text-yellow-500 mb-2" size={24} />
                <span className="text-2xl font-bold">{stats.gifts || 0}</span>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Gifts</span>
            </div>
        </div>

        <button 
            onClick={() => navigate('/')}
            className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition flex items-center justify-center gap-2"
        >
            <Home size={20} />
            Back to Home
        </button>
      </div>
    </div>
  );
}
