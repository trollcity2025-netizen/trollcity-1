
import React, { useEffect, useState } from 'react';
import { useAgora } from '@/hooks/useAgora';
import AgoraVideoPlayer from '@/components/broadcast/AgoraVideoPlayer';
import MuxViewer from '@/components/broadcast/MuxViewer';
import { IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import { useAuthStore } from '@/lib/store';

interface CourtBroadcastProps {
  canPublish: boolean;
  courtSession: any; // Consider creating a more specific type
  agoraToken: string | null;
  muxPlaybackId: string | null;
}

const AgoraPublisherView: React.FC<{ courtSession: any; token: string | null }> = ({ courtSession, token }) => {
  const { user } = useAuthStore();
  const { join, leave, localVideoTrack, remoteUsers, publish } = useAgora();
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    if (token && user && courtSession?.id && !isJoined) {
      const joinChannel = async () => {
        try {
          console.log('[AgoraPublisherView] Joining channel', courtSession.id);
          // A UID of 0 tells Agora to assign a dynamic UID.
          await join(import.meta.env.VITE_AGORA_APP_ID, courtSession.id, token, 0, 'host');
          await publish();
          setIsJoined(true);
          console.log('[AgoraPublisherView] Joined and published successfully');
        } catch (error) {
          console.error('[AgoraPublisherView] Failed to join or publish:', error);
        }
      };
      joinChannel();
    }

    return () => {
      if (isJoined) {
        console.log('[AgoraPublisherView] Leaving channel');
        leave();
      }
    };
  }, [courtSession, token, user, join, leave, publish, isJoined]);

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {/* Local User */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <p className="absolute top-2 left-2 z-10 text-xs text-white bg-black/50 px-2 py-1 rounded">
          {user?.user_metadata?.username || 'You'}
        </p>
        <AgoraVideoPlayer videoTrack={localVideoTrack} className="w-full h-full" />
      </div>

      {/* Remote Users */}
      {remoteUsers.map((remoteUser: IAgoraRTCRemoteUser) => (
        <div key={remoteUser.uid} className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <p className="absolute top-2 left-2 z-10 text-xs text-white bg-black/50 px-2 py-1 rounded">
            User {remoteUser.uid}
          </p>
          {remoteUser.hasVideo && (
            <AgoraVideoPlayer videoTrack={remoteUser.videoTrack} className="w-full h-full" />
          )}
        </div>
      ))}
    </div>
  );
};

const CourtBroadcast: React.FC<CourtBroadcastProps> = ({
  canPublish,
  courtSession,
  agoraToken,
  muxPlaybackId,
}) => {
  if (canPublish) {
    return <AgoraPublisherView courtSession={courtSession} token={agoraToken} />;
  }

  if (muxPlaybackId) {
    return <MuxViewer playbackId={muxPlaybackId} />;
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-black text-white">
      <p>Waiting for broadcast to start...</p>
    </div>
  );
};

export default CourtBroadcast;
