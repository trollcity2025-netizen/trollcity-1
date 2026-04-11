import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Gift, Shield, Gavel, Ban, Eye, Clock, UserCheck, 
  AlertTriangle, Building2, Wallet, FileText, Users,
  Mic, MicOff, AlertCircle, MessageSquareOff, LogOut, Power
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import GiftBoxModal from './GiftBoxModal';
import { getActiveInsurance, hasProtection, ProtectionType } from '../../lib/insuranceSystem';
import { useNavigate } from 'react-router-dom';

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string;
  role?: string;
  troll_role?: string;
  is_troll_officer?: boolean;
  is_lead_officer?: boolean;
  is_admin?: boolean;
  is_prosecutor?: boolean;
  is_attorney?: boolean;
}

interface ModActionsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserProfile | null;
  targetUsername: string;
  targetUserId: string;
  streamId: string;
  hostId: string;
  currentUserId?: string;
  onMuteUser?: (userId: string, duration: number) => void;
  onUnmuteUser?: (userId: string) => void;
  onArrestUser?: (userId: string, reason: string, severity: string, bailAmount: number) => void;
  onDisableChat?: (userId: string, duration: number) => void;
  onKickUser?: (userId: string) => void;
  onViewBackgroundCheck?: (userId: string) => void;
}

type TabType = 'gift' | 'mod';

const MOD_ACTIONS = [
  { id: 'mute', label: 'Mute', icon: Mic, color: 'text-red-400', description: 'Mute user\'s microphone' },
  { id: 'unmute', label: 'Unmute', icon: MicOff, color: 'text-green-400', description: 'Unmute user\'s microphone' },
  { id: 'arrest', label: 'Arrest', icon: AlertCircle, color: 'text-orange-400', description: 'Send to Troll Jail' },
  { id: 'disable_chat', label: 'Disable Chat', icon: MessageSquareOff, color: 'text-yellow-400', description: 'Disable chat temporarily' },
  { id: 'kick', label: 'Kick', icon: LogOut, color: 'text-purple-400', description: 'Remove from broadcast' },
  { id: 'remove_officer', label: 'Remove Officer', icon: Shield, color: 'text-red-500', description: 'Remove broadofficer status' },
  { id: 'end_stream', label: 'End Stream', icon: Power, color: 'text-red-500', description: 'End broadcast and restrict' },
  { id: 'background_check', label: 'Background', icon: FileText, color: 'text-blue-400', description: 'View user background' },
];

const SEVERITY_LEVELS = [
  { id: 'minor', label: 'Minor', description: 'Minor offense', bailMultiplier: 1 },
  { id: 'moderate', label: 'Moderate', description: 'Moderate offense', bailMultiplier: 2 },
  { id: 'serious', label: 'Serious', description: 'Serious offense', bailMultiplier: 5 },
  { id: 'severe', label: 'Severe', description: 'Severe offense', bailMultiplier: 10 },
];

export default function ModActionsPopup({
  isOpen,
  onClose,
  targetUser,
  targetUsername,
  targetUserId,
  streamId,
  hostId,
  currentUserId,
  onMuteUser,
  onUnmuteUser,
  onArrestUser,
  onDisableChat,
  onKickUser,
  onViewBackgroundCheck,
}: ModActionsPopupProps) {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('gift');
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  
  // Arrest modal state
  const [showArrestModal, setShowArrestModal] = useState(false);
  const [arrestReason, setArrestReason] = useState('');
  const [arrestSeverity, setArrestSeverity] = useState('moderate');
  const [arrestBailAmount, setArrestBailAmount] = useState(100);
  const [isArresting, setIsArresting] = useState(false);
  
  // Mute modal state
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [muteDuration, setMuteDuration] = useState(5); // minutes
  const [isMuting, setIsMuting] = useState(false);
  
  // Disable chat modal state
  const [showDisableChatModal, setShowDisableChatModal] = useState(false);
  const [chatDisableDuration, setChatDisableDuration] = useState(5); // minutes
  const [isDisablingChat, setIsDisablingChat] = useState(false);
  
  // Kick state
  const [isKicking, setIsKicking] = useState(false);
  const [hasInsuranceProtection, setHasInsuranceProtection] = useState(false);
  
  // End stream state
  const [showEndStreamModal, setShowEndStreamModal] = useState(false);
  const [restrictDuration, setRestrictDuration] = useState(60); // minutes
  const [isEndingStream, setIsEndingStream] = useState(false);
  const [endStreamReason, setEndStreamReason] = useState('');
  
  // Check if current user is an officer role
  const isOfficer = profile?.role === 'admin' || 
                   profile?.role === 'lead_troll_officer' || 
                   profile?.role === 'troll_officer' ||
                   profile?.role === 'secretary' ||
                   profile?.role === 'prosecutor' ||
                   profile?.role === 'attorney' ||
                   profile?.is_admin ||
                   profile?.is_troll_officer ||
                   profile?.is_lead_officer;

  // Check if target is host
  const isTargetHost = targetUserId === hostId;

  // Check insurance status for kick
  useEffect(() => {
    if (targetUserId) {
      checkInsuranceStatus();
    }
  }, [targetUserId]);

  const checkInsuranceStatus = async () => {
    try {
      const hasKickProtection = await hasProtection(targetUserId, 'kick');
      setHasInsuranceProtection(hasKickProtection);
    } catch (error) {
      console.error('Error checking insurance:', error);
    }
  };

  const handleMute = async () => {
    if (!targetUserId || !currentUserId) return;
    setIsMuting(true);
    try {
      // Insert mute record
      const expiresAt = new Date(Date.now() + muteDuration * 60 * 1000).toISOString();
      
      const { data, error } = await supabase.from('stream_mutes').insert({
        stream_id: streamId,
        user_id: targetUserId,
        muted_by: currentUserId,
        expires_at: expiresAt,
        reason: `Muted for ${muteDuration} minutes`,
      }).select();
      
      if (error) {
        console.error('[ModActions] Mute insert error:', error);
        toast.error('Failed to mute: ' + error.message);
        setIsMuting(false);
        return;
      }
      
      console.log('[ModActions] Mute created:', data);
      toast.success(`${targetUsername} has been muted for ${muteDuration} minutes`);
      setShowMuteModal(false);
      onMuteUser?.(targetUserId, muteDuration);
    } catch (error) {
      console.error('[ModActions] Error muting user:', error);
      toast.error('Failed to mute user');
    } finally {
      setIsMuting(false);
    }
  };

  const handleUnmute = async () => {
    if (!targetUserId) return;
    try {
      await supabase
        .from('stream_mutes')
        .delete()
        .eq('stream_id', streamId)
        .eq('user_id', targetUserId);
      
      toast.success(`${targetUsername} has been unmuted`);
      onUnmuteUser?.(targetUserId);
    } catch (error) {
      console.error('Error unmuting user:', error);
      toast.error('Failed to unmute user');
    }
  };

  const handleArrest = async () => {
    if (!targetUserId || !arrestReason) return;
    setIsArresting(true);
    
    try {
      // Calculate bail amount based on severity
      const severity = SEVERITY_LEVELS.find(s => s.id === arrestSeverity);
      const bail = severity ? severity.bailMultiplier * 100 : 100;
      setArrestBailAmount(bail);
      
      // 1. Create jail record
      const arrestDate = new Date().toISOString();
      await supabase.from('jail').insert({
        user_id: targetUserId,
        arrest_date: arrestDate,
        reason: arrestReason,
        severity: arrestSeverity,
        bail_amount: bail,
        arrested_by: currentUserId,
        court_date: null, // Will be set when case is added to docket
        status: 'jailed',
      });
      
      // 2. Create case in court docket
      // Find or create today's court session
      const today = new Date().toISOString().split('T')[0];
      
      // Get existing docket for today
      const { data: existingDocket } = await supabase
        .from('court_dockets')
        .select('id, cases_count')
        .eq('court_date', today)
        .maybeSingle();
      
      let docketId: string;
      let newCasesCount = 1;
      
      if (existingDocket && existingDocket.cases_count < 20) {
        // Add to existing docket
        docketId = existingDocket.id;
        await supabase
          .from('court_dockets')
          .update({ cases_count: existingDocket.cases_count + 1 })
          .eq('id', docketId);
        newCasesCount = existingDocket.cases_count + 1;
      } else {
        // Create new docket
        const { data: newDocket } = await supabase
          .from('court_dockets')
          .insert({
            court_date: today,
            max_cases: 20,
            cases_count: 1,
            status: 'scheduled',
          })
          .select()
          .single();
        docketId = newDocket?.id;
      }
      
      // 3. Create court case
      const courtDate = new Date();
      courtDate.setDate(courtDate.getDate() + 3); // 3 days from now
      
      await supabase.from('court_cases').insert({
        docket_id: docketId,
        defendant_id: targetUserId,
        plaintiff_id: currentUserId,
        case_type: 'criminal',
        charges: arrestReason,
        severity: arrestSeverity,
        bail_amount: bail,
        status: 'pending',
        court_date: courtDate.toISOString(),
        created_at: new Date().toISOString(),
      });
      
      toast.success(`${targetUsername} has been arrested and added to court docket`);
      setShowArrestModal(false);
      setArrestReason('');
      setArrestSeverity('moderate');
      onArrestUser?.(targetUserId, arrestSeverity, arrestSeverity, bail);
    } catch (error) {
      console.error('Error arresting user:', error);
      toast.error('Failed to arrest user');
    } finally {
      setIsArresting(false);
    }
  };

  const handleDisableChat = async () => {
    if (!targetUserId) return;
    setIsDisablingChat(true);
    try {
      const expiresAt = new Date(Date.now() + chatDisableDuration * 60 * 1000).toISOString();
      await supabase.from('chat_blocks').insert({
        stream_id: streamId,
        user_id: targetUserId,
        blocked_by: currentUserId,
        expires_at: expiresAt,
        reason: `Chat disabled for ${chatDisableDuration} minutes`,
      });
      
      toast.success(`${targetUsername}'s chat disabled for ${chatDisableDuration} minutes`);
      setShowDisableChatModal(false);
      onDisableChat?.(targetUserId, chatDisableDuration);
    } catch (error) {
      console.error('Error disabling chat:', error);
      toast.error('Failed to disable chat');
    } finally {
      setIsDisablingChat(false);
    }
  };

  const handleKick = async () => {
    if (!targetUserId) return;
    
    // Check if user has insurance and current user is not admin/lead
    const isAdminOrLead = profile?.role === 'admin' || 
                         profile?.role === 'lead_troll_officer' || 
                         profile?.is_admin ||
                         profile?.is_lead_officer;
    
    if (hasInsuranceProtection && !isAdminOrLead) {
      toast.error('Cannot kick user with active insurance protection');
      return;
    }
    
    setIsKicking(true);
    try {
      await supabase.from('stream_kicks').insert({
        stream_id: streamId,
        user_id: targetUserId,
        kicked_by: currentUserId,
        reason: 'Kicked by moderator',
      });
      
      toast.success(`${targetUsername} has been kicked from the broadcast`);
      onKickUser?.(targetUserId);
      onClose();
    } catch (error) {
      console.error('Error kicking user:', error);
      toast.error('Failed to kick user');
    } finally {
      setIsKicking(false);
    }
  };

  const handleBackgroundCheck = async () => {
    console.log('[ModActions] handleBackgroundCheck called for userId:', targetUserId);
    
    if (!targetUserId) {
      toast.error('No user selected');
      return;
    }
    
    // Need to get username from user ID first
    const { data: profileData, error } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('id', targetUserId)
      .maybeSingle();
    
    console.log('[ModActions] Profile lookup result:', { profileData, error });
    
    if (error) {
      console.error('[ModActions] Profile fetch error:', error);
      toast.error('Failed to load profile');
      return;
    }
    
    if (profileData?.username) {
      console.log('[ModActions] Navigating to:', `/profile/${profileData.username}?tab=background`);
      navigate(`/profile/${profileData.username}?tab=background`);
    } else {
      console.log('[ModActions] No profile found for userId:', targetUserId);
      toast.error('User profile not found');
    }
    onClose();
  };

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case 'mute':
        setShowMuteModal(true);
        break;
      case 'unmute':
        handleUnmute();
        break;
      case 'arrest':
        setShowArrestModal(true);
        break;
      case 'disable_chat':
        setShowDisableChatModal(true);
        break;
      case 'kick':
        handleKick();
        break;
      case 'remove_officer':
        handleRemoveOfficer();
        break;
      case 'end_stream':
        setShowEndStreamModal(true);
        break;
      case 'background_check':
        handleBackgroundCheck();
        break;
    }
  };

  const handleRemoveOfficer = async () => {
    if (!targetUserId || !currentUserId) return;
    
    // Check if user is actually an officer
    const { data: targetProfile } = await supabase
      .from('user_profiles')
      .select('is_troll_officer, is_lead_officer')
      .eq('id', targetUserId)
      .maybeSingle();
    
    if (!targetProfile?.is_troll_officer && !targetProfile?.is_lead_officer) {
      toast.error('User is not a broadofficer');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_troll_officer: false,
          is_lead_officer: false,
          troll_role: 'user'
        })
        .eq('id', targetUserId);
      
      if (error) throw error;
      
      toast.success(`${targetUsername} has been removed as broadofficer`);
      onClose();
    } catch (error) {
      console.error('[ModActions] Error removing officer:', error);
      toast.error('Failed to remove officer status');
    }
  };

  const handleEndStream = async () => {
    if (!streamId || !currentUserId) return;
    setIsEndingStream(true);
    try {
      // Update stream status to ended
      const { error } = await supabase
        .from('streams')
        .update({ 
          status: 'ended',
          is_live: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', streamId);
      
      if (error) throw error;
      
      // Add broadcast restriction for the broadcaster
      const { data: streamData } = await supabase
        .from('streams')
        .select('user_id')
        .eq('id', streamId)
        .single();
      
      if (streamData?.user_id) {
        const restrictUntil = new Date(Date.now() + restrictDuration * 60 * 1000).toISOString();
        await supabase.from('broadcast_restrictions').insert({
          user_id: streamData.user_id,
          restricted_by: currentUserId,
          reason: endStreamReason || 'Ended by officer',
          duration_minutes: restrictDuration,
          expires_at: restrictUntil
        });
      }
      
      toast.success('Stream ended and broadcaster restricted');
      setShowEndStreamModal(false);
      onClose();
    } catch (error) {
      console.error('[ModActions] Error ending stream:', error);
      toast.error('Failed to end stream');
    } finally {
      setIsEndingStream(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-h-[80vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden z-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              {targetUser?.avatar_url ? (
                <img src={targetUser.avatar_url} alt={targetUsername} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-white font-bold">{targetUsername?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h3 className="text-white font-semibold">{targetUsername}</h3>
              {targetUser?.role && (
                <span className="text-xs text-slate-400 capitalize">{targetUser.role.replace('_', ' ')}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('gift')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'gift' 
                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gift className="w-4 h-4 inline mr-2" />
            Gift
          </button>
          <button
            onClick={() => setActiveTab('mod')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'mod' 
                ? 'text-red-400 border-b-2 border-red-400 bg-red-500/10' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-2" />
            Mod Actions
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[400px]">
          {activeTab === 'gift' ? (
            <div className="text-center py-8">
              <p className="text-slate-400 mb-4">Send a gift to {targetUsername}</p>
              <button
                onClick={() => setIsGiftModalOpen(true)}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-500 hover:to-pink-500 transition-all"
              >
                <Gift className="w-5 h-5 inline mr-2" />
                Open Gift Box
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {MOD_ACTIONS.map((action) => {
                const Icon = action.icon;
                const isKickAction = action.id === 'kick';
                const isDisabled = isKickAction && hasInsuranceProtection && 
                                  !(profile?.role === 'admin' || profile?.is_admin || profile?.is_lead_officer || profile?.role === 'lead_troll_officer');
                
                return (
                  <button
                    key={action.id}
                    onClick={() => handleAction(action.id)}
                    disabled={isDisabled}
                    className={`p-3 rounded-xl border transition-all text-left ${
                      isDisabled
                        ? 'border-slate-700 bg-slate-800/50 opacity-50 cursor-not-allowed'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-700/50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${action.color}`} />
                    <div className="text-sm font-medium text-white">{action.label}</div>
                    <div className="text-xs text-slate-400">{action.description}</div>
                    {isKickAction && hasInsuranceProtection && (
                      <div className="text-xs text-orange-400 mt-1">Has Insurance</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Arrest Modal */}
        <AnimatePresence>
          {showArrestModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/95 flex items-center justify-center p-4"
            >
              <div className="bg-slate-800 border border-orange-500/30 rounded-xl p-4 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                  <h3 className="text-white font-semibold">Arrest {targetUsername}</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Reason for Arrest</label>
                    <input
                      type="text"
                      value={arrestReason}
                      onChange={(e) => setArrestReason(e.target.value)}
                      placeholder="e.g., Harassment, Violation of terms..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Severity</label>
                    <div className="grid grid-cols-4 gap-2">
                      {SEVERITY_LEVELS.map((sev) => (
                        <button
                          key={sev.id}
                          onClick={() => setArrestSeverity(sev.id)}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                            arrestSeverity === sev.id
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                              : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {sev.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                    <span className="text-slate-400 text-sm">Bail Amount</span>
                    <span className="text-white font-bold">{arrestBailAmount} coins</span>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowArrestModal(false)}
                      className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleArrest}
                      disabled={!arrestReason || isArresting}
                      className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-500 disabled:opacity-50"
                    >
                      {isArresting ? 'Arresting...' : 'Submit Arrest'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mute Modal */}
        <AnimatePresence>
          {showMuteModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/95 flex items-center justify-center p-4"
            >
              <div className="bg-slate-800 border border-red-500/30 rounded-xl p-4 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Mic className="w-5 h-5 text-red-400" />
                  <h3 className="text-white font-semibold">Mute {targetUsername}</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Mute Duration (minutes)</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 5, 10, 15, 30].map((dur) => (
                        <button
                          key={dur}
                          onClick={() => setMuteDuration(dur)}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                            muteDuration === dur
                              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                              : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {dur}m
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowMuteModal(false)}
                      className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleMute}
                      disabled={isMuting}
                      className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-500 disabled:opacity-50"
                    >
                      {isMuting ? 'Muting...' : 'Mute User'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Disable Chat Modal */}
        <AnimatePresence>
          {showDisableChatModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/95 flex items-center justify-center p-4"
            >
              <div className="bg-slate-800 border border-yellow-500/30 rounded-xl p-4 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquareOff className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-white font-semibold">Disable Chat for {targetUsername}</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Disable Duration (minutes)</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 5, 10, 15, 30].map((dur) => (
                        <button
                          key={dur}
                          onClick={() => setChatDisableDuration(dur)}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                            chatDisableDuration === dur
                              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                              : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {dur}m
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowDisableChatModal(false)}
                      className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDisableChat}
                      disabled={isDisablingChat}
                      className="flex-1 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-500 disabled:opacity-50"
                    >
                      {isDisablingChat ? 'Disabling...' : 'Disable Chat'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* End Stream Modal */}
        <AnimatePresence>
          {showEndStreamModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/95 flex items-center justify-center p-4"
            >
              <div className="bg-slate-800 border border-red-500/30 rounded-xl p-4 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Power className="w-5 h-5 text-red-400" />
                  <h3 className="text-white font-semibold">End Stream & Restrict</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Reason (optional)</label>
                    <input
                      type="text"
                      value={endStreamReason}
                      onChange={(e) => setEndStreamReason(e.target.value)}
                      placeholder="e.g., Violation of terms..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Restriction Duration</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[15, 30, 60, 120, 240].map((dur) => (
                        <button
                          key={dur}
                          onClick={() => setRestrictDuration(dur)}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                            restrictDuration === dur
                              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                              : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {dur < 60 ? `${dur}m` : `${dur/60}h`}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowEndStreamModal(false)}
                      className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEndStream}
                      disabled={isEndingStream}
                      className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-500 disabled:opacity-50"
                    >
                      {isEndingStream ? 'Ending...' : 'End Stream'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Gift Modal */}
      <GiftBoxModal
        isOpen={isGiftModalOpen}
        onClose={() => setIsGiftModalOpen(false)}
        recipientId={targetUserId}
        streamId={streamId}
        broadcasterId={hostId}
      />
    </>
  );
}