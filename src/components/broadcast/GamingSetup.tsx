import React from 'react';
import { Monitor, Camera, Gamepad2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface GamingSetupProps {
  streamId: string;
  isScreenSharing: boolean;
  cameraOverlayEnabled: boolean;
  onToggleScreenShare: () => void;
  onToggleCameraOverlay: (enabled: boolean) => void;
}

export function GamingSetup({
  streamId,
  isScreenSharing,
  cameraOverlayEnabled,
  onToggleScreenShare,
  onToggleCameraOverlay,
}: GamingSetupProps) {
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [copiedUrl, setCopiedUrl] = React.useState(false);

  // LiveKit RTMP settings
  const livekitRTMPUrl = 'rtmp://rtmp.livekit.io/live';
  const livekitStreamKey = streamId;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(livekitStreamKey);
    setCopiedKey(true);
    toast.success('Stream key copied!');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(livekitRTMPUrl);
    setCopiedUrl(true);
    toast.success('RTMP URL copied!');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="bg-slate-950/80 border border-purple-500/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-purple-400">
        <Monitor size={18} />
        <span className="font-semibold">🎮 Gaming Setup</span>
      </div>

      {/* Screen Share Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onToggleScreenShare}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            isScreenSharing
              ? 'bg-purple-500 text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          <Gamepad2 size={16} />
          {isScreenSharing ? 'Screen Sharing Active' : 'Start Screen Share'}
        </button>
      </div>

      {/* Camera Overlay Toggle */}
      <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Camera size={14} className="text-gray-400" />
          <div>
            <span className="text-xs font-medium text-gray-300">Camera Overlay</span>
            <p className="text-[10px] text-gray-500">Show your camera as a draggable facecam on top of the screen share</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggleCameraOverlay(!cameraOverlayEnabled)}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
            cameraOverlayEnabled
              ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
              : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:bg-white/10'
          }`}
        >
          {cameraOverlayEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Screen Share Active Indicator */}
      {isScreenSharing && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Screen sharing active</span>
          </div>
          {cameraOverlayEnabled && (
            <p className="text-[10px] text-green-300/70 mt-1">Camera overlay is shown on your screen preview — drag it to reposition</p>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="border-t border-white/10 pt-3">
        <p className="text-xs font-medium text-purple-300 mb-1">💡 Pro Tips:</p>
        <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
          <li>Click &quot;Start Screen Share&quot; to share your gameplay</li>
          <li>Enable &quot;Camera Overlay&quot; to add a facecam you can drag around</li>
          <li>Test your audio levels before going live</li>
        </ul>
      </div>
    </div>
  );
}

export default GamingSetup;
