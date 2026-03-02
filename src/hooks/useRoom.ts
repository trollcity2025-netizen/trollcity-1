import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IRemoteAudioTrack, IRemoteVideoTrack, ILocalVideoTrack, ILocalAudioTrack, ILocalTrack, IAgoraRTCRemoteUser } from "agora-rtc-sdk-ng";
import { useState, useRef, useEffect } from "react";

type IRemoteUser = IAgoraRTCRemoteUser;

interface UseRoomOptions {
  url?: string;
  token?: string;
  onConnected?: (room: IAgoraRTCClient) => void;
  onDisconnected?: () => void;
}

export function useRoom({ url, token, onConnected, onDisconnected }: UseRoomOptions = {}) {
  const [room, _setRoom] = useState<IAgoraRTCClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<IRemoteUser[]>([]);
  const [localAudioTrack, setLocalAudioTrack] = useState<ILocalAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ILocalVideoTrack | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);
  const roomRef = useRef<IAgoraRTCClient | null>(null);

  useEffect(() => {
    if (!url || !token) return;

    const connect = async () => {
      try {
        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

        client.on("user-published", async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === "audio") {
            const remoteAudioTrack = user.audioTrack;
            // Audio can play immediately (no DOM element needed)
            remoteAudioTrack?.play();
          }
          // Video is NOT played here - the component using this hook (e.g., BroadcastGrid)
          // will handle playing video in the correct DOM container
          setRemoteUsers((prev) => {
            if (prev.find((p) => p.uid === user.uid)) return prev;
            return [...prev, user];
          });
          setViewerCount((prev) => prev + 1);
        });

        client.on("user-unpublished", (user) => {
          setRemoteUsers((prev) => prev.filter((p) => p.uid !== user.uid));
          setViewerCount((prev) => Math.max(0, prev - 1));
        });

        await client.join(token, url, null);
        roomRef.current = client;
        _setRoom(client);
        setIsConnected(true);
        onConnected?.(client);

        // Create and publish local tracks
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        await client.publish([audioTrack, videoTrack]);
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);

        setIsCameraEnabled(videoTrack.enabled);
        setIsMicrophoneEnabled(audioTrack.enabled);

      } catch (error) {
        console.error("Failed to connect to room:", error);
      }
    };

    connect();

    return () => {
      if (roomRef.current) {
        roomRef.current.leave();
        roomRef.current = null;
      }
      if (localAudioTrack) {
        localAudioTrack.close();
      }
      if (localVideoTrack) {
        localVideoTrack.close();
      }
    };
  }, [url, token, onConnected, onDisconnected, localAudioTrack, localVideoTrack]);

  const toggleCamera = async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(!isCameraEnabled);
      setIsCameraEnabled(!isCameraEnabled);
    }
  };

  const toggleMicrophone = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!isMicrophoneEnabled);
      setIsMicrophoneEnabled(!isMicrophoneEnabled);
    }
  };

  return {
    room,
    isConnected,
    participants: remoteUsers,
    localParticipant: { isCameraEnabled, isMicrophoneEnabled, audioTrack: localAudioTrack, videoTrack: localVideoTrack },
    viewerCount,
    isCameraEnabled,
    isMicrophoneEnabled,
    toggleCamera,
    toggleMicrophone,
    // Legacy API aliases for backwards compatibility
    join: () => {}, // No-op - connection is automatic when url/token provided
    localTracks: [localVideoTrack, localAudioTrack],
    remoteUsers,
    leave: () => {
      if (roomRef.current) {
        roomRef.current.leave();
        roomRef.current = null;
      }
    },
  };
}

// Legacy alias for backwards compatibility
export function useAgoraRoom() {
  return useRoom({});
}

