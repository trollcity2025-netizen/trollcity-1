import React from 'react';
import { Mic, MicOff, Video, VideoOff, Camera, Settings, Shield, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MoreControlsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isMuted: boolean;
  isCameraOff: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onSettings?: () => void;
  onLeave?: () => void;
  onClearStage?: () => void;
  isHost?: boolean;
  userRole?: string | null;
}

export default function MoreControlsDrawer({
  isOpen,
  onClose,
  isMuted,
  isCameraOff,
  onToggleMic,
  onToggleCamera,
  onFlipCamera,
  onSettings,
  onLeave,
  onClearStage,
  isHost,
  userRole
}: MoreControlsDrawerProps) {
  if (!isOpen) return null;

  const canClearStage = userRole === 'admin' || userRole === 'lead_troll_officer';

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-[60] animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl z-[70] p-6 pb-safe-bottom animate-slide-up border-t border-white/10">
        <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />
        
        <div className="grid grid-cols-4 gap-4 mb-8">
          <ControlButton 
            icon={isMuted ? MicOff : Mic} 
            label={isMuted ? "Unmute" : "Mute"}
            active={!isMuted}
            onClick={onToggleMic}
          />
          <ControlButton 
            icon={isCameraOff ? VideoOff : Video} 
            label={isCameraOff ? "Start Video" : "Stop Video"}
            active={!isCameraOff}
            onClick={onToggleCamera}
          />
          <ControlButton 
            icon={Camera} 
            label="Flip"
            onClick={onFlipCamera}
          />
          <ControlButton 
            icon={Settings} 
            label="Settings"
            onClick={onSettings}
          />
          {isHost && (
            <ControlButton 
                icon={Shield} 
                label="Admin"
                onClick={() => {}}
            />
          )}
        </div>

        <button 
          onClick={onLeave}
          className="w-full bg-zinc-800 text-red-400 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <LogOut size={20} />
          {isHost ? "End Broadcast" : "Leave Broadcast"}
        </button>
      </div>
    </>
  );
}

function ControlButton({ icon: Icon, label, active, onClick }: any) {
    return (
        <button 
            onClick={onClick}
            className="flex flex-col items-center gap-2 group"
        >
            <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200",
                active 
                    ? "bg-zinc-800 text-white border border-white/10" 
                    : "bg-zinc-800/50 text-zinc-400 border border-transparent group-hover:bg-zinc-800"
            )}>
                <Icon size={24} />
            </div>
            <span className="text-xs text-zinc-400 font-medium">{label}</span>
        </button>
    );
}
