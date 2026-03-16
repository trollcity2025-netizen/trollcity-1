import React, { useEffect, useRef, useState } from 'react';
import { RemoteParticipant, LocalVideoTrack, LocalAudioTrack, RemoteVideoTrack, RemoteAudioTrack } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VideoTileProps {
  user?: RemoteParticipant;
  localVideoTrack?: LocalVideoTrack;
  localAudioTrack?: LocalAudioTrack;
  displayName: string;
  role: 'performer' | 'judge' | 'viewer';
  canPublish?: boolean;
  livekitRoom?: any; // The LiveKit room instance
}

const VideoTile: React.FC<VideoTileProps> = ({ 
  user, 
  localVideoTrack,
  localAudioTrack,
  displayName,
  role,
  canPublish = false,
  livekitRoom
}) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  // Get video track from user or local
  const getVideoTrack = () => {
    if (localVideoTrack) return localVideoTrack;
    if (user) {
      // Get video track from LiveKit participant
      const trackPublications = Array.from(user.videoTrackPublications.values());
      const videoPub = trackPublications.find(p => p.track?.kind === 'video');
      return videoPub?.track as RemoteVideoTrack | undefined;
    }
    return undefined;
  };

  // Get audio track from user or local
  const getAudioTrack = () => {
    if (localAudioTrack) return localAudioTrack;
    if (user) {
      const trackPublications = Array.from(user.audioTrackPublications.values());
      const audioPub = trackPublications.find(p => p.track?.kind === 'audio');
      return audioPub?.track as RemoteAudioTrack | undefined;
    }
    return undefined;
  };

  const videoTrack = getVideoTrack();
  const audioTrack = getAudioTrack();

  // Attach video track to DOM element
  useEffect(() => {
    if (videoRef.current && videoTrack) {
      // LiveKit tracks attach themselves to the element
      if ('attach' in videoTrack) {
        const element = videoTrack.attach();
        videoRef.current.appendChild(element);
      }
    }
    return () => {
      // Cleanup attached element on unmount
      if (videoRef.current) {
        videoRef.current.innerHTML = '';
      }
    };
  }, [videoTrack]);

  // Play audio track for remote users
  useEffect(() => {
    if (user && audioTrack) {
      // LiveKit audio tracks auto-play when attached
      if ('attach' in audioTrack) {
        audioTrack.attach();
      }
    }
  }, [user, audioTrack]);

  const togglePublish = async () => {
    if (!livekitRoom || !localVideoTrack || !localAudioTrack) return;

    if (!isPublished) {
      // Publish tracks
      await livekitRoom.localParticipant.publishTrack(localAudioTrack);
      await livekitRoom.localParticipant.publishTrack(localVideoTrack);
      setIsPublished(true);
    } else {
      // Unpublish tracks
      await livekitRoom.localParticipant.unpublishTrack(localAudioTrack);
      await livekitRoom.localParticipant.unpublishTrack(localVideoTrack);
      setIsPublished(false);
    }
  };

  return (
    <div className="w-full h-full bg-black rounded-xl overflow-hidden relative aspect-video">
      <div ref={videoRef} className="w-full h-full" />
      
      {/* Overlay Info */}
      <div className="absolute top-3 left-3 bg-black/60 px-3 py-1 rounded-lg text-sm">
        <p className="font-bold">{displayName}</p>
        <p className="text-xs capitalize text-slate-300">{role}</p>
      </div>

      {/* Placeholder */}
      {!videoTrack && (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-slate-500">{displayName}</p>
        </div>
      )}

      {/* Publish Controls for local user */}
      {canPublish && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <Button 
            onClick={togglePublish}
            className={cn(
              "transition-all",
              isPublished ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
            )}
          >
            {isPublished ? 'Stop Broadcast' : 'Go Live'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default VideoTile;
