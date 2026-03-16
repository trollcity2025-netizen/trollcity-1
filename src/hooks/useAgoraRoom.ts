import { useLiveKitRoom } from './useLiveKitRoom';

/**
 * @deprecated Use useLiveKitRoom instead
 * This hook is kept for backwards compatibility
 */
export function useAgoraRoom(config: any) {
  // Redirect to useLiveKitRoom with backwards-compatible API
  const {
    isConnected,
    isPublishing,
    isJoining,
    remoteUsers,
    localVideoTrack,
    localAudioTrack,
    error,
    joinAsPublisher,
    joinAsAudience,
    leaveRoom,
    toggleCamera,
    toggleMicrophone,
    room,
    muxPlaybackId
  } = useLiveKitRoom({
    roomId: config?.roomId,
    roomType: config?.roomType || 'broadcast',
    role: config?.role || 'viewer',
    audioOnly: config?.audioOnly || false,
    publish: config?.publish || false,
    muxPlaybackId: config?.muxPlaybackId,
    onUserJoined: config?.onUserJoined,
    onUserLeft: config?.onUserLeft,
    onError: config?.onError
  });

  // Map LiveKit API to Agora-compatible API
  return {
    // State
    isConnected,
    isPublishing,
    isJoining,
    remoteUsers,
    localVideoTrack,
    localAudioTrack,
    error,
    
    // Methods - adapt to Agora API
    joinAsPublisher: () => joinAsPublisher(config?.userId || 'anonymous'),
    joinAsAudience: () => joinAsAudience(config?.userId || 'anonymous'),
    leaveRoom,
    shouldUseMux: () => config?.role === 'viewer' && !!config?.muxPlaybackId,
    
    // For Mux playback
    muxPlaybackId,
    
    // Client ref for external access
    client: room,
    
    // Legacy aliases
    join: () => {},
    localTracks: [localVideoTrack, localAudioTrack]
  };
}

export default useAgoraRoom;
