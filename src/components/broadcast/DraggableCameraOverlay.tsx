import React, { useRef, useState, useCallback } from 'react';
import { Video, VideoOff, Mic, MicOff, Move, X, RefreshCw } from 'lucide-react';

interface DraggableCameraOverlayProps {
  videoRef: React.RefObject<HTMLDivElement | null>;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onFlipCamera?: () => void;
  hasMultipleCameras?: boolean;
  onClose?: () => void;
  initialPosition?: { x: number; y: number };
}

export function DraggableCameraOverlay({
  videoRef,
  isVideoEnabled,
  isAudioEnabled,
  onToggleVideo,
  onToggleAudio,
  onFlipCamera,
  hasMultipleCameras = false,
  onClose,
  initialPosition = { x: 16, y: 16 },
}: DraggableCameraOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerBounds = useRef({ width: 0, height: 0, left: 0, top: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!overlayRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = overlayRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    // Get parent container bounds for clamping
    const parent = overlayRef.current.parentElement;
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      containerBounds.current = {
        width: parentRect.width,
        height: parentRect.height,
        left: parentRect.left,
        top: parentRect.top,
      };
    }

    setIsDragging(true);
    overlayRef.current.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !overlayRef.current) return;
    e.preventDefault();

    const parent = overlayRef.current.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const overlayRect = overlayRef.current.getBoundingClientRect();

    let newX = e.clientX - parentRect.left - dragOffset.current.x;
    let newY = e.clientY - parentRect.top - dragOffset.current.y;

    // Clamp to parent bounds
    const maxX = parentRect.width - overlayRect.width;
    const maxY = parentRect.height - overlayRect.height;
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      ref={overlayRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="absolute z-20 rounded-xl overflow-hidden border-2 border-white/30 shadow-2xl"
      style={{
        left: position.x,
        top: position.y,
        width: 160,
        height: 120,
        touchAction: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: isDragging ? 'none' : 'box-shadow 0.2s',
      }}
    >
      {/* Camera video container */}
      <div
        ref={videoRef}
        className="absolute inset-0 w-full h-full bg-black"
        style={{ zIndex: 1 }}
      />

      {/* Drag handle indicator */}
      <div
        className="absolute top-1 left-1/2 -translate-x-1/2 z-30 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
        style={{ opacity: isDragging ? 1 : undefined }}
      >
        <Move size={10} className="text-white" />
        <span className="text-[8px] text-white font-bold">DRAG</span>
      </div>

      {/* Controls bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/80 to-transparent p-1.5 flex items-center justify-center gap-1.5">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleVideo}
          className={`p-1.5 rounded-full transition-colors ${
            isVideoEnabled ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500/80 hover:bg-red-600/80'
          }`}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isVideoEnabled ? <Video size={12} className="text-white" /> : <VideoOff size={12} className="text-white" />}
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleAudio}
          className={`p-1.5 rounded-full transition-colors ${
            isAudioEnabled ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500/80 hover:bg-red-600/80'
          }`}
          title={isAudioEnabled ? 'Mute mic' : 'Unmute mic'}
        >
          {isAudioEnabled ? <Mic size={12} className="text-white" /> : <MicOff size={12} className="text-white" />}
        </button>
        {hasMultipleCameras && onFlipCamera && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onFlipCamera}
            className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            title="Flip camera"
          >
            <RefreshCw size={12} className="text-white" />
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="p-1.5 rounded-full bg-red-500/60 hover:bg-red-500/80 transition-colors"
            title="Remove camera overlay"
          >
            <X size={12} className="text-white" />
          </button>
        )}
      </div>
    </div>
  );
}

export default DraggableCameraOverlay;
