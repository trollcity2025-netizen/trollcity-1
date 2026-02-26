
import React, { useEffect, useRef, useState } from 'react';
import { IAgoraRTCRemoteUser, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VideoTileProps {
  user?: IAgoraRTCRemoteUser;
  localVideoTrack?: ICameraVideoTrack;
  localAudioTrack?: IMicrophoneAudioTrack;
  displayName: string;
  role: 'performer' | 'judge' | 'viewer';
  canPublish?: boolean;
  agoraClient?: any; // The main Agora client instance
}

const VideoTile: React.FC<VideoTileProps> = ({ 
  user, 
  localVideoTrack,
  localAudioTrack,
  displayName,
  role,
  canPublish = false,
  agoraClient
}) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const videoTrack = localVideoTrack || user?.videoTrack;
  const audioTrack = localAudioTrack || user?.audioTrack;

  // Play video track
  useEffect(() => {
    if (videoRef.current && videoTrack) {
      videoTrack.play(videoRef.current);
    }
    return () => {
      videoTrack?.stop();
    };
  }, [videoTrack]);

  // Play audio track for remote users
  useEffect(() => {
    if (user && audioTrack) {
      audioTrack.play();
    }
  }, [user, audioTrack]);

  const togglePublish = async () => {
    if (!agoraClient || !localVideoTrack || !localAudioTrack) return;

    if (!isPublished) {
      await agoraClient.publish([localAudioTrack, localVideoTrack]);
      setIsPublished(true);
    } else {
      await agoraClient.unpublish([localAudioTrack, localVideoTrack]);
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
