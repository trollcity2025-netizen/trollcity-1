// =============================================================================
// FAMILY COMMUNICATION HUB - REAL-TIME FAMILY CHAT
// A premium, real-time family communication system combining:
// - Real-time messaging
// - Voice rooms
// - Video calls
// - Live presence indicators
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { useCoins } from '../lib/hooks/useCoins';
import { deductCoins, addCoins } from '../lib/coinTransactions';
import { toast } from 'sonner';
import { 
  Crown, Users, MessageSquare, Phone, Video, Send, 
  Circle, ChevronLeft, MoreVertical, Mic, MicOff,
  VideoOff, PhoneOff, Plus, Gift, Sparkles,
  Activity, ArrowLeft, Clock, ShoppingCart
} from 'lucide-react';

// Family Minutes Store Modal - Buy call minutes with coins
function FamilyMinutesStoreModal({
  isOpen,
  onClose,
  familyId,
  familyName,
  familyMinutes,
  onPurchaseComplete
}: {
  isOpen: boolean;
  onClose: () => void;
  familyId: string;
  familyName: string;
  familyMinutes: { audio_minutes: number; video_minutes: number };
  onPurchaseComplete: () => void;
}) {
  const { user } = useAuthStore();
  const { troll_coins, refreshCoins } = useCoins();
  const [selectedPackage, setSelectedPackage] = useState<{ audio: number; video: number; cost: number; originalCost: number; name: string } | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [isFamilyMember, setIsFamilyMember] = useState(false);

  // Base packages (non-family prices)
  const basePackages = [
    { audio: 30, video: 15, cost: 100, name: 'Starter' },
    { audio: 60, video: 30, cost: 180, name: 'Standard' },
    { audio: 120, video: 60, cost: 320, name: 'Premium' },
    { audio: 240, video: 120, cost: 600, name: 'Ultimate' },
  ];

  // Apply 5% discount for family members
  const packages = basePackages.map(pkg => ({
    ...pkg,
    originalCost: pkg.cost,
    cost: isFamilyMember ? Math.floor(pkg.cost * 0.95) : pkg.cost // 5% off for family
  }));

  // Check if user is a family member on mount
  useEffect(() => {
    if (user && familyId) {
      checkFamilyMembership();
    }
  }, [user, familyId]);

  const checkFamilyMembership = async () => {
    try {
      const { data } = await supabase
        .from('family_members')
        .select('id')
        .eq('family_id', familyId)
        .eq('user_id', user?.id)
        .single();
      
      setIsFamilyMember(!!data);
    } catch {
      // Try alternate table
      try {
        const { data: tfmData } = await supabase
          .from('troll_family_members')
          .select('id')
          .eq('family_id', familyId)
          .eq('user_id', user?.id)
          .single();
        
        setIsFamilyMember(!!tfmData);
      } catch {
        setIsFamilyMember(false);
      }
    }
  };

  if (!isOpen) return null;

  const handlePurchase = async () => {
    if (!user || !selectedPackage) return;

    // Refresh balance first to ensure accuracy
    await refreshCoins();

    if (troll_coins < selectedPackage.cost) {
      toast.error('Not enough coins! Buy more from the Coin Store.');
      return;
    }

    setPurchasing(true);
    try {
      // Deduct coins
      const deductResult = await deductCoins({
        userId: user.id,
        amount: selectedPackage.cost,
        type: 'purchase',
        description: `Purchased ${selectedPackage.audio} audio + ${selectedPackage.video} video family call minutes`,
        metadata: { family_id: familyId, audio_minutes: selectedPackage.audio, video_minutes: selectedPackage.video },
        useCredit: false,
        supabaseClient: supabase
      });

      if (!deductResult.success) {
        toast.error(deductResult.error || 'Failed to deduct coins');
        setPurchasing(false);
        return;
      }

      // Add minutes to family
      const { data, error } = await supabase.rpc('purchase_family_call_minutes', {
        p_family_id: familyId,
        p_user_id: user.id,
        p_audio_minutes: selectedPackage.audio,
        p_video_minutes: selectedPackage.video,
        p_cost: selectedPackage.cost
      });

      if (error || !data?.success) {
        // Rollback: refund the coins since minutes purchase failed
        await addCoins({
          userId: user.id,
          amount: selectedPackage.cost,
          type: 'refund',
          description: 'Refund for failed family minutes purchase',
          metadata: { failed_purchase: true, family_id: familyId }
        });
        toast.error(data?.error || 'Failed to purchase minutes - coins refunded');
        await refreshCoins();
        setPurchasing(false);
        return;
      }

      if (data?.success) {
        toast.success(`Purchased ${selectedPackage.audio} audio + ${selectedPackage.video} video minutes for family!`);
        await refreshCoins();
        onPurchaseComplete();
        onClose();
      }
    } catch (err) {
      console.error('Error purchasing family minutes:', err);
      toast.error('Failed to purchase minutes');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-white/20 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Buy Family Call Minutes
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <span className="text-gray-400 text-2xl">&times;</span>
          </button>
        </div>

        {/* Current Balance */}
        <div className="mb-6 p-4 bg-slate-800/50 rounded-xl">
          <p className="text-gray-400 text-sm mb-2">Current Family Minutes</p>
          <div className="flex items-center gap-6 mb-3">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-green-400" />
              <span className="text-white font-bold text-lg">{familyMinutes.audio_minutes || 0}</span>
              <span className="text-gray-400">audio</span>
            </div>
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-400" />
              <span className="text-white font-bold text-lg">{familyMinutes.video_minutes || 0}</span>
              <span className="text-gray-400">video</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-slate-700">
            <span className="text-gray-400">Your Coins</span>
            <span className="text-yellow-400 font-bold">{troll_coins?.toLocaleString() || 0}</span>
          </div>
        </div>

        {/* Package Options */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">Select a package:</p>
            {isFamilyMember && (
              <span className="text-green-400 text-xs bg-green-500/20 px-2 py-1 rounded-full">
                👑 Family Member - 5% OFF
              </span>
            )}
          </div>
          {packages.map((pkg) => (
            <button
              key={pkg.name}
              onClick={() => setSelectedPackage(pkg)}
              disabled={troll_coins < pkg.cost}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                selectedPackage?.name === pkg.name
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-white/10 hover:border-white/30 bg-slate-800/30'
              } ${troll_coins < pkg.cost ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">{pkg.name}</p>
                  <p className="text-gray-400 text-sm">
                    {pkg.audio} audio + {pkg.video} video minutes
                  </p>
                </div>
                <div className="text-right">
                  {isFamilyMember && pkg.cost < pkg.originalCost && (
                    <p className="text-gray-500 text-xs line-through">{pkg.originalCost} coins</p>
                  )}
                  <p className="text-amber-400 font-bold">{pkg.cost} coins</p>
                  {troll_coins < pkg.cost && (
                    <p className="text-red-400 text-xs">Not enough</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Purchase Button */}
        <button
          onClick={handlePurchase}
          disabled={!selectedPackage || purchasing || (troll_coins < (selectedPackage?.cost || 0))}
          className={`w-full py-3 rounded-xl font-semibold transition-all ${
            selectedPackage && troll_coins >= selectedPackage.cost && !purchasing
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-slate-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {purchasing ? 'Purchasing...' : selectedPackage ? `Purchase for ${selectedPackage.cost} Coins` : 'Select a Package'}
        </button>

        <p className="text-gray-500 text-xs text-center mt-4">
          Minutes expire after 30 days from purchase
        </p>
      </div>
    </div>
  );
}

// Family Gift Modal Component
function FamilyGiftModal({
  isOpen,
  onClose,
  familyId,
  familyName
}: {
  isOpen: boolean;
  onClose: () => void;
  familyId: string;
  familyName: string;
}) {
  const { user } = useAuthStore();
  const { troll_coins, refreshCoins } = useCoins();
  const [amount, setAmount] = useState(100);
  const [sending, setSending] = useState(false);

  const presetAmounts = [50, 100, 200, 500, 1000, 2500];

  if (!isOpen) return null;

  const sendGift = async () => {
    if (!user || amount <= 0 || amount > (troll_coins || 0)) {
      toast.error('Invalid gift amount or insufficient balance');
      return;
    }

    setSending(true);
    try {
      // Deduct coins
      const { success, error } = await deductCoins({
        userId: user.id,
        amount: amount,
        type: 'family_gift',
        description: `Gift to family ${familyName}`,
        metadata: { family_id: familyId },
        useCredit: false,
        supabaseClient: supabase
      });

      if (success) {
        // Record family gift for goals
        await supabase
          .from('family_gift_logs')
          .insert({
            family_id: familyId,
            user_id: user.id,
            amount: amount,
            created_at: new Date().toISOString()
          });

        toast.success(`Gift of ${amount} coins sent to family!`);
        await refreshCoins();
        onClose();
        setAmount(100);
      } else {
        toast.error(error || 'Failed to send gift');
      }
    } catch (err) {
      console.error('Gift error:', err);
      toast.error('Failed to send gift');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-400" />
            Gift to Family
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <span className="text-gray-400 text-2xl">&times;</span>
          </button>
        </div>

        <div className="mb-6 p-4 bg-slate-800/50 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Your Coins</span>
            <span className="text-yellow-400 font-bold">{troll_coins?.toLocaleString() || 0}</span>
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-300 mb-3">Gift Amount</label>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {presetAmounts.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                amount === preset ? 'bg-purple-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              {preset.toLocaleString()}
            </button>
          ))}
        </div>

        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white mb-6"
          placeholder="Enter amount"
        />

        <button
          onClick={sendGift}
          disabled={sending || amount <= 0 || amount > (troll_coins || 0)}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {sending ? 'Sending...' : `Send ${amount.toLocaleString()} Coins`}
        </button>

        {amount > (troll_coins || 0) && (
          <p className="text-red-400 text-sm mt-2 text-center">Insufficient coins</p>
        )}
      </div>
    </div>
  );
}

// Types
interface FamilyData {
  id: string;
  name: string;
  tag: string;
  crest_url?: string;
  banner_url?: string;
  level: number;
}

interface FamilyMember {
  id: string;
  user_id: string;
  role: string;
  username?: string;
  avatar_url?: string;
  display_name?: string;
}

interface ChatMessage {
  id: string;
  family_id: string;
  user_id: string;
  message: string;
  message_type: 'text' | 'system' | 'call';
  created_at: string;
  // Joined fields
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

interface FamilyCall {
  id: string;
  family_id: string;
  type: 'voice' | 'video';
  created_by: string;
  is_active: boolean;
  max_participants: number;
  started_at: string;
}

interface CallMember {
  id: string;
  call_id: string;
  user_id: string;
  joined_at: string;
  is_speaking: boolean;
  is_muted: boolean;
  is_video_on: boolean;
  // Joined fields
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

interface OnlineMember {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  role: string;
  is_in_call: boolean;
  call_id: string | null;
}

export default function TrollFamilyChat() {
  const { familyId: urlFamilyId } = useParams<{ familyId: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // State
  const [familyId, setFamilyId] = useState<string | null>(urlFamilyId || null);
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([]);
  const [activeCall, setActiveCall] = useState<FamilyCall | null>(null);
  const [callMembers, setCallMembers] = useState<CallMember[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [familyMinutes, setFamilyMinutes] = useState<{ audio_minutes: number; video_minutes: number }>({ audio_minutes: 0, video_minutes: 0 });
  const [showBuyMinutesModal, setShowBuyMinutesModal] = useState(false);
  const [showCoinStore, setShowCoinStore] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftRecipient, setGiftRecipient] = useState<{id: string, username: string} | null>(null);
  const { troll_coins, refreshCoins } = useCoins();

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch family data
  const fetchFamilyData = useCallback(async () => {
    let targetFamilyId = familyId;
    
    // If no familyId provided, fetch user's family
    if (!targetFamilyId && user) {
      try {
        const { data: memberData } = await supabase
          .from('family_members')
          .select('family_id')
          .eq('user_id', user.id)
          .single();
        
        if (memberData?.family_id) {
          targetFamilyId = memberData.family_id;
          setFamilyId(targetFamilyId);
          // Update URL without navigation
          navigate(`/family/chat/${targetFamilyId}`, { replace: true });
        } else {
          // Try troll_family_members table
          const { data: tfmData } = await supabase
            .from('troll_family_members')
            .select('family_id')
            .eq('user_id', user.id)
            .single();
          
          if (tfmData?.family_id) {
            targetFamilyId = tfmData.family_id;
            setFamilyId(targetFamilyId);
            navigate(`/family/chat/${targetFamilyId}`, { replace: true });
          }
        }
      } catch (err) {
        console.error('Error fetching user family:', err);
      }
    }

    if (!targetFamilyId) return;

    try {
      // Get family details
      const { data: familyData, error: familyError } = await supabase
        .from('troll_families')
        .select('*')
        .eq('id', targetFamilyId)
        .single();

      if (familyError) throw familyError;
      setFamily(familyData);

      // Get user's role in family
      if (user) {
        const { data: memberData } = await supabase
          .from('family_members')
          .select('role')
          .eq('family_id', targetFamilyId)
          .eq('user_id', user.id)
          .single();
        
        if (memberData) {
          setCurrentUserRole(memberData.role);
        }
      }
    } catch (err) {
      console.error('Error fetching family:', err);
    }
  }, [familyId, user, navigate]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!familyId) return;

    try {
      const { data, error } = await supabase
        .from('family_chat_messages')
        .select('*')
        .eq('family_id', familyId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      // Enrich messages with user data
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(m => m.user_id))];
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const enrichedMessages = data.map(m => ({
          ...m,
          username: profileMap.get(m.user_id)?.username,
          display_name: profileMap.get(m.user_id)?.username,
          avatar_url: profileMap.get(m.user_id)?.avatar_url,
        }));

        setMessages(enrichedMessages);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, [familyId]);

  // Fetch active call
  const fetchActiveCall = useCallback(async () => {
    if (!familyId) return;

    try {
      const { data, error } = await supabase
        .from('family_calls')
        .select('*')
        .eq('family_id', familyId)
        .eq('is_active', true)
        .single();

      if (data) {
        setActiveCall(data);
        // Check if user is in call
        if (user) {
          const { data: memberData } = await supabase
            .from('family_call_members')
            .select('*')
            .eq('call_id', data.id)
            .eq('user_id', user.id)
            .is('left_at', null)
            .single();
          
          setIsInCall(!!memberData);
        }
      } else {
        setActiveCall(null);
        setIsInCall(false);
      }
    } catch (err) {
      setActiveCall(null);
    }
  }, [familyId, user]);

  // Fetch call members
  const fetchCallMembers = useCallback(async () => {
    if (!activeCall) return;

    try {
      const { data, error } = await supabase
        .from('family_call_members')
        .select('*')
        .eq('call_id', activeCall.id)
        .is('left_at', null);

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const enrichedMembers = data.map(m => ({
          ...m,
          username: profileMap.get(m.user_id)?.username,
          display_name: profileMap.get(m.user_id)?.username,
          avatar_url: profileMap.get(m.user_id)?.avatar_url,
        }));

        setCallMembers(enrichedMembers);
      } else {
        setCallMembers([]);
      }
    } catch (err) {
      console.error('Error fetching call members:', err);
    }
  }, [activeCall]);

  // Fetch online members
  const fetchOnlineMembers = useCallback(async () => {
    if (!familyId) return;

    try {
      const { data, error } = await supabase.rpc('get_family_online_members', {
        p_family_id: familyId
      });

      if (!error && data) {
        setOnlineMembers(data);
      }
    } catch (err) {
      console.error('Error fetching online members:', err);
    }
  }, [familyId]);

  // Fetch family call minutes
  const fetchFamilyMinutes = useCallback(async () => {
    if (!familyId) return;

    try {
      const { data, error } = await supabase.rpc('get_family_call_minutes', {
        p_family_id: familyId
      });

      if (!error && data && data.length > 0) {
        setFamilyMinutes({
          audio_minutes: data[0].audio_minutes || 0,
          video_minutes: data[0].video_minutes || 0
        });
      } else {
        setFamilyMinutes({ audio_minutes: 0, video_minutes: 0 });
      }
    } catch (err) {
      console.error('Error fetching family minutes:', err);
      setFamilyMinutes({ audio_minutes: 0, video_minutes: 0 });
    }
  }, [familyId]);

  // Purchase family call minutes
  const purchaseFamilyMinutes = async (audioMinutes: number, videoMinutes: number, totalCost: number) => {
    if (!familyId || !user || !isLeader) return;

    // Refresh balance first to ensure accuracy
    await refreshCoins();

    if (troll_coins < totalCost) {
      toast.error(`Not enough coins. Need ${totalCost}, have ${troll_coins}`);
      return;
    }

    try {
      // Deduct coins - use 'purchase' type like coin store does
      const deductResult = await deductCoins({
        userId: user.id,
        amount: totalCost,
        type: 'purchase',
        description: `Purchased ${audioMinutes} audio + ${videoMinutes} video family call minutes`,
        metadata: { family_id: familyId, audio_minutes: audioMinutes, video_minutes: videoMinutes },
        useCredit: false,
        supabaseClient: supabase
      });

      if (!deductResult.success) {
        toast.error(deductResult.error || 'Failed to deduct coins');
        return;
      }

      // Add minutes to family
      const { data, error } = await supabase.rpc('purchase_family_call_minutes', {
        p_family_id: familyId,
        p_user_id: user.id,
        p_audio_minutes: audioMinutes,
        p_video_minutes: videoMinutes,
        p_cost: totalCost
      });

      if (error || !data?.success) {
        // Rollback: refund the coins since minutes purchase failed
        await addCoins({
          userId: user.id,
          amount: totalCost,
          type: 'refund',
          description: 'Refund for failed family minutes purchase',
          metadata: { failed_purchase: true, family_id: familyId }
        });
        toast.error(data?.error || 'Failed to purchase minutes - coins refunded');
        await refreshCoins();
        return;
      }

      toast.success(`Purchased ${audioMinutes} audio + ${videoMinutes} video minutes for family!`);
      await refreshCoins();
      await fetchFamilyMinutes();
      setShowBuyMinutesModal(false);
    } catch (err) {
      console.error('Error purchasing family minutes:', err);
      toast.error('Failed to purchase minutes');
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!messageInput.trim() || !familyId || !user) return;

    try {
      const { error } = await supabase
        .from('family_chat_messages')
        .insert({
          family_id: familyId,
          user_id: user.id,
          message: messageInput.trim(),
          message_type: 'text'
        });

      if (error) throw error;
      setMessageInput('');
      inputRef.current?.focus();
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Start call
  const startCall = async (callType: 'voice' | 'video') => {
    if (!familyId || !user) return;

    try {
      const { data, error } = await supabase.rpc('start_family_call', {
        p_family_id: familyId,
        p_user_id: user.id,
        p_call_type: callType
      });

      if (error) throw error;

      if (data?.success) {
        setIsInCall(true);
        fetchActiveCall();
      } else {
        alert(data?.error || 'Failed to start call');
      }
    } catch (err) {
      console.error('Error starting call:', err);
      alert('Failed to start call');
    }
  };

  // Join call
  const joinCall = async () => {
    if (!activeCall || !user) return;

    try {
      const { data, error } = await supabase.rpc('join_family_call', {
        p_call_id: activeCall.id,
        p_user_id: user.id
      });

      if (error) throw error;

      if (data?.success) {
        setIsInCall(true);
        fetchCallMembers();
      } else {
        alert(data?.error || 'Failed to join call');
      }
    } catch (err) {
      console.error('Error joining call:', err);
      alert('Failed to join call');
    }
  };

  // Leave call
  const leaveCall = async () => {
    if (!activeCall || !user) return;

    try {
      const { data, error } = await supabase.rpc('leave_family_call', {
        p_call_id: activeCall.id,
        p_user_id: user.id
      });

      if (error) throw error;

      setIsInCall(false);
      fetchActiveCall();
    } catch (err) {
      console.error('Error leaving call:', err);
    }
  };

  // End call (for creator/leader)
  const endCall = async () => {
    if (!activeCall || !user) return;

    try {
      const { data, error } = await supabase.rpc('end_family_call', {
        p_call_id: activeCall.id,
        p_user_id: user.id
      });

      if (error) throw error;

      setIsInCall(false);
      setActiveCall(null);
      setCallMembers([]);
    } catch (err) {
      console.error('Error ending call:', err);
    }
  };

  // Update familyId when URL changes
  useEffect(() => {
    if (urlFamilyId && urlFamilyId !== familyId) {
      setFamilyId(urlFamilyId);
    }
  }, [urlFamilyId]);

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchFamilyData(),
        fetchMessages(),
        fetchActiveCall(),
        fetchOnlineMembers(),
        fetchFamilyMinutes()
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchFamilyData, fetchMessages, fetchActiveCall, fetchOnlineMembers, fetchFamilyMinutes]);

  // Fetch call members when active call changes
  useEffect(() => {
    if (activeCall) {
      fetchCallMembers();
    }
  }, [activeCall, fetchCallMembers]);

  // Auto-scroll to bottom when new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!familyId) return;

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel(`family-messages-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'family_chat_messages',
          filter: `family_id=eq.${familyId}`
        },
        async (payload) => {
          // Fetch the full message with user data
          const { data } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .eq('id', payload.new.user_id)
            .single();

          const newMessage = {
            ...payload.new,
            username: data?.username,
            display_name: data?.username,
            avatar_url: data?.avatar_url,
          };

          setMessages(prev => [...prev, newMessage]);
        }
      )
      .subscribe();

    // Subscribe to call changes
    const callsChannel = supabase
      .channel(`family-calls-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_calls',
          filter: `family_id=eq.${familyId}`
        },
        () => {
          fetchActiveCall();
          fetchOnlineMembers();
        }
      )
      .subscribe();

    // Subscribe to call member changes
    const callMembersChannel = supabase
      .channel(`family-call-members-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_call_members'
        },
        () => {
          fetchCallMembers();
          fetchOnlineMembers();
        }
      )
      .subscribe();

    channelsRef.current = [messagesChannel, callsChannel, callMembersChannel];

    return () => {
      channelsRef.current.forEach(channel => supabase.removeChannel(channel));
    };
  }, [familyId, fetchActiveCall, fetchCallMembers, fetchOnlineMembers]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading Family Hub...</p>
        </div>
      </div>
    );
  }

  const isLeader = currentUserRole === 'leader' || currentUserRole === 'co_leader';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      {/* Live Header */}
      <LiveHeader 
        family={family}
        onlineCount={onlineMembers.length}
        activeCall={activeCall}
        isInCall={isInCall}
        onJoinCall={joinCall}
        onLeaveCall={leaveCall}
        onEndCall={endCall}
        isLeader={isLeader}
        onBack={() => navigate('/family')}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <ChatArea 
            messages={messages}
            messagesEndRef={messagesEndRef}
          />

          {/* Input Bar */}
          <InputBar 
            value={messageInput}
            onChange={setMessageInput}
            onSend={sendMessage}
            onKeyPress={handleKeyPress}
            inputRef={inputRef}
            onGiftClick={() => setShowGiftModal(true)}
          />
        </div>

        {/* Right Sidebar */}
        <RightSidebar 
          onlineMembers={onlineMembers}
          activeCall={activeCall}
          callMembers={callMembers}
          isInCall={isInCall}
          onStartVoiceCall={() => startCall('voice')}
          onStartVideoCall={() => startCall('video')}
          onJoinCall={joinCall}
          onLeaveCall={leaveCall}
          onEndCall={endCall}
          isLeader={isLeader}
          familyMinutes={familyMinutes}
          showBuyMinutesModal={showBuyMinutesModal}
          setShowBuyMinutesModal={setShowBuyMinutesModal}
          purchaseFamilyMinutes={purchaseFamilyMinutes}
          troll_coins={troll_coins}
        />
      </div>

      {/* Call Overlay (when in call) */}
      {isInCall && activeCall && (
        <CallOverlay 
          call={activeCall}
          members={callMembers}
          isMuted={isMuted}
          isVideoOn={isVideoOn}
          onToggleMute={() => setIsMuted(!isMuted)}
          onToggleVideo={() => setIsVideoOn(!isVideoOn)}
          onLeaveCall={leaveCall}
        />
      )}

      {/* Buy Minutes Modal - Family Minutes Store */}
      {showBuyMinutesModal && (
        <FamilyMinutesStoreModal
          isOpen={showBuyMinutesModal}
          onClose={() => setShowBuyMinutesModal(false)}
          familyId={familyId || ''}
          familyName={family?.name || 'Family'}
          familyMinutes={familyMinutes}
          onPurchaseComplete={fetchFamilyMinutes}
        />
      )}

      {/* Gift Modal */}
      {showGiftModal && family && (
        <FamilyGiftModal
          isOpen={showGiftModal}
          onClose={() => setShowGiftModal(false)}
          familyId={family.id}
          familyName={family.name}
        />
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

// Live Header Component
function LiveHeader({ 
  family,
  onlineCount,
  activeCall,
  isInCall,
  onJoinCall,
  onLeaveCall,
  onEndCall,
  isLeader,
  onBack
}: {
  family: FamilyData | null;
  onlineCount: number;
  activeCall: FamilyCall | null;
  isInCall: boolean;
  onJoinCall: () => void;
  onLeaveCall: () => void;
  onEndCall: () => void;
  isLeader: boolean;
  onBack: () => void;
}) {
  const isLive = !!activeCall;

  return (
    <div className={`
      relative px-4 py-3 border-b backdrop-blur-sm transition-all duration-300
      ${isLive 
        ? 'bg-gradient-to-r from-red-900/80 via-pink-900/80 to-red-900/80 border-red-500/50' 
        : 'bg-slate-800/50 border-white/10'
      }
    `}>
      {/* Glow animation for live */}
      {isLive && (
        <div className="absolute inset-0 animate-pulse bg-red-500/10" />
      )}

      <div className="relative flex items-center justify-between max-w-7xl mx-auto">
        {/* Left: Back button and Family info */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          
          <div className="flex items-center gap-2">
            {family?.crest_url ? (
              <img src={family.crest_url} alt="" className="w-8 h-8 rounded-lg" />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Crown className="w-4 h-4 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-white font-bold">{family?.name || 'Family'}</h1>
              <p className="text-gray-400 text-xs">[{family?.tag}]</p>
            </div>
          </div>
        </div>

        {/* Center: Live indicator */}
        <div className="flex items-center gap-4">
          {isLive ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Circle className="w-3 h-3 fill-red-500 text-red-500 animate-pulse" />
                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
              </div>
              <span className="text-white font-semibold flex items-center gap-1">
                🔴 LIVE {activeCall?.type.toUpperCase()} CALL
              </span>
            </div>
          ) : null}
        </div>

        {/* Right: Call actions */}
        <div className="flex items-center gap-2">
          {isLive ? (
            <div className="flex items-center gap-2">
              {isInCall ? (
                <>
                  <button
                    onClick={onLeaveCall}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <PhoneOff className="w-4 h-4" />
                    Leave
                  </button>
                </>
              ) : (
                <button
                  onClick={onJoinCall}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors animate-pulse"
                >
                  <Phone className="w-4 h-4" />
                  Join Call
                </button>
              )}
              {isLeader && (
                <button
                  onClick={onEndCall}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  <PhoneOff className="w-4 h-4" />
                  End
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Circle className="w-3 h-3 fill-green-500 text-green-500" />
              <span className="text-green-400 font-medium">
                {onlineCount} {onlineCount === 1 ? 'member' : 'members'} online
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Chat Area Component
function ChatArea({ 
  messages, 
  messagesEndRef 
}: { 
  messages: ChatMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <MessageSquare className="w-16 h-16 text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Start the conversation 🚀</h3>
          <p className="text-gray-400">Be the first to say something!</p>
        </div>
      ) : (
        messages.map((message, index) => (
          <MessageItem 
            key={message.id} 
            message={message}
            isNew={index === messages.length - 1}
          />
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

// Message Item Component
function MessageItem({ message, isNew }: { message: ChatMessage; isNew: boolean }) {
  const isSystem = message.message_type === 'system' || message.message_type === 'call';
  const isCallEvent = message.message_type === 'call';

  // Check if message is from the same user as the previous one
  const showAvatar = true; // For simplicity, always show avatar

  if (isSystem) {
    return (
      <div className={`
        flex items-center justify-center py-2
        ${isNew ? 'animate-fade-in' : ''}
      `}>
        <div className="bg-slate-800/50 rounded-full px-4 py-2 border border-white/10">
          <p className="text-gray-400 text-sm">{message.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`
      flex items-start gap-3 group
      ${isNew ? 'animate-slide-in' : ''}
    `}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {message.avatar_url ? (
          <img src={message.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <Users className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-white">
            {message.display_name || message.username || 'Unknown'}
          </span>
          <span className="text-gray-500 text-xs">
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-gray-300 break-words">{message.message}</p>
      </div>
    </div>
  );
}

// Input Bar Component
function InputBar({ 
  value, 
  onChange, 
  onSend, 
  onKeyPress,
  inputRef,
  onGiftClick
}: { 
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onGiftClick?: () => void;
}) {
  return (
    <div className="p-4 border-t border-white/10 bg-slate-800/30">
      <div className="flex items-center gap-3 max-w-4xl mx-auto">
        {/* Text input */}
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={onKeyPress}
            placeholder="Type a message..."
            className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>

        {/* Gift button */}
        <button 
          onClick={onGiftClick}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Gift className="w-5 h-5 text-gray-400" />
        </button>

        {/* Send button */}
        <button
          onClick={onSend}
          disabled={!value.trim()}
          className={`
            p-3 rounded-xl transition-all
            ${value.trim() 
              ? 'bg-purple-600 hover:bg-purple-700 text-white' 
              : 'bg-slate-700 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// Right Sidebar Component
function RightSidebar({
  onlineMembers,
  activeCall,
  callMembers,
  isInCall,
  onStartVoiceCall,
  onStartVideoCall,
  onJoinCall,
  onLeaveCall,
  onEndCall,
  isLeader,
  familyMinutes,
  showBuyMinutesModal,
  setShowBuyMinutesModal,
  purchaseFamilyMinutes,
  troll_coins
}: {
  onlineMembers: OnlineMember[];
  activeCall: FamilyCall | null;
  callMembers: CallMember[];
  isInCall: boolean;
  onStartVoiceCall: () => void;
  onStartVideoCall: () => void;
  onJoinCall: () => void;
  onLeaveCall: () => void;
  onEndCall: () => void;
  isLeader: boolean;
  familyMinutes?: { audio_minutes: number; video_minutes: number };
  showBuyMinutesModal?: boolean;
  setShowBuyMinutesModal?: (show: boolean) => void;
  purchaseFamilyMinutes?: (audio: number, video: number, cost: number) => Promise<void>;
  troll_coins?: number;
}) {
  const onlineCount = onlineMembers.filter(m => !m.is_in_call).length;
  const inCallCount = callMembers.length;

  return (
    <div className="w-72 border-l border-white/10 bg-slate-900/50 flex flex-col overflow-hidden hidden lg:flex">
      {/* Active Call Section */}
      {activeCall && (
        <div className="p-4 border-b border-white/10">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-500 animate-pulse" />
            Current Call
          </h3>
          <div className="space-y-2">
            {callMembers.map(member => (
              <div 
                key={member.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-4 h-4 text-white" />
                    )}
                  </div>
                  {member.is_speaking && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">
                    {member.display_name || member.username || 'Unknown'}
                  </p>
                  {member.is_muted && (
                    <MicOff className="w-3 h-3 text-red-400" />
                  )}
                </div>
              </div>
            ))}
            
            {/* Call actions */}
            <div className="pt-2 space-y-2">
              {isInCall ? (
                <button
                  onClick={onLeaveCall}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <PhoneOff className="w-4 h-4" />
                  Leave Call
                </button>
              ) : (
                <button
                  onClick={onJoinCall}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  Join Call
                </button>
              )}
              {isLeader && (
                <button
                  onClick={onEndCall}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  End Call
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Online Members Section */}
      <div className="flex-1 p-4 overflow-y-auto">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Circle className="w-3 h-3 fill-green-500 text-green-500" />
          Active Members ({onlineMembers.length})
        </h3>
        
        <div className="space-y-2">
          {onlineMembers.map(member => (
            <div 
              key={member.user_id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate flex items-center gap-1">
                  {member.display_name || member.username || 'Unknown'}
                  {member.role === 'leader' && <Crown className="w-3 h-3 text-amber-400" />}
                </p>
                {member.is_in_call && (
                  <span className="text-xs text-purple-400 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> In call
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="p-4 border-t border-white/10">
        <h3 className="text-white font-semibold mb-3">Quick Actions</h3>
        
        {/* Family Minutes Display (for leaders) */}
        {isLeader && familyMinutes && (
          <div className="mb-3 p-3 bg-slate-800/50 rounded-lg border border-purple-500/30">
            <p className="text-gray-400 text-xs mb-1">Family Call Minutes</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Phone className="w-4 h-4 text-green-400" />
                <span className="text-white font-semibold">{familyMinutes.audio_minutes || 0}</span>
                <span className="text-gray-500 text-xs">audio</span>
              </div>
              <div className="flex items-center gap-1">
                <Video className="w-4 h-4 text-blue-400" />
                <span className="text-white font-semibold">{familyMinutes.video_minutes || 0}</span>
                <span className="text-gray-500 text-xs">video</span>
              </div>
            </div>
            {troll_coins !== undefined && (
              <p className="text-amber-400 text-xs mt-2">💰 Your Coins: {troll_coins.toLocaleString()}</p>
            )}
          </div>
        )}
        
        <div className="space-y-2">
          {isLeader && (
            <button
              onClick={() => setShowBuyMinutesModal?.(true)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              Buy Family Minutes
            </button>
          )}
          <button
            onClick={onStartVoiceCall}
            disabled={!!activeCall}
            className="w-full flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Phone className="w-4 h-4" />
            Start Voice Call
          </button>
          <button
            onClick={onStartVideoCall}
            disabled={!!activeCall}
            className="w-full flex items-center gap-2 px-3 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Video className="w-4 h-4" />
            Start Video Call
          </button>
        </div>
      </div>
    </div>
  );
}

// Call Overlay Component (for when user is in the call)
function CallOverlay({
  call,
  members,
  isMuted,
  isVideoOn,
  onToggleMute,
  onToggleVideo,
  onLeaveCall
}: {
  call: FamilyCall;
  members: CallMember[];
  isMuted: boolean;
  isVideoOn: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onLeaveCall: () => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-slate-900 border border-white/20 rounded-2xl p-4 shadow-2xl">
        {/* Call header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-white font-semibold">
            {call.type === 'voice' ? '🎙️' : '📹'} Family Call
          </span>
        </div>

        {/* Participants grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {members.map(member => (
            <div 
              key={member.id}
              className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-800"
            >
              {member.avatar_url ? (
                <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-gray-400" />
                </div>
              )}
              {member.is_speaking && (
                <div className="absolute inset-0 bg-green-500/30 border-2 border-green-500 rounded-xl" />
              )}
              <div className="absolute bottom-1 left-1 right-1">
                <p className="text-white text-xs truncate bg-black/50 px-1 rounded">
                  {member.display_name || member.username}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onToggleMute}
            className={`
              p-3 rounded-full transition-colors
              ${isMuted ? 'bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}
            `}
          >
            {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
          </button>
          
          {call.type === 'video' && (
            <button
              onClick={onToggleVideo}
              className={`
                p-3 rounded-full transition-colors
                ${!isVideoOn ? 'bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}
              `}
            >
              {isVideoOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
            </button>
          )}
          
          <button
            onClick={onLeaveCall}
            className="p-3 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
          >
            <PhoneOff className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Buy Minutes Modal Component
function BuyMinutesModal({
  familyMinutes,
  troll_coins,
  onPurchase,
  onClose
}: {
  familyMinutes: { audio_minutes: number; video_minutes: number };
  troll_coins: number;
  onPurchase: (audio: number, video: number, cost: number) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedPackage, setSelectedPackage] = useState<{ audio: number; video: number; cost: number; name: string } | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const packages = [
    { audio: 30, video: 15, cost: 100, name: 'Starter' },
    { audio: 60, video: 30, cost: 180, name: 'Standard' },
    { audio: 120, video: 60, cost: 320, name: 'Premium' },
  ];

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    setPurchasing(true);
    try {
      await onPurchase(selectedPackage.audio, selectedPackage.video, selectedPackage.cost);
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/20 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-amber-400" />
            Buy Family Call Minutes
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <span className="text-gray-400 text-2xl">&times;</span>
          </button>
        </div>

        {/* Current Balance */}
        <div className="mb-6 p-4 bg-slate-800/50 rounded-xl">
          <p className="text-gray-400 text-sm mb-1">Current Family Minutes</p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-green-400" />
              <span className="text-white font-bold text-lg">{familyMinutes.audio_minutes || 0}</span>
              <span className="text-gray-400">audio</span>
            </div>
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-400" />
              <span className="text-white font-bold text-lg">{familyMinutes.video_minutes || 0}</span>
              <span className="text-gray-400">video</span>
            </div>
          </div>
          <p className="text-amber-400 text-sm mt-3">💰 Your Coins: {troll_coins.toLocaleString()}</p>
        </div>

        {/* Package Options */}
        <div className="space-y-3 mb-6">
          <p className="text-gray-400 text-sm">Select a package:</p>
          {packages.map((pkg) => (
            <button
              key={pkg.name}
              onClick={() => setSelectedPackage(pkg)}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                selectedPackage?.name === pkg.name
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-white/10 hover:border-white/30 bg-slate-800/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">{pkg.name}</p>
                  <p className="text-gray-400 text-sm">
                    {pkg.audio} audio + {pkg.video} video minutes
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-amber-400 font-bold">{pkg.cost} coins</p>
                  {troll_coins < pkg.cost && (
                    <p className="text-red-400 text-xs">Not enough coins</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Purchase Button */}
        <button
          onClick={handlePurchase}
          disabled={!selectedPackage || purchasing || (troll_coins < (selectedPackage?.cost || 0))}
          className={`w-full py-3 rounded-xl font-semibold transition-all ${
            selectedPackage && troll_coins >= selectedPackage.cost && !purchasing
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-slate-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {purchasing ? 'Purchasing...' : selectedPackage ? `Purchase for ${selectedPackage.cost} Coins` : 'Select a Package'}
        </button>

        <p className="text-gray-500 text-xs text-center mt-4">
          Minutes expire after 30 days from purchase
        </p>
      </div>
    </div>
  );
}
