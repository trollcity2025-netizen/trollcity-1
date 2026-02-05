import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import HLSPlayer from '@/components/broadcast/HLSPlayer';

export interface WatchableStream {
  id: string;
  room_name?: string;
  agora_channel?: string;
  hls_url?: string;
  hls_path?: string;
  title?: string;
}

interface StreamWatchModalProps {
  stream: WatchableStream;
  onClose: () => void;
}

export default function StreamWatchModal({ stream, onClose }: StreamWatchModalProps) {
  // Prefer hls_path, then hls_url, then fallback to ID (HLSPlayer handles ID->URL conversion)
  const playbackSrc = stream.hls_path || stream.hls_url || stream.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-red-600 rounded-full text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        {playbackSrc ? (
           <HLSPlayer 
             src={playbackSrc} 
             className="w-full h-full object-contain"
             autoPlay={true}
           />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white bg-zinc-900">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Stream Feed Not Available</h3>
            <p className="text-gray-400">Stream ID is missing.</p>
          </div>
        )}
      </div>
    </div>
  );
}
