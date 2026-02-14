import React, { useState, useCallback, useEffect } from 'react';
import { Stream, ChatMessage } from '../../types/broadcast';
import { useMobileLayout, useSafeAreaHeight } from '../../hooks/useMobileLayout';
import { cn } from '../../lib/utils';
import { SeatSession } from '../../hooks/useStreamSeats';
import TopLiveBar from './TopLiveBar';
import ChatBottomSheet from './ChatBottomSheet';
import GiftTray from './GiftTray';
import ParticipantStrip from './ParticipantStrip';
import BroadcastControls from './BroadcastControls';
import FloatingActionCluster from './FloatingActionCluster';
import MoreControlsDrawer from './MoreControlsDrawer';
import { MessageSquare } from 'lucide-react';

interface MobileBroadcastLayoutProps {
  stream: Stream;
  isHost: boolean;
  isModerator: boolean;
  messages: ChatMessage[];
  seats: Record<number, SeatSession>;
  children: React.ReactNode;
  onSendMessage: (text: string) => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onLeave: () => void;
  onJoinSeat: (index: number) => void;
  hostGlowingColor?: string;
  onShare?: () => void;
  isMicEnabled?: boolean;
  isCamEnabled?: boolean;
}

export default function MobileBroadcastLayout({
  stream,
  isHost,
  isModerator,
  messages,
  seats,
  children,
  onSendMessage,
  onToggleMic,
  onToggleCamera,
  onFlipCamera,
  onLeave,
  onJoinSeat,
  hostGlowingColor,
  onShare,
  isMicEnabled = true,
  isCamEnabled = true,
}: MobileBroadcastLayoutProps) {
  const { isMobile } = useMobileLayout();
  const { headerHeight, dockHeight, safeArea } = useSafeAreaHeight();
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // Removed local isMuted/isCameraOff state to rely on props
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGiftOpen, setIsGiftOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  // Track unread messages when chat is closed
  useEffect(() => {
    if (!isChatOpen && messages.length > 0) {
      setUnreadMessages((prev) => Math.min(prev + 1, 9));
    }
  }, [messages.length, isChatOpen]);

  // Clear unread when chat opens
  useEffect(() => {
    if (isChatOpen) {
      setUnreadMessages(0);
    }
  }, [isChatOpen]);

  const handleToggleMic = useCallback(() => {
    onToggleMic();
  }, [onToggleMic]);

  const handleToggleCamera = useCallback(() => {
    onToggleCamera();
  }, [onToggleCamera]);

  const handleLeave = useCallback(() => {
    if (confirm(isHost ? 'End this broadcast?' : 'Leave this broadcast?')) {
      onLeave();
    }
  }, [isHost, onLeave]);

  const handleGift = useCallback(() => {
    setIsGiftOpen(true);
  }, []);

  // Calculate stage height based on viewport
  const stageHeight = `calc(100dvh - ${headerHeight}px - ${isMinimized ? '60' : dockHeight}px)`;

  if (!isMobile) {
    // Desktop layout - return original structure
    return (
      <div className="relative h-screen w-full bg-black overflow-hidden">
        {children}
        <TopLiveBar
          stream={stream}
          hostName={isHost ? 'You' : 'Host'}
          hostGlowingColor={hostGlowingColor}
          onClose={onLeave}
          className="z-20"
        />
        <BroadcastControls
          stream={stream}
          isHost={isHost}
          isModerator={isModerator}
          isOnStage={isHost}
          chatOpen={isChatOpen}
          toggleChat={() => setIsChatOpen(!isChatOpen)}
          onGiftHost={handleGift}
          onLeave={handleLeave}
          onShare={onShare}
        />
        {isChatOpen && (
          <ChatBottomSheet
            messages={messages}
            onSendMessage={onSendMessage}
            isOpen={isChatOpen}
          />
        )}
        <MoreControlsDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          isMuted={!isMicEnabled}
          isCameraOff={!isCamEnabled}
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
          onFlipCamera={onFlipCamera}
          onLeave={handleLeave}
          isHost={isHost}
        />
        {isGiftOpen && (
          <GiftTray
            recipientId={stream.user_id}
            streamId={stream.id}
            onClose={() => setIsGiftOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div 
      className="relative h-dvh w-full bg-black overflow-hidden flex flex-col font-sans text-white"
      style={{ 
        paddingBottom: safeArea.bottom,
        minHeight: '100dvh'
      }}
    >
      {/* 1. Top HUD - Sticky Header */}
      <div 
        className="absolute top-0 left-0 right-0 z-50"
        style={{ 
          paddingTop: safeArea.top,
        }}
      >
        <TopLiveBar
          stream={stream}
          hostName={isHost ? 'You' : 'Host'}
          hostGlowingColor={hostGlowingColor}
          onClose={handleLeave}
          className=""
        />
      </div>

      {/* 2. Stage Area - Main Video Content */}
      <div 
        className="relative z-10 w-full"
        style={{ 
          height: stageHeight,
          marginTop: headerHeight,
        }}
      >
        {/* Video Layer */}
        <div className="absolute inset-0">
          {children}
        </div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/20 via-transparent to-black/40" />

        {/* Participant Strip (Guests) */}
        <div className="absolute top-4 left-0 right-0 z-20">
          <ParticipantStrip 
            seats={seats} 
            onJoinRequest={onJoinSeat}
          />
        </div>
      </div>

      {/* 3. Chat - Toggleable Overlay */}
      {isChatOpen && (
        <div className="absolute inset-0 z-40 bg-black/60" onClick={() => setIsChatOpen(false)}>
          <div 
            className="absolute right-0 top-0 bottom-0 bg-zinc-900 animate-slide-in-right w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatBottomSheet
              messages={messages}
              onSendMessage={onSendMessage}
              className="h-full"
            />
          </div>
        </div>
      )}

      {/* 4. Bottom Dock - Controls */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 z-30",
          isMinimized ? "pb-safe-bottom" : ""
        )}
        style={{ paddingBottom: safeArea.bottom }}
      >
        {isMinimized ? (
          // Minimized state - just show toggle button
          <button
            onClick={() => setIsMinimized(false)}
            className="w-full py-3 bg-zinc-900/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-center gap-2"
          >
            <span className="text-xs text-white/60">Controls</span>
            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/80">Tap to expand</span>
          </button>
        ) : (
          // Full controls
          <div className="bg-gradient-to-t from-black/95 via-black/90 to-transparent pt-4 pb-2">
            {/* Gift Tray Overlay */}
            {isGiftOpen && (
              <div className="absolute bottom-full left-0 right-0 pb-2" onClick={() => setIsGiftOpen(false)}>
                <div onClick={(e) => e.stopPropagation()}>
                  <GiftTray
                    recipientId={stream.user_id}
                    streamId={stream.id}
                    onClose={() => setIsGiftOpen(false)}
                  />
                </div>
              </div>
            )}

            {/* Bottom Action Buttons Row */}
            <div className="flex items-end justify-between px-4">
              {/* Left: Chat Toggle */}
              <button
                onClick={() => setIsChatOpen(true)}
                className="relative w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:bg-white/10 transition-colors"
              >
                <MessageSquare size={20} />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </button>

              {/* Center: Floating Actions */}
              <FloatingActionCluster
                isHost={isHost}
                onLike={() => {}}
                onGift={handleGift}
                onShare={onShare}
                onMenu={() => setIsDrawerOpen(true)}
              />

              {/* Right: Minimize Button */}
              <button
                onClick={() => setIsMinimized(true)}
                className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
              >
                <span className="text-xs font-bold">−</span>
              </button>
            </div>

            {/* Primary Controls Row */}
            <div className="flex items-center justify-center gap-4 mt-4 pb-2">
              <button
                onClick={handleToggleMic}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-all",
                  !isMicEnabled 
                    ? "bg-red-500/20 text-red-500 border border-red-500/30" 
                    : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
                )}
              >
                {!isMicEnabled ? <span className="text-xl">🔇</span> : <span className="text-xl">🎤</span>}
              </button>
              
              <button
                onClick={handleToggleCamera}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-all",
                  !isCamEnabled 
                    ? "bg-red-500/20 text-red-500 border border-red-500/30" 
                    : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
                )}
              >
                {!isCamEnabled ? <span className="text-xl">📷</span> : <span className="text-xl">📹</span>}
              </button>

              {isHost && (
                <button
                  onClick={handleLeave}
                  className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg hover:bg-red-700 transition-colors"
                >
                  <span className="text-xl">📴</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. More Controls Drawer Overlay */}
      <MoreControlsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        isMuted={!isMicEnabled}
        isCameraOff={!isCamEnabled}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onFlipCamera={onFlipCamera}
        onLeave={handleLeave}
        isHost={isHost}
      />
    </div>
  );
}
