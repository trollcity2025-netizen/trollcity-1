import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stream } from '../../types/broadcast';
import { supabase } from '../../lib/supabase';
import { Plus, Minus, LayoutGrid, Settings2, Coins, Lock, Unlock, Mic, MicOff, Video, VideoOff, MessageSquare, MessageSquareOff, Heart, Eye, Power, Sparkles, Palette, Gift, UserX, ImageIcon, LogOut, ChevronDown, ChevronUp, Share2, UserCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import BannedUsersList from './BannedUsersList';
import ThemeSelector from './ThemeSelector';
import { useAgora } from '../../hooks/useAgora';
import { useAuthStore } from '../../lib/store';
import { useParticipantAttributes } from '../../hooks/useParticipantAttributes';
import { AnimatePresence, motion } from 'framer-motion';
import { useStreamSeats } from '../../hooks/useStreamSeats';

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
  liveViewerCount?: number;
  onShowBattleManager?: () => void;
  mySession: any;
  onLeaveStage: () => Promise<void>;
}

export default function BroadcastControls({ stream, isHost, isModerator = false, isOnStage, chatOpen, toggleChat, onGiftHost, onLeave, onShare, requiredBoxes = 1, onBoxCountUpdate, liveViewerCount, onShowBattleManager, _mySession, _onLeaveStage }: BroadcastControlsProps) {
  const _navigate = useNavigate();
  const { publish, unpublish, localVideoTrack, _remoteUsers } = useAgora();
  const isMicrophoneEnabled = localVideoTrack ? localVideoTrack.isMuted : false;
  const isCameraEnabled = localVideoTrack ? true : false;
  const { user, isAdmin, profile } = useAuthStore();
  const { _seats, _joinSeat, _kickParticipant } = useStreamSeats(stream.id, user?.id, profile);
  const [seatPrice, setSeatPrice] = useState(stream.seat_price || 0);
  const [locked, setLocked] = useState(stream.are_seats_locked || false);
  const [debouncedPrice, setDebouncedPrice] = useState(seatPrice);
  const [showEffects, setShowEffects] = useState(false);
  const [showBannedList, setShowBannedList] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [_likes, _setLikes] = useState(0); // Local like count for immediate feedback
  const [_isLiking, _setIsLiking] = useState(false);
  const [_hasRgb, setHasRgb] = useState(stream.has_rgb_effect || false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showStreamControls, setShowStreamControls] = useState(true);
    const _lastLikeRef = useRef(0);

  // Sync likes from stream
  useEffect(() => {
    if (typeof (stream as any).total_likes === 'number') {
        _setLikes((stream as any).total_likes);
    }
  }, [stream]);

  const toggleMic = async () => {
    if (localVideoTrack) {
      try {
        await localVideoTrack.setMuted(!isMicrophoneEnabled);
      } catch (e) {
        console.error('Failed to toggle mic:', e);
        toast.error('Failed to toggle microphone');
      }
    }
  };

  const toggleCam = async () => {
    if (localVideoTrack) {
      await unpublish();
    } else {
      await publish();
    }
  };
  const attributes = useParticipantAttributes(user ? [user.id] : [], stream.id);
  const myAttributes = user ? attributes[user.id] : null;
  const activePerks = myAttributes?.activePerks || [];
  
  const isStaff = isAdmin || profile?.troll_role === 'admin' || profile?.troll_role === 'moderator' || isModerator;
  const canManageStream = isHost || isStaff;
  // Only Host can control stream settings (Visuals, Price, Boxes)
  // Staff/Mods can moderate (ban users), but NOT change stream settings (unless specified)
  const canEditStream = isHost || (isStaff && !isModerator); // Only true staff can edit stream settings, mods just moderate chat/users
    const isTrollmersStream = stream.stream_kind === 'trollmers';
  const isChurchStream = stream.category === 'church';

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

  // Sync local state with stream data
  useEffect(() => {
    setLocked(stream.are_seats_locked || false);
    setHasRgb(stream.has_rgb_effect || false);
  }, [stream]);

  const isMicOn = isMicrophoneEnabled;
  const isCamOn = isCameraEnabled;


  const updateStreamConfig = React.useCallback(async (price: number, isLocked: boolean, showToast: boolean = true) => {
    if (!canEditStream) return;
    try {
        await supabase
        .from('streams')
        .update({ seat_price: price, are_seats_locked: isLocked })
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
      updateStreamConfig(debouncedPrice, locked, false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [debouncedPrice, stream.seat_price, locked, updateStreamConfig]);

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

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = e.target as HTMLInputElement;
      const newPrice = parseInt(target.value, 10) || 0;
      setSeatPrice(newPrice);
      setDebouncedPrice(newPrice);
      updateStreamConfig(newPrice, locked, true);
      target.blur();
    }
  };

  const toggleLock = () => {
    const newLocked = !locked;
    setLocked(newLocked);
    updateStreamConfig(seatPrice, newLocked, true); // Explicitly show toast for manual action
  };
  
  const updateBoxCount = (newCount: number) => {
    if (!canEditStream) return;
        if (isTrollmersStream && newCount !== 1) {
            toast.error('Trollmers broadcasts are locked to 1 box');
            return;
        }

    // Enforce limits
    const minLimit = Math.max(1, requiredBoxes);
    if (newCount < minLimit) {
      toast.error("Cannot reduce boxes below occupied seats");
      return;
    }
    if (newCount > 6) {
      toast.error("Maximum 6 boxes allowed");
      return;
    }

    // Call the parent handler
    if (onBoxCountUpdate) {
      onBoxCountUpdate(newCount);
    }
  };

  const toggleStreamRgb = async () => {
     // Only Host can toggle RGB (Prompt: Host only)
     if (!isHost) return;
     
     const enabling = !_hasRgb;
     
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
        setHasRgb(enabling);
        
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

  const handleEndStream = async () => {
    // if (!confirm("Are you sure you want to END the broadcast?")) return; // Removed confirmation as requested
    try {
        // Use p_stream_id to match RPC parameter name
        const { data, error } = await supabase.rpc('end_stream', { p_stream_id: stream.id });
        
        if (error) throw error;
        // Check if data is array or object
        const result = Array.isArray(data) ? data[0] : data;
        if (result && result.success === false) throw new Error(result.message || "Failed to end stream");

        toast.success("Broadcast ended");
    } catch (e: any) {
        console.error("End Stream RPC Error:", e);
        
        // Fallback for legacy support if RPC fails or doesn't exist yet
        // Covers: "function end_stream does not exist", "Could not find the function... in the schema cache"
        const msg = (e?.message || JSON.stringify(e) || '').toLowerCase();
        
        if (
            msg.includes('function') || 
            msg.includes('schema cache') || 
            msg.includes('could not find') ||
            e?.code === '42883' || // Undefined function
            e?.code === 'PGRST202' // Function not found
        ) {
             const { error: updateError } = await supabase
                .from('streams')
                .update({ 
                    status: 'ended', 
                    is_live: false,
                    ended_at: new Date().toISOString() 
                })
                .eq('id', stream.id);
             
             if (updateError) {
                 toast.error("Failed to end broadcast (DB Error)");
             } else {
                 toast.success("Broadcast ended");
             }
        } else {
             toast.error(e?.message || "Failed to end broadcast");
        }
    }
  };

  const _handleMuteParticipant = async (_userId: string) => {
    if (!isHost && !isStaff) return;
    // TODO: Implement Agora mute participant
    toast.success("Participant muted");
  };

  const _handleUnpublishParticipant = async (_userId: string) => {
    if (!isHost && !isStaff) return;
    // TODO: Implement Agora unpublish participant
    toast.success("Participant camera turned off");
  };

  return (
    <div className={cn(
        "bg-zinc-900/90 border-t border-white/10 backdrop-blur-sm mx-auto rounded-xl shadow-2xl relative transition-all duration-300",
        isMinimized ? "w-48 py-2 px-4 flex justify-center items-center" : "w-full p-4 flex flex-col gap-4 max-w-4xl"
    )}>
        <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-800 border border-white/10 rounded-full p-1 text-zinc-400 hover:text-white shadow-lg z-50"
            title={isMinimized ? "Expand Controls" : "Minimize Controls"}
        >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {isMinimized ? (
             <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Controls</span>
        ) : (
        <>
        <AnimatePresence>
        {showEffects && (
            <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-full right-0 w-64 mb-4 bg-zinc-900 border border-white/10 rounded-xl p-4 shadow-2xl z-[100]"
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Sparkles size={16} className="text-yellow-400" />
                        My Effects
                    </h3>
                    <button onClick={() => setShowEffects(false)} className="text-sm text-zinc-400 hover:text-white">Close</button>
                </div>
                
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-black/40 rounded-lg border border-white/5">
                        <span className="text-sm text-zinc-300 font-medium">RGB Border</span>
                        <button 
                            onClick={() => togglePerk('perk_rgb_username')}
                            className={cn("w-10 h-5 rounded-full transition-colors relative", 
                                activePerks.includes('perk_rgb_username' as any) ? "bg-green-500" : "bg-zinc-700"
                            )}
                        >
                            <div className={cn("absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform shadow-sm", 
                                activePerks.includes('perk_rgb_username' as any) && "translate-x-5"
                            )} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-black/40 rounded-lg border border-white/5">
                        <span className="text-sm text-zinc-300 font-medium">Neon Glow</span>
                        <button 
                            onClick={() => togglePerk('perk_global_highlight')}
                            className={cn("w-10 h-5 rounded-full transition-colors relative", 
                                activePerks.includes('perk_global_highlight' as any) ? "bg-green-500" : "bg-zinc-700"
                            )}
                        >
                            <div className={cn("absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform shadow-sm", 
                                activePerks.includes('perk_global_highlight' as any) && "translate-x-5"
                            )} />
                        </button>
                    </div>
                    <p className="text-[10px] text-zinc-500 text-center mt-2">
                        Effects visible to everyone in the room
                    </p>
                </div>
            </motion.div>
        )}
        </AnimatePresence>

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

        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <Settings2 className="text-purple-400" />
                    Controls
                </h3>
                
                {/* Viewer Count */}
                <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/5">
                    <Eye size={16} className="text-blue-400" />
                    <span className="text-sm font-bold text-white">
                        {liveViewerCount !== undefined ? liveViewerCount : ((stream as any).current_viewers || stream.viewer_count || 0)}
                    </span>
                </div>

                {/* Like Count */}
                <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/5">
                    <Heart size={16} className="text-pink-500 fill-pink-500/20" />
                    <span className="text-sm font-bold text-white">{_likes}</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                 {/* Mic & Cam Controls (Stage Only) */}
                 {isOnStage && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleMic(); }}
                            className={cn(
                                "p-2 rounded-lg transition-colors group relative",
                                isMicOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                            )}
                            title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                        >
                            {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleCam(); }}
                            className={cn(
                                "p-2 rounded-lg transition-colors group relative mr-2",
                                isCamOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                            )}
                            title={isCamOn ? "Turn Camera Off" : "Turn Camera On"}
                        >
                            {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
                        </button>
                    </>
                 )}

                 {/* Gift Button - Show for EVERYONE (except host maybe, but usually everyone can open tray) */}
                 <button
                    onClick={(e) => { e.stopPropagation(); onGiftHost(); }}
                    className="p-2 hover:bg-yellow-500/20 rounded-lg transition-colors group"
                    title="Send Gift"
                 >
                    <Gift size={20} className="text-zinc-400 group-hover:text-yellow-500 transition-colors" />
                 </button>

                 {/* Share Button */}
                 {onShare && (
                     <button
                        onClick={(e) => { e.stopPropagation(); onShare(); }}
                        className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors group"
                        title="Share Stream"
                     >
                        <Share2 size={20} className="text-zinc-400 group-hover:text-blue-500 transition-colors" />
                     </button>
                 )}

                 {/* Like Button */}
                 <button
                    onClick={(e) => { e.stopPropagation(); /* TODO: Implement like */ }}
                    disabled={_isLiking}
                    className="p-2 hover:bg-pink-500/20 rounded-lg transition-colors group"
                    title="Like Stream"
                 >
                    <Heart size={20} className={cn("text-zinc-400 group-hover:text-pink-500 transition-colors", _isLiking && "scale-125 text-pink-500 fill-pink-500")} />
                 </button>

                 {/* Chat Toggle */}
                 <button 
                    onClick={(e) => { e.stopPropagation(); toggleChat(); }}
                    className={cn(
                        "p-2 rounded-lg transition-colors flex items-center gap-2",
                        chatOpen ? "bg-purple-500/20 text-purple-400" : "hover:bg-white/5 text-zinc-400"
                    )}
                    title="Toggle Chat"
                 >
                    {chatOpen ? <MessageSquare size={20} /> : <MessageSquareOff size={20} />}
                 </button>

                 {canManageStream && (
                    <>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowBannedList(!showBannedList);
                            setShowEffects(false);
                            setShowThemeSelector(false);
                        }}
                        className={cn("p-2 rounded-lg transition-colors", showBannedList ? "bg-red-500/20 text-red-400" : "hover:bg-white/5 text-zinc-400")}
                        title="Banned Users"
                    >
                        <UserX size={20} />
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowThemeSelector(!showThemeSelector);
                            setShowEffects(false);
                            setShowBannedList(false);
                        }}
                        className={cn("p-2 rounded-lg transition-colors", showThemeSelector ? "bg-purple-500/20 text-purple-400" : "hover:bg-white/5 text-zinc-400")}
                        title="Broadcast Theme"
                    >
                        <ImageIcon size={20} />
                    </button>
                    {isHost && isChurchStream && (
                        <button
                            onClick={(e) => { e.stopPropagation(); /* TODO: Show approval panel */ }}
                            className="p-2 hover:bg-green-500/20 rounded-lg transition-colors group"
                            title="Approve Audience to Join"
                        >
                            <UserCheck size={20} className="text-zinc-400 group-hover:text-green-500 transition-colors" />
                        </button>
                    )}
                    </>
                 )}

                 {/* Effects Toggle (HOST ONLY per requirement) */}
                 {isHost && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowEffects(!showEffects);
                            setShowThemeSelector(false);
                            setShowBannedList(false);
                        }}
                        className={cn(
                            "p-2 rounded-lg transition-colors flex items-center gap-2",
                            showEffects ? "bg-yellow-500/20 text-yellow-400" : "hover:bg-white/5 text-zinc-400"
                        )}
                        title="My Effects"
                    >
                        <Sparkles size={20} />
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
        {canManageStream && !isChurchStream && (
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
                            className={cn("text-zinc-400 transition-transform duration-200", showStreamControls && "rotate-180")} 
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
                            {/* Battle Manager Control - Host Only */}
                            {isHost && onShowBattleManager && !isChurchStream && (
                                <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                                    <span className="text-zinc-400 text-sm font-medium flex items-center gap-2">
                                        <LayoutGrid size={16} className="text-orange-500" />
                                        Battle
                                    </span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onShowBattleManager(); }}
                                        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white transition text-sm font-bold rounded-md"
                                        title="Manage Battle"
                                    >
                                        Manage
                                    </button>
                                </div>
                            )}
                            {/* Box Layout Control */}
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                        <span className="text-zinc-400 text-sm font-medium flex items-center gap-2">
                            <LayoutGrid size={16} />
                            Boxes
                        </span>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => updateBoxCount((stream.box_count || 1) - 1)}
                                disabled={!canEditStream || isTrollmersStream || (stream.box_count || 1) <= Math.max(1, requiredBoxes)}
                                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition disabled:opacity-50"
                            >
                                <Minus size={16} />
                            </button>
                            <span className="font-bold text-white min-w-[20px] text-center">{stream.box_count}</span>
                            <button 
                                onClick={() => updateBoxCount((stream.box_count || 1) + 1)}
                                disabled={!canEditStream || isTrollmersStream || (stream.box_count || 1) >= 6}
                                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition disabled:opacity-50"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Seat Pricing & Locking - Only visible to Host & Staff */}
                    {canManageStream && (
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center gap-4">
                        <div className="flex-1">
                            <label className="text-zinc-400 text-xs font-medium flex items-center gap-1 mb-1">
                                <Coins size={12} className="text-yellow-500" />
                                Price
                            </label>
                            <input 
                                type="number" 
                                min="0"
                                value={seatPrice === 0 ? '' : seatPrice}
                                onChange={handlePriceChange}
                                onKeyDown={handlePriceKeyDown}
                                disabled={!isHost}
                                className={cn(
                                    "w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-yellow-500",
                                    (!isHost) && "opacity-50 cursor-not-allowed"
                                )}
                                placeholder=""
                            />
                        </div>
                        
                        <div className="flex flex-col justify-end">
                            <button 
                                onClick={toggleLock}
                                className={cn(
                                    "p-2 rounded-lg transition flex items-center gap-2 text-sm font-bold",
                                    locked ? "bg-red-500/20 text-red-400 border border-red-500/50" : "bg-green-500/20 text-green-400 border border-green-500/50"
                                )}
                                title={locked ? "Seats Locked" : "Seats Open"}
                            >
                                {locked ? <Lock size={16} /> : <Unlock size={16} />}
                                {locked ? "Locked" : "Open"}
                            </button>
                        </div>
                    </div>
                    )}

                    {/* Visual Effects - HOST ONLY */}
                    {isHost && (
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                         <span className="text-zinc-400 text-sm font-medium flex items-center gap-2">
                            <Palette size={16} className="text-purple-400" />
                            Visuals
                         </span>
                         <button 
                            onClick={toggleStreamRgb}
                            className={cn(
                                "w-12 h-6 rounded-full transition-colors relative flex items-center", 
                                _hasRgb ? "bg-green-500" : "bg-zinc-700"
                            )}
                            title={
                                 _hasRgb 
                                     ? "Disable RGB Effect" 
                                     : (stream.rgb_purchased ? "Enable RGB Effect" : "Unlock RGB Effect (10 Coins)")
                             }
                         >
                            <div className={cn("absolute left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm", 
                                _hasRgb && "translate-x-6"
                            )} />
                         </button>
                    </div>
                    )}

                    {/* Guest RGB Toggle (Only if Stream has RGB enabled) */}
                    {!isHost && _hasRgb && isOnStage && (
                        <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                            <span className="text-zinc-400 text-sm font-medium flex items-center gap-2">
                                <Palette size={16} className="text-purple-400" />
                                My RGB
                            </span>
                            <button 
                                onClick={() => {
                                    const currentMeta = localParticipant?.metadata ? JSON.parse(localParticipant.metadata) : {};
                                    const isCurrentlyDisabled = currentMeta.rgb_disabled === true;
                                    
                                    const newMeta = {
                                        ...currentMeta,
                                        rgb_disabled: !isCurrentlyDisabled
                                    };
                                    
                                    localParticipant?.setMetadata(JSON.stringify(newMeta));
                                    toast.success(isCurrentlyDisabled ? "RGB Enabled" : "RGB Disabled");
                                }}
                                className={cn(
                                    "w-12 h-6 rounded-full transition-colors relative flex items-center", 
                                    // If NOT disabled, it is ON (green)
                                    !(localParticipant?.metadata && JSON.parse(localParticipant.metadata).rgb_disabled) ? "bg-green-500" : "bg-zinc-700"
                                )}
                                title="Toggle your RGB border"
                            >
                                <div className={cn("absolute left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm", 
                                    !(localParticipant?.metadata && JSON.parse(localParticipant.metadata).rgb_disabled) && "translate-x-6"
                                )} />
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
