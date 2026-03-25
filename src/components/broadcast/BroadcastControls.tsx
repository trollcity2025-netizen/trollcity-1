import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stream } from '../../types/broadcast';
import { supabase } from '../../lib/supabase';
import { Plus, Minus, LayoutGrid, Settings2, Coins, Lock, Unlock, Mic, MicOff, Video, VideoOff, MessageSquare, MessageSquareOff, Heart, Eye, Power, Sparkles, Palette, Gift, UserX, ImageIcon, LogOut, ChevronDown, ChevronUp, Share2, Package, Swords, Star, GripVertical, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { getCategoryConfig } from '../../config/broadcastCategories';
import BannedUsersList from './BannedUsersList';
import ThemeSelector from './ThemeSelector';
import { useAuthStore } from '../../lib/store';
import { PreflightStore } from '../../lib/preflightStore';
import { useParticipantAttributes } from '../../hooks/useParticipantAttributes';
import { AnimatePresence, motion } from 'framer-motion';
import { LocalVideoTrack, LocalAudioTrack } from 'livekit-client';
import { trollCityTheme } from '../../styles/trollCityTheme';

interface BroadcastControlsProps {
  stream: Stream;
  isHost: boolean;
  isModerator?: boolean;
  isOnStage: boolean;
  chatOpen: boolean;
  toggleChat: () => void;
  onGiftHost: () => void;
  onLeave?: () => void;
  onShare?: () => void;
  requiredBoxes?: number;
  onBoxCountUpdate?: (count: number) => void;
  onStreamEnd?: () => void;
  handleLike: () => void;
  toggleBattleMode: () => void;
  liveViewerCount?: number;
  localTracks: [LocalAudioTrack | null, LocalVideoTrack | null] | null;
  toggleCamera: () => void;
  toggleMicrophone: () => void;
  onPinProduct?: () => void;
  onRgbToggle?: (enabled: boolean) => void;
  // New props for UI state tracking
  isMicOn?: boolean;
  isCamOn?: boolean;
  // Box count from parent for instant sync
  boxCount?: number;
  setBoxCount?: (count: number) => void;
  // Stream refresh for battle mode
  onRefreshStream?: () => void;
  // Challenge management props
  pendingChallenges?: any[];
  onAcceptChallenge?: (challengeId: string, challengerId: string) => void;
  onDenyChallenge?: (challengeId: string) => void;
  // Challenge button props for viewers
  onChallengeBroadcaster?: () => void;
  hasPendingChallenge?: boolean;
  // Battle mode props
  onStartBattle?: () => void;
  battleActive?: boolean;
  battleEnabled?: boolean;
}

export default function BroadcastControls({
  stream,
  isHost,
  isModerator = false,
  isOnStage,
  chatOpen,
  toggleChat,
  onGiftHost,
  onLeave,
  onShare,
  requiredBoxes = 1,
  onBoxCountUpdate,
  onStreamEnd,
  handleLike,
  toggleBattleMode,
  liveViewerCount,
  localTracks,
  toggleCamera,
  toggleMicrophone,
  onPinProduct,
  onRgbToggle,
  isMicOn: propMicOn,
  isCamOn: propCamOn,
  boxCount: parentBoxCount,
  setBoxCount: parentSetBoxCount,
  onRefreshStream,
  pendingChallenges = [],
  onAcceptChallenge,
  onDenyChallenge,
  onChallengeBroadcaster,
  hasPendingChallenge = false,
  onStartBattle,
  battleActive = false,
  battleEnabled = false
}: BroadcastControlsProps) {
  const navigate = useNavigate();
  const [audioTrack, videoTrack] = localTracks || [];

  // Use props if provided (from parent state), otherwise derive from localTracks
  // IMPORTANT: Check .isEnabled on the track, not just track existence
  const isMicOn = propMicOn !== undefined ? propMicOn : (audioTrack ? (audioTrack.isEnabled ?? true) : false);
  const isCamOn = propCamOn !== undefined ? propCamOn : (videoTrack ? (videoTrack.isEnabled ?? true) : false);
  
  // Check if tracks are available
  const hasAudioTrack = !!audioTrack;
  const hasVideoTrack = !!videoTrack;
  const tracksReady = hasAudioTrack || hasVideoTrack;
  
  // Debug logging
  console.log('[BroadcastControls] Track states:', {
    propMicOn,
    propCamOn,
    isMicOn,
    isCamOn,
    hasAudioTrack,
    hasVideoTrack,
    tracksReady,
    isOnStage,
    audioEnabled: audioTrack?.enabled,
    videoEnabled: videoTrack?.enabled
  });
  
  const { user, isAdmin, profile } = useAuthStore();
  const [seatPrice, setSeatPrice] = useState(stream.seat_price || 0);
  // Per-box pricing: array of prices for each box (index 0 = host, 1+ = guests)
  const [seatPrices, setSeatPrices] = useState<number[]>(stream.seat_prices || [0, seatPrice, seatPrice, seatPrice, seatPrice, seatPrice]);

  const [debouncedPrice, setDebouncedPrice] = useState(seatPrice);
  const [debouncedSeatPrices, setDebouncedSeatPrices] = useState(seatPrices);

  const [showBannedList, setShowBannedList] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [likes, setLikes] = useState(0); // Local like count for immediate feedback
  const [isLiking, setIsLiking] = useState(false);
  const [isFeatureLoading, setIsFeatureLoading] = useState(false);

  const [isMinimized, setIsMinimized] = useState(false);
  const [showStreamControls, setShowStreamControls] = useState(true);
  // Default to stationary (not floating) at bottom of screen
  const [isFloating, setIsFloating] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Get category config to check if boxes can be added/removed
  const categoryConfig = getCategoryConfig(stream.category || 'general');
  const canModifyBoxes = categoryConfig.allowAddBox || categoryConfig.allowDeductBox;
  
  // For election category, only officers/admins can modify boxes
  const isElectionCategory = stream.category === 'election';
  
  // Check if user is officer or admin using multiple validation methods
  const isOfficerOrAdmin = 
    profile?.role === 'admin' ||
    profile?.role === 'secretary' ||
    profile?.role === 'lead_troll_officer' ||
    profile?.role === 'troll_officer' ||
    profile?.is_admin === true ||
    profile?.is_troll_officer === true ||
    profile?.is_lead_officer === true ||
    profile?.troll_role === 'admin' ||
    profile?.troll_role === 'lead_officer' ||
    profile?.troll_role === 'secretary' ||
    profile?.troll_role === 'pastor' ||
    false;
  const canEditElectionBoxes = !isElectionCategory || isOfficerOrAdmin;

  // Use parent boxCount if provided, otherwise use local state
  const [localBoxCount, setLocalBoxCount] = useState(stream.box_count || 1);
  
  // Use parent state if available, otherwise fall back to local
  const boxCount = parentBoxCount !== undefined ? parentBoxCount : localBoxCount;
  const setBoxCount = parentSetBoxCount !== undefined ? parentSetBoxCount : setLocalBoxCount;

  // Sync box count when stream updates from database (for viewers)
  useEffect(() => {
    // Only update if we don't have parent control and stream box_count changed
    if (parentBoxCount === undefined && stream.box_count !== undefined && stream.box_count !== localBoxCount) {
      setLocalBoxCount(stream.box_count);
    }
  }, [stream.box_count, parentBoxCount, localBoxCount]);

  // Sync likes from stream - only when total_likes changes
  useEffect(() => {
    if (typeof stream.total_likes === 'number') {
        setLikes(stream.total_likes);
    }
  }, [stream.total_likes]);

  // Sync seat prices from stream - keep stable, only update when broadcaster explicitly changes
  useEffect(() => {
    if (stream.seat_prices && Array.isArray(stream.seat_prices)) {
      // Only update if we don't have pending changes (debouncing)
      const currentPrices = stream.seat_prices;
      setSeatPrices(currentPrices);
      setDebouncedSeatPrices(currentPrices);
    }
  }, [stream.seat_prices]);
  
  // Also sync main seat price
  useEffect(() => {
    if (stream.seat_price !== undefined) {
      setSeatPrice(stream.seat_price);
      setDebouncedPrice(stream.seat_price);
    }
  }, [stream.seat_price]);

  // Sync box count when stream updates (only if no parent control)
  useEffect(() => {
    if (parentBoxCount === undefined) {
      setLocalBoxCount(stream.box_count || 1);
    }
  }, [stream.box_count, parentBoxCount]);
  const attributes = useParticipantAttributes(user ? [user.id] : [], stream.id);
  const myAttributes = user ? attributes[user.id] : null;
  const activePerks = myAttributes?.activePerks || [];
  
  // Only true admins can control broadcaster streams - NOT moderators
  const isTrueAdmin = isAdmin || profile?.troll_role === 'admin';
  const canManageStream = isHost || isTrueAdmin;
  // Only Host and Admins can control stream settings (Visuals, Price, Boxes)
  // Moderators can NOT control broadcaster streams
  const canEditStream = isHost || isTrueAdmin;
  
  // Feature toggle function for officers/admin
  const toggleFeature = async () => {
    if (!isOfficerOrAdmin || !user) return;
    
    setIsFeatureLoading(true);
    try {
      const newFeatured = !stream.is_featured;
      const { error } = await supabase
        .from('streams')
        .update({ 
          is_featured: newFeatured,
          featured_at: newFeatured ? new Date().toISOString() : null,
          featured_by: newFeatured ? user.id : null
        })
        .eq('id', stream.id);
      
      if (error) throw error;
      toast.success(newFeatured ? 'Stream featured successfully!' : 'Stream unfeatured');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to update featured status');
    } finally {
      setIsFeatureLoading(false);
    }
  };

  const togglePerk = async (perkId: string) => {
    if (!user) return;
    const isActive = activePerks.includes(perkId as any);

    try {
        if (isActive) {
             const { error } = await supabase.from('user_perks').update({ is_active: false }).eq('user_id', user.id).eq('perk_id', perkId);
             if (error) throw error;
        } else {
             // Try to find existing perk first (active or inactive)
             const { data, error: fetchError } = await supabase
                .from('user_perks')
                .select('id')
                .eq('user_id', user.id)
                .eq('perk_id', perkId)
                .maybeSingle();
             
             if (fetchError && fetchError.code !== 'PGRST116') {
                 throw fetchError;
             }

             if (data) {
                 const { error } = await supabase.from('user_perks').update({ is_active: true }).eq('id', data.id);
                 if (error) throw error;
             } else {
                 // Try to grant free perk (might fail if RLS prevents insert)
                 const { error } = await supabase.from('user_perks').insert({ 
                    user_id: user.id, 
                    perk_id: perkId, 
                    is_active: true, 
                    expires_at: new Date(Date.now() + 86400000).toISOString() 
                 });
                 
                 if (error) {
                     // 42501 is RLS violation
                     if (error.code === '42501') {
                         toast.error("You don't own this effect yet.");
                     } else {
                         throw error;
                     }
                 } else {
                     toast.success("Effect activated!");
                 }
             }
        }
    } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Failed to toggle effect");
    }
  };




  const updateStreamConfig = React.useCallback(async (price: number, showToast: boolean = true, perBoxPrices?: number[]) => {
    if (!canEditStream) return;
    try {
        const updates: { seat_price: number; seat_prices?: number[] } = { seat_price: price };
        if (perBoxPrices) {
            updates.seat_prices = perBoxPrices;
        }
        await supabase
        .from('streams')
        .update(updates)
        .eq('id', stream.id);
        if (showToast) {
            toast.success("Stream settings updated");
        }
    } catch (e) {
        console.error(e);
    }
  }, [canEditStream, stream.id]);

  // Debounce price updates to DB
  useEffect(() => {
    // If local price matches stream price (loosely to handle potential string/number mismatch), do nothing
    if (debouncedPrice == stream.seat_price) return;

    const timer = setTimeout(() => {
      // Don't show toast for auto-updates
      updateStreamConfig(debouncedPrice, false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [debouncedPrice, stream.seat_price, updateStreamConfig]);

  // Debounce per-box price updates to DB
  useEffect(() => {
    // Check if per-box prices have changed
    const currentPrices = stream.seat_prices || [0, stream.seat_price || 0, stream.seat_price || 0, stream.seat_price || 0, stream.seat_price || 0, stream.seat_price || 0];
    const hasChanged = debouncedSeatPrices.some((price, idx) => price !== currentPrices[idx]);
    if (!hasChanged) return;

    const timer = setTimeout(() => {
      updateStreamConfig(seatPrice, false, debouncedSeatPrices);
    }, 1000);
    return () => clearTimeout(timer);
  }, [debouncedSeatPrices, stream.seat_prices, seatPrice, updateStreamConfig]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only Host can change price (Prompt: Host only)
    if (!isHost) return;
    
        if (e.target.value === '') {
            setSeatPrice(0);
            setDebouncedPrice(0);
            return;
        }

        let val = parseInt(e.target.value, 10) || 0;
        if (val > 5000) val = 5000;
    setSeatPrice(val);
    setDebouncedPrice(val);
  };

  // Handler for per-box price changes
  const handleBoxPriceChange = (boxIndex: number, value: string) => {
    if (!isHost) return;
    
    const newPrices = [...seatPrices];
    let val = parseInt(value, 10) || 0;
    if (val > 5000) val = 5000;
    if (val < 0) val = 0;
    
    newPrices[boxIndex] = val;
    setSeatPrices(newPrices);
    setDebouncedSeatPrices(newPrices);
  };

  // Toggle per-box pricing mode
  const [enablePerBoxPricing, setEnablePerBoxPricing] = useState(false);


  
  const updateBoxCount = async (newCount: number) => {
    if (!canEditStream) return;

    const minLimit = Math.max(1, requiredBoxes);

    if (newCount < minLimit) {
      toast.error("Cannot reduce boxes below occupied seats");
      return;
    }

    if (newCount > 6) {
      toast.error("Maximum 6 boxes allowed");
      return;
    }

    // Update local state immediately for instant UI feedback (optimistic update)
    setBoxCount(newCount);

    // notify parent for any additional handling (broadcast to viewers)
    if (onBoxCountUpdate) {
      onBoxCountUpdate(newCount);
    }

    // Update database asynchronously (viewers will get realtime update)
    try {
      console.log('[BroadcastControls] Updating database with box_count:', newCount);
      const { error } = await supabase
        .from('streams')
        .update({ box_count: newCount })
        .eq('id', stream.id);
      
      if (error) {
        console.error('[BroadcastControls] Error updating box count:', error);
        toast.error("Failed to update box count");
        // Revert UI on error
        setBoxCount(stream.box_count || 1);
        return;
      }
      
      console.log('[BroadcastControls] Box count updated in database to:', newCount);
    } catch (e) {
      console.error('[BroadcastControls] Exception updating box count:', e);
      toast.error("Failed to update box count");
      setBoxCount(stream.box_count || 1);
    }
  };

  const toggleStreamRgb = async () => {
     // Only Host can toggle RGB (Prompt: Host only)
     if (!isHost) return;
     
     const enabling = !stream.has_rgb_effect;
     
     try {
        // If enabling, we might be purchasing. 
        // We let the RPC handle the logic of "charge if not purchased yet".
        const { data, error } = await supabase.rpc('purchase_rgb_broadcast', { 
             p_stream_id: stream.id, 
             p_enable: enabling 
        });

        if (error) throw error;
        
        // Handle array or object return
        const result = Array.isArray(data) ? data[0] : data;
        
        if (!result || !result.success) throw new Error(result?.error || "Failed to update RGB");
        
        // Update local state based on success
        if (onRgbToggle) {
          onRgbToggle(enabling);
        }
        
        if (result.message === 'Purchased and Enabled') {
             toast.success("RGB Unlocked! (-10 Coins)");
        } else {
             toast.success(enabling ? "RGB Effect Enabled" : "RGB Effect Disabled");
        }
     } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Failed to update RGB setting");
        // Revert local state if needed (though we didn't optimistically update this time)
     }
  };

  const handleEndStream = () => {
    if (onStreamEnd) {
      onStreamEnd();
    }
  };



  // If closed, show a small button to reopen
  if (isClosed) {
    return (
      <div 
        className="fixed z-50"
        style={{ left: position.x, top: position.y }}
      >
        <button
          onClick={() => setIsClosed(false)}
          className="bg-slate-900/95 border border-yellow-500/50 rounded-full p-3 shadow-lg hover:bg-slate-800 transition-colors"
          title="Show Controls"
        >
          <Settings2 size={20} className="text-yellow-500" />
        </button>
      </div>
    );
  }

  // Drag handlers for floating bubble mode
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isFloating) {
      setIsDragging(true);
      dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && isFloating) {
      setPosition({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className={cn(
        "bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.4)] relative transition-all duration-300",
        isMinimized ? "w-56 py-3 px-4" : isFloating ? "w-80 p-4" : "w-full p-4",
        isFloating ? "fixed z-50 border-2 border-purple-500/30" : ""
      )}
      style={isFloating ? { left: position.x, top: position.y } : undefined}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
        {/* Drag handle for floating bubble */}
        <div 
          className={cn(
            "flex items-center justify-between mb-2",
            isFloating && "cursor-move pb-2 border-b border-white/10"
          )}
          onMouseDown={handleMouseDown}
        >
          {isFloating ? (
            <>
              <div className="flex items-center gap-2">
                <GripVertical size={16} className="text-yellow-500" />
                <span className="text-xs text-yellow-500 font-bold">Controls</span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                    onClick={() => setIsFloating(false)}
                    className="bg-slate-800 border border-white/10 rounded-full p-1 text-slate-400 hover:text-white"
                    title="Dock"
                >
                    <Settings2 size={14} />
                </button>
                <button 
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="bg-slate-800 border border-white/10 rounded-full p-1 text-slate-400 hover:text-white"
                    title={isMinimized ? "Expand" : "Minimize"}
                >
                    {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button 
                    onClick={() => setIsClosed(true)}
                    className="bg-red-500/20 border border-red-500/30 rounded-full p-1 text-red-400 hover:text-red-300"
                    title="Close"
                >
                    <X size={14} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold">Controls</span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                    onClick={() => setIsFloating(true)}
                    className="bg-yellow-500/20 border border-yellow-500/30 rounded-full p-1.5 text-yellow-500 hover:text-yellow-400"
                    title="Make Floating"
                >
                    <GripVertical size={14} />
                </button>
                <button 
                    onClick={() => setIsClosed(true)}
                    className="bg-red-500/20 border border-red-500/30 rounded-full p-1 text-red-400 hover:text-red-300"
                    title="Close"
                >
                    <X size={14} />
                </button>
              </div>
            </>
          )}
        </div>

        {isMinimized ? (
             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Controls</span>
        ) : (
        <>


        {showBannedList && (
            <BannedUsersList streamId={stream.id} onClose={() => setShowBannedList(false)} />
        )}

        {showThemeSelector && (
            <ThemeSelector 
                streamId={stream.id} 
                currentThemeUrl={stream.active_theme_url} 
                onClose={() => setShowThemeSelector(false)} 
            />
        )}

        {/* Mobile: Stack title and controls vertically; Desktop: side by side */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
            <div className="flex items-center gap-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <Settings2 className="text-purple-400" />
                    Controls
                </h3>
            </div>

            {/* Mobile: full width, wrap buttons; Desktop: inline */}
            <div className="flex items-center gap-2 flex-wrap justify-center md:justify-end w-full md:w-auto">
                 {/* Viewer Count */}
                 <div className="flex items-center gap-1.5 md:gap-2 bg-black/40 px-2 md:px-3 py-1 rounded-full border border-white/5">
                     <Eye size={14} className="text-blue-400" />
                     <span className="text-xs md:text-sm font-bold text-white">
                         {liveViewerCount !== undefined ? liveViewerCount : ((stream as any).current_viewers || stream.viewer_count || 0)}
                     </span>
                 </div>

                 {/* Like Count */}
                 <div className="flex items-center gap-1.5 md:gap-2 bg-black/40 px-2 md:px-3 py-1 rounded-full border border-white/5">
                     <Heart size={14} className="text-pink-500 fill-pink-500/20" />
                     <span className="text-xs md:text-sm font-bold text-white">{likes}</span>
                 </div>

                 {/* Mic & Cam Controls (Stage Only, when tracks ready) */}
                 {isOnStage && tracksReady && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleMicrophone(); }}
                            disabled={!hasAudioTrack}
                            className={cn(
                                "p-2 rounded-lg transition-colors group relative",
                                isMicOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-500 hover:bg-red-500/30",
                                !hasAudioTrack && "opacity-50 cursor-not-allowed"
                            )}
                            title={hasAudioTrack ? (isMicOn ? "Mute Microphone" : "Unmute Microphone") : "Microphone not available"}
                        >
                            {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleCamera(); }}
                            disabled={!hasVideoTrack}
                            className={cn(
                                "p-2 rounded-lg transition-colors group relative mr-2",
                                isCamOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-500 hover:bg-red-500/30",
                                !hasVideoTrack && "opacity-50 cursor-not-allowed"
                            )}
                            title={hasVideoTrack ? (isCamOn ? "Turn Camera Off" : "Turn Camera On") : "Camera not available"}
                        >
                            {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
                        </button>
                    </>
                 )}
                 
                 {/* Loading indicator when on stage but tracks not ready */}
                 {isOnStage && !tracksReady && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 rounded-full border border-yellow-500/20">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                        <span className="text-xs text-yellow-500">Initializing...</span>
                    </div>
                 )}

                 {/* Share Button */}
                 {onShare && (
                     <button
                        onClick={(e) => { e.stopPropagation(); onShare(); }}
                        className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors group"
                        title="Share Stream"
                     >
                        <Share2 size={20} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                     </button>
                 )}

                 {/* Like Button - Only show for non-hosts (viewers) */}
                 {!isHost && (
                 <button
                    onClick={(e) => { e.stopPropagation(); handleLike(); }}
                    disabled={isLiking}
                    className="p-2 hover:bg-pink-500/20 rounded-lg transition-colors group"
                    title="Like Stream"
                 >
                    <Heart size={20} className={cn("text-slate-400 group-hover:text-pink-500 transition-colors", isLiking && "scale-125 text-pink-500 fill-pink-500")} />
                 </button>
                 )}

                  {/* Challenge Button - For Viewers */}
                  {onChallengeBroadcaster && !isHost && !PreflightStore.getBattlesDisabled() && (
                      <button
                          onClick={(e) => { e.stopPropagation(); onChallengeBroadcaster(); }}
                          disabled={hasPendingChallenge}
                          className={cn(
                              "p-2 rounded-lg transition-colors flex items-center gap-2",
                              hasPendingChallenge
                                  ? "bg-yellow-500/20 text-yellow-400 cursor-wait"
                                  : "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black"
                          )}
                          title={hasPendingChallenge ? "Challenge pending..." : "Challenge broadcaster to a battle!"}
                      >
                          <Swords size={20} className={hasPendingChallenge ? "animate-pulse" : ""} />
                      </button>
                  )}

                  {/* Start Battle Button - For Guests on Stage when battle is enabled */}
                  {(() => {
                    const showStartBattle = onStartBattle && isOnStage && battleEnabled && !battleActive;
                    return showStartBattle && (
                      <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            console.log('[BroadcastControls] ✅ Start Battle clicked!');
                            if (onStartBattle) onStartBattle(); 
                          }}
                          className="p-2 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white transition-colors flex items-center gap-2 animate-pulse"
                          title="Start Battle!"
                      >
                          <Swords size={20} />
                          <span className="text-xs font-bold">Start Battle</span>
                      </button>
                    );
                  })()}

                 {/* Chat Toggle */}
                 <button 
                    onClick={(e) => { e.stopPropagation(); toggleChat(); }}
                    className={cn(
                        "p-2 rounded-lg transition-colors flex items-center gap-2",
                        chatOpen ? "bg-purple-500/20 text-purple-400" : "hover:bg-white/5 text-slate-400"
                    )}
                    title="Toggle Chat"
                 >
                    {chatOpen ? <MessageSquare size={20} /> : <MessageSquareOff size={20} />}
                 </button>

                 {/* Feature Button - Officers/Admin Only */}
                 {isOfficerOrAdmin && (
                     <button
                       onClick={(e) => { e.stopPropagation(); toggleFeature(); }}
                       disabled={isFeatureLoading}
                       className={cn(
                           "p-2 rounded-lg transition-colors flex items-center gap-2",
                           stream.is_featured 
                               ? "bg-pink-500/20 text-pink-400 hover:bg-pink-500/30" 
                               : "hover:bg-pink-500/20 text-slate-400 hover:text-pink-400"
                       )}
                       title={stream.is_featured ? "Unfeature Stream" : "Feature Stream"}
                     >
                        <Star size={20} className={cn(stream.is_featured && "fill-pink-400")} />
                     </button>
                 )}

                 {canManageStream && (
                    <>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowBannedList(!showBannedList);
                            setShowThemeSelector(false);
                        }}
                        className={cn("p-2 rounded-lg transition-colors", showBannedList ? "bg-red-500/20 text-red-400" : "hover:bg-white/5 text-slate-400")}
                        title="Banned Users"
                    >
                        <UserX size={20} />
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowThemeSelector(!showThemeSelector);
                            setShowBannedList(false);
                        }}
                        className={cn("p-2 rounded-lg transition-colors", showThemeSelector ? "bg-purple-500/20 text-purple-400" : "hover:bg-white/5 text-slate-400")}
                        title="Broadcast Theme"
                    >
                        <ImageIcon size={20} />
                    </button>
                    </>
                 )}



                 {/* Pin Product (Host Only) */}
                 {isHost && onPinProduct && (
                     <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onPinProduct();
                        }}
                        className="p-2 rounded-lg hover:bg-white/5 text-slate-400 transition-colors flex items-center gap-2"
                        title="Pin Product"
                    >
                        <Package size={20} />
                    </button>
                 )}

                 {/* End Stream (Host Only) */}
                 {isHost && (
                     <button
                    onClick={(e) => { e.stopPropagation(); handleEndStream(); }}
                    className="ml-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-500 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors relative z-50"
                >
                        <Power size={16} />
                        End Stream
                     </button>
                 )}

                 {/* Leave Seat (Guest Only) */}
                 {onLeave && isOnStage && !isHost && (
                     <button 
                        onClick={(e) => { e.stopPropagation(); onLeave(); }}
                        className="ml-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-500 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                     >
                        <LogOut size={16} />
                        Leave
                     </button>
                 )}
            </div>
        </div>

        {/* Stream Controls - Host & Staff */}
        {canManageStream && (
            <div className="flex flex-col gap-4">
                <div
                className="flex items-center justify-between border-t border-white/10 pt-4 cursor-pointer hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
                onClick={() => setShowStreamControls(!showStreamControls)}
              >
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <Settings2 className="text-yellow-500" />
                        Stream Controls
                    </h3>
                    <div className="flex items-center gap-4">
                        <ChevronDown 
                            size={20} 
                            className={cn("text-slate-400 transition-transform duration-200", showStreamControls && "rotate-180")} 
                        />
                    </div>
                </div>

                <AnimatePresence>
                {showStreamControls && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-2">
                            {/* Box Layout Control - Only show if category allows adding/removing boxes and user has permission */}
                            {canModifyBoxes && canEditElectionBoxes && (
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                        <span className="text-slate-400 text-sm font-medium flex items-center gap-2">
                            <LayoutGrid size={16} />
                            Boxes
                        </span>
                        <div className="flex items-center gap-3">
                            <button 
                                type="button"
                                onClick={() => updateBoxCount(boxCount - 1)}
                                disabled={!canEditStream || boxCount <= Math.max(1, requiredBoxes) || !categoryConfig.allowDeductBox}
                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition disabled:opacity-50"
                            >
                                <Minus size={16} />
                            </button>
                            <span className="font-bold text-white min-w-[20px] text-center">{boxCount}</span>
                            <button 
                                type="button"
                                onClick={() => updateBoxCount(boxCount + 1)}
                                disabled={!canEditStream || boxCount >= 6 || !categoryConfig.allowAddBox}
                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition disabled:opacity-50"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                            )}

                    {/* Seat Pricing - Only visible to Host & Staff */}
                    {canManageStream && (
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <label className="text-slate-400 text-xs font-medium flex items-center gap-1">
                                <Coins size={12} className="text-yellow-500" />
                                {enablePerBoxPricing ? 'Per-Box Pricing' : 'Seat Price'}
                            </label>
                            <button
                                onClick={() => setEnablePerBoxPricing(!enablePerBoxPricing)}
                                className={cn(
                                    "text-[10px] px-2 py-1 rounded-full transition-colors",
                                    enablePerBoxPricing 
                                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" 
                                        : "bg-zinc-700 text-slate-400 hover:bg-zinc-600"
                                )}
                            >
                                {enablePerBoxPricing ? 'Simple Mode' : 'Advanced Mode'}
                            </button>
                        </div>
                        
                        {!enablePerBoxPricing ? (
                            // Simple mode - single price for all seats
                            <div className="flex items-center gap-3">
                                <input 
                                    type="number" 
                                    min="0"
                                    max="5000"
                                    value={seatPrice === 0 ? '' : seatPrice}
                                    onChange={handlePriceChange}
                                    disabled={!isHost}
                                    className={cn(
                                        "flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-yellow-500",
                                        (!isHost) && "opacity-50 cursor-not-allowed"
                                    )}
                                    placeholder="0 = Free"
                                />
                                <span className="text-xs text-zinc-500">coins</span>
                            </div>
                        ) : (
                            // Advanced mode - per-box pricing
                            <div className="grid grid-cols-3 gap-2">
                                {Array.from({ length: 6 }, (_, i) => (
                                    <div key={i} className="flex flex-col gap-1">
                                        <label className="text-[10px] text-zinc-500">
                                            {i === 0 ? 'Host' : `Seat ${i}`}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="5000"
                                            value={seatPrices[i] || 0}
                                            onChange={(e) => handleBoxPriceChange(i, e.target.value)}
                                            disabled={!isHost || i === 0} // Host seat is always free
                                            className={cn(
                                                "w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-yellow-500",
                                                (i === 0) && "opacity-50 cursor-not-allowed bg-slate-900"
                                            )}
                                            placeholder="0"
                                            title={i === 0 ? "Host seat is always free" : `Price for seat ${i}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <p className="text-[10px] text-zinc-500">
                            {enablePerBoxPricing 
                                ? "Set 0 for free seats. Host seat is always free." 
                                : "Set to 0 for free seats, or charge coins to join."}
                        </p>
                    </div>
                    )}

                    {/* Visual Effects - HOST ONLY */}
                    {isHost && (
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                         <span className="text-slate-400 text-sm font-medium flex items-center gap-2">
                            <Palette size={16} className="text-purple-400" />
                            Visuals
                         </span>
                         <button onClick={() => toggleStreamRgb()} className={cn("p-1 px-2 rounded-full", stream.has_rgb_effect ? "bg-purple-500" : "bg-zinc-700")}>
           <div className={cn("w-4 h-4 rounded-full", stream.has_rgb_effect ? "bg-white" : "bg-zinc-500")}></div>
         </button>
                    </div>
                    )}


                </div>
                </motion.div>
                )}
                </AnimatePresence>
            </div>
        )}
        </>
        )}
    </div>
  );
}
