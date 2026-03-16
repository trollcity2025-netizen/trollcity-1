import React, { useEffect, useMemo } from 'react';
import { X, AlertTriangle } from 'lucide-react';

import { useAuthStore } from '../../lib/store';
import { ListenerEntranceEffect } from '../../hooks/useListenerEntranceEffect';
import LiveKitViewerPlayer from './LiveKitViewerPlayer';
import MuxViewerPlayer from './MuxViewerPlayer';


export interface WatchableStream {
  id: string;
  room_name?: string;
  agora_channel: string;
  title?: string;
  mux_playback_id?: string | null;
  broadcaster_id?: string;
}

interface StreamWatchModalProps {
  stream: WatchableStream;
  onClose: () => void;
}

export default function StreamWatchModal({ stream, onClose }: StreamWatchModalProps) {
  const userId = useAuthStore(s => s.user?.id || null);
  const username = useAuthStore(s => s.profile?.username);
  const isGuest = !userId;

  // Determine if we should use Mux or Agora
  // Viewers should ALWAYS use Mux when available
  const useMux = !!stream.mux_playback_id;

  if (useMux) {
    console.log('[StreamWatchModal] Using Mux for viewer playback, mux_playback_id:', stream.mux_playback_id);
  } else {
    console.log('[StreamWatchModal] No Mux available, stream may not be live yet');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-red-600 rounded-full text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        {/* Viewers use Mux when available, otherwise use LiveKit */}
        {useMux ? (
          <MuxViewerPlayer
            playbackId={stream.mux_playback_id!}
            streamType="live"
            autoPlay
            muted={false}
          />
        ) : (
          /* Use LiveKit for real-time viewing */
          <LiveKitViewerPlayer
            streamId={stream.id}
            broadcasterId={stream.broadcaster_id || stream.agora_channel}
            roomName={stream.id}
          />
        )}

        <ListenerEntranceEffect
            streamId={stream.id}
            isHost={false}
            isGuest={isGuest}
            canPublish={false}
            userId={userId}
            username={username}
        />
      </div>
    </div>
  );
}
