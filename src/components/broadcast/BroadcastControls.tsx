import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TrollmersBattleControls from './TrollmersBattleControls';
import { Stream } from '../../types/broadcast';
import { supabase } from '../../lib/supabase';
import { Plus, Minus, LayoutGrid, Settings2, Coins, Lock, Unlock, Mic, MicOff, Video, VideoOff, MessageSquare, MessageSquareOff, Heart, Eye, Power, Sparkles, Palette, Gift, UserX, ImageIcon, LogOut, ChevronDown, ChevronUp, Share2, Package, Swords } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { getCategoryConfig } from '../../config/broadcastCategories';
import BannedUsersList from './BannedUsersList';
import ThemeSelector from './ThemeSelector';
import { useAuthStore } from '../../lib/store';
import { useParticipantAttributes } from '../../hooks/useParticipantAttributes';
import { AnimatePresence, motion } from 'framer-motion';
import { ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';

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
  localTracks: [IMicrophoneAudioTrack, ICameraVideoTrack] | null;
  toggleCamera: () => void;
  toggleMicrophone: () => void;
  onPinProduct?: () => void;
  onRgbToggle?: (enabled: boolean) => void;
}

export default function BroadcastControls({ stream, isHost, isModerator = false, isOnStage, chatOpen, toggleChat, onGiftHost, onLeave, onShare, requiredBoxes = 1, onBoxCountUpdate, onStreamEnd, handleLike, liveViewerCount, localTracks, toggleCamera, toggleMicrophone, onPinProduct, onRgbToggle }: BroadcastControlsProps) {
  const navigate = useNavigate();
  const [audioTrack, videoTrack] = localTracks || [];
  const isMicOn = audioTrack ? audioTrack.enabled : false;
  const isCamOn = videoTrack ? videoTrack.enabled : false;
  const { user, isAdmin, profile } = useAuthStore();
  const [seatPrice, setSeatPrice] = useState(stream.seat_price || 0);

  const [debouncedPrice, setDebouncedPrice] = useState(seatPrice);

  const [showBannedList, setShowBannedList] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [likes, setLikes] = useState(0); // Local like count for immediate feedback
  const [isLiking, setIsLiking] = useState(false);

  const [isMinimized, setIsMinimized] = useState(false);
  const [showStreamControls, setShowStreamControls] = useState(true);

  // Get category config to check if boxes can be added/removed
  const categoryConfig = getCategoryConfig(stream.category || 'general');
  const canModifyBoxes = categoryConfig.allowAddBox || categoryConfig.allowDeductBox;
  
  // For election category, only officers/admins can modify boxes
  const isElectionCategory = stream.category === 'election';
  const allowedRoles = ['admin', 'secretary', 'lead_troll_officer', 'troll_officer'];
  const isOfficerOrAdmin = profile?.role && allowedRoles.includes(profile.role);
  const canEditElectionBoxes = !isElectionCategory || isOfficerOrAdmin;

  // Stable box count to prevent unnecessary rerenders
  const boxCount = stream.box_count || 1;





  // Sync likes from stream - only when total_likes changes
  useEffect(() => {
    if (typeof (stream as any).total_likes === 'number') {
        setLikes((stream as any).total_likes);
    }
  }, [(stream as any).total_likes]);
  const attributes = useParticipantAttributes(user ? [user.id] : [], stream.id);
  const myAttributes = user ? attributes[user.id] : null;
  const activePerks = myAttributes?.activePerks || [];
  
  const isStaff = isAdmin || profile?.troll_role === 'admin' || profile?.troll_role === 'moderator' || isModerator;
  const canManageStream = isHost || isStaff;
  // Only Host can control stream settings (Visuals, Price, Boxes)
  // Staff/Mods can moderate (ban users), but NOT change stream settings (unless specified)
  const canEditStream = isHost || (isStaff && !isModerator); // Only true staff can edit stream settings, mods just moderate chat/users

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




  const updateStreamConfig = React.useCallback(async (price: number, showToast: boolean = true) => {
    if (!canEditStream) return;
    try {
        await supabase
        .from('streams')
        .update({ seat_price: price })
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


  
  const updateBoxCount = (newCount: number) => {
    if (!canEditStream) return;

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

    // Call the parent handler with error handling
    try {
      if (onBoxCountUpdate) {
        onBoxCountUpdate(newCount);
      }
    } catch (err) {
      console.error("Box count update error:", err);
      // Prevent error from propagating
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
                

            </div>

            <div className="flex items-center gap-2">
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
                     <span className="text-sm font-bold text-white">{likes}</span>
                 </div>

                 {/* Mic & Cam Controls (Stage Only) */}
                 {isOnStage && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleMicrophone(); }}
                            className={cn(
                                "p-2 rounded-lg transition-colors group relative",
                                isMicOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                            )}
                            title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                        >
                            {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleCamera(); }}
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
                    onClick={(e) => { e.stopPropagation(); handleLike(); }}
                    disabled={isLiking}
                    className="p-2 hover:bg-pink-500/20 rounded-lg transition-colors group"
                    title="Like Stream"
                 >
                    <Heart size={20} className={cn("text-zinc-400 group-hover:text-pink-500 transition-colors", isLiking && "scale-125 text-pink-500 fill-pink-500")} />
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
                            setShowBannedList(false);
                        }}
                        className={cn("p-2 rounded-lg transition-colors", showThemeSelector ? "bg-purple-500/20 text-purple-400" : "hover:bg-white/5 text-zinc-400")}
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
                        className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 transition-colors flex items-center gap-2"
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
                            {/* Box Layout Control - Only show if category allows adding/removing boxes and user has permission */}
                            {canModifyBoxes && canEditElectionBoxes && (
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                        <span className="text-zinc-400 text-sm font-medium flex items-center gap-2">
                            <LayoutGrid size={16} />
                            Boxes
                        </span>
                        <div className="flex items-center gap-3">
                            <button 
                                type="button"
                                onClick={() => updateBoxCount(boxCount - 1)}
                                disabled={!canEditStream || boxCount <= Math.max(1, requiredBoxes) || !categoryConfig.allowDeductBox}
                                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition disabled:opacity-50"
                            >
                                <Minus size={16} />
                            </button>
                            <span className="font-bold text-white min-w-[20px] text-center">{boxCount}</span>
                            <button 
                                type="button"
                                onClick={() => updateBoxCount(boxCount + 1)}
                                disabled={!canEditStream || boxCount >= 6 || !categoryConfig.allowAddBox}
                                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition disabled:opacity-50"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                            )}

                    {/* Seat Pricing - Only visible to Host & Staff */}
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
                                max="5000"
                                value={seatPrice === 0 ? '' : seatPrice}
                                onChange={handlePriceChange}
                                disabled={!isHost}
                                className={cn(
                                    "w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-yellow-500",
                                    (!isHost) && "opacity-50 cursor-not-allowed"
                                )}
                                placeholder=""
                            />
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
                         <button onClick={() => toggleStreamRgb()} className={cn("p-1 px-2 rounded-full", stream.has_rgb_effect ? "bg-purple-500" : "bg-zinc-700")}>
           <div className={cn("w-4 h-4 rounded-full", stream.has_rgb_effect ? "bg-white" : "bg-zinc-500")}></div>
         </button>
                    </div>
                    )}

                    {/* Trollmers Battle Controls - Only for trollmers head to head category */}
                    {stream.category === 'trollmers head to head' && (
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                         <span className="text-zinc-400 text-sm font-medium flex items-center gap-2">
                            <Swords size={16} className="text-amber-500" />
                            Trollmers Battles
                         </span>
                         <TrollmersBattleControls currentStream={stream} />
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
