import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stream } from '../../types/broadcast';
import { supabase } from '../../lib/supabase';
import { Plus, Minus, LayoutGrid, Settings2, Coins, Lock, Unlock, Mic, MicOff, Video, VideoOff, MessageSquare, MessageSquareOff, Heart, Eye, Power, Sparkles, Palette, Gift, UserX, ImageIcon, LogOut, ChevronDown, ChevronUp, Share2, Package, Swords, Star, GripVertical, X, MoreHorizontal, Sliders, Shield } from 'lucide-react';
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
  isMicOn?: boolean;
  isCamOn?: boolean;
  boxCount?: number;
  setBoxCount?: (count: number) => void;
  onRefreshStream?: () => void;
  onFiveVFiveBattle?: () => void;
  fiveVFiveBattleActive?: boolean;
  isLive?: boolean;
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
  onFiveVFiveBattle,
  fiveVFiveBattleActive = false,
  isLive = false,
}: BroadcastControlsProps) {
  const navigate = useNavigate();
  const [audioTrack, videoTrack] = localTracks || [];

  const isMicOn = propMicOn !== undefined ? propMicOn : (audioTrack ? (audioTrack.isEnabled ?? true) : false);
  const isCamOn = propCamOn !== undefined ? propCamOn : (videoTrack ? (videoTrack.isEnabled ?? true) : false);

  const hasAudioTrack = !!audioTrack;
  const hasVideoTrack = !!videoTrack;
  const tracksReady = hasAudioTrack || hasVideoTrack;

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
  const [seatPrices, setSeatPrices] = useState<number[]>(stream.seat_prices || [0, seatPrice, seatPrice, seatPrice, seatPrice, seatPrice]);

  const [debouncedPrice, setDebouncedPrice] = useState(seatPrice);
  const [debouncedSeatPrices, setDebouncedSeatPrices] = useState(seatPrices);

  const [showBannedList, setShowBannedList] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [likes, setLikes] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [isFeatureLoading, setIsFeatureLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  const categoryConfig = getCategoryConfig(stream.category || 'general');
  const canModifyBoxes = categoryConfig.allowAddBox || categoryConfig.allowDeductBox;

  const isElectionCategory = stream.category === 'election';
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

  const [localBoxCount, setLocalBoxCount] = useState(stream.box_count || 1);
  const boxCount = parentBoxCount !== undefined ? parentBoxCount : localBoxCount;
  const setBoxCount = parentSetBoxCount !== undefined ? parentSetBoxCount : setLocalBoxCount;

  useEffect(() => {
    if (parentBoxCount === undefined && stream.box_count !== undefined && stream.box_count !== localBoxCount) {
      setLocalBoxCount(stream.box_count);
    }
  }, [stream.box_count, parentBoxCount, localBoxCount]);

  useEffect(() => {
    if (typeof stream.total_likes === 'number') {
      setLikes(stream.total_likes);
    }
  }, [stream.total_likes]);

  useEffect(() => {
    if (stream.seat_prices && Array.isArray(stream.seat_prices)) {
      const currentPrices = stream.seat_prices;
      setSeatPrices(currentPrices);
      setDebouncedSeatPrices(currentPrices);
    }
  }, [stream.seat_prices]);

  useEffect(() => {
    if (stream.seat_price !== undefined) {
      setSeatPrice(stream.seat_price);
      setDebouncedPrice(stream.seat_price);
    }
  }, [stream.seat_price]);

  useEffect(() => {
    if (parentBoxCount === undefined) {
      setLocalBoxCount(stream.box_count || 1);
    }
  }, [stream.box_count, parentBoxCount]);

  const attributes = useParticipantAttributes(user ? [user.id] : [], stream.id);
  const myAttributes = user ? attributes[user.id] : null;
  const activePerks = myAttributes?.activePerks || [];

  const isTrueAdmin = isAdmin || profile?.troll_role === 'admin';
  const canManageStream = isHost || isTrueAdmin;
  const canEditStream = isHost || isTrueAdmin;

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
        const { data, error: fetchError } = await supabase
          .from('user_perks')
          .select('id')
          .eq('user_id', user.id)
          .eq('perk_id', perkId)
          .maybeSingle();
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (data) {
          const { error } = await supabase.from('user_perks').update({ is_active: true }).eq('id', data.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('user_perks').insert({
            user_id: user.id,
            perk_id: perkId,
            is_active: true,
            expires_at: new Date(Date.now() + 86400000).toISOString()
          });
          if (error) {
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
      await supabase.from('streams').update(updates).eq('id', stream.id);
      if (showToast) {
        toast.success("Stream settings updated");
      }
    } catch (e) {
      console.error(e);
    }
  }, [canEditStream, stream.id]);

  useEffect(() => {
    if (debouncedPrice == stream.seat_price) return;
    const timer = setTimeout(() => {
      updateStreamConfig(debouncedPrice, false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [debouncedPrice, stream.seat_price, updateStreamConfig]);

  useEffect(() => {
    const currentPrices = stream.seat_prices || [0, stream.seat_price || 0, stream.seat_price || 0, stream.seat_price || 0, stream.seat_price || 0, stream.seat_price || 0];
    const hasChanged = debouncedSeatPrices.some((price, idx) => price !== currentPrices[idx]);
    if (!hasChanged) return;
    const timer = setTimeout(() => {
      updateStreamConfig(seatPrice, false, debouncedSeatPrices);
    }, 1000);
    return () => clearTimeout(timer);
  }, [debouncedSeatPrices, stream.seat_prices, seatPrice, updateStreamConfig]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setBoxCount(newCount);
    if (onBoxCountUpdate) {
      onBoxCountUpdate(newCount);
    }
    try {
      console.log('[BroadcastControls] Updating database with box_count:', newCount);
      const { error } = await supabase
        .from('streams')
        .update({ box_count: newCount })
        .eq('id', stream.id);
      if (error) {
        console.error('[BroadcastControls] Error updating box count:', error);
        toast.error("Failed to update box count");
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
    if (!isHost) return;
    const enabling = !stream.has_rgb_effect;
    try {
      const { data, error } = await supabase.rpc('purchase_rgb_broadcast', {
        p_stream_id: stream.id,
        p_enable: enabling
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result || !result.success) throw new Error(result?.error || "Failed to update RGB");
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
    }
  };

  const handleEndStream = () => {
    if (onStreamEnd) {
      onStreamEnd();
    }
  };

  if (isClosed) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsClosed(false)}
          className="bg-slate-900/95 border border-white/10 rounded-full p-3 shadow-lg hover:bg-slate-800 transition-colors"
          title="Show Controls"
        >
          <Settings2 size={20} className="text-white/60" />
        </button>
      </div>
    );
  }

  return (
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

      {/* Main action orbs - bottom center */}
      <div className="flex items-center gap-3">
        {/* Mic (stage only) */}
        {isOnStage && tracksReady && (
          <OrbBtn
            active={isMicOn}
            onClick={toggleMicrophone}
            icon={isMicOn ? Mic : MicOff}
            label="Mic"
            glow={!isMicOn ? "red" : undefined}
            size="sm"
            disabled={!hasAudioTrack}
          />
        )}

        {/* Cam (stage only) */}
        {isOnStage && tracksReady && (
          <OrbBtn
            active={isCamOn}
            onClick={toggleCamera}
            icon={isCamOn ? Video : VideoOff}
            label="Cam"
            glow={!isCamOn ? "red" : undefined}
            size="sm"
            disabled={!hasVideoTrack}
          />
        )}

        {/* Loading indicator */}
        {isOnStage && !tracksReady && (
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 rounded-full border border-yellow-500/20">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-yellow-500 font-bold">Init...</span>
          </div>
        )}

        {/* Chat */}
        <OrbBtn
          active={chatOpen}
          onClick={toggleChat}
          icon={chatOpen ? MessageSquare : MessageSquareOff}
          label="Chat"
          size="sm"
        />

        {/* Share */}
        {onShare && (
          <OrbBtn
            active={false}
            onClick={onShare}
            icon={Share2}
            label="Share"
            size="sm"
          />
        )}

        {/* Like (viewers only) */}
        {!isHost && (
          <OrbBtn
            active={false}
            onClick={handleLike}
            icon={Heart}
            label="Like"
            glow={isLiking ? "pink" : undefined}
            size="sm"
          />
        )}

        {/* 5v5 Battle (General Chat only, when live) */}
        {onFiveVFiveBattle && isHost && isLive && !fiveVFiveBattleActive && categoryConfig.id === 'general' && (
          <OrbBtn
            active={false}
            onClick={onFiveVFiveBattle}
            icon={Swords}
            label="Battle"
            glow="red"
            size="sm"
          />
        )}

        {/* Battle Active Indicator */}
        {fiveVFiveBattleActive && (
          <OrbBtn
            active={true}
            onClick={() => {}}
            icon={Swords}
            label="In Battle"
            glow="red"
            size="sm"
          />
        )}

        {/* End Stream (host) - center large orb */}
        {isHost && (
          <OrbBtn
            active={false}
            onClick={handleEndStream}
            icon={Power}
            label="End"
            glow="red"
            size="lg"
          />
        )}

        {/* Leave Seat (guest) */}
        {onLeave && isOnStage && !isHost && (
          <OrbBtn
            active={false}
            onClick={onLeave}
            icon={LogOut}
            label="Leave"
            glow="red"
            size="sm"
          />
        )}

        {/* More menu toggle */}
        {(canManageStream || isHost || isOfficerOrAdmin) && (
          <OrbBtn
            active={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            icon={Sliders}
            label="More"
            size="sm"
          />
        )}
      </div>

      {/* Expandable menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl w-80 max-h-[60vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Stream Settings</span>
              <button onClick={() => setMenuOpen(false)} className="text-slate-500 hover:text-white">
                <X size={14} />
              </button>
            </div>

            {/* Quick actions grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {onShare && (
                <MenuOrb icon={Share2} label="Share" onClick={() => { onShare(); setMenuOpen(false); }} />
              )}
              {isHost && onPinProduct && (
                <MenuOrb icon={Package} label="Product" onClick={() => { onPinProduct(); setMenuOpen(false); }} />
              )}
              {canManageStream && (
                <MenuOrb icon={ImageIcon} label="Theme" onClick={() => { setShowThemeSelector(!showThemeSelector); setMenuOpen(false); }} />
              )}
              {canManageStream && (
                <MenuOrb icon={UserX} label="Banned" onClick={() => { setShowBannedList(!showBannedList); setMenuOpen(false); }} />
              )}
              {isOfficerOrAdmin && (
                <MenuOrb
                  icon={Star}
                  label={stream.is_featured ? "Unfeature" : "Feature"}
                  onClick={() => { toggleFeature(); setMenuOpen(false); }}
                  active={stream.is_featured}
                />
              )}
              {isHost && (
                <MenuOrb
                  icon={Palette}
                  label={stream.has_rgb_effect ? "RGB ON" : "RGB OFF"}
                  onClick={() => { toggleStreamRgb(); }}
                  active={stream.has_rgb_effect}
                />
              )}
            </div>

            {/* Seat Price */}
            {canManageStream && (
              <div className="bg-white/5 rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Coins size={14} className="text-amber-400" />
                    <span className="text-xs font-bold text-white">
                      {enablePerBoxPricing ? 'Per-Box Pricing' : 'Seat Price'}
                    </span>
                  </div>
                  <button
                    onClick={() => setEnablePerBoxPricing(!enablePerBoxPricing)}
                    className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    {enablePerBoxPricing ? 'Simple' : 'Advanced'}
                  </button>
                </div>

                {!enablePerBoxPricing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="5000"
                      value={seatPrice === 0 ? '' : seatPrice}
                      onChange={handlePriceChange}
                      disabled={!isHost}
                      className={cn(
                        "flex-1 bg-black/40 border border-amber-500/20 rounded-lg px-3 py-2 text-sm font-bold text-white placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 transition-all",
                        !isHost && "opacity-50 cursor-not-allowed"
                      )}
                      placeholder="0"
                    />
                    <span className="text-[10px] text-zinc-500 font-medium">coins</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <label className={cn(
                          "text-[9px] font-bold uppercase tracking-wider",
                          i === 0 ? "text-purple-400" : "text-zinc-500"
                        )}>
                          {i === 0 ? 'Host' : `Seat ${i}`}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="5000"
                          value={seatPrices[i] || 0}
                          onChange={(e) => handleBoxPriceChange(i, e.target.value)}
                          disabled={!isHost || i === 0}
                          className={cn(
                            "w-full bg-black/40 border rounded-lg px-2 py-1.5 text-xs font-bold text-white text-center focus:outline-none transition-all",
                            i === 0
                              ? "border-purple-500/20 text-purple-300 opacity-60 cursor-not-allowed"
                              : "border-amber-500/20"
                          )}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Viewer stats */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-1">
                <Eye size={11} className="text-blue-400" />
                <span className="text-[10px] font-bold text-blue-300">
                  {liveViewerCount !== undefined ? liveViewerCount : ((stream as any).current_viewers || stream.viewer_count || 0)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-pink-500/10 border border-pink-500/20 rounded-full px-2.5 py-1">
                <Heart size={11} className="text-pink-400" />
                <span className="text-[10px] font-bold text-pink-300">{likes}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── ORB COMPONENTS ───

function OrbBtn({ active, onClick, icon: Icon, label, glow, size, disabled }: any) {
  const isLg = size === 'lg';
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "rounded-full flex items-center justify-center transition-all backdrop-blur-xl border",
          isLg ? "w-14 h-14" : "w-11 h-11",
          glow === "red"
            ? "bg-red-500/20 border-red-500/40 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
            : glow === "pink"
              ? "bg-pink-500/20 border-pink-500/40 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.3)]"
              : glow === "yellow"
                ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.3)] animate-pulse"
                : active
                  ? "bg-white/15 border-white/25 text-white shadow-lg"
                  : "bg-black/40 border-white/10 text-white/50 hover:text-white hover:bg-white/10",
          disabled && "opacity-40 cursor-not-allowed"
        )}
      >
        <Icon size={isLg ? 20 : 16} />
      </button>
      <span className="text-[8px] text-slate-500 font-medium">{label}</span>
    </div>
  );
}

function SideOrb({ onClick, icon: Icon, color, active, disabled, label }: any) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all",
          active ? `bg-${color}-500/20 border-${color}-500/40 text-${color}-400` : "bg-black/40 border-white/10 text-white/50 hover:text-white",
          disabled && "opacity-30 cursor-not-allowed"
        )}
      >
        <Icon size={14} />
      </button>
      {label && <span className="text-[7px] text-slate-500 font-medium leading-none">{label}</span>}
    </div>
  );
}

function MenuOrb({ icon: Icon, label, onClick, active }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
        active ? "bg-purple-500/15 text-purple-400" : "hover:bg-white/10 text-white/70"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-full border flex items-center justify-center",
        active ? "bg-purple-500/20 border-purple-500/30" : "bg-white/10 border-white/10"
      )}>
        <Icon size={16} />
      </div>
      <span className="text-[8px] text-slate-400">{label}</span>
    </button>
  );
}
