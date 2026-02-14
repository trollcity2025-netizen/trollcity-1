import React from 'react';
import { X } from 'lucide-react';

interface BroadcasterStatsModalProps {
  stream: any;
  onClose: () => void;
  broadcasterProfile: any;
}

export default function BroadcasterStatsModal({ stream, onClose, broadcasterProfile: _broadcasterProfile }: BroadcasterStatsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Broadcaster Stats</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Stream Status</span>
            <span className="text-green-400 font-medium">Live</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Viewer Count</span>
            <span className="text-white font-medium">{stream?.current_viewers || stream?.viewer_count || 0}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Stream Duration</span>
            <span className="text-white font-medium">--:--:--</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Likes</span>
            <span className="text-white font-medium">{stream?.like_count || 0}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Coins Earned</span>
            <span className="text-yellow-400 font-medium">{stream?.coin_earnings || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
