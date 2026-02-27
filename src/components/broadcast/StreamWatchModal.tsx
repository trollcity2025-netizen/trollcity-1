import React, { useEffect, useMemo } from 'react';
import { X, AlertTriangle } from 'lucide-react';

import { useAuthStore } from '../../lib/store';
import { ListenerEntranceEffect } from '../../hooks/useListenerEntranceEffect';
import MuxViewerPlayer from './MuxViewerPlayer';


export interface WatchableStream {
  id: string;
  room_name?: string;
  agora_channel: string;
  mux_playback_id?: string;
  title?: string;
}

interface StreamWatchModalProps {
  stream: WatchableStream;
  onClose: () => void;
}

export default function StreamWatchModal({ stream, onClose }: StreamWatchModalProps) {
  const { user, profile } = useAuthStore(s => ({ user: s.user, profile: s.profile }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-red-600 rounded-full text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        {stream.mux_playback_id ? (
          <MuxViewerPlayer
            playbackId={stream.mux_playback_id}
            autoPlay={true}
            muted={false}
            streamType="live"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white gap-2">
            <AlertTriangle className="text-yellow-500 w-8 h-8" />
            <div className="text-white/70">No Mux playback ID available for this stream.</div>
            <div className="text-white/50 text-sm">This stream might not be configured for public viewing.</div>
          </div>
        )}

        <ListenerEntranceEffect
            streamId={stream.id}
            isHost={false}
            isGuest={!user}
            canPublish={false}
            userId={user?.id || null}
            username={profile?.username}
        />
      </div>
    </div>
  );
}
