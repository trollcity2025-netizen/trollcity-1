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

  // Determine if we should use LiveKit or Mux
  // Always prefer LiveKit for real-time low-latency viewing
  // Use LiveKit room name if available, otherwise fall back to stream id
  const livekitRoomName = stream.room_name || stream.id;
  const useLiveKit = true; // Always prefer LiveKit for real-time viewing

  if (useLiveKit) {
    console.log('[StreamWatchModal] Using LiveKit for real-time viewer playback, room:', livekitRoomName);
  } else if (stream.mux_playback_id) {
    console.log('[StreamWatchModal] Using Mux for viewer playback, mux_playback_id:', stream.mux_playback_id);
  } else {
    console.log('[StreamWatchModal] No playback method available');
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
        
        {/* Always prefer LiveKit for real-time viewing, fallback to Mux if needed */}
        {useLiveKit ? (
          /* Use LiveKit for real-time viewing */
          <LiveKitViewerPlayer
            streamId={stream.id}
            broadcasterId={stream.broadcaster_id || stream.agora_channel}
            roomName={livekitRoomName}
          />
        ) : stream.mux_playback_id ? (
          <MuxViewerPlayer
            playbackId={stream.mux_playback_id!}
            streamType="live"
            autoPlay
            muted={false}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
              <p>No playback method available</p>
              <p className="text-sm text-gray-400 mt-2">Stream may not be live yet</p>
            </div>
          </div>
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
