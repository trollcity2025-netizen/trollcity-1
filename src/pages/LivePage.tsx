import React, { 
  useCallback, 
  useEffect, 
  useMemo, 
  useRef, 
  useState 
} from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useLiveKit } from '../hooks/useLiveKit';
import { useLiveKitSession } from '../hooks/useLiveKitSession';
import { useLiveKitToken } from '../hooks/useLiveKitToken';
import { useStreamEndListener } from '../hooks/useStreamEndListener';
import { useAuthStore } from '../lib/store';
import { supabase, createConversation, sendConversationMessage } from '../lib/supabase';
import { sendNotification } from '../lib/sendNotification';
import { toast } from 'sonner';
import { Participant } from 'livekit-client';
import {
  Users,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  RefreshCw,
  Swords,
  X,
  Settings,
  Plus,
  Minus
} from 'lucide-react';
import ChatBox from '../components/broadcast/ChatBox';
import GiftBox, { GiftItem, RecipientMode } from '../components/broadcast/GiftBox';
import GiftModal from '../components/broadcast/GiftModal';
import ProfileModal from '../components/broadcast/ProfileModal';
import CoinStoreModal from '../components/broadcast/CoinStoreModal';
import EntranceEffect from '../components/broadcast/EntranceEffect';
import BroadcastLayout from '../components/broadcast/BroadcastLayout';
import FlyingChatOverlay from '../components/broadcast/FlyingChatOverlay';
import GlobalGiftBanner from '../components/GlobalGiftBanner';
import GiftEventOverlay from './GiftEventOverlay';
import { getUserEntranceEffect, triggerUserEntranceEffect } from '../lib/entranceEffects';
import { processGiftXp } from '../lib/xp';
import { evaluateBadgesForUser } from '../services/badgeEvaluationService';

import { useGiftEvents } from '../lib/hooks/useGiftEvents';
import { useOfficerBroadcastTracking } from '../hooks/useOfficerBroadcastTracking';
import { updateOfficerActivity } from '../lib/officerActivity';
import { useSeatRoster } from '../hooks/useSeatRoster';
import { attachLiveKitDebug } from '../lib/livekit-debug';
import UserActionsMenu from '../components/broadcast/UserActionsMenu';
import { useViewerTracking } from '../hooks/useViewerTracking';
import TrollBattleOverlay from '../components/broadcast/TrollBattleOverlay';
import TrollBattlesSetup from '../components/broadcast/TrollBattlesSetup';

// Constants
const STREAM_POLL_INTERVAL = 2000;

const DEFAULT_GIFTS: GiftItem[] = [
  { id: "troll_clap", name: "Troll Clap", icon: "👏", value: 5, category: "Basic" },
  { id: "glow_heart", name: "Glow Heart", icon: "💖", value: 10, category: "Basic" },
  { id: "laughing_mask", name: "Laughing Mask", icon: "😹", value: 30, category: "Basic" },
  { id: "troll_mic_drop", name: "Troll Mic Drop", icon: "🎤", value: 100, category: "Rare" },
  { id: "troll_confetti", name: "Troll Confetti", icon: "🎉", value: 850, category: "Rare" },
  { id: "crown_blast", name: "Crown Blast", icon: "👑", value: 1200, category: "Epic" },
  { id: "diamond_storm", name: "Diamond Storm", icon: "💎", value: 7000, category: "Legendary" },
  { id: "the_big_crown", name: "The Big Crown", icon: "👑✨", value: 15000, category: "Legendary" },
  { id: "troll", name: "Troll", icon: "🧟", value: 1, category: "Basic" },
  { id: "rose", name: "Rose", icon: "🌹", value: 20, category: "Basic" },
  { id: "sparkles", name: "Sparkles", icon: "✨", value: 75, category: "Rare" },
  { id: "fireworks", name: "Fireworks", icon: "🎆", value: 2000, category: "Legendary" },
  { id: "neon_wave", name: "Neon Wave", icon: "🌊", value: 300, category: "Rare" },
  { id: "royal_scepter", name: "Royal Scepter", icon: "⚜️", value: 4500, category: "Epic" },
  { id: "neon_dragon", name: "Neon Dragon", icon: "🐉", value: 8000, category: "Legendary" },
  { id: "galaxy_portal", name: "Galaxy Portal", icon: "🌀", value: 20000, category: "Legendary" },
  { id: "cosmic_comet", name: "Cosmic Comet", icon: "☄️", value: 35000, category: "Legendary" },
  { id: "rainbow_unicorn", name: "Rainbow Unicorn", icon: "🦄", value: 150, category: "Rare" },
  { id: "golden_trophy", name: "Golden Trophy", icon: "🏆", value: 500, category: "Rare" },
  { id: "magic_wand", name: "Magic Wand", icon: "🪄", value: 250, category: "Rare" },
  { id: "shooting_star", name: "Shooting Star", icon: "⭐", value: 600, category: "Epic" },
  { id: "phoenix_fire", name: "Phoenix Fire", icon: "🔥", value: 3000, category: "Epic" },
  { id: "crystal_heart", name: "Crystal Heart", icon: "💎", value: 5000, category: "Epic" },
  { id: "thunder_bolt", name: "Thunder Bolt", icon: "⚡", value: 400, category: "Rare" },
  { id: "ice_blast", name: "Ice Blast", icon: "❄️", value: 350, category: "Rare" },
  { id: "golden_rose", name: "Golden Rose", icon: "🌹", value: 800, category: "Epic" },
  { id: "party_popper", name: "Party Popper", icon: "🎊", value: 200, category: "Basic" },
  { id: "rocket_ship", name: "Rocket Ship", icon: "🚀", value: 1500, category: "Epic" },
  { id: "lucky_clover", name: "Lucky Clover", icon: "🍀", value: 450, category: "Rare" },
  { id: "golden_star", name: "Golden Star", icon: "🌟", value: 900, category: "Epic" },
  { id: "royal_castle", name: "Royal Castle", icon: "🏰", value: 6000, category: "Epic" },
  { id: "celestial_moon", name: "Celestial Moon", icon: "🌙", value: 1800, category: "Epic" },
  { id: "super_nova", name: "Super Nova", icon: "💫", value: 12000, category: "Legendary" },
  { id: "angel_wings", name: "Angel Wings", icon: "👼", value: 2500, category: "Epic" },
  { id: "demon_horns", name: "Demon Horns", icon: "😈", value: 2800, category: "Epic" },
  { id: "infinity_gem", name: "Infinity Gem", icon: "💠", value: 50000, category: "Legendary" },
  { id: "divine_halo", name: "Divine Halo", icon: "😇", value: 10000, category: "Legendary" },
];

// Types
interface StreamRow {
  id: string;
  broadcaster_id: string;
  status: string;
  is_live: boolean;
  current_viewers?: number;
  total_gifts_coins?: number;
  total_likes?: number;
  start_time?: string;
  title?: string;
  room_name?: string;
  agora_channel?: string;
  category?: string;
  is_private?: boolean;
}

interface ActiveViewer {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  role?: string | null;
  isBroadcaster?: boolean;
  fullName?: string | null;
  onboardingCompleted?: boolean;
  w9Status?: string;
}

interface GiftBalanceDelta {
  userId: string;
  delta: number;
  key: number;
}

interface SeatBan {
  id: string;
  user_id: string;
  banned_until: string | null;
  created_at: string;
  reason?: string | null;
  username?: string | null;
}

const useIsBroadcaster = (profile: any, stream: StreamRow | null) => {
  return useMemo(() => {
    return Boolean(profile?.id && stream?.broadcaster_id && profile.id === stream.broadcaster_id);
  }, [profile?.id, stream?.broadcaster_id]);
};

function BroadcasterTimer({ startTime, onClick }: { startTime: string; onClick?: () => void }) {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (!startTime) return;
    const start = new Date(startTime).getTime();
    
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - start;
      if (diff < 0) {
        setElapsed('00:00:00');
        return;
      }
      
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      setElapsed(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-red-600/90 text-white px-3 py-1 rounded-full text-xs font-bold font-mono animate-pulse flex items-center gap-2 shadow-[0_0_10px_rgba(220,38,38,0.5)] border border-red-400/30"
    >
      <div className="w-2 h-2 rounded-full bg-white animate-ping" />
      LIVE {elapsed}
    </button>
  );
}

function BroadcasterSettings({
  streamId,
  broadcasterId: _broadcasterId,
  onAlertOfficers,
  joinPrice,
  onSetPrice,
}: {
  streamId: string;
  broadcasterId?: string;
  onAlertOfficers: (targetUserId?: string) => Promise<void>;
  joinPrice: number;
  onSetPrice: (price: number) => void;
}) {
  const [participants, setParticipants] = useState<Array<{ user_id: string; username: string; avatar_url?: string; is_moderator?: boolean; can_chat?: boolean; chat_mute_until?: string; is_active?: boolean }>>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [kicking, setKicking] = useState<string | null>(null);
  const [updatingMod, setUpdatingMod] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState(() =>
    joinPrice > 0 ? String(joinPrice) : ''
  );

  useEffect(() => {
    setDraftPrice(joinPrice > 0 ? String(joinPrice) : '');
  }, [joinPrice]);

  const handleApplyJoinPrice = () => {
    const parsed = parseInt(draftPrice || '0') || 0;
    onSetPrice(Math.max(0, parsed));
  };

  const loadParticipants = useCallback(async () => {
    if (!streamId) return;
    setLoading(true);
    try {
      const { data: sp } = await supabase
        .from('streams_participants')
        .select('user_id,is_active,is_moderator,can_chat,chat_mute_until')
        .eq('stream_id', streamId);

      const rows = sp || [];
      const ids = rows.map(r => r.user_id);
      const profiles: Record<string, { username: string; avatar_url?: string }> = {};
      if (ids.length > 0) {
        const { data: ups } = await supabase
          .from('user_profiles')
          .select('id,username,avatar_url')
          .in('id', ids);
        (ups || []).forEach((p: any) => { profiles[p.id] = { username: p.username, avatar_url: p.avatar_url }; });
      }
      setParticipants(rows.map(r => ({
        user_id: r.user_id,
        username: profiles[r.user_id]?.username || 'Unknown',
        avatar_url: profiles[r.user_id]?.avatar_url,
        is_moderator: r.is_moderator,
        can_chat: r.can_chat,
        chat_mute_until: r.chat_mute_until,
        is_active: r.is_active
      })));
    } catch (err) {
      console.error('Failed to load participants', err);
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => { loadParticipants(); }, [loadParticipants]);

  const assignModerator = async (userId: string) => {
    setUpdatingMod(userId);
    try {
      await supabase
        .from('streams_participants')
        .update({ is_moderator: true })
        .eq('stream_id', streamId)
        .eq('user_id', userId);
      toast.success('Moderator assigned');
      loadParticipants();
    } catch (err) {
      console.error('Failed to assign moderator', err);
      toast.error('Failed to assign moderator');
    } finally {
      setUpdatingMod(null);
    }
  };

  const removeModerator = async (userId: string) => {
    setUpdatingMod(userId);
    try {
      await supabase
        .from('streams_participants')
        .update({ is_moderator: false })
        .eq('stream_id', streamId)
        .eq('user_id', userId);
      toast.success('Moderator removed');
      loadParticipants();
    } catch (err) {
      console.error('Failed to remove moderator', err);
      toast.error('Failed to remove moderator');
    } finally {
      setUpdatingMod(null);
    }
  };

  const kickUser = async (userId: string) => {
    setKicking(userId);
    try {
      await supabase
        .from('streams_participants')
        .update({ is_active: false, left_at: new Date().toISOString() })
        .eq('stream_id', streamId)
        .eq('user_id', userId);
      toast.success('User kicked from stream');
      loadParticipants();
    } catch (err) {
      console.error('Failed to kick user', err);
      toast.error('Failed to kick user');
    } finally {
      setKicking(null);
    }
  };

  const reportUser = async (userId: string) => {
    const reason = window.prompt('Reason for report:', 'Violation of rules');
    if (reason === null) return;
    try {
      await supabase
        .from('moderation_reports')
        .insert({
          reporter_id: (await supabase.auth.getUser()).data.user?.id,
          target_user_id: userId,
          stream_id: streamId,
          reason,
          description: ''
        });
      toast.success('Report submitted');
    } catch (err) {
      console.error('Failed to submit report', err);
      toast.error('Failed to submit report');
    }
  };

  const filtered = participants.filter(p => p.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-[#05010a] rounded-3xl border border-white/10 p-5 overflow-y-auto max-h-[70vh] min-h-0 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Settings size={20} className="text-purple-400" />
          Broadcast Settings
        </h3>
      </div>
      
      <div className="space-y-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-white/80">
              Join Price (Coins)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={draftPrice}
                placeholder="0"
                inputMode="numeric"
                onChange={(e) =>
                  setDraftPrice(e.target.value.replace(/[^\d]/g, ''))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleApplyJoinPrice();
                  }
                }}
                className="w-20 bg-black/40 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:border-purple-500 focus:outline-none"
              />
              <button 
                onClick={handleApplyJoinPrice}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg uppercase tracking-wider"
              >
                Set
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-[0.3em] text-white/60">Participants & Mods</span>
            <button
              onClick={() => onAlertOfficers()}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-500/40 text-red-200 hover:bg-red-600/30 font-bold uppercase tracking-wider transition-colors"
            >
              Alert Troll Officers
            </button>
          </div>
          <div className="mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search participants..."
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500/50 focus:outline-none"
            />
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {loading ? (
              <div className="text-xs text-white/60 text-center py-4">Loading participants...</div>
            ) : filtered.length === 0 ? (
              <div className="text-xs text-white/60 text-center py-4">No participants found</div>
            ) : (
              filtered.map((p) => (
                <div key={p.user_id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-900/30 border border-purple-500/20 flex items-center justify-center overflow-hidden">
                       {p.avatar_url ? (
                         <img src={p.avatar_url} className="w-full h-full object-cover" />
                       ) : (
                         <span className="text-xs font-bold text-purple-300">{p.username.charAt(0)}</span>
                       )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white/90">{p.username}</div>
                      <div className="text-[10px] text-white/40 flex items-center gap-1">
                        {p.is_moderator && <span className="text-yellow-400">Moderator</span>}
                        {!p.is_active && <span>Inactive</span>}
                        {p.can_chat === false && <span className="text-red-400">Muted</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.is_moderator ? (
                      <button
                        disabled={updatingMod === p.user_id}
                        onClick={() => removeModerator(p.user_id)}
                        className="text-[10px] px-2 py-1 rounded bg-yellow-900/20 border border-yellow-500/30 text-yellow-200 hover:bg-yellow-900/40"
                      >
                        Unmod
                      </button>
                    ) : (
                      <button
                        disabled={updatingMod === p.user_id}
                        onClick={() => assignModerator(p.user_id)}
                        className="text-[10px] px-2 py-1 rounded bg-green-900/20 border border-green-500/30 text-green-200 hover:bg-green-900/40"
                      >
                        Mod
                      </button>
                    )}
                    <button
                      disabled={kicking === p.user_id}
                      onClick={() => kickUser(p.user_id)}
                      className="text-[10px] px-2 py-1 rounded bg-red-900/20 border border-red-500/30 text-red-200 hover:bg-red-900/40"
                    >
                      Kick
                    </button>
                    <button
                      onClick={() => reportUser(p.user_id)}
                      className="text-[10px] px-2 py-1 rounded bg-blue-900/20 border border-blue-500/30 text-blue-200 hover:bg-blue-900/40"
                    >
                      Report
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OfficerActionBubble({
  streamId: _streamId,
  onAddBox,
  onDeductBox,
  onEndBroadcast,
  onMuteAll,
  onKickAll,
  onDisableChat,
  targets,
  selectedTargetId,
  onTargetChange,
  onMuteUser,
  onDisableUserChat,
  onKickUser,
  onRemoveSeat,
  seatBans,
  onClearSeatBan,
  onClose,
  position,
  onMouseDown
}: {
  streamId: string;
  onAddBox: () => void;
  onDeductBox: () => void;
  onEndBroadcast: () => void;
  onMuteAll: () => void;
  onKickAll: () => void;
  onDisableChat: () => void;
  targets: Array<{ id: string; username: string; seatIndex?: number | null }>;
  selectedTargetId: string | null;
  onTargetChange: (userId: string | null) => void;
  onMuteUser: (userId: string, minutes: number) => void;
  onDisableUserChat: (userId: string) => void;
  onKickUser: (userId: string) => void;
  onRemoveSeat: (userId: string) => void;
  seatBans: SeatBan[];
  onClearSeatBan: (banId: string) => void;
  onClose: () => void;
  position: { x: number; y: number } | null;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const selectedTarget = targets.find((t) => t.id === selectedTargetId) || null;
  return (
    <div
      className="fixed z-[200] w-64 bg-black/90 border border-red-500/50 rounded-xl shadow-[0_0_30px_rgba(220,38,38,0.3)] backdrop-blur-xl overflow-hidden"
      style={position ? { left: position.x, top: position.y } : { bottom: 100, right: 20 }}
    >
      <div
        className="bg-red-900/20 px-3 py-2 border-b border-red-500/30 flex items-center justify-between cursor-move select-none"
        onMouseDown={onMouseDown}
      >
        <span className="text-xs font-bold text-red-200 uppercase tracking-wider">Officer Tools</span>
        <button onClick={onClose} className="text-red-200 hover:text-white">×</button>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        <button
          onClick={onEndBroadcast}
          className="col-span-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 rounded shadow-lg flex items-center justify-center gap-2"
        >
          <span className="text-lg">⛔</span> END BROADCAST
        </button>
        <div className="col-span-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-white/50">Target user</label>
          <select
            value={selectedTargetId || ''}
            onChange={(e) => onTargetChange(e.target.value || null)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
          >
            <option value="">Select user</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.username}
              </option>
            ))}
          </select>
        </div>
          <button
            onClick={onAddBox}
            className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 rounded flex flex-col items-center gap-1"
          >
            <span className="text-lg">📺</span> Add Box
          </button>
          <button
            onClick={onDeductBox}
            className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 rounded flex flex-col items-center gap-1"
          >
            <span className="text-lg">➖</span> Deduct Box
          </button>
        <button
          onClick={onKickAll}
          className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 rounded flex flex-col items-center gap-1"
        >
          <span className="text-lg">🧹</span> Clear Stage
        </button>
        <button
          onClick={onMuteAll}
          className="col-span-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 rounded flex flex-col items-center gap-1"
        >
          <span className="text-lg">🔇</span> Mute All
        </button>
        <div className="col-span-2 grid grid-cols-3 gap-2">
          <button
            disabled={!selectedTarget}
            onClick={() => selectedTarget && onMuteUser(selectedTarget.id, 5)}
            className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold py-2 rounded disabled:opacity-50"
          >
            Mute 5m
          </button>
          <button
            disabled={!selectedTarget}
            onClick={() => selectedTarget && onMuteUser(selectedTarget.id, 15)}
            className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold py-2 rounded disabled:opacity-50"
          >
            Mute 15m
          </button>
          <button
            disabled={!selectedTarget}
            onClick={() => selectedTarget && onMuteUser(selectedTarget.id, 30)}
            className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold py-2 rounded disabled:opacity-50"
          >
            Mute 30m
          </button>
        </div>
        <button
          onClick={onDisableChat}
          className="col-span-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2"
        >
          <span className="text-lg">💬</span> Disable Chat (Global)
        </button>
        <button
          disabled={!selectedTarget}
          onClick={() => selectedTarget && onDisableUserChat(selectedTarget.id)}
          className="col-span-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span className="text-lg">🔕</span> Disable Chat (User)
        </button>
        <button
          disabled={!selectedTarget}
          onClick={() => selectedTarget && onKickUser(selectedTarget.id)}
          className="col-span-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span className="text-lg">🚫</span> Kick From Stream
        </button>
        <button
          disabled={!selectedTarget || selectedTarget?.seatIndex === undefined || selectedTarget?.seatIndex === null}
          onClick={() => selectedTarget && onRemoveSeat(selectedTarget.id)}
          className="col-span-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span className="text-lg">📦</span> Remove From Box
        </button>
        <div className="col-span-2 border-t border-red-500/20 pt-2 mt-1 max-h-40 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">Guest-box bans</span>
            <span className="text-[10px] text-white/60">{seatBans.length}</span>
          </div>
          {seatBans.length === 0 ? (
            <p className="text-[11px] text-white/40">No active bans</p>
          ) : (
            seatBans.slice(0, 6).map((ban) => {
              const isPermanent = !ban.banned_until;
              let untilLabel = 'Permanent';
              if (!isPermanent) {
                const date = new Date(ban.banned_until as string);
                if (!isNaN(date.getTime())) {
                  untilLabel = `Until ${date.toLocaleTimeString()}`;
                }
              }
              return (
                <div key={ban.id} className="flex items-center justify-between gap-2 py-1">
                  <div className="min-w-0">
                    <div className="text-[11px] text-white truncate">
                      {ban.username || ban.user_id.slice(0, 8)}
                    </div>
                    <div className="text-[10px] text-red-300/80 truncate">
                      {untilLabel}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onClearSeatBan(ban.id)}
                    className="px-2 py-1 rounded-md bg-red-600/80 hover:bg-red-500 text-[10px] font-bold text-white whitespace-nowrap"
                  >
                    Clear
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default function LivePage() {
  const { streamId } = useParams<{ streamId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  const { user, profile, refreshProfile } = useAuthStore();

  useViewerTracking(streamId || null, user?.id || null);

  const [joinPrice, setJoinPrice] = useState(0);
  const [showTrollBattles, setShowTrollBattles] = useState(false);
  const [activeBattle, setActiveBattle] = useState<{id: string, player1_id: string, player2_id: string, status: string} | null>(null);
  const [boxCount, setBoxCount] = useState(0);
  const [seatBans, setSeatBans] = useState<SeatBan[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>(() => {
    if (typeof window === 'undefined') return 'user';
    const stored = window.localStorage.getItem('tc_camera_facing');
    return stored === 'environment' ? 'environment' : 'user';
  });
  const [hostSeatIndex, setHostSeatIndex] = useState(0);
  const [showLivePanels, setShowLivePanels] = useState(true);
  const [broadcastThemeStyle, setBroadcastThemeStyle] = useState<React.CSSProperties | undefined>(undefined);
  const [broadcastTheme, setBroadcastTheme] = useState<any>(null);
  const [reactiveEvent, setReactiveEvent] = useState<{ key: number; style: string; intensity: number } | null>(null);
  const [reactiveClass, setReactiveClass] = useState('');
  const [hasViewerGift, setHasViewerGift] = useState(false);
  const noViewerTimerRef = useRef<number | null>(null);
  const noGiftTimerRef = useRef<number | null>(null);
  const autoEndTriggeredRef = useRef(false);

  const stableIdentity = useMemo(() => {
    const id = user?.id || profile?.id;
    if (!id) console.warn('[LivePage] No stable identity found');
    return id;
  }, [user?.id, profile?.id]);
  
  const [stream, setStream] = useState<StreamRow | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [activeViewers, setActiveViewers] = useState<ActiveViewer[]>([]);
  const [isViewerDropdownOpen, setIsViewerDropdownOpen] = useState(false);
  const viewerDropdownRef = useRef<HTMLDivElement | null>(null);
  const viewerButtonRef = useRef<HTMLButtonElement | null>(null);
  const notifiedMissingFormsRef = useRef<Set<string>>(new Set());
  const micRestrictionInfo = useMemo(() => {
    if (!profile?.mic_muted_until) {
      return { isMuted: false, message: '' };
    }
    const until = Date.parse(profile.mic_muted_until);
    if (Number.isNaN(until) || until <= Date.now()) {
      return { isMuted: false, message: '' };
    }
    return {
      isMuted: true,
      message: `Microphone disabled until ${new Date(until).toLocaleString()}`,
    };
  }, [profile?.mic_muted_until]);
  const notifyMissingForms = useCallback(async (userId: string, missing: string[]) => {
    if (!missing.length) return;
    try {
      await supabase.rpc('notify_user_rpc', {
        p_target_user_id: userId,
        p_type: 'system_alert',
        p_title: 'Complete your User Forms & Compliance',
        p_message: `Please finish the following sections: ${missing.join(', ')}. Visit your Profile Settings to complete them.`,
      });
      notifiedMissingFormsRef.current.add(userId);
    } catch (err) {
      console.error('Failed to notify user about compliance:', err);
    }
  }, []);
  const [isLoadingStream, setIsLoadingStream] = useState(true);
  const [privateAccessGranted, setPrivateAccessGranted] = useState(false);
  const [privatePasswordInput, setPrivatePasswordInput] = useState('');
  const [privateAuthError, setPrivateAuthError] = useState('');
  const privateAccessStorageKey = streamId ? `private-stream-access:${streamId}` : null;
  const [isCurrentUserBroadofficer, setIsCurrentUserBroadofficer] = useState(false);

  const refreshBoxCountFromMessages = useCallback(
    async (id: string) => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('content')
          .eq('stream_id', id)
          .eq('message_type', 'system')
          .like('content', 'BOX_COUNT_UPDATE:%')
          .order('created_at', { ascending: false })
          .limit(1);

        if (error || !data || data.length === 0) return;

        const content = data[0]?.content as string | null;
        if (!content || typeof content !== 'string') return;

        const parts = content.split(':');
        if (parts.length < 2) return;
        const parsed = parseInt(parts[1], 10);
        if (Number.isNaN(parsed)) return;

        const maxBoxes = 5;
        const next = Math.max(0, Math.min(maxBoxes, parsed));
        setBoxCount(next === 0 ? 5 : next);
      } catch (err) {
        console.error('Failed to refresh box count from messages:', err);
      }
    },
    [setBoxCount]
  );

  // Save stream to session storage for persistence
  useEffect(() => {
    if (stream) {
      try {
        sessionStorage.setItem("activeStream", JSON.stringify(stream));
      } catch (e) {
        console.warn('Failed to save stream to sessionStorage', e);
      }
    }
  }, [stream]);

  useEffect(() => {
    if (!isViewerDropdownOpen || typeof window === 'undefined') return;
    const handleClickOutside = (event: MouseEvent) => {
      if (viewerDropdownRef.current?.contains(event.target as Node)) return;
      if (viewerButtonRef.current?.contains(event.target as Node)) return;
      setIsViewerDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isViewerDropdownOpen]);
  
  const seatRoomName = stream?.room_name || stream?.agora_channel || streamId || 'officer-stream';
  const isBroadcaster = useIsBroadcaster(profile, stream);
  const isRoleExempt = useMemo(() => {
    if (profile?.is_admin) return true;
    const role = (profile?.troll_role || profile?.role || '').toLowerCase();
    return ['admin', 'lead_troll_officer', 'secretary', 'troll_officer'].includes(role);
  }, [profile?.role, profile?.troll_role, profile?.is_admin]);
  const { seats, claimSeat, releaseSeat } = useSeatRoster(seatRoomName);
  const isGuestSeat = !isBroadcaster && seats.some(seat => seat?.user_id === user?.id);
  const canPublish = isBroadcaster || isGuestSeat;
  const canModerateGuests = isBroadcaster || isCurrentUserBroadofficer;


  
  const liveKit = useLiveKit();


    


  useEffect(() => {
    const broadcasterId = stream?.broadcaster_id;
    if (!broadcasterId) return;
    let isActive = true;

    const loadTheme = async () => {
      const { data: state } = await supabase
        .from('user_broadcast_theme_state')
        .select('active_theme_id')
        .eq('user_id', broadcasterId)
        .maybeSingle();

      if (!isActive) return;
      if (!state?.active_theme_id) {
        setBroadcastThemeStyle(undefined);
        setBroadcastTheme(null);
        setLastThemeId(null);
        return;
      }

      const { data: theme } = await supabase
        .from('broadcast_background_themes')
        .select('id, asset_type, video_webm_url, video_mp4_url, image_url, background_css, background_asset_url, reactive_enabled, reactive_style, reactive_intensity')
        .eq('id', state.active_theme_id)
        .maybeSingle();

      if (!isActive) return;
      if (!theme) {
        setBroadcastThemeStyle(undefined);
        setBroadcastTheme(null);
        setLastThemeId(null);
        return;
      }

      if (theme.background_css) {
        // Strip trailing semicolons to avoid React warnings
        const cleanBackground = theme.background_css.trim().replace(/;+$/, '');
        setBroadcastThemeStyle({ background: cleanBackground });
        setBroadcastTheme(theme);
        setLastThemeId(theme.id || null);
        return;
      }
      if (theme.background_asset_url) {
        setBroadcastThemeStyle({
          backgroundImage: `url(${theme.background_asset_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        });
        setBroadcastTheme(theme);
        setLastThemeId(theme.id || null);
        return;
      }
      if (theme.image_url) {
        setBroadcastThemeStyle({
          backgroundImage: `url(${theme.image_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        });
        setBroadcastTheme(theme);
        setLastThemeId(theme.id || null);
        return;
      }
      setBroadcastThemeStyle(undefined);
      setBroadcastTheme(theme);
      setLastThemeId(theme.id || null);
    };

    loadTheme();
    return () => {
      isActive = false;
    };
  }, [stream?.broadcaster_id]);

  useEffect(() => {
    if (!reactiveEvent?.key) return;
    const style = reactiveEvent.style || 'pulse';
    const intensity = Math.max(1, Math.min(5, reactiveEvent.intensity || 2));
    const nextClass = `theme-reactive-${style} theme-reactive-intensity-${intensity}`;
    setReactiveClass(nextClass);
    const timer = window.setTimeout(() => setReactiveClass(''), 900);
    return () => window.clearTimeout(timer);
  }, [reactiveEvent?.key, reactiveEvent?.style, reactiveEvent?.intensity]);

  // Sync UI state with broadcaster role (auto-publish)
  useEffect(() => {
    if (isBroadcaster) {
      setCameraOn(true);
      setMicOn(true);
    }
  }, [isBroadcaster]);

  // 1. Room name derivation: prefer agora_channel (set by GoLive), then room_name, fallback to stream_{id}
  const roomName = useMemo(() => {
    if (stream?.agora_channel) return stream.agora_channel;
    if (stream?.room_name) return stream.room_name;
    // GoLive sets agora_channel to streamId. BroadcastPage uses streamId.
    // If neither is present, falling back to streamId is safer than stream_{id} to match BroadcastPage.
    return streamId || ''; 
  }, [stream?.agora_channel, stream?.room_name, streamId]);

  const hasValidStreamId = !!streamId && typeof streamId === 'string' && streamId.trim() !== '';
  const sessionReady = !!user && !!profile && hasValidStreamId && !!roomName;


  const officerRoleNames = ['admin', 'lead_troll_officer', 'troll_officer'];
  const isOfficerUser = Boolean(
    profile &&
      (officerRoleNames.includes(profile.role || '') ||
        profile.is_admin ||
        profile.is_lead_officer ||
        profile.is_troll_officer)
  );

  const loadSeatBans = useCallback(async () => {
    if (!isOfficerUser || !seatRoomName) return;
    try {
      const { data, error } = await supabase
        .from('broadcast_seat_bans')
        .select('id,user_id,banned_until,created_at,reason')
        .eq('room', seatRoomName)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load seat bans', error);
        return;
      }

      const rows = (data as any[]) || [];
      const userIds = Array.from(
        new Set(
          rows
            .map((row) => row.user_id as string | null)
            .filter((id): id is string => Boolean(id))
        )
      );

      const usernameMap = new Map<string, string | null>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id,username')
          .in('id', userIds);
        (profiles as any[] | null | undefined)?.forEach((p) => {
          usernameMap.set(p.id as string, (p.username as string | null) ?? null);
        });
      }

      const enriched: SeatBan[] = rows.map((row) => {
        const userId = row.user_id as string;
        return {
          id: row.id as string,
          user_id: userId,
          banned_until: (row.banned_until as string | null) ?? null,
          created_at: row.created_at as string,
          reason: (row.reason as string | null) ?? null,
          username: usernameMap.get(userId) ?? null,
        };
      });

      setSeatBans(enriched);
    } catch (err) {
      console.error('Failed to load seat bans', err);
    }
  }, [isOfficerUser, seatRoomName]);

  useEffect(() => {
    if (!isOfficerUser || !seatRoomName) return;
    let cancelled = false;

    loadSeatBans();

    const channel = supabase
      .channel(`broadcast-seat-bans-${seatRoomName}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broadcast_seat_bans',
          filter: `room=eq.${seatRoomName}`,
        },
        () => {
          if (!cancelled) {
            loadSeatBans();
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [isOfficerUser, seatRoomName, loadSeatBans]);

  const [seatActionTarget, setSeatActionTarget] = useState<{
    userId: string
    username?: string
    role?: string
    seatIndex: number
    isOfficer?: boolean
  } | null>(null);

  useEffect(() => {
    setSeatActionTarget(null);
  }, [streamId]);

  const livekitIdentity = useMemo(() => {
    const id = stableIdentity;
    if (!id) console.warn('[LivePage] No identity found for LiveKit');
    return id;
  }, [stableIdentity]);

  // Token Management
  const { 
    token, 
    serverUrl, 
    identity: tokenIdentity, 
    roomName: tokenRoomName, 
    ready: tokenReady,
    error: tokenError
  } = useLiveKitToken({
    streamId,
    isHost: canPublish,
    userId: user?.id,
    roomName: roomName,
  });

  useEffect(() => {
    if (tokenError) {
      console.error('[LivePage] Token fetch error:', tokenError);
    }
  }, [tokenError]);

  const needsPrivateGate = Boolean(stream?.is_private && stream?.broadcaster_id && stream?.broadcaster_id !== user?.id);
  const streamLoaded = Boolean(stream?.id);
  const canAccessPrivate = !needsPrivateGate || privateAccessGranted;
  const canConnect = tokenReady && !!token && !!serverUrl && !!user?.id && !!roomName && streamLoaded && canAccessPrivate;

  const joinLogRef = useRef(false);

  // Logging for verification (only once when we can first connect)
  useEffect(() => {
    if (canConnect && !joinLogRef.current) {
      joinLogRef.current = true;
      console.log('[LivePage] Joining session:', {
        streamId,
        broadcaster_id: stream?.broadcaster_id,
        isBroadcaster,
        roomName: tokenRoomName || roomName,
        auth_uid: user?.id,
        identity: tokenIdentity || livekitIdentity,
        token: !!token
      });
    }
  }, [canConnect, streamId, stream?.broadcaster_id, isBroadcaster, roomName, tokenRoomName, user?.id, livekitIdentity, tokenIdentity, token]);

  const {
    isConnected,
    resetJoinGuard,
  } = useLiveKitSession({
    roomName: tokenRoomName || (sessionReady ? roomName : ''),
    user: sessionReady && user
      ? { ...user, identity: tokenIdentity || livekitIdentity, role: isBroadcaster ? 'broadcaster' : (canPublish ? 'guest' : 'viewer') }
      : null,
    role: isBroadcaster ? 'broadcaster' : (canPublish ? 'guest' : 'viewer'),
    allowPublish: canPublish && sessionReady,
    autoPublish: canPublish, // Enable autoPublish for guests too when allowed
    token: token || undefined,
    serverUrl: serverUrl || undefined,
    connect: canConnect,
    identity: tokenIdentity || livekitIdentity
  });

  const handleDisableGuestMedia = useCallback(
    async (participantId: string, disableVideo = true, disableAudio = true) => {
      if (!canModerateGuests) return;
      await liveKit.disableGuestMedia(participantId, disableVideo, disableAudio);
    },
    [canModerateGuests, liveKit]
  );

  const publishUpgradeRef = useRef(false);

  const handleLeaveSession = useCallback(async () => {
    const seatIndex = seats.findIndex(seat => seat?.user_id === user?.id);
    if (seatIndex >= 0) {
      await releaseSeat(seatIndex);
    }
    
    // Disable media
    if (cameraOn) {
       await liveKit.toggleCamera();
       setCameraOn(false);
       // Explicitly stop all video tracks to turn off the hardware light
       if (liveKit.localParticipant?.videoTrack?.track) {
         liveKit.localParticipant.videoTrack.track.stop();
       }
    }
    if (micOn) {
       await liveKit.toggleMicrophone();
       setMicOn(false);
       // Explicitly stop audio tracks too just in case
       if (liveKit.localParticipant?.audioTrack?.track) {
         liveKit.localParticipant.audioTrack.track.stop();
       }
    }
    
    toast.info("You have left the guest box");
  }, [liveKit, cameraOn, micOn, releaseSeat, seats, user?.id]);

  // Ensure camera/mic are stopped when unmounting (e.g. redirecting when broadcast ends)
  useEffect(() => {
    return () => {
      if (liveKit.localParticipant) {
        liveKit.localParticipant.videoTrack?.track?.stop();
        liveKit.localParticipant.audioTrack?.track?.stop();
      }
    };
  }, [liveKit]);

  // Ref tracking for cleanup
  const seatsRef = useRef(seats);
  const userRef = useRef(user);
  const releaseSeatRef = useRef(releaseSeat);
  const isBroadcasterRef = useRef(isBroadcaster);

  useEffect(() => {
    seatsRef.current = seats;
    userRef.current = user;
    releaseSeatRef.current = releaseSeat;
    isBroadcasterRef.current = isBroadcaster;
  }, [seats, user, releaseSeat, isBroadcaster]);

  // Cleanup seat on unmount to prevent auto-joining on return
  useEffect(() => {
    return () => {
      const currentSeats = seatsRef.current;
      const currentUser = userRef.current;
      const release = releaseSeatRef.current;
      const isBroadcasterVal = isBroadcasterRef.current;

      if (!isBroadcasterVal && currentUser?.id) {
        const index = currentSeats.findIndex(s => s?.user_id === currentUser.id);
        if (index >= 0) {
          console.log('[LivePage] Cleaning up seat on unmount');
          release(index).catch(err => console.error('Failed to release seat on unmount', err));
        }
      }
    };
  }, []);

  // Billing Heartbeat (Server-Side Billing Implementation)
  useEffect(() => {
    if (!streamId || !user?.id || (!isBroadcaster && !isGuestSeat)) return;
    // Only run if stream is effectively live or we are in a box
    // Broadcaster pays for being live. Guests pay for being in box.

    const runBilling = async () => {
      try {
        const { data, error } = await supabase.rpc('process_stream_billing', {
          p_stream_id: streamId,
          p_user_id: user.id,
          p_is_host: isBroadcaster
        });

        if (error) {
          console.error('[Billing] RPC error:', error);
          return;
        }

        if (data?.status === 'stop') {
          console.warn('[Billing] Stopped:', data.reason);
          toast.error(data.reason || 'Insufficient funds');
          
          if (isBroadcaster) {
             // If broadcaster runs out of funds, stop the stream
             toast.error('Stream ending due to insufficient funds.');
             // Trigger end stream flow
             // We can't easily call onEndBroadcast from here as it's inside OfficerActionBubble
             // But we can trigger the end stream API
             // For now, just notify user.
          } else {
             // Guest runs out of funds
             handleLeaveSession();
          }
        } else if (data?.remaining !== undefined) {
          // Optional: update local coin balance if desired
          // refreshProfile(); // Might be too heavy to call every minute
        }
      } catch (err) {
        console.error('[Billing] execution error:', err);
      }
    };

    // Run immediately on mount/state change if condition met? 
    // No, we charge per minute. 
    // But we should probably charge "on entry" (handled by join logic) and then "every minute".
    // For broadcaster, they pay per minute.
    
    const interval = setInterval(runBilling, 60000); 
    return () => clearInterval(interval);
  }, [streamId, user?.id, isBroadcaster, isGuestSeat, handleLeaveSession]);

  const handleSetPrice = async (price: number) => {
    try {
      // 1. Update DB first so RPC sees correct price
      const { error } = await supabase
        .from('streams')
        .update({ box_price_amount: price })
        .eq('id', streamId);

      if (error) throw error;

      setJoinPrice(price);
      
      // 2. Broadcast price to viewers via system message
      await supabase.from('messages').insert({
        stream_id: streamId,
        user_id: user?.id,
        message_type: 'system',
        content: `PRICE_UPDATE:${price}`
      });
      
      toast.success(`Join price set to ${price} coins`);
    } catch (err) {
      console.error('Failed to update box price:', err);
      toast.error('Failed to update price');
    }
  };

  const handleAlertOfficers = useCallback(
    async (targetUserId?: string) => {
      if (!streamId) return;
      try {
        let targetUsername: string | undefined;
        if (targetUserId) {
          const { data: targetProfile } = await supabase
            .from('user_profiles')
            .select('username')
            .eq('id', targetUserId)
            .single();
          targetUsername = targetProfile?.username || undefined;
        }

        const reporterId = profile?.id || user?.id || null;
        let reporterUsername: string | undefined = profile?.username;

        if (!reporterUsername && reporterId) {
          const { data: reporterProfile } = await supabase
            .from('user_profiles')
            .select('username')
            .eq('id', reporterId)
            .single();
          reporterUsername = reporterProfile?.username || undefined;
        }

        const { data: officers } = await supabase
          .from('user_profiles')
          .select('id, username, role, is_officer')
          .in('role', ['troll_officer', 'lead_troll_officer', 'admin']);

        const baseMessage = targetUserId
          ? `Alert in stream ${streamId} involving @${targetUsername || targetUserId}`
          : `Alert in stream ${streamId}`;

        const messageWithReporter =
          reporterUsername && reporterId
            ? `${baseMessage} (reported by @${reporterUsername})`
            : baseMessage;

        const list = (officers || []).map((o) => ({
          user_id: o.id,
          type: 'officer_update' as const,
          title: 'Stream Moderation Alert',
          message: messageWithReporter,
          metadata: {
            stream_id: streamId,
            target_user_id: targetUserId,
            target_username: targetUsername,
            reporter_id: reporterId,
            reporter_username: reporterUsername,
            link: `/live/${streamId}?source=officer_alert`
          }
        }));

        if (list.length > 0) {
          await supabase.from('notifications').insert(list);
          toast.success('Alert sent to troll officers');

          // Send push notifications to officers
          try {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                user_ids: list.map((n) => n.user_id),
                title: 'Stream Moderation Alert',
                body: messageWithReporter,
                url: `/live/${streamId}?source=officer_alert`,
                create_db_notification: false,
              },
            });
          } catch (err) {
            console.warn('Failed to send push to officers', err);
          }
        } else {
          toast.info('No officers found to notify');
        }
      } catch (err) {
        console.error('Failed to alert officers', err);
        toast.error('Failed to alert officers');
      }
    },
    [streamId, profile?.id, profile?.username, user?.id]
  );

  const handleJoinRequest = async (seatIndex: number) => {
    if (canPublish) {
        if (!cameraOn) {
          liveKit.toggleCamera().then((ok) => {
            if (ok) setCameraOn(true);
          });
        }
        if (!micOn) {
          liveKit.toggleMicrophone().then((ok) => {
            if (ok) setMicOn(true);
          });
        }
        return;
    }

    if (!user?.id || !stream?.broadcaster_id || !streamId) {
      toast.error('Unable to join right now.');
      return;
    }

    let joinPriceForClaim = joinPrice;
    
    // Officers join for free (skip payment and set price to 0)
    if (isOfficerUser) {
      joinPriceForClaim = 0;
    } else if (joinPrice > 0) {
      const confirmed = confirm(`Join the stream for ${joinPrice} coins?`);
      if (!confirmed) return;

      try {
        // Use the new join_stream_box RPC which handles billing and guest tracking atomically
        const { data: joinResult, error: joinError } = await supabase.rpc('join_stream_box', {
          p_stream_id: streamId,
          p_user_id: user?.id
        });

        if (joinError) throw joinError;
        
        // Check logical success from RPC JSON response
        if (joinResult && joinResult.success === false) {
           throw new Error(joinResult.error || 'Failed to join box');
        }

        joinPriceForClaim = 0; // Already paid via RPC
        toast.success('Joined guest box!');
      } catch (err: any) {
        console.error('Join fee failed:', err);
        toast.error(err?.message || 'Transaction failed');
        return;
      }
    }

    try {
      await claimSeat(seatIndex, { joinPrice: joinPriceForClaim });
    } catch (err: any) {
      console.error('Failed to claim seat:', err);
      toast.error(err?.message || 'Failed to join seat');
    }
  };

  const handleSeatAction = async (params: { seatIndex: number; seat: any; participant?: any }) => {
    const { seatIndex, seat } = params
    if (!isOfficerUser || !seat?.user_id) return;

    let isOfficer = false;
    if (stream?.broadcaster_id) {
       const { data } = await supabase.rpc('is_broadofficer', {
         p_broadcaster_id: stream.broadcaster_id,
         p_user_id: seat.user_id
       });
       isOfficer = !!data;
    }
    if (seat.role && ['admin', 'lead_troll_officer', 'troll_officer'].includes(seat.role)) {
        isOfficer = true;
    }

    setSeatActionTarget({
      userId: seat.user_id,
      username: seat.username,
      role: seat.role,
      seatIndex,
      isOfficer
    });
  };

  const closeSeatActionMenu = () => {
    setSeatActionTarget(null);
  };

  const handleSeatGift = () => {
    if (!seatActionTarget) return;
    setGiftReceiver({ id: seatActionTarget.userId, username: seatActionTarget.username || '' });
    setIsGiftModalOpen(true);
    closeSeatActionMenu();
  };

  const handleSeatKick = async () => {
    if (!seatActionTarget) return;
    try {
      await releaseSeat(seatActionTarget.seatIndex, seatActionTarget.userId, { force: true });
      toast.success('Guest removed from seat');
      closeSeatActionMenu();
    } catch (err) {
      console.error('Failed to remove guest from seat', err);
      toast.error('Failed to remove guest from seat');
    }
  };

  const handleSeatReport = () => {
    if (!seatActionTarget) return;
    handleAlertOfficers(seatActionTarget.userId);
    toast.info('Officers alerted');
    closeSeatActionMenu();
  };

  const handleSeatFollow = () => {
    if (!seatActionTarget) return;
    toast.success(`Follow request sent to ${seatActionTarget.username || 'user'}`);
    closeSeatActionMenu();
  };

  const handleSeatSummon = () => {
    if (!seatActionTarget) return;
    handleAlertOfficers(seatActionTarget.userId);
    toast.success('Summon request sent');
    closeSeatActionMenu();
  };

  useEffect(() => {
    const handleOpenGiftMenu = () => setIsGiftModalOpen(true);
    window.addEventListener('open-gift-menu', handleOpenGiftMenu);
    return () => window.removeEventListener('open-gift-menu', handleOpenGiftMenu);
  }, []);

  useEffect(() => {
    if (!canPublish) {
      publishUpgradeRef.current = false;
      return;
    }
    if (isBroadcaster || !tokenReady || !serverUrl || !isConnected) return;
    if (publishUpgradeRef.current) return;
    publishUpgradeRef.current = true;
    resetJoinGuard();
    liveKit.disconnect();

    // Auto-enable camera/mic state since we are upgrading to publisher
    setCameraOn(true);
    setMicOn(true);
  }, [canPublish, isBroadcaster, tokenReady, serverUrl, isConnected, resetJoinGuard, liveKit]);


  // Officer tracking for broadcasters
  useOfficerBroadcastTracking({
    streamId: isBroadcaster ? streamId : undefined,
    connected: isConnected,
  });

  useEffect(() => {
    if (isConnected) {
      const room = liveKit.getRoom();
      attachLiveKitDebug(room);
    }
  }, [isConnected, liveKit]);

  // Controls

  const toggleCamera = useCallback(async () => {
    const ok = await liveKit.toggleCamera();
    const next = Boolean(ok);
    setCameraOn(next);
    console.log('[LivePage] Camera toggled', {
      cameraOn: next,
      hostSeatIndex,
    });
  }, [liveKit, hostSeatIndex]);

  const switchCameraFacing = useCallback(async () => {
    const nextFacing: 'user' | 'environment' = cameraFacing === 'user' ? 'environment' : 'user';

    if (!cameraOn) {
      setCameraFacing(nextFacing);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('tc_camera_facing', nextFacing);
      }
      toast.success(nextFacing === 'user' ? 'Front camera will be used next time' : 'Rear camera will be used next time');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      toast.error('Camera switching not supported on this device');
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      if (!videoInputs.length) {
        toast.error('No cameras found');
        return;
      }

      const matchLabel = (label: string, facing: 'user' | 'environment') => {
        const l = label.toLowerCase();
        if (facing === 'user') {
          return l.includes('front') || l.includes('user') || l.includes('self') || l.includes('face');
        }
        return l.includes('back') || l.includes('rear') || l.includes('environment') || l.includes('world');
      };

      let target = videoInputs.find((d) => matchLabel(d.label || '', nextFacing));
      if (!target) {
        target = videoInputs.length > 1 ? videoInputs[1] : videoInputs[0];
      }

      let switched = false;

      if (liveKit.service && (liveKit.service as any).selectCamera) {
        const ok = await (liveKit.service as any).selectCamera(target.deviceId);
        if (ok) {
          switched = true;
        }
      }

      if (!switched) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('tc_camera_facing', nextFacing);
        }
        const firstToggle = await liveKit.toggleCamera();
        if (firstToggle) {
          const secondToggle = await liveKit.toggleCamera();
          if (secondToggle) {
            switched = true;
          }
        }
      }

      if (!switched) {
        toast.error('Camera switch failed');
        return;
      }

      setCameraFacing(nextFacing);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('tc_camera_facing', nextFacing);
      }
      toast.success(nextFacing === 'user' ? 'Front camera selected' : 'Rear camera selected');
    } catch (err) {
      console.error('Camera switch failed', err);
      toast.error('Camera switch failed');
    }
  }, [cameraFacing, cameraOn, liveKit]);

  // Officer Tool Handlers
  const [isOfficerBubbleVisible, setIsOfficerBubbleVisible] = useState(true);
  const [officerBubblePos, setOfficerBubblePos] = useState<{ x: number; y: number } | null>(null);
  const officerBubbleDraggingRef = useRef(false);
  const officerBubbleDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleOfficerDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window === 'undefined') return;
    
    // Default position (bottom right) if not set
    const startPos = officerBubblePos || { x: window.innerWidth - 300, y: window.innerHeight - 300 };
    
    officerBubbleDraggingRef.current = true;
    officerBubbleDragOffsetRef.current = {
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y
    };

    const handleMove = (ev: MouseEvent) => {
      if (!officerBubbleDraggingRef.current) return;
      setOfficerBubblePos({
        x: ev.clientX - officerBubbleDragOffsetRef.current.x,
        y: ev.clientY - officerBubbleDragOffsetRef.current.y
      });
    };

    const handleUp = () => {
      officerBubbleDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [officerBubblePos]);

  const handleOfficerDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isOfficerUser) return;
      if (typeof window === 'undefined') return;

      const margin = 320;
      const x = Math.min(e.clientX, window.innerWidth - margin);
      const y = Math.min(e.clientY, window.innerHeight - margin);

      setOfficerBubblePos({ x, y });
      setIsOfficerBubbleVisible(true);
    },
    [isOfficerUser]
  );

  const handleOfficerEndBroadcast = async () => {
      if (!confirm('OFFICER ACTION: Force END this broadcast?')) return;
      try {
        await supabase.from('streams').update({ status: 'ended', is_live: false, ended_at: new Date().toISOString() }).eq('id', streamId);
        if (streamId) {
          const channel = supabase.channel(`stream-${streamId}`);
          await channel.subscribe();
          await channel.send({
            type: 'broadcast',
            event: 'stream-ended',
            payload: { streamId }
          });
          supabase.removeChannel(channel);
        }
        // Force disconnect the broadcaster's LiveKit connection
        if (liveKit.getRoom()) {
          liveKit.disconnect();
        }
        toast.success('Broadcast ended by Officer');
        // Navigate to stream ended page
        setTimeout(() => navigate('/stream-ended'), 1000);
      } catch { toast.error('Failed to end broadcast'); }
  };
  
  const handleOfficerMuteAll = async () => {
      if(!confirm('OFFICER ACTION: Mute all participants?')) return;
      try {
        const until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await supabase
          .from('streams_participants')
          .update({ can_chat: false, chat_mute_until: until })
          .eq('stream_id', streamId);
        toast.success('All participants muted for 10 minutes');
      } catch (err) {
        console.error('Failed to mute all participants', err);
        toast.error('Failed to mute all participants');
      }
  };

  const handleOfficerDisableChat = async () => {
       if(!confirm('OFFICER ACTION: Disable chat globally?')) return;
       try {
         await supabase
           .from('streams_participants')
           .update({ can_chat: false, chat_mute_until: null })
           .eq('stream_id', streamId);
         toast.success('Chat disabled for all participants');
       } catch (err) {
         console.error('Failed to disable chat globally', err);
         toast.error('Failed to disable chat globally');
       }
  };
  
  const handleOfficerKickAll = () => {
      if(!confirm('OFFICER ACTION: Clear the stage (remove all boxes)?')) return;
      setBoxCount(0);
      if (streamId) {
        void supabase.from('messages').insert({
          stream_id: streamId,
          message_type: 'system',
          content: 'BOX_COUNT_UPDATE:0'
        });
      }
      seats.forEach((seat, index) => {
        if (seat?.user_id) {
          void releaseSeat(index, seat.user_id, { force: true });
        }
      });
      toast.success('Stage cleared');
  };
  
  const syncBoxCount = useCallback((next: number) => {
    const maxBoxes = 5;
    const clamped = Math.max(0, Math.min(maxBoxes, next));
    setBoxCount(clamped);
    if (streamId) {
      void supabase.from('messages').insert({
        stream_id: streamId,
        message_type: 'system',
        content: `BOX_COUNT_UPDATE:${clamped}`
      });
    }
    if (clamped < seats.length) {
      seats.forEach((seat, index) => {
        if (index >= clamped && seat?.user_id) {
          void releaseSeat(index, seat.user_id, { force: true });
        }
      });
    }
    return clamped;
  }, [streamId, seats, releaseSeat]);
  
  const handleAddBox = useCallback(() => {
    const next = syncBoxCount(boxCount + 1);
    toast.success(`Added box (${next})`);
  }, [boxCount, syncBoxCount]);

  const handleDeductBox = useCallback(() => {
    if (boxCount <= 0) {
      toast.info('No boxes left to remove');
      return;
    }
    const next = syncBoxCount(boxCount - 1);
    toast.success(`Removed box (${next})`);
  }, [boxCount, syncBoxCount]);

  const handleOfficerAddBox = useCallback(() => {
      const next = syncBoxCount(boxCount + 1);
      toast.success(`Added box (${next})`);
  }, [boxCount, syncBoxCount]);

  const handleOfficerDeductBox = useCallback(() => {
      if (boxCount <= 0) {
        toast.info('No boxes left to remove');
        return;
      }
      const next = syncBoxCount(boxCount - 1);
      toast.success(`Removed box (${next})`);
  }, [boxCount, syncBoxCount]);

  const officerTargets = useMemo(() => {
    const map = new Map<string, { id: string; username: string; seatIndex?: number | null }>();
    activeViewers.forEach((viewer) => {
      if (!viewer?.userId) return;
      map.set(viewer.userId, {
        id: viewer.userId,
        username: viewer.username || `Viewer ${viewer.userId.slice(0, 6)}`,
      });
    });
    seats.forEach((seat, index) => {
      if (!seat?.user_id) return;
      const existing = map.get(seat.user_id);
      map.set(seat.user_id, {
        id: seat.user_id,
        username: seat.username || existing?.username || `User ${seat.user_id.slice(0, 6)}`,
        seatIndex: index,
      });
    });
    return Array.from(map.values()).sort((a, b) => a.username.localeCompare(b.username));
  }, [activeViewers, seats]);

  const handleOfficerMuteUser = async (userId: string, minutes: number) => {
    if (!streamId) return;
    try {
      const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      await supabase
        .from('streams_participants')
        .update({ can_chat: false, chat_mute_until: until })
        .eq('stream_id', streamId)
        .eq('user_id', userId);
      toast.success(`User muted for ${minutes} minutes`);
    } catch (err) {
      console.error('Failed to mute user', err);
      toast.error('Failed to mute user');
    }
  };

  const handleOfficerDisableUserChat = async (userId: string) => {
    if (!streamId) return;
    try {
      await supabase
        .from('streams_participants')
        .update({ can_chat: false, chat_mute_until: null })
        .eq('stream_id', streamId)
        .eq('user_id', userId);
      toast.success('User chat disabled');
    } catch (err) {
      console.error('Failed to disable user chat', err);
      toast.error('Failed to disable user chat');
    }
  };

  const handleOfficerKickUser = async (userId: string) => {
    if (!streamId) return;
    try {
      await supabase
        .from('streams_participants')
        .update({ is_active: false, left_at: new Date().toISOString() })
        .eq('stream_id', streamId)
        .eq('user_id', userId);
      toast.success('User kicked from stream');
    } catch (err) {
      console.error('Failed to kick user', err);
      toast.error('Failed to kick user');
    }
  };

  const handleOfficerRemoveSeat = async (userId: string) => {
    const seatIndex = seats.findIndex((seat) => seat?.user_id === userId);
    if (seatIndex < 0) return;
    try {
      await releaseSeat(seatIndex, userId, { force: true });
      toast.success('User removed from box');
    } catch (err) {
      console.error('Failed to remove user from seat', err);
      toast.error('Failed to remove user from seat');
    }
  };

  const handleOfficerClearSeatBan = async (banId: string) => {
    try {
      await supabase
        .from('broadcast_seat_bans')
        .delete()
        .eq('id', banId);
      toast.success('Guest-box ban cleared');
      await loadSeatBans();
    } catch (err) {
      console.error('Failed to clear seat ban', err);
      toast.error('Failed to clear guest-box ban');
    }
  };

  const toggleMic = useCallback(async () => {
    if (!micOn && micRestrictionInfo.isMuted) {
      toast.error(micRestrictionInfo.message || 'Microphone is disabled.');
      return;
    }
    const ok = await liveKit.toggleMicrophone();
    setMicOn(Boolean(ok));
  }, [liveKit, micOn, micRestrictionInfo.isMuted, micRestrictionInfo.message]);

  const endStreamAuto = useCallback(async (reason: string) => {
    if (autoEndTriggeredRef.current) return;
    autoEndTriggeredRef.current = true;

    try {
      if (streamId) {
        await supabase.from('streams').update({ status: 'ended', is_live: false }).eq('id', streamId);
      }
    } catch (err) {
      console.error('Auto-end stream update failed:', err);
    }

    toast.error(reason);
    liveKit.markClientDisconnectIntent();
    liveKit.disconnect();
    navigate('/stream-ended');
  }, [liveKit, navigate, streamId]);

  const endStream = useCallback(async () => {
    if (!confirm("Are you sure you want to end this stream?")) return;
    autoEndTriggeredRef.current = true;
    
    try {
      if (streamId) {
        await supabase.from('streams').update({ status: 'ended', is_live: false }).eq('id', streamId);
      }
    } catch {}
    liveKit.markClientDisconnectIntent();
    liveKit.disconnect();
    navigate('/stream-ended');
  }, [streamId, liveKit, navigate]);

  // Auth/Session checks (defensive)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error || !data?.session) {
          try { await supabase.auth.signOut(); } catch {}
          navigate('/auth');
        }
      } catch {
        if (mounted) navigate('/auth');
      }
    })();
    return () => { mounted = false };
  }, [navigate]);

  // UI State
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [giftReceiver, setGiftReceiver] = useState<any>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false);
  const [entranceEffect, setEntranceEffect] = useState<any>(null);
  const [giftBalanceDelta, setGiftBalanceDelta] = useState<GiftBalanceDelta | null>(null);
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [chatOverlayOpen, setChatOverlayOpen] = useState(false);
  const [entranceEffectKey, setEntranceEffectKey] = useState(0);
  const [lastThemeId, setLastThemeId] = useState<string | null>(null);
  const [messageBubbleTarget, setMessageBubbleTarget] = useState<{
    id: string;
    username?: string;
    avatar_url?: string | null;
  } | null>(null);
  const [messageBubbleOpen, setMessageBubbleOpen] = useState(false);
  const [messageBubbleText, setMessageBubbleText] = useState('');
  const [messageBubbleSending, setMessageBubbleSending] = useState(false);
  const [messageBubblePosition, setMessageBubblePosition] = useState<{ x: number; y: number } | null>(null);
  const messageBubbleDraggingRef = useRef(false);
  const messageBubbleDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [officerTargetId, setOfficerTargetId] = useState<string | null>(null);
  

  const entranceTimeoutRef = useRef<number | null>(null);
  const [quickGifts, setQuickGifts] = useState<GiftItem[]>([]);
  const [quickGiftsLoading, setQuickGiftsLoading] = useState(false);
  const [quickGiftsError, setQuickGiftsError] = useState<string | null>(null);
  
  const entranceSentRef = useRef(false);

  // Reset entrance sent status when changing streams
  useEffect(() => {
    entranceSentRef.current = false;
  }, [streamId]);

  // Entrance effect logic
  useEffect(() => {
    const triggerEntrance = async () => {
      if (entranceSentRef.current) return;
      if (!user || !streamId || isBroadcaster || profile?.is_ghost_mode) return;

      entranceSentRef.current = true;

      const { effectKey, config } = await getUserEntranceEffect(user.id);

      if (effectKey) {
        await supabase.from('messages').insert({
          stream_id: streamId,
          user_id: user.id,
          message_type: 'entrance',
          content: JSON.stringify({
            username: profile?.username || user.email,
            role: profile?.role || 'user',
            effectKey,
            effect: config
          })
        });
      }
    };

    if (isConnected) {
      void triggerEntrance();
    }
  }, [isConnected, user, streamId, profile, isBroadcaster]);

  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`live-updates-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const msg = payload.new;
          if (msg.message_type === 'entrance') {
            try {
              const rawContent = msg.content;
              const data = typeof rawContent === 'string'
                ? JSON.parse(rawContent)
                : (rawContent || {});
              const payloadUserId =
                data.user_id || data.sender_id || msg.user_id || msg.sender_id;

              // Don't show your own entrance effect to yourself
              if (payloadUserId && user?.id && payloadUserId === user.id) {
                return;
              }

              setEntranceEffect({
                username: data.username || 'Viewer',
                role: data.role || 'viewer',
                profile: data.profile,
                effectKey: data.effectKey,
                effect: data.effect,
                userId: payloadUserId || null,
              });
              setEntranceEffectKey((prev) => prev + 1);

              if (entranceTimeoutRef.current) {
                window.clearTimeout(entranceTimeoutRef.current);
              }
              entranceTimeoutRef.current = window.setTimeout(() => {
                setEntranceEffect(null);
                entranceTimeoutRef.current = null;
              }, 5000);

              if (payloadUserId) {
                void triggerUserEntranceEffect(payloadUserId);
              }
            } catch (e) {
              console.error('Failed to parse entrance effect', e);
            }
          } else if (msg.message_type === 'system' && msg.content?.startsWith('PRICE_UPDATE:')) {
            const price = parseInt(msg.content.split(':')[1]);
            if (!isNaN(price)) setJoinPrice(price);
          } else if (msg.message_type === 'system' && msg.content?.startsWith('BOX_COUNT_UPDATE:')) {
            const parts = msg.content.split(':');
            const raw = parts[1];
            const parsed = parseInt(raw);
            if (!isNaN(parsed)) {
              const maxBoxes = 6;
              const next = Math.max(0, Math.min(maxBoxes, parsed));
              setBoxCount(next);
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (entranceTimeoutRef.current) {
        window.clearTimeout(entranceTimeoutRef.current);
        entranceTimeoutRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [streamId, stream?.broadcaster_id, isBroadcaster, user?.id]);


  // Load Stream Data
  const loadStreamData = useCallback(async () => {
    if (!streamId) {
      setIsLoadingStream(false);
      return;
    }

    // Try location state first
    const streamDataFromState = location.state?.streamData;
    if (streamDataFromState && streamDataFromState.id === streamId) {
      setStream(streamDataFromState as StreamRow);
      setViewerCount((streamDataFromState as StreamRow).current_viewers ?? 0);
      setIsLoadingStream(false);
      if (streamId) {
        void refreshBoxCountFromMessages(streamId);
      }
      return;
    }

    // Try session storage second
    try {
      const storedStream = sessionStorage.getItem("activeStream");
      if (storedStream) {
        const parsedStream = JSON.parse(storedStream);
          if (parsedStream.id === streamId) {
          setStream(parsedStream);
          setViewerCount(parsedStream.current_viewers ?? 0);
          setIsLoadingStream(false);
          if (streamId) {
            void refreshBoxCountFromMessages(streamId);
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to parse stream from sessionStorage', e);
    }

    setIsLoadingStream(true);
    
    try {
        // Fetch by Stream ID ONLY
        const { data: streamRow, error } = await supabase
          .from("streams")
        .select("id, broadcaster_id, title, category, status, start_time, end_time, current_viewers, total_gifts_coins, total_unique_gifters, is_live, is_private, thumbnail_url, room_name, created_at, updated_at")
          .eq("id", streamId)
          .maybeSingle();

        if (error || !streamRow) {
            toast.error("Stream not found.");
            setIsLoadingStream(false);
            return;
        }
        setViewerCount(streamRow.current_viewers ?? 0);
        setStream(streamRow as StreamRow);
        if (streamId) {
          void refreshBoxCountFromMessages(streamId);
        }
    } catch (err) {
        console.error("Failed to load stream:", err);
        toast.error("Failed to load stream information.");
    } finally {
        setIsLoadingStream(false);
    }
  }, [streamId, location, refreshBoxCountFromMessages]);

  useEffect(() => {
    loadStreamData();
  }, [loadStreamData]);

  useEffect(() => {
    if (!streamId || !stream) {
      setPrivateAccessGranted(false);
      setPrivatePasswordInput('');
      setPrivateAuthError('');
      return;
    }

    if (!privateAccessStorageKey) {
      setPrivateAccessGranted(true);
      return;
    }

    if (stream.is_private && stream.broadcaster_id !== user?.id) {
      const stored = localStorage.getItem(privateAccessStorageKey);
      setPrivateAccessGranted(Boolean(stored));
    } else {
      setPrivateAccessGranted(true);
      if (privateAccessStorageKey) {
        localStorage.removeItem(privateAccessStorageKey);
      }
    }
  }, [streamId, stream?.is_private, stream?.broadcaster_id, user?.id, privateAccessStorageKey, stream]);

  const handlePrivatePasswordSubmit = async () => {
    setPrivateAuthError('');
    if (!streamId) {
      setPrivateAuthError('Stream unavailable');
      return;
    }
    if (!user) {
      setPrivateAuthError('Please sign in to enter the password');
      return;
    }
    if (!privatePasswordInput.trim()) {
      setPrivateAuthError('Enter the stream password');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('verify_stream_password', {
        p_stream_id: streamId,
        p_password: privatePasswordInput.trim(),
      });

      if (error) throw error;

      if (data?.success) {
        setPrivateAccessGranted(true);
        if (privateAccessStorageKey) {
          localStorage.setItem(privateAccessStorageKey, '1');
        }
        setPrivateAuthError('');
        toast.success('Private access granted');
      } else {
        setPrivateAuthError('Incorrect password');
      }
    } catch (err: any) {
      console.error('Private password verification failed:', err);
      setPrivateAuthError('Unable to verify password right now');
    }
  };

  // XP Tracking for Watchers (Anti-Farm: 5 XP every 10 mins)
  const watchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const minutesWatchedRef = useRef(0);

  useEffect(() => {
    // Only track if user is logged in, stream is live, and NOT the broadcaster
    if (!user?.id || !stream?.is_live || isBroadcaster) return;

    // Clear existing timer
    if (watchTimerRef.current) clearInterval(watchTimerRef.current);

    watchTimerRef.current = setInterval(async () => {
      minutesWatchedRef.current += 1;
      
      // Award 5 XP every 10 minutes
      if (minutesWatchedRef.current % 10 === 0) {
        try {
           // Call add_xp with 'watch' source
           await supabase.rpc('add_xp', { 
             p_user_id: user.id, 
             p_amount: 5, 
             p_source: 'watch' 
           });
           console.log('[XP] Awarded 5 watch XP');
        } catch (e) {
           console.error('[XP] Failed to award watch XP', e);
        }
      }
    }, 60000); // Check every minute

    return () => {
      if (watchTimerRef.current) clearInterval(watchTimerRef.current);
    };
  }, [user?.id, stream?.is_live, isBroadcaster]);

  // Access Control for Officer Streams
  useEffect(() => {
    if (!stream) return;
    
    if (stream.category === 'Officer Stream') {
      const isOfficer = profile && (
        ['admin', 'troll_officer', 'lead_troll_officer'].includes(profile.role || '') || 
        (profile as any).is_lead_officer || 
        (profile as any).is_admin
      );
      
      if (!isOfficer) {
        toast.error("This stream is restricted to officers only.");
        navigate('/');
      }
    }
  }, [stream, profile, navigate]);

  // Update stream status to LIVE once Broadcaster is fully connected
  const hasSetLiveRef = useRef(false);
  
  useEffect(() => {
    // Only proceed if:
    // 1. User is the broadcaster
    // 2. We have a valid stream ID
    // 3. LiveKit is fully connected
    // 4. We haven't already set it to live in this session
    if (!isBroadcaster || !streamId || !isConnected || hasSetLiveRef.current) {
      return;
    }

    // Prevent redundant updates if we know it's already live
    if (stream?.status === 'live' && stream?.is_live) {
       hasSetLiveRef.current = true;
       return;
    }

    console.log('[LivePage] Broadcaster connected. Updating stream status to LIVE...');
    hasSetLiveRef.current = true;

    supabase.from("streams").update({ 
      status: "live", 
      is_live: true, 
      start_time: new Date().toISOString(),
      room_name: roomName 
    }).eq("id", streamId).then(async () => {
      console.log("[LivePage] ✅ Stream status updated to LIVE");
      toast.success("You are now LIVE!");
      
      // Evaluate badges for going live
      if (profile?.id) {
        await evaluateBadgesForUser(profile.id);
      }
    });

  }, [isBroadcaster, streamId, isConnected, roomName, stream?.status, stream?.is_live]);

  const [useFlyingChats, setUseFlyingChats] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const lastTapRef = useRef(0);

  useEffect(() => {
    const shouldLock = chatOverlayOpen || controlPanelOpen || isGiftModalOpen || isCoinStoreOpen
    if (shouldLock) {
      document.body.classList.add('no-scroll')
    } else {
      document.body.classList.remove('no-scroll')
    }
    return () => {
      document.body.classList.remove('no-scroll')
    }
  }, [chatOverlayOpen, controlPanelOpen, isGiftModalOpen, isCoinStoreOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobileViewport(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener('change', update);
    } else {
      media.addListener(update);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', update);
      } else {
        media.removeListener(update);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMobileViewport) {
      setUseFlyingChats(false);
    }
  }, [isMobileViewport]);

  const openGiftPopup = useCallback(() => {
    if (!isMobileViewport) return;
    setGiftReceiver(null);
    setIsGiftModalOpen(true);
  }, [isMobileViewport]);

  const handleStageTouchEnd = useCallback(() => {
    if (!isMobileViewport) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      openGiftPopup();
    }
    lastTapRef.current = now;
  }, [isMobileViewport, openGiftPopup]);

  // Stream polling
  useEffect(() => {
    if (!streamId) return;
    const channel = supabase
      .channel(`stream-updates-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          const newStream = payload.new as StreamRow;
          setStream(prev => {
            if (!prev) return null;
            return {
              ...prev,
              total_gifts_coins: newStream.total_gifts_coins,
              current_viewers: newStream.current_viewers,
              status: newStream.status,
              is_live: newStream.is_live,
              total_likes: newStream.total_likes
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  useEffect(() => {
    if (!streamId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from("streams").select("status,is_live,current_viewers,total_gifts_coins,total_likes").eq("id", streamId).maybeSingle();
      if (data) {
        setStream(prev => {
          if (!prev) return prev;
          
          // Check if we're within grace period of a local coin update
          const withinGrace = Date.now() - lastLocalCoinUpdateRef.current < COIN_UPDATE_GRACE_PERIOD;
          
          // Force update if values changed, but preserve local coin updates within grace period
          const shouldUpdateCoins = !withinGrace || prev.total_gifts_coins === data.total_gifts_coins;
          
          if (
            prev.current_viewers !== data.current_viewers ||
            prev.total_likes !== data.total_likes ||
            (shouldUpdateCoins && prev.total_gifts_coins !== data.total_gifts_coins)
          ) {
            return {
              ...prev,
              ...data,
              // Don't override coins if we just updated them locally
              ...(withinGrace && { total_gifts_coins: prev.total_gifts_coins })
            };
          }
          return prev;
        });
      }
    }, STREAM_POLL_INTERVAL); // Polling every 2 seconds
    return () => clearInterval(interval);
  }, [streamId]);

  useStreamEndListener({
    streamId: streamId || '',
    enabled: !!streamId, // Redirect all users including broadcaster if they are on this page
    redirectToSummary: true,
  });

  const NO_VIEWER_JOIN_MS = 15 * 60 * 1000;
  const NO_GIFT_GRACE_MS = 10 * 60 * 1000;

  useEffect(() => {
    autoEndTriggeredRef.current = false;
    setHasViewerGift(false);
    if (noViewerTimerRef.current) {
      clearTimeout(noViewerTimerRef.current);
      noViewerTimerRef.current = null;
    }
    if (noGiftTimerRef.current) {
      clearTimeout(noGiftTimerRef.current);
      noGiftTimerRef.current = null;
    }
  }, [streamId]);

  useEffect(() => {
    if (!isBroadcaster || isRoleExempt || !stream?.is_live) {
      if (noViewerTimerRef.current) {
        clearTimeout(noViewerTimerRef.current);
        noViewerTimerRef.current = null;
      }
      return;
    }

    if (activeViewers.length > 0) {
      if (noViewerTimerRef.current) {
        clearTimeout(noViewerTimerRef.current);
        noViewerTimerRef.current = null;
      }
      return;
    }

    if (!noViewerTimerRef.current) {
      noViewerTimerRef.current = window.setTimeout(() => {
        if (activeViewers.length === 0) {
          void endStreamAuto('Stream ended: no viewers joined within 15 minutes.');
        }
      }, NO_VIEWER_JOIN_MS);
    }

    return () => {
      if (noViewerTimerRef.current) {
        clearTimeout(noViewerTimerRef.current);
        noViewerTimerRef.current = null;
      }
    };
  }, [activeViewers.length, endStreamAuto, isBroadcaster, isRoleExempt, stream?.is_live, NO_VIEWER_JOIN_MS]);

  useEffect(() => {
    if (!isBroadcaster || isRoleExempt || !stream?.is_live) {
      if (noGiftTimerRef.current) {
        clearTimeout(noGiftTimerRef.current);
        noGiftTimerRef.current = null;
      }
      return;
    }

    if (hasViewerGift) {
      if (noGiftTimerRef.current) {
        clearTimeout(noGiftTimerRef.current);
        noGiftTimerRef.current = null;
      }
      return;
    }

    if (!noGiftTimerRef.current) {
      noGiftTimerRef.current = window.setTimeout(() => {
        if (!hasViewerGift) {
          void endStreamAuto('Stream ended: no gifts received from viewers.');
        }
      }, NO_GIFT_GRACE_MS);
    }

    return () => {
      if (noGiftTimerRef.current) {
        clearTimeout(noGiftTimerRef.current);
        noGiftTimerRef.current = null;
      }
    };
  }, [endStreamAuto, hasViewerGift, isBroadcaster, isRoleExempt, stream?.is_live, NO_GIFT_GRACE_MS]);

  const refreshViewerSnapshot = useCallback(async () => {
    if (!streamId) {
      setActiveViewers([]);
      setViewerCount(0);
      return;
    }

    try {
      const { data: viewerRows, error: viewerError } = await supabase
        .from('stream_viewers')
        .select('user_id')
        .eq('stream_id', streamId);

      console.log('[LivePage] Refreshing viewer snapshot. Found:', viewerRows?.length || 0, 'viewers');

      if (viewerError) {
        console.error('Failed to load active viewers:', viewerError);
        return;
      }

      const viewerIds = (viewerRows || []).map((row: any) => row.user_id).filter(Boolean);
      const fallbackViewers = viewerIds.map((id: string) => ({
        userId: id,
        username: `Viewer ${id.substring(0, 6)}`,
      }));
      let mappedViewers = fallbackViewers;

      if (viewerIds.length > 0) {
        const [profileResult, taxResult] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('id, username, avatar_url, role, troll_role, is_broadcaster, full_name, onboarding_completed')
            .in('id', viewerIds),
          supabase
            .from('user_tax_info')
            .select('user_id, w9_status')
            .in('user_id', viewerIds)
        ]);

        const profileRows = profileResult.data;
        const profileError = profileResult.error;
        const taxRows = taxResult.data || [];

        if (!profileError && Array.isArray(profileRows) && profileRows.length > 0) {
          const profileMap = new Map(profileRows.map((p: any) => [p.id, p]));
          const taxMap = new Map(taxRows.map((t: any) => [t.user_id, t]));

          mappedViewers = viewerIds.map((id: string) => {
            const profile = profileMap.get(id);
            const taxInfo = taxMap.get(id);
            const w9Status = taxInfo?.w9_status || 'pending';

            return {
              userId: id,
              username: profile?.username || `Viewer ${id.substring(0, 6)}`,
              avatarUrl: profile?.avatar_url,
              role: profile?.role || profile?.troll_role || null,
              isBroadcaster: Boolean(profile?.is_broadcaster),
              fullName: profile?.full_name || null,
              onboardingCompleted: Boolean(profile?.onboarding_completed),
              w9Status,
            };
          });
        }
      }

      setActiveViewers(mappedViewers);
      setViewerCount(viewerIds.length);
      setStream((prev) => (prev ? { ...prev, current_viewers: viewerIds.length } : prev));
    } catch (err) {
      console.error('Failed to refresh viewer snapshot:', err);
    }
  }, [streamId]);

  useEffect(() => {
    if (!streamId) return;
    refreshViewerSnapshot();
    const channel = supabase
      .channel(`stream-viewers-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_viewers',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          console.log('[LivePage] Viewer change detected:', payload.eventType);
          refreshViewerSnapshot();
        }
      )
      .subscribe((status) => {
        console.log('[LivePage] Viewer subscription status:', status);
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, refreshViewerSnapshot]);

  useEffect(() => {
    activeViewers.forEach((viewer) => {
      if (!viewer.userId) return;
      if (viewer.isBroadcaster) {
        notifiedMissingFormsRef.current.delete(viewer.userId);
        return;
      }

      const missing: string[] = [];
      if (!viewer.fullName) missing.push('Profile Info');
      if (!viewer.onboardingCompleted) missing.push('Onboarding');
      if (!['submitted', 'verified'].includes(viewer.w9Status || 'pending')) {
        missing.push('Tax / W9');
      }

      // If forms are complete, clear notification tracking and don't re-notify
      if (missing.length === 0) {
        notifiedMissingFormsRef.current.delete(viewer.userId);
        return;
      }

      // Only notify if we haven't already notified this user about their missing forms
      if (notifiedMissingFormsRef.current.has(viewer.userId)) return;
      void notifyMissingForms(viewer.userId, missing);
    });
  }, [activeViewers, notifyMissingForms]);

  // Gift subscription
  const lastGift = useGiftEvents(streamId);
  
  // Track local coin updates to prevent polling from reverting them
  const lastLocalCoinUpdateRef = useRef<number>(0);
  const COIN_UPDATE_GRACE_PERIOD = 3000; // 3 seconds

  // Update coin count instantly when a gift is received
  useEffect(() => {
    if (!lastGift) return;
    const amount = Number(lastGift.coinCost || 0);
    if (amount <= 0) return;

    lastLocalCoinUpdateRef.current = Date.now();
    setStream(prev => {
      if (!prev) return prev;
      const updatedCoins = (prev.total_gifts_coins || 0) + amount;
      if (updatedCoins === prev.total_gifts_coins) return prev;
      return { ...prev, total_gifts_coins: updatedCoins };
    });
  }, [lastGift]);

  useEffect(() => {
    if (!lastGift || !isBroadcaster || isRoleExempt || !stream?.is_live) return;
    const senderRole = (lastGift.sender_troll_role || lastGift.sender_role || '').toLowerCase();
    const senderPrivileged = ['admin', 'lead_troll_officer', 'secretary', 'troll_officer'].includes(senderRole);
    if (!senderPrivileged) {
      setHasViewerGift(true);
      if (noGiftTimerRef.current) {
        clearTimeout(noGiftTimerRef.current);
        noGiftTimerRef.current = null;
      }
    }
  }, [isBroadcaster, isRoleExempt, lastGift, stream?.is_live]);

  const toGiftSlug = (value?: string) => {
    if (!value) return 'gift';
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'gift';
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (messageBubblePosition) return;
    const width = window.innerWidth || 0;
    const height = window.innerHeight || 0;
    const defaultWidth = 360;
    const defaultHeight = 220;
    const margin = 16;
    const x = Math.max(margin, width - defaultWidth - margin);
    const y = Math.max(margin, height - defaultHeight - margin);
    setMessageBubblePosition({ x, y });
  }, [messageBubblePosition]);

  const ensureConversationForUser = useCallback(
    async (otherUserId: string): Promise<string | null> => {
      if (!profile?.id || !otherUserId) return null;

      try {
        const { data: myMemberships, error: myError } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', profile.id);

        let conversationId: string | null = null;

        if (!myError && myMemberships && myMemberships.length > 0) {
          const conversationIds = (myMemberships as any[]).map((m) => m.conversation_id);
          const { data: otherMemberships, error: otherError } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', otherUserId)
            .in('conversation_id', conversationIds);

          if (!otherError && otherMemberships && otherMemberships.length > 0) {
            conversationId = (otherMemberships[0] as any).conversation_id as string;
          }
        }

        if (!conversationId) {
          const conversation = await createConversation([otherUserId]);
          conversationId = conversation.id;
        }

        return conversationId;
      } catch (err) {
        console.error('Failed to ensure conversation:', err);
        return null;
      }
    },
    [profile?.id]
  );

  const openMessageBubble = useCallback(
    (target: { id: string; username?: string; name?: string; avatar_url?: string | null }) => {
      if (!target?.id) return;
      setMessageBubbleTarget({
        id: target.id,
        username: target.username || target.name || '',
        avatar_url: target.avatar_url || null,
      });
      setMessageBubbleText('');
      setMessageBubbleOpen(true);
    },
    []
  );

  const handleMessageBubbleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!messageBubblePosition) return;
      if (typeof window === 'undefined') return;
      event.preventDefault();

      messageBubbleDraggingRef.current = true;
      messageBubbleDragOffsetRef.current = {
        x: event.clientX - messageBubblePosition.x,
        y: event.clientY - messageBubblePosition.y,
      };

      const handleMove = (e: MouseEvent) => {
        if (!messageBubbleDraggingRef.current) return;
        const viewportWidth = window.innerWidth || 0;
        const viewportHeight = window.innerHeight || 0;
        const cardWidth = 360;
        const cardHeight = 220;
        const margin = 8;

        let nextX = e.clientX - messageBubbleDragOffsetRef.current.x;
        let nextY = e.clientY - messageBubbleDragOffsetRef.current.y;

        nextX = Math.min(Math.max(margin, nextX), Math.max(margin, viewportWidth - cardWidth - margin));
        nextY = Math.min(Math.max(margin, nextY), Math.max(margin, viewportHeight - cardHeight - margin));

        setMessageBubblePosition({ x: nextX, y: nextY });
      };

      const handleUp = () => {
        messageBubbleDraggingRef.current = false;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [messageBubblePosition]
  );

  const handleSendBubbleMessage = useCallback(async () => {
    if (!messageBubbleTarget || !messageBubbleText.trim() || messageBubbleSending) return;
    if (!profile?.id) {
      toast.error('Please sign in to send messages.');
      return;
    }

    setMessageBubbleSending(true);
    try {
      const conversationId = await ensureConversationForUser(messageBubbleTarget.id);
      if (!conversationId) {
        toast.error('Unable to start conversation right now.');
        setMessageBubbleSending(false);
        return;
      }

      const messageBody = messageBubbleText.trim();
      await sendConversationMessage(conversationId, messageBody);

      try {
        await sendNotification(
          messageBubbleTarget.id,
          'message',
          'New message',
          `New message from ${profile.username}`,
          { sender_id: profile.id }
        );
      } catch (notifErr) {
        console.warn('Notification error (bubble message):', notifErr);
      }

      setMessageBubbleText('');
      setMessageBubbleOpen(false);
      toast.success('Message sent');
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setMessageBubbleSending(false);
    }
  }, [
    messageBubbleTarget,
    messageBubbleText,
    messageBubbleSending,
    ensureConversationForUser,
    profile?.id,
    profile?.username,
  ]);

  const [generalUserActionTarget, setGeneralUserActionTarget] = useState<{
    userId: string;
    username: string;
    role: string;
    isOfficer?: boolean;
  } | null>(null);

  // Check if current user is broadofficer
  useEffect(() => {
    if (!stream?.broadcaster_id || !user?.id) return;
    if (isBroadcaster) {
        setIsCurrentUserBroadofficer(true); // Broadcaster is implied officer
        return;
    }
    const checkOfficer = async () => {
        const { data } = await supabase.rpc('is_broadofficer', {
            p_broadcaster_id: stream.broadcaster_id,
            p_user_id: user.id
        });
        setIsCurrentUserBroadofficer(!!data);
    };
    checkOfficer();
  }, [stream?.broadcaster_id, user?.id, isBroadcaster]);

  const handleGeneralKick = async () => {
      if (!generalUserActionTarget || !user) return;
      
      const isPrivileged = isBroadcaster || isCurrentUserBroadofficer || isRoleExempt;
      const fee = isPrivileged ? 0 : 500;
      
      if (!isPrivileged && (profile?.troll_coins || 0) < fee) {
          toast.error(`Insufficient funds. Need ${fee} coins.`);
          return;
      }
      
      try {
        const { error } = await supabase.rpc('kick_user', {
            p_target_user_id: generalUserActionTarget.userId,
            p_kicker_user_id: user.id,
            p_stream_id: stream?.id || null,
        });
        
        if (error) throw error;
        
        // Log action
        await supabase.from('officer_actions').insert({
            officer_id: user.id,
            target_user_id: generalUserActionTarget.userId,
            action_type: 'kick',
            related_stream_id: stream?.id || null,
            fee_coins: fee,
            metadata: { username: generalUserActionTarget.username }
        });

        toast.success(`Kicked ${generalUserActionTarget.username}`);
        setGeneralUserActionTarget(null);
      } catch (err) {
          console.error('Kick failed', err);
          toast.error('Kick failed');
      }
  };

  const handleAssignOfficer = async () => {
    if (!generalUserActionTarget || !isBroadcaster || !user) return;
    try {
      const { data, error } = await supabase.rpc('assign_broadofficer', {
        p_broadcaster_id: user.id,
        p_officer_id: generalUserActionTarget.userId
      });

      if (error) throw error;
      
      // Handle JSON response if it returns success/error object
      if (data && typeof data === 'object' && 'success' in data && !data.success) {
         toast.error(data.error || 'Failed to assign officer');
         return;
      }

      toast.success(`${generalUserActionTarget.username} is now a Broadofficer`);
      setGeneralUserActionTarget(prev => prev ? { ...prev, isOfficer: true } : null);
    } catch (err) {
      console.error('Failed to assign officer:', err);
      toast.error('Failed to assign officer');
    }
  };

  const handleRemoveOfficer = async () => {
    if (!generalUserActionTarget || !isBroadcaster || !user) return;
    try {
      const { data, error } = await supabase.rpc('remove_broadofficer', {
        p_broadcaster_id: user.id,
        p_officer_id: generalUserActionTarget.userId
      });

      if (error) throw error;

       if (data && typeof data === 'object' && 'success' in data && !data.success) {
         toast.error(data.error || 'Failed to remove officer');
         return;
      }

      toast.success(`${generalUserActionTarget.username} is no longer a Broadofficer`);
      setGeneralUserActionTarget(prev => prev ? { ...prev, isOfficer: false } : null);
    } catch (err) {
      console.error('Failed to remove officer:', err);
      toast.error('Failed to remove officer');
    }
  };

  const recordAction = async (actionType: string, targetUserId: string, targetUsername: string, fee: number = 0, metadata: any = {}) => {
      if (!user?.id) return;
      try {
        await supabase.from('officer_actions').insert({
          officer_id: user.id,
          target_user_id: targetUserId,
          action_type: actionType,
          related_stream_id: streamId || null,
          fee_coins: fee,
          metadata: {
            username: targetUsername,
            ...metadata,
          },
        });
        
        if (isOfficerUser) {
           await updateOfficerActivity(user.id);
        }
      } catch (err) {
        console.error('Failed to log action:', err);
      }
  };

  const handleMute = async (target: { userId: string; username: string }) => {
      const isPrivileged = isBroadcaster || isCurrentUserBroadofficer || isOfficerUser;
      const fee = isPrivileged ? 0 : 25;

      if (!isPrivileged && (profile?.troll_coins || 0) < fee) {
          toast.error(`Insufficient funds. Need ${fee} coins.`);
          return;
      }

      const muteDurationMs = 10 * 60 * 1000;
      const muteUntil = new Date(Date.now() + muteDurationMs).toISOString();
      
      const { error } = await supabase
        .from('user_profiles')
        .update({ mic_muted_until: muteUntil })
        .eq('id', target.userId);

      if (error) {
          toast.error('Failed to mute user');
          return;
      }

      toast.success(`Muted ${target.username} for 10 minutes`);
      await recordAction('mute', target.userId, target.username, fee, { duration_minutes: 10 });
  };

  const handleUnmute = async (target: { userId: string; username: string }) => {
       if (!isBroadcaster && !isCurrentUserBroadofficer && !isOfficerUser) {
           toast.error('You do not have permission to unmute.');
           return;
       }

       const { error } = await supabase
        .from('user_profiles')
        .update({ mic_muted_until: null })
        .eq('id', target.userId);
        
       if (error) {
          toast.error('Failed to unmute user');
          return;
       }
       toast.success(`Unmuted ${target.username}`);
       await recordAction('unmute', target.userId, target.username, 0);
  };
  
  const handleBlock = async (target: { userId: string; username: string }) => {
       const isPrivileged = isBroadcaster || isCurrentUserBroadofficer || isOfficerUser;
       const fee = isPrivileged ? 0 : 500;

       if (!isPrivileged && (profile?.troll_coins || 0) < fee) {
          toast.error(`Insufficient funds. Need ${fee} coins.`);
          return;
      }

       const blockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
       const { error } = await supabase
         .from('user_profiles')
         .update({ no_ban_until: blockUntil })
         .eq('id', target.userId);

       if (error) {
          toast.error('Failed to block user');
          return;
       }
       toast.success(`Blocked ${target.username} from bans for 24 hours`);
       await recordAction('block', target.userId, target.username, fee, { block_until: blockUntil });
  };

  const handleUserClick = useCallback(async (participant: Participant) => {
    let isOfficer = false;
    // Check if officer if we are the broadcaster
    if (stream?.broadcaster_id && participant.identity) {
       // We can optimize this by keeping a list of officers in state
       const { data } = await supabase.rpc('is_broadofficer', {
         p_broadcaster_id: stream.broadcaster_id,
         p_user_id: participant.identity
       });
       isOfficer = !!data;
    }

    setGeneralUserActionTarget({
      userId: participant.identity,
      username: participant.name || participant.identity,
      role: 'user', // Ideally parse from metadata
      isOfficer
    });
  }, [stream]);

  const handleGiftSent = useCallback(
    async (gift: GiftItem, targetModeOrSendToAll: RecipientMode | boolean) => {
      const totalCoins = gift.value || 0;
      if (totalCoins <= 0) return;

      const sendToAll = typeof targetModeOrSendToAll === 'boolean' ? targetModeOrSendToAll : false;
      const targetMode = typeof targetModeOrSendToAll === 'string' ? targetModeOrSendToAll : 'user';

      const senderId = user?.id;
      const streamIdValue = stream?.id;
      const broadcasterId = stream?.broadcaster_id;
      const canonicalGiftName = gift?.name || "Gift";
      const canonicalGiftSlug = toGiftSlug(canonicalGiftName);

      if (!senderId || !streamIdValue) {
        toast.error("Unable to send gift right now.");
        return;
      }

      const recipients: string[] = [];

      if (sendToAll) {
        const viewers = activeViewers.filter(v => v.userId !== senderId).map(v => v.userId);
        const uniqueRecipients = Array.from(new Set(viewers));
        recipients.push(...uniqueRecipients);
      } else {
        const receiverId = targetMode === "broadcaster"
          ? stream?.broadcaster_id
          : giftReceiver?.id || stream?.broadcaster_id;

        if (receiverId) recipients.push(receiverId);
      }

      if (recipients.length === 0) {
        toast.error("No recipients found.");
        return;
      }

      setGiftReceiver(null);

      let successCount = 0;

      try {
        const promises = recipients.map(async (receiverId) => {
          const { data: spendResult, error } = await supabase.rpc("spend_coins", {
            p_sender_id: senderId,
            p_receiver_id: receiverId,
            p_coin_amount: totalCoins,
            p_source: "gift",
            p_item: canonicalGiftName,
          });

          if (error) throw error;

          if (spendResult && typeof spendResult === 'object' && 'success' in spendResult && !(spendResult as any).success) {
            const errorMsg = (spendResult as any).error || 'Failed to send gift';
            throw new Error(errorMsg);
          }

          try {
            if (streamIdValue) {
              const giftId = (spendResult as any)?.gift_id;
              if (giftId && typeof giftId === 'string') {
                const { error: giftUpdateError } = await supabase
                  .from('gifts')
                  .update({
                    stream_id: streamIdValue,
                    gift_slug: canonicalGiftSlug,
                  })
                  .eq('id', giftId)
                  .limit(1);

                if (giftUpdateError) {
                  console.warn('Could not update gift with stream context:', giftUpdateError);
                }
              }
            }
          } catch (streamGiftErr) {
            console.warn('Failed to update gift stream context', streamGiftErr);
          }

          try {
            await processGiftXp(senderId, receiverId, totalCoins);
          } catch (xpErr) {
            console.warn('[LivePage] Failed to process gift XP:', xpErr);
          }

          setGiftBalanceDelta({
            userId: receiverId,
            delta: totalCoins,
            key: Date.now(),
          });
          successCount++;
        });

        await Promise.all(promises);

        if (streamIdValue && senderId) {
          const senderName = profile?.username || 'Someone';
          const content = sendToAll
            ? `${senderName} sent ${gift.name} to ${successCount} users`
            : `${senderName} sent ${gift.name}`;
          try {
            await supabase.from('messages').insert({
              stream_id: streamIdValue,
              user_id: senderId,
              content,
              message_type: 'gift',
            });
          } catch (chatErr) {
            console.warn('Failed to insert gift chat message', chatErr);
          }
        }

        if (typeof refreshProfile === 'function') {
          refreshProfile().catch((err) => {
            console.warn('Failed to refresh profile after sending gift:', err);
          });
        }

        setStream((prev) =>
          prev
            ? {
                ...prev,
                total_gifts_coins: (prev.total_gifts_coins || 0) + (totalCoins * successCount),
              }
            : prev
        );

        if (streamIdValue && broadcasterId) {
          const eventType = totalCoins >= 1000 ? "super_gift" : "gift";
          const themeIdToUse = lastThemeId || broadcastTheme?.id;

          if (themeIdToUse) {
            const themeEvents = recipients.map(rid => ({
              room_id: streamIdValue,
              broadcaster_id: broadcasterId,
              user_id: senderId,
              theme_id: themeIdToUse,
              event_type: eventType,
              payload: {
                gift_slug: canonicalGiftSlug,
                coins: totalCoins,
                sender_id: senderId,
                recipient_id: rid
              }
            }));

            await supabase.from("broadcast_theme_events").insert(themeEvents);
          }
        }

        if (sendToAll) {
          toast.success(`Sent ${gift.name} to ${successCount} users!`);
        }
      } catch (err) {
        console.error("Failed to send gift:", err);
        toast.error("Failed to send some gifts. Please try again.");
      }
    },
    [stream?.id, user?.id, giftReceiver, stream?.broadcaster_id, broadcastTheme?.id, lastThemeId, refreshProfile, activeViewers, profile?.username]
  );
  useEffect(() => {
    if (!streamId) return;
    const channel = supabase
      .channel(`broadcast-theme-events-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'broadcast_theme_events',
          filter: `room_id=eq.${streamId}`,
        },
        (payload) => {
          if (!broadcastTheme?.reactive_enabled) return;
          const eventType = payload.new?.event_type || 'gift';
          const baseIntensity = Number(broadcastTheme?.reactive_intensity || 2);
          const intensityBoost = eventType === 'super_gift' ? 2 : eventType === 'gift' ? 1 : 0;
          const intensity = Math.max(1, Math.min(5, baseIntensity + intensityBoost));
          const style = String(broadcastTheme?.reactive_style || 'pulse');
          setReactiveEvent({ key: Date.now(), style, intensity });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, broadcastTheme?.reactive_enabled, broadcastTheme?.reactive_intensity, broadcastTheme?.reactive_style]);

  useEffect(() => {
    let active = true;
    const fetchQuickGifts = async () => {
      try {
        setQuickGiftsLoading(true);
        setQuickGiftsError(null);
        const { data, error } = await supabase
          .from("gift_items")
          .select("id,name,icon,value,category")
          .order("value", { ascending: true });
        if (!active) return;
        if (error) throw error;
        const payload: GiftItem[] = (data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          icon: item.icon,
          value: item.value,
          category: item.category || "Common",
        }));

        const merged = [...payload, ...DEFAULT_GIFTS];
        const seen = new Set<string>();
        const deduped = merged.filter((g) => {
          if (seen.has(g.id)) return false;
          seen.add(g.id);
          return true;
        });

        setQuickGifts(deduped);
      } catch (err) {
        if (!active) return;
        console.error("[LivePage] Failed to load quick gifts:", err);
        setQuickGiftsError("Unable to load gifts. Showing default Quick Gifts.");
        setQuickGifts(DEFAULT_GIFTS);
      } finally {
        if (active) {
          setQuickGiftsLoading(false);
        }
      }
    };
    fetchQuickGifts();
    return () => {
      active = false;
    };
  }, []);

  // Sync active battle state for everyone
  useEffect(() => {
    if (!stream?.broadcaster_id) return;

    const checkActiveBattle = async () => {
      const { data } = await supabase
        .from('troll_battles')
        .select('*')
        .or(`player1_id.eq.${stream.broadcaster_id},player2_id.eq.${stream.broadcaster_id}`)
        .eq('status', 'active')
        .maybeSingle();

      if (data) {
        setActiveBattle(data);
      }
    };

    checkActiveBattle();
    
    const channel = supabase
      .channel(`battles-broadcaster-${stream.broadcaster_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'troll_battles',
          filter: `player1_id=eq.${stream.broadcaster_id}` 
        },
        (payload) => {
             if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                 if (payload.new.status === 'active' || payload.new.status === 'matched') {
                    setActiveBattle(payload.new as any);
                } else if (payload.new.status === 'completed') {
                    setActiveBattle(payload.new as any);
                }
             }
        }
      )
      .subscribe();

      return () => {
          supabase.removeChannel(channel);
      }
  }, [stream?.broadcaster_id]);

  const handleCoinsPurchased = useCallback((_amount: number) => {
    setIsCoinStoreOpen(false);
  }, []);
  
  const handleSendCoins = useCallback((amount: number) => {
    console.log('Sending coins:', amount);
  }, []);

  const handleSendCoinsToUser = useCallback((_user: string, amount: number) => {
    console.log('Sending coins:', amount);
    toast.info(`Sent ${amount} coins`);
  }, []);

  // Layout
  const themeAssetType =
    broadcastTheme?.asset_type ||
    (broadcastTheme?.background_css ? 'css' : broadcastTheme?.image_url || broadcastTheme?.background_asset_url ? 'image' : null);
  const imageUrl = broadcastTheme?.image_url || broadcastTheme?.background_asset_url || null;
  const hasVideoBackground =
    themeAssetType === 'video' && (broadcastTheme?.video_webm_url || broadcastTheme?.video_mp4_url);

  if (isLoadingStream || !stream || !profile) {
    return (
      <div className="min-h-screen bg-[#03010c] via-[#05031a] to-[#110117] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-2 border-purple-500/60 animate-pulse" />
          <p className="text-sm text-gray-300">Loading broadcast...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] min-h-[100dvh] w-full flex flex-col text-white overflow-hidden relative pt-[env(safe-area-inset-top,0px)] pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] lg:pt-0 lg:pb-0">
      {hasVideoBackground ? (
        <video
          className="fixed inset-0 w-full h-full object-cover -z-20"
          muted
          loop
          autoPlay
          playsInline
        >
          {broadcastTheme?.video_webm_url && (
            <source src={broadcastTheme.video_webm_url} type="video/webm" />
          )}
          {broadcastTheme?.video_mp4_url && (
            <source src={broadcastTheme.video_mp4_url} type="video/mp4" />
          )}
        </video>
      ) : (
        <div
          className="fixed inset-0 -z-20"
          style={{
            backgroundColor: '#05010a',
            ...(broadcastThemeStyle || {}),
            ...(themeAssetType === 'image' && imageUrl
              ? {
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }
              : {}),
          }}
        />
      )}
      <div className="fixed inset-0 bg-black/30 -z-10" />
      <div className={`fixed inset-0 pointer-events-none ${reactiveClass} -z-0`} />

      <div className="relative z-10 w-full flex flex-col min-h-0 flex-1">
        <GlobalGiftBanner />

      {needsPrivateGate && !privateAccessGranted && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0a16] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">Private stream</h3>
            <p className="text-sm text-gray-300 mb-4">
              This broadcast requires a password provided by the broadcaster. Enter it below to join.
            </p>
            <input
              type="password"
              value={privatePasswordInput}
              onChange={(e) => setPrivatePasswordInput(e.target.value)}
              placeholder="Enter stream password"
              className="w-full bg-[#05060f] border border-purple-500/40 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-300 focus:outline-none mb-2"
            />
            {privateAuthError && (
              <p className="text-xs text-red-400 mb-2">{privateAuthError}</p>
            )}
            <button
              className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 font-semibold text-sm"
              onClick={handlePrivatePasswordSubmit}
            >
              Submit password
            </button>
            {!user && (
              <p className="mt-3 text-xs text-gray-400">
                You must be signed in to enter the password.
              </p>
            )}
          </div>
        </div>
      )}
      {/* Entrance effect for all users */}
      {entranceEffect && (
        <div key={entranceEffectKey} className="fixed inset-0 z-[100] pointer-events-none">
          <EntranceEffect
            username={entranceEffect.username}
            role={entranceEffect.role}
            profile={entranceEffect.profile}
            userId={entranceEffect.userId}
          />
        </div>
      )}

      {/* Officer Action Bubble */}
      {isOfficerUser && isOfficerBubbleVisible && (
        <OfficerActionBubble
          streamId={streamId || ''}
          onAddBox={handleOfficerAddBox}
          onDeductBox={handleOfficerDeductBox}
          onEndBroadcast={handleOfficerEndBroadcast}
          onMuteAll={handleOfficerMuteAll}
          onKickAll={handleOfficerKickAll}
          onDisableChat={handleOfficerDisableChat}
          targets={officerTargets}
          selectedTargetId={officerTargetId}
          onTargetChange={setOfficerTargetId}
          onMuteUser={handleOfficerMuteUser}
          onDisableUserChat={handleOfficerDisableUserChat}
          onKickUser={handleOfficerKickUser}
          onRemoveSeat={handleOfficerRemoveSeat}
          seatBans={seatBans}
          onClearSeatBan={handleOfficerClearSeatBan}
          onClose={() => setIsOfficerBubbleVisible(false)}
          position={officerBubblePos}
          onMouseDown={handleOfficerDragStart}
        />
      )}
      
      {/* Header Area */}
      <div className="shrink-0 px-[clamp(8px,2.5vw,14px)] pt-2 pb-2 flex flex-wrap justify-between items-center gap-2 z-10">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(147,51,234,0.5)]">
               <span className="font-bold text-lg text-white">TC</span>
            </div>
            <div>
               <h1 className="text-[clamp(14px,4vw,20px)] font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 shadow-purple-500/50 drop-shadow-md">TROLL CITY</h1>
               <p className="text-[clamp(10px,2.8vw,12px)] text-white/50 tracking-widest uppercase">Live Broadcast</p>
            </div>
         </div>
         
         <div className="flex w-full lg:w-auto flex-wrap items-center justify-end gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setUseFlyingChats((prev) => !prev)}
              className={`lg:hidden px-2 py-1.5 rounded-lg border text-[10px] font-semibold uppercase tracking-wide transition ${
                useFlyingChats
                  ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/15 bg-white/5 text-white/70'
              }`}
            >
              {useFlyingChats ? 'Chat Box' : 'Flying Chats'}
            </button>
            {stream.is_live && (
              isBroadcaster && stream.start_time ? (
                <BroadcasterTimer startTime={stream.start_time} onClick={endStream} />
              ) : (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-600/90 rounded-full border border-red-500/50 shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                   <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                   <span className="text-xs font-bold text-white tracking-wider">LIVE</span>
                </div>
              )
            )}

            {isBroadcaster && (
              <>
                <button
                  onClick={() => setControlPanelOpen(true)}
                  className="px-2 py-1.5 rounded-xl border border-purple-500/30 bg-purple-900/20 text-[10px] font-bold uppercase tracking-wider text-purple-200 hover:bg-purple-800/40 hover:border-purple-400/50 transition-all shadow-[0_0_10px_rgba(147,51,234,0.2)] flex items-center gap-1"
                >
                  <Settings size={14} />
                  Settings
                </button>
                <button
                  onClick={handleAddBox}
                  className="px-2 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-900/20 text-[10px] font-bold uppercase tracking-wider text-emerald-200 hover:bg-emerald-800/40 hover:border-emerald-400/50 transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)] flex items-center gap-1"
                >
                  <Plus size={14} />
                  Add Box
                </button>
                <button
                  onClick={handleDeductBox}
                  className="px-2 py-1.5 rounded-xl border border-amber-500/30 bg-amber-900/20 text-[10px] font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-800/40 hover:border-amber-400/50 transition-all shadow-[0_0_10px_rgba(245,158,11,0.2)] flex items-center gap-1"
                >
                  <Minus size={14} />
                  Deduct Box
                </button>
                <button
                  onClick={() => setShowTrollBattles(true)}
                  className="px-2 py-1.5 rounded-xl border border-red-500/30 bg-red-900/20 text-[10px] font-bold uppercase tracking-wider text-red-200 hover:bg-red-800/40 hover:border-red-400/50 transition-all shadow-[0_0_10px_rgba(220,38,38,0.2)] flex items-center gap-1"
                >
                  <Swords size={14} />
                  Battles
                </button>
              </>
            )}

            <button
              className="hidden lg:flex px-4 py-2 rounded-xl border border-blue-500/30 bg-blue-900/20 text-xs font-bold uppercase tracking-wider text-blue-200 hover:bg-blue-800/40 hover:border-blue-400/50 transition-all gap-2 items-center shadow-[0_0_10px_rgba(59,130,246,0.2)]"
              onClick={() => toast.info("Install App feature coming soon!")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              Install App
            </button>
            
            <div className="relative">
              <button
                ref={viewerButtonRef}
                type="button"
                onClick={() => setIsViewerDropdownOpen((prev) => !prev)}
                className="px-2 py-1.5 bg-white/5 rounded-lg border border-white/10 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-400 transition"
                aria-expanded={isViewerDropdownOpen}
              >
                <Users size={16} className="text-green-400" /> <span className="font-bold text-[clamp(11px,3vw,14px)]">{viewerCount.toLocaleString()}</span>
              </button>
              {isViewerDropdownOpen && (
                <div
                  ref={viewerDropdownRef}
                  className="absolute right-0 mt-2 w-64 max-h-72 overflow-hidden rounded-2xl border border-white/10 bg-black/95 shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-20"
                >
                  <div className="px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-white/50">
                    Active viewers
                  </div>
                  <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
                    {activeViewers.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-white/60 text-center">No active viewers</div>
                    ) : (
                      activeViewers.map((viewer) => (
                        <div key={viewer.userId} className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition">
                          <div className="h-8 w-8 rounded-full bg-white/10 text-xs font-semibold uppercase text-white flex items-center justify-center overflow-hidden">
                            {viewer.avatarUrl ? (
                              <img src={viewer.avatarUrl} alt={viewer.username} className="h-full w-full object-cover" />
                            ) : (
                              viewer.username?.charAt(0) ?? '?'
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{viewer.username}</p>
                            {viewer.role && (
                              <p className="text-[11px] text-white/60 capitalize">{viewer.role}</p>
                            )}
                          </div>
                          {viewer.isBroadcaster && (
                            <span className="self-start whitespace-nowrap rounded-full border border-emerald-400/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                              Host
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {isBroadcaster && (
              <>
                <button onClick={toggleMic} className={`p-1.5 rounded-lg border ${micOn ? 'bg-purple-600 border-purple-400' : 'bg-red-900/50 border-red-500'}`}>
                  {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button onClick={toggleCamera} className={`p-1.5 rounded-lg border ${cameraOn ? 'bg-purple-600 border-purple-400' : 'bg-red-900/50 border-red-500'}`}>
                  {cameraOn ? <Camera size={18} /> : <CameraOff size={18} />}
                </button>
                <button
                  onClick={switchCameraFacing}
                  className="p-1.5 rounded-lg border bg-black/40 border-purple-500 text-purple-300"
                  title={cameraFacing === 'user' ? 'Switch to rear camera' : 'Switch to front camera'}
                >
                  <RefreshCw size={18} />
                </button>
              </>
            )}
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 px-[clamp(8px,2.5vw,12px)] pb-2 overflow-y-auto lg:overflow-hidden">
        {/* Live Stage (Video + Guests) */}
        <div
          className="flex flex-col min-h-0 gap-2 lg:gap-2 flex-1 relative z-0 video-cover"
          onClick={() => {
            if (!showLivePanels) setShowLivePanels(true);
          }}
          onDoubleClick={(e) => {
            handleOfficerDoubleClick(e);
            openGiftPopup();
          }}
          onTouchEnd={handleStageTouchEnd}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (!showLivePanels) setShowLivePanels(true);
            }
          }}
        >
          <div className="shrink-0 min-h-0 flex flex-col relative w-full">
            <BroadcastLayout 
              className="h-auto"
              streamId={streamId || ''}
              room={liveKit.getRoom()} 
              broadcasterId={stream.broadcaster_id}
              isHost={canModerateGuests}
              boxCount={boxCount}
              seats={seats}
              onUserClick={handleUserClick}
              hostSeatIndex={hostSeatIndex}
              onHostSeatChange={(index) => {
                setHostSeatIndex((prev) => {
                  if (prev === index) return prev;
                  console.log('[LivePage] Host seat index changed', {
                    from: prev,
                    to: index,
                    broadcasterId: stream.broadcaster_id,
                    cameraOn,
                  });
                  return index;
                });
              }}
              joinPrice={joinPrice}
              lastGift={lastGift}
              backgroundStyle={broadcastThemeStyle}
              onSetPrice={handleSetPrice}
              onJoinRequest={handleJoinRequest}
              onLeaveSession={handleLeaveSession}
              onDisableGuestMedia={canModerateGuests ? handleDisableGuestMedia : undefined}
              onSeatAction={handleSeatAction}
              giftBalanceDelta={giftBalanceDelta}
              // Media Controls
              onToggleCamera={toggleCamera}
              isCameraOn={cameraOn}
            >
               <GiftEventOverlay gift={lastGift} onProfileClick={(p) => setSelectedProfile(p)} />
            </BroadcastLayout>

            {activeBattle && stream?.broadcaster_id && (
               <TrollBattleOverlay
                 battleId={activeBattle.id}
                 broadcasterId={stream.broadcaster_id}
                 initialBattleData={activeBattle}
                 onBattleEnd={() => {
                    setTimeout(() => setActiveBattle(null), 15000); 
                 }}
               />
            )}

            {useFlyingChats && (
              <div className="absolute inset-0 pointer-events-none lg:hidden">
                <div className="chat-container">
                  <div className="message-list">
                    <FlyingChatOverlay streamId={streamId || ''} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Chat Panel (hidden when flying chats enabled) */}
          {showLivePanels && !useFlyingChats && (
            <div className="lg:hidden relative flex flex-col min-h-0 h-[clamp(160px,26vh,240px)] overflow-hidden rounded-xl border border-white/10 bg-black/40">
              <button
                type="button"
                onClick={() => setChatOverlayOpen(true)}
                className="absolute top-2 right-2 z-10 text-[10px] px-2 py-1 rounded-full border border-white/20 text-white/70 bg-black/40"
              >
                Expand
              </button>
              <div className="flex-1 min-h-0 overflow-hidden">
                <ChatBox 
                  streamId={streamId || ''} 
                  onProfileClick={setSelectedProfile}
                  onCoinSend={handleSendCoinsToUser}
                  room={liveKit.getRoom()}
                  isBroadcaster={isBroadcaster}
                />
              </div>
            </div>
          )}
        </div>

        {/* Desktop Right Panel (Chat/Gifts) */}
        {showLivePanels && (
          <div className="hidden lg:flex w-[300px] shrink-0 lg:h-full min-h-0 flex-col gap-3 overflow-hidden relative z-0">
            <div className="flex flex-col flex-[1] min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60 border-b border-white/10">Gifts</div>
                <div className="h-full min-h-0 overflow-y-auto pr-2 pb-[env(safe-area-inset-bottom)]">
                  <GiftBox
                    onSendGift={handleGiftSent}
                    gifts={quickGifts}
                    loading={quickGiftsLoading}
                    loadError={quickGiftsError}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col flex-[1] min-h-0">
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-black/40">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60 border-b border-white/10">
                  <span>Chat</span>
                </div>
                <div className="flex-1 min-h-0">
                  <ChatBox 
                    streamId={streamId || ''} 
                    onProfileClick={setSelectedProfile}
                    onCoinSend={handleSendCoinsToUser}
                    room={liveKit.getRoom()}
                    isBroadcaster={isBroadcaster}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {useFlyingChats && (
        <button
          type="button"
          onClick={() => setChatOverlayOpen(true)}
          className="lg:hidden fixed right-3 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+12px)] z-[70] px-3 py-2 rounded-full bg-purple-600/90 border border-purple-400/60 text-xs font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(147,51,234,0.6)]"
        >
          Chat
        </button>
      )}

      {/* Modals */}
      {showTrollBattles && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md relative">
            <button
              onClick={() => setShowTrollBattles(false)}
              className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <TrollBattlesSetup
              streamId={streamId || ''}
              onOpponentFound={async (opponent, battleId) => {
                try {
                  const { error } = await supabase
                    .from('troll_battles')
                    .update({ status: 'active', started_at: new Date().toISOString() })
                    .eq('id', battleId);

                  if (error) throw error;

                  setActiveBattle({ 
                    id: battleId, 
                    player1_id: user?.id, 
                    player2_id: opponent.id, 
                    status: 'active' 
                  });
                  setShowTrollBattles(false);
                } catch (err) {
                  console.error('Failed to start battle:', err);
                  toast.error('Failed to start battle');
                }
              }}
              onCancel={() => setShowTrollBattles(false)}
            />
          </div>
        </div>
      )}
      {isGiftModalOpen && (
        <GiftModal 
          onClose={() => { setIsGiftModalOpen(false); setGiftReceiver(null); }} 
          onSendGift={handleGiftSent} 
          recipientName={giftReceiver?.username || giftReceiver?.name} 
          profile={profile}
        />
      )}
      {selectedProfile && (
        <ProfileModal 
          profile={selectedProfile} 
          currentUser={user}
          onClose={() => setSelectedProfile(null)} 
          onSendCoins={handleSendCoins} 
          onGift={(profile: { id: string; username?: string; name?: string }) => {
            setGiftReceiver(profile);
            setIsGiftModalOpen(true);
            setSelectedProfile(null);
          }}
          onMessageUser={(target: { id: string; username?: string; name?: string; avatar_url?: string | null }) => {
            openMessageBubble(target);
            setSelectedProfile(null);
          }}
        />
      )}
      {messageBubbleOpen && messageBubbleTarget && (
        <div className="fixed inset-0 z-[180] pointer-events-none">
          <div
            className="max-w-sm w-full bg-[#05010a]/95 border border-white/10 rounded-2xl shadow-2xl p-4 pointer-events-auto"
            style={
              messageBubblePosition
                ? {
                    position: 'fixed',
                    left: messageBubblePosition.x,
                    top: messageBubblePosition.y,
                  }
                : undefined
            }
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="flex items-center gap-2 cursor-move select-none"
                onMouseDown={handleMessageBubbleMouseDown}
              >
                {messageBubbleTarget.avatar_url && (
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-white/10">
                    <img
                      src={messageBubbleTarget.avatar_url}
                      alt={messageBubbleTarget.username || ''}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="text-sm font-semibold">
                  Message {messageBubbleTarget.username || 'user'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMessageBubbleOpen(false)}
                className="text-xs px-2 py-1 rounded-full border border-white/30 text-white/70 hover:bg-white/10"
              >
                ×
              </button>
            </div>
            <textarea
              value={messageBubbleText}
              onChange={(e) => setMessageBubbleText(e.target.value)}
              rows={3}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40 resize-none"
              placeholder="Type your message..."
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMessageBubbleOpen(false)}
                className="px-3 py-1.5 rounded-full text-xs border border-white/20 text-white/70 hover:bg-white/5"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSendBubbleMessage}
                disabled={!messageBubbleText.trim() || messageBubbleSending}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:text-white/40"
              >
                {messageBubbleSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
      {seatActionTarget && (
      <UserActionsMenu
          user={{
            name: seatActionTarget.username || 'Seat occupant',
            role: seatActionTarget.role as any,
          }}
          userRole={profile?.role}
          onClose={closeSeatActionMenu}
          onGift={handleSeatGift}
          onKick={handleSeatKick}
          onKickWithBan={async (duration) => {
            if (!seatActionTarget) return;
            let minutes: number | null = null;
            if (duration === '5m') minutes = 5;
            if (duration === '30m') minutes = 30;
            if (duration === '1h') minutes = 60;
            const banMinutes = duration === 'permanent' ? null : minutes;
            try {
              await releaseSeat(seatActionTarget.seatIndex, seatActionTarget.userId, {
                force: true,
                banMinutes,
                banPermanent: duration === 'permanent',
              });
              if (duration === 'permanent') {
                toast.success('Guest removed and permanently blocked from guest box');
              } else if (banMinutes) {
                toast.success(
                  `Guest removed and blocked from guest box for ${banMinutes} minutes`
                );
              } else {
                toast.success('Guest removed from seat');
              }
              closeSeatActionMenu();
            } catch (err) {
              console.error('Failed to remove guest with timeout', err);
              toast.error('Failed to remove guest');
            }
          }}
          onReport={handleSeatReport}
          onFollow={handleSeatFollow}
          onSummon={handleSeatSummon}
          onMute={() => handleMute({ userId: seatActionTarget.userId, username: seatActionTarget.username || '' })}
          onUnmute={() => handleUnmute({ userId: seatActionTarget.userId, username: seatActionTarget.username || '' })}
          onBlock={() => handleBlock({ userId: seatActionTarget.userId, username: seatActionTarget.username || '' })}
          isCurrentUserBroadofficer={isCurrentUserBroadofficer}
          isBroadcaster={isBroadcaster}
          isBroadofficer={seatActionTarget.isOfficer}
        />
      )}
      {generalUserActionTarget && (
        <UserActionsMenu
          user={{
            name: generalUserActionTarget.username,
            role: generalUserActionTarget.role,
          }}
          userRole={profile?.role}
          onClose={() => setGeneralUserActionTarget(null)}
          onKick={handleGeneralKick}
          onAssignOfficer={handleAssignOfficer}
          onRemoveOfficer={handleRemoveOfficer}
          isBroadofficer={generalUserActionTarget.isOfficer}
          isBroadcaster={isBroadcaster}
          isCurrentUserBroadofficer={isCurrentUserBroadofficer}
          onGift={(amount) => handleSendCoinsToUser(generalUserActionTarget.userId, amount)}
          onMute={() => handleMute({ userId: generalUserActionTarget.userId, username: generalUserActionTarget.username })}
          onUnmute={() => handleUnmute({ userId: generalUserActionTarget.userId, username: generalUserActionTarget.username })}
          onBlock={() => handleBlock({ userId: generalUserActionTarget.userId, username: generalUserActionTarget.username })}
        />
      )}
      {isCoinStoreOpen && <CoinStoreModal onClose={() => setIsCoinStoreOpen(false)} onPurchase={handleCoinsPurchased} />}
      {chatOverlayOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 p-2 md:hidden">
          <div className="w-full max-h-[80vh] bg-[#05010a] rounded-t-2xl border border-white/10 overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-white/60">Live Chat</h3>
              <button
                onClick={() => setChatOverlayOpen(false)}
                className="text-white/60 hover:text-white text-sm"
              >
                Close
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden p-3">
              <ChatBox
                streamId={streamId || ''}
                onProfileClick={setSelectedProfile}
                onCoinSend={handleSendCoinsToUser}
                room={liveKit.getRoom()}
                isBroadcaster={isBroadcaster}
              />
            </div>
          </div>
        </div>
      )}
      {isBroadcaster && controlPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-4xl">
            <button
              onClick={() => setControlPanelOpen(false)}
              className="absolute right-3 top-3 text-white/60 hover:text-white"
            >
              Close
            </button>
            <div className="bg-[#05010a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
              <BroadcasterSettings
                streamId={streamId || ''}
                broadcasterId={stream?.broadcaster_id}
                onAlertOfficers={handleAlertOfficers}
                joinPrice={joinPrice}
                onSetPrice={handleSetPrice}
              />
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
