import React from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { LiveKitRoom, VideoTrack, useTracks } from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { useLiveKitToken } from '../../hooks/useLiveKitToken';
import { useAuthStore } from '../../lib/store';

export interface WatchableStream {
  id: string;
  room_name?: string;
  agora_channel?: string;
  title?: string;
}

interface StreamWatchModalProps {
  stream: WatchableStream;
  onClose: () => void;
}

const VideoViewer = () => {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: true });
  // Show first video track
  const videoTrack = tracks.find(t => t.source === Track.Source.Camera || t.source === Track.Source.ScreenShare);
  
  if (!videoTrack) {
      return <div className="flex items-center justify-center h-full text-zinc-500">Waiting for video...</div>;
  }
  
  return <VideoTrack trackRef={videoTrack} className="w-full h-full object-contain" />;
};

export default function StreamWatchModal({ stream, onClose }: StreamWatchModalProps) {
  const user = useAuthStore(s => s.user);
  
  const { token, serverUrl, isLoading, error } = useLiveKitToken({
      streamId: stream.id,
      roomName: stream.id,
      userId: user?.id || `guest-${Math.random().toString(36).slice(2)}`,
      isHost: false,
      canPublish: false,
      enabled: true
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-red-600 rounded-full text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        {isLoading ? (
            <div className="flex items-center justify-center h-full text-white gap-2">
                <Loader2 className="animate-spin text-green-500" />
                <span>Connecting to LiveKit...</span>
            </div>
        ) : error ? (
             <div className="flex flex-col items-center justify-center h-full text-white gap-2">
                <AlertTriangle className="text-red-500 w-8 h-8" />
                <div className="text-red-400">{error}</div>
             </div>
        ) : (
            <LiveKitRoom
                token={token}
                serverUrl={serverUrl}
                connect={true}
                video={true}
                audio={true}
                className="w-full h-full"
            >
                <VideoViewer />
            </LiveKitRoom>
        )}
      </div>
    </div>
  );
}
