import React, { useState, useEffect } from 'react';
import { Stream } from '../../types/broadcast';
import { supabase } from '../../lib/supabase';
import { Plus, Minus, LayoutGrid, Settings2, Coins, Lock, Unlock, Mic, MicOff, Video, VideoOff, MessageSquare, MessageSquareOff, Heart, Eye, Power, Sparkles, Palette, Gift, UserX, ImageIcon, LogOut, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import BannedUsersList from './BannedUsersList';
import ThemeSelector from './ThemeSelector';
import { useLocalParticipant } from '@livekit/components-react';
import { useAuthStore } from '../../lib/store';
import { useParticipantAttributes } from '../../hooks/useParticipantAttributes';
import { AnimatePresence, motion } from 'framer-motion';

interface BroadcastControlsProps {
  stream: Stream;
  isHost: boolean;
  chatOpen: boolean;
  toggleChat: () => void;
  onGiftHost: () => void;
  onLeave?: () => void;
}

export default function BroadcastControls({ stream, isHost, chatOpen, toggleChat, onGiftHost, onLeave }: BroadcastControlsProps) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const { user, isAdmin, profile } = useAuthStore();
  const [seatPrice, setSeatPrice] = useState(stream.seat_price || 0);
  const [locked, setLocked] = useState(stream.are_seats_locked || false);
  const [debouncedPrice, setDebouncedPrice] = useState(seatPrice);
  const [showEffects, setShowEffects] = useState(false);
  const [showBannedList, setShowBannedList] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [likes, setLikes] = useState(0); // Local like count for immediate feedback
  const [isLiking, setIsLiking] = useState(false);
  const [hasRgb, setHasRgb] = useState(stream.has_rgb_effect || false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showStreamControls, setShowStreamControls] = useState(true);

  // Fetch local attributes for perks
  const attributes = useParticipantAttributes(user ? [user.id] : [], stream.id);
  const myAttributes = user ? attributes[user.id] : null;
  const activePerks = myAttributes?.activePerks || [];
  
  const isStaff = isAdmin || profile?.troll_role === 'admin' || profile?.troll_role === 'moderator';
  const canManageStream = isHost || isStaff;

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
    if ((stream as any).total_likes) {
        setLikes((stream as any).total_likes);
    }
    setLocked(stream.are_seats_locked || false);
    setHasRgb(stream.has_rgb_effect || false);
    // Don't overwrite seatPrice if user is typing (handled by debouncing logic somewhat, but risky)
    // Actually, let's only update seatPrice if significantly different to avoid cursor jumps, 
    // or just assume stream updates are rare enough or driven by this user.
    // For now, let's stick to syncing likes/locks/rgb.
  }, [stream]);

  const toggleMic = async () => {
    if (localParticipant) {
      const newVal = !isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(newVal);
    }
  };

  const toggleCam = async () => {
    if (localParticipant) {
      const newVal = !isCameraEnabled;
      await localParticipant.setCameraEnabled(newVal);
    }
  };

  const isMicOn = isMicrophoneEnabled;
  const isCamOn = isCameraEnabled;


  const updateStreamConfig = React.useCallback(async (price: number, isLocked: boolean) => {
    if (!canManageStream) return;
    try {
        await supabase
        .from('streams')
        .update({ seat_price: price, are_seats_locked: isLocked })
        .eq('id', stream.id);
        toast.success("Stream settings updated");
    } catch (e) {
        console.error(e);
    }
  }, [canManageStream, stream.id]);

  // Debounce price updates to DB
  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedPrice !== stream.seat_price) {
        updateStreamConfig(debouncedPrice, locked);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [debouncedPrice, stream.seat_price, locked, updateStreamConfig]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setSeatPrice(val);
    setDebouncedPrice(val);
  };

  const toggleLock = () => {
    const newLocked = !locked;
    setLocked(newLocked);
    updateStreamConfig(seatPrice, newLocked);
  };
  
  const updateBoxCount = async (increment: boolean) => {
    if (!canManageStream) return;
    const newCount = increment ? stream.box_count + 1 : stream.box_count - 1;
    if (newCount < 1 || newCount > 6) return;

    await supabase
      .from('streams')
      .update({ box_count: newCount })
      .eq('id', stream.id);
  };

  const toggleStreamRgb = async () => {
     if (!canManageStream) return;
     
     const enabling = !hasRgb;
     
     try {
        // If enabling, we might be purchasing. 
        // We let the RPC handle the logic of "charge if not purchased yet".
        const { data, error } = await supabase.rpc('purchase_rgb_broadcast', { 
             p_stream_id: stream.id, 
             p_enable: enabling 
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || "Failed to update RGB");
        
        // Update local state based on success
        setHasRgb(enabling);
        
        if (data.message === 'Purchased and Enabled') {
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
        const { data, error } = await supabase.rpc('end_stream', { stream_id: stream.id });
        
        if (error) throw error;
        if (data && !data.success) throw new Error(data.message || "Failed to end stream");

        toast.success("Broadcast ended");
    } catch (e: any) {
        console.error(e);
        // Fallback for legacy support if RPC fails or doesn't exist yet
        // Covers: "function end_stream does not exist", "Could not find the function... in the schema cache"
        if (
            e.message?.includes('function') || 
            e.message?.includes('schema cache') || 
            e.code === '42883'
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
             toast.error(e.message || "Failed to end broadcast");
        }
    }
  };

  const handleLike = async () => {
    if (isLiking || !user) return;
    if (isHost) {
        toast.error("Broadcasters cannot like their own broadcast");
        return;
    }
    setIsLiking(true);
    
    // Optimistic update
    setLikes(prev => prev + 1);

    try {
        // Try to insert into stream_likes if table exists
        const { error } = await supabase.from('stream_likes').insert({
            stream_id: stream.id,
            user_id: user.id
        });

        if (error) {
            // If duplicate like (unique constraint), maybe just ignore or toggle?
            // Assuming we just want to count likes, we might ignore unique constraint errors
            if (error.code !== '23505') { // 23505 is unique violation
                console.error("Like error:", error);
            }
        }
        
        // Also try to update total_likes on stream if column exists
        // We can do this via RPC to be safe, or just let a trigger handle it
        // For now, we'll assume a trigger handles counting or we just rely on realtime updates
    } catch (e) {
        console.error(e);
    } finally {
        setTimeout(() => setIsLiking(false), 500); // Debounce
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
        <AnimatePresence>
        {showEffects && (
            <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-full right-0 w-64 mb-4 bg-zinc-900 border border-white/10 rounded-xl p-4 shadow-2xl z-50"
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
                
                {canManageStream && (
                    <button 
                        onClick={() => setShowBannedList(!showBannedList)}
                        className={cn("p-2 rounded-full transition-colors", showBannedList ? "bg-red-500/20 text-red-400" : "hover:bg-white/10 text-zinc-400")}
                        title="Banned Users"
                    >
                        <UserX size={20} />
                    </button>
                )}
                
                {/* Viewer Count */}
                <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/5">
                    <Eye size={16} className="text-blue-400" />
                    <span className="text-sm font-bold text-white">{(stream as any).current_viewers || stream.viewer_count || 0}</span>
                </div>

                {/* Like Count */}
                <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/5">
                    <Heart size={16} className="text-pink-500 fill-pink-500/20" />
                    <span className="text-sm font-bold text-white">{likes}</span>
                </div>

                {/* My Balance */}
                <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/5" title="My Troll Coins">
                    <Coins size={16} className="text-yellow-500" />
                    <span className="text-sm font-bold text-white">{(profile?.troll_coins || 0).toLocaleString()}</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                 {/* Gift Button */}
                 <button
                    onClick={onGiftHost}
                    className="p-2 hover:bg-yellow-500/20 rounded-lg transition-colors group"
                    title="Send Gift"
                 >
                    <Gift size={20} className="text-zinc-400 group-hover:text-yellow-500 transition-colors" />
                 </button>

                 {/* Like Button */}
                 <button
                    onClick={handleLike}
                    disabled={isLiking}
                    className="p-2 hover:bg-pink-500/20 rounded-lg transition-colors group"
                    title="Like Stream"
                 >
                    <Heart size={20} className={cn("text-zinc-400 group-hover:text-pink-500 transition-colors", isLiking && "scale-125 text-pink-500 fill-pink-500")} />
                 </button>

                 {/* Chat Toggle */}
                 <button 
                    onClick={toggleChat}
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
                        onClick={() => {
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
                        onClick={() => {
                            setShowThemeSelector(!showThemeSelector);
                            setShowEffects(false);
                            setShowBannedList(false);
                        }}
                        className={cn("p-2 rounded-lg transition-colors", showThemeSelector ? "bg-purple-500/20 text-purple-400" : "hover:bg-white/5 text-zinc-400")}
                        title="Broadcast Theme"
                    >
                        <ImageIcon size={20} />
                    </button>
                    </>
                 )}

                 {/* Effects Toggle (Visible to all logged in users) */}
                 {user && (
                    <button 
                        onClick={() => {
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
                        onClick={handleEndStream}
                        className="ml-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-500 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                     >
                        <Power size={16} />
                        End Stream
                     </button>
                 )}

                 {/* Leave Seat (Guest Only) */}
                 {onLeave && !isHost && (
                     <button 
                        onClick={onLeave}
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
                        {/* Media Controls - Host Only (Staff shouldn't control host's mic/cam) */}
                        {isHost && (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <button 
                                    onClick={toggleMic}
                                    className={cn(
                                        "p-2 rounded-lg text-white transition font-bold flex items-center gap-2",
                                        isMicOn ? "bg-zinc-800 hover:bg-zinc-700" : "bg-red-500/20 text-red-400 border border-red-500/50"
                                    )}
                                    title={isMicOn ? "Mute Mic" : "Unmute Mic"}
                                >
                                    {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
                                </button>
                                <button 
                                    onClick={toggleCam}
                                    className={cn(
                                        "p-2 rounded-lg text-white transition font-bold flex items-center gap-2",
                                        isCamOn ? "bg-zinc-800 hover:bg-zinc-700" : "bg-red-500/20 text-red-400 border border-red-500/50"
                                    )}
                                    title={isCamOn ? "Turn Off Camera" : "Turn On Camera"}
                                >
                                    {isCamOn ? <Video size={18} /> : <VideoOff size={18} />}
                                </button>

                                <div className="w-px h-8 bg-white/10 mx-2" />
                            </div>
                        )}
                        
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
                            {/* Box Layout Control */}
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                        <span className="text-zinc-400 text-sm font-medium flex items-center gap-2">
                            <LayoutGrid size={16} />
                            Boxes
                        </span>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => updateBoxCount(false)}
                                disabled={stream.box_count <= 1}
                                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition disabled:opacity-50"
                            >
                                <Minus size={16} />
                            </button>
                            <span className="font-bold text-white min-w-[20px] text-center">{stream.box_count}</span>
                            <button 
                                onClick={() => updateBoxCount(true)}
                                disabled={stream.box_count >= 6}
                                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition disabled:opacity-50"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Seat Pricing & Locking */}
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center gap-4">
                        <div className="flex-1">
                            <label className="text-zinc-400 text-xs font-medium flex items-center gap-1 mb-1">
                                <Coins size={12} className="text-yellow-500" />
                                Price
                            </label>
                            <input 
                                type="number" 
                                min="0"
                                value={seatPrice}
                                onChange={handlePriceChange}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-yellow-500"
                                placeholder="0"
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

                    {/* Visual Effects */}
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                         <span className="text-zinc-400 text-sm font-medium flex items-center gap-2">
                            <Palette size={16} className="text-purple-400" />
                            Visuals
                         </span>
                         <button 
                            onClick={toggleStreamRgb}
                            className={cn(
                                "w-12 h-6 rounded-full transition-colors relative flex items-center", 
                                hasRgb ? "bg-green-500" : "bg-zinc-700"
                            )}
                            title={
                                 hasRgb 
                                     ? "Disable RGB Effect" 
                                     : (stream.rgb_purchased ? "Enable RGB Effect" : "Unlock RGB Effect (10 Coins)")
                             }
                         >
                            <div className={cn("absolute left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm", 
                                hasRgb && "translate-x-6"
                            )} />
                         </button>
                    </div>
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
