import React from 'react';
import { Monitor, Camera, Gamepad2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useScreenShare, StreamMode } from '@/hooks/useScreenShare';
import { useStreamStore } from '@/lib/streamStore';

interface GamingSetupProps {
  streamId: string;
  // videoRef removed - video playback is now handled by Agora's play() method in the parent
  acquireMediaStream?: (facingMode: 'user' | 'environment', enableVideo: boolean) => Promise<MediaStream | null>;
  facingMode?: 'user' | 'environment';
  isVideoEnabled?: boolean;
  setStream?: (stream: MediaStream | null) => void;
}

export function GamingSetup({
  streamId,
  acquireMediaStream,
  facingMode = 'user',
  isVideoEnabled = true,
  setStream,
}: GamingSetupProps) {
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [copiedUrl, setCopiedUrl] = React.useState(false);

  // Use global stream store for persistence
  const {
    screenTrack,
    setScreenTrack,
    streamMode,
    setStreamMode,
    setScreenPreviewStream,
  } = useStreamStore();

  // Use screen share hook
  const screenShare = useScreenShare();

  // Agora RTMP settings
  const agoraRTMPUrl = 'rtmp://rtmp.agora.io/live';
  const agoraStreamKey = streamId;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(agoraStreamKey);
    setCopiedKey(true);
    toast.success('Stream key copied!');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(agoraRTMPUrl);
    setCopiedUrl(true);
    toast.success('RTMP URL copied!');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const toggleScreenShare = async () => {
    if (streamMode === 'screen') {
      // Switch back to camera mode
      screenShare.stopScreenShare();
      setScreenTrack(null);
      setScreenPreviewStream(null);
      setStreamMode('camera');

      // Re-acquire camera stream if function provided
      // Note: Video playback is handled by Agora's play() method in the parent component
      if (acquireMediaStream && setStream) {
        const mediaStream = await acquireMediaStream(facingMode, isVideoEnabled);
        if (mediaStream) {
          setStream(mediaStream);
        }
      }

      toast.info('Switched to camera mode');
    } else {
      // Switch to screen share mode
      const track = await screenShare.startScreenShare();
      if (track) {
        setScreenTrack(track);
        setStreamMode('screen');

        // Create preview stream for state management
        const mediaStreamTrack = track.getMediaStreamTrack();
        if (mediaStreamTrack) {
          const previewStream = new MediaStream([mediaStreamTrack]);
          setScreenPreviewStream(previewStream);
        }

        toast.success('Screen sharing started!');

        // Handle when user stops sharing via browser UI
        screenShare.onScreenShareEnded(() => {
          setScreenTrack(null);
          setScreenPreviewStream(null);
          setStreamMode('camera');

          // Re-acquire camera stream when screen share ends
          // Note: Video playback is handled by Agora's play() method in the parent component
          if (acquireMediaStream && setStream) {
            acquireMediaStream(facingMode, isVideoEnabled).then(mediaStream => {
              if (mediaStream) {
                setStream(mediaStream);
              }
            });
          }

          toast.info('Screen sharing ended');
        });
      } else {
        toast.error(screenShare.error || 'Failed to start screen sharing');
      }
    }
  };

  // Mobile fallback - phones often cannot screen share
  if (!screenShare.isSupported) {
    return (
      <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-amber-400">
          <Monitor size={18} />
          <span className="font-semibold">🎮 Gaming Mode</span>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <p className="text-xs text-amber-300">
            📱 Screen sharing is not supported on this device/browser.
            You can still stream using your camera.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStreamMode('camera')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              streamMode === 'camera'
                ? 'bg-amber-500 text-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Camera size={16} className="inline mr-2" />
            Camera
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/80 border border-purple-500/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-purple-400">
        <Monitor size={18} />
        <span className="font-semibold">🎮 Stream Your Game</span>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (streamMode === 'screen') {
              screenShare.stopScreenShare();
              setScreenTrack(null);
              setScreenPreviewStream(null);

              // Re-acquire camera stream if function provided
              // Note: Video playback is handled by Agora's play() method in the parent component
              if (acquireMediaStream && setStream) {
                acquireMediaStream(facingMode, isVideoEnabled).then(mediaStream => {
                  if (mediaStream) {
                    setStream(mediaStream);
                  }
                });
              }
            }
            setStreamMode('camera');
          }}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            streamMode === 'camera'
              ? 'bg-purple-500 text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          <Camera size={16} className="inline mr-2" />
          Camera
        </button>
        <button
          type="button"
          onClick={toggleScreenShare}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            streamMode === 'screen'
              ? 'bg-purple-500 text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          <Gamepad2 size={16} className="inline mr-2" />
          Screen
        </button>
      </div>

      {/* Screen Share Active Indicator */}
      {streamMode === 'screen' && screenTrack && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Screen sharing active</span>
          </div>
        </div>
      )}

      <div className="space-y-3 text-sm">
        {/* Quick Start - In Browser */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-400 mb-1">
            <span className="font-semibold">✅ Easiest: In-Browser</span>
          </div>
          <p className="text-xs text-gray-400">
            Click the <Gamepad2 size={12} className="inline" /> button above to share your screen directly from the browser!
          </p>
        </div>

        {/* OBS Option */}
        <div className="border-t border-white/10 pt-3">
          <p className="text-xs text-gray-400 mb-2">
            Or use OBS Studio for advanced streaming:
          </p>

          {/* RTMP URL */}
          <div>
            <span className="text-gray-400 text-xs">RTMP Ingest URL:</span>
            <div className="flex gap-2 mt-1">
              <code className="flex-1 bg-black/50 p-2 rounded text-blue-300 text-xs break-all">
                {agoraRTMPUrl}
              </code>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-3 py-1 bg-blue-600/80 hover:bg-blue-500 rounded text-xs text-white transition-colors"
                title="Copy RTMP URL"
              >
                {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Stream Key */}
          <div className="mt-2">
            <span className="text-gray-400 text-xs">Stream Key (Channel):</span>
            <div className="flex gap-2 mt-1">
              <code className="flex-1 bg-black/50 p-2 rounded text-green-400 text-xs break-all">
                {agoraStreamKey}
              </code>
              <button
                type="button"
                onClick={handleCopyKey}
                className="px-3 py-1 bg-blue-600/80 hover:bg-blue-500 rounded text-xs text-white transition-colors"
                title="Copy Stream Key"
              >
                {copiedKey ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Use these settings in OBS Studio → Settings → Stream
          </p>
        </div>

        {/* Tips */}
        <div className="border-t border-white/10 pt-3">
          <p className="text-xs font-medium text-purple-300 mb-1">💡 Pro Tips:</p>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
            <li>Use "Screen" mode to share your gameplay</li>
            <li>Use "Camera" mode to show your facecam</li>
            <li>OBS gives you more control over overlays and scenes</li>
            <li>Test your audio levels before going live</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default GamingSetup;
