
import React, { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, Edit, Save, Camera, Coins, DollarSign, Radio, 
  Trophy, Crown, Users, Calendar, Settings, ChevronDown, ChevronUp,
  CreditCard, Check, Sparkles, X, Clock // Added Clock
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { safeFormatDate } from "@/lib/utils";
import TrollFamilyBadge from "../components/TrollFamilyBadge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { getCurrentUserProfile } from "@/api/supabaseHelpers";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const avatarInputRef = useRef(null);
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [lastUploadDebug, setLastUploadDebug] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("");
  
  // Accordion states
  const [openSections, setOpenSections] = useState({
    profile: true,
    stats: false,
    streams: false,
    effects: false,
    payment: false,
    settings: false
  });

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };



  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUserProfile,
  });

  useEffect(() => {
    if (!user) return;
    try {
      const cached = localStorage.getItem(`tc_avatar_${user.id}`);
      if (cached) {
        queryClient.setQueryData(['currentUser'], (prev) => prev ? { ...prev, avatar: cached } : prev);
      }
    } catch (_) {}
  }, [user, queryClient]);

  // Safe table access helpers (fallbacks for supabase entities)
  const tableMap = {
    Stream: "streams",
    UserEntranceEffect: "user_entrance_effects",
    EntranceEffect: "entrance_effects",
    PaymentVerification: "payment_verifications",
    User: "profiles",
  };

  const listTable = async (entityName, options = {}) => {
    const table = tableMap[entityName];
    if (!table) return [];
    let query = supabase.from(table).select("*");
    if (options.orderBy) {
      const ascending = options.orderDirection === "asc";
      query = query.order(options.orderBy, { ascending });
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    const { data, error } = await query;
    if (error) {
      console.warn(`Error listing ${table}:`, error.message);
      return [];
    }
    return data || [];
  };

  const filterTable = async (entityName, filters = {}, orderBy = null, limit = null) => {
    const table = tableMap[entityName];
    if (!table) return [];
    let query = supabase.from(table).select("*");
    Object.entries(filters || {}).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    if (orderBy) {
      const desc = orderBy.startsWith("-");
      const column = desc ? orderBy.slice(1) : orderBy;
      query = query.order(column, { ascending: !desc });
    }
    if (limit) {
      query = query.limit(limit);
    }
    const { data, error } = await query;
    if (error) {
      console.warn(`Error filtering ${table}:`, error.message);
      return [];
    }
    return data || [];
  };

  const { data: myStreams = [] } = useQuery({
    queryKey: ['myStreams', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await filterTable('Stream', { streamer_id: user.id }, "-created_date", 10);
    },
    enabled: !!user,
    initialData: [],
  });

  const { data: userEffects = [] } = useQuery({
    queryKey: ['userEffects', user?.id],
    queryFn: () => filterTable('UserEntranceEffect', { user_id: user.id }),
    initialData: [],
    enabled: !!user?.id,
  });

  const { data: paymentVerifications = [] } = useQuery({
    queryKey: ['paymentVerifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await filterTable('PaymentVerification', { user_id: user.id });
    },
    enabled: !!user,
    initialData: [],
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      const updates = { ...data };
      // Normalize/sanitize username if provided
      if (typeof updates.username === 'string') {
        const raw = updates.username;
        const sanitized = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (sanitized.length < 3) {
          throw new Error('Username must be at least 3 characters and use a-z, 0-9, _');
        }
        // Case-insensitive uniqueness check (exclude current user)
        const { data: taken } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', sanitized)
          .neq('id', user.id)
          .limit(1);
        if (Array.isArray(taken) && taken.length > 0) {
          throw new Error('Username is already taken. Please choose another.');
        }
        updates.username = sanitized;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (!error) return;

      // Per-field fallback: update keys individually to avoid schema mismatches
      const keys = Object.keys(updates);
      let anySuccess = false;
      let lastErr = error;
      for (const key of keys) {
        const single = { [key]: updates[key] };
        const { error: e } = await supabase
          .from('profiles')
          .update(single)
          .eq('id', user.id);
        if (!e) {
          anySuccess = true;
        } else {
          lastErr = e;
        }
      }
      if (!anySuccess && lastErr) throw lastErr;
    },
    onSuccess: async (_, variables) => {
      // Optimistically update the cached currentUser to reflect changes immediately
      const optimistic = { ...variables };
      if (typeof optimistic.username === 'string') {
        optimistic.username = optimistic.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      }
      queryClient.setQueryData(['currentUser'], (prev) => prev ? { ...prev, ...optimistic } : prev);

      // Fetch authoritative profile from server to prevent flicker/revert
      try {
        const { data: fresh } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (fresh) {
          queryClient.setQueryData(['currentUser'], (prev) => prev ? { ...prev, ...fresh } : prev);
        }
      } catch (_) {}

      queryClient.invalidateQueries(['currentUser']);
      setIsEditing(false);
      toast.success("Profile updated successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile");
    }
  });

  const activateEffectMutation = useMutation({
    mutationFn: async (effectId) => {
      // Deactivate all effects for user
      await supabase
        .from('user_entrance_effects')
        .update({ is_active: false })
        .eq('user_id', user.id);

      const targetEffect = userEffects.find(e => e.id === effectId);

      // Activate selected effect
      await supabase
        .from('user_entrance_effects')
        .update({ is_active: true })
        .eq('id', effectId);

      // Update profile with active effect metadata
      await supabase
        .from('profiles')
        .update({
          active_entrance_effect: targetEffect?.animation_type || null,
          active_entrance_effect_name: targetEffect?.effect_name || null,
        })
        .eq('id', user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['userEffects']);
      queryClient.invalidateQueries(['currentUser']);
      toast.success("Entrance effect activated!");
    }
  });

  const updatePaymentMethodMutation = useMutation({
    mutationFn: async ({ details }) => {
      // Temporarily lock payment method to CashApp
      const { error } = await supabase
        .from('profiles')
        .update({
          payment_method: 'cashapp',
          cashapp_handle: details,
        })
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      toast.success('Payment method updated to CashApp');
      setSelectedPaymentMethod('');
      setPaymentDetails('');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update payment method');
    }
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async ({ verificationId, code }) => {
      const verification = paymentVerifications.find(v => v.id === verificationId);
      if (verification?.verification_code !== code) {
        throw new Error("Invalid verification code");
      }
      const { error } = await supabase
        .from('payment_verifications')
        .update({
          verified_by_user: true,
          verification_date: new Date().toISOString(),
        })
        .eq('id', verificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['paymentVerifications']);
      toast.success("Payment method verified! Awaiting admin approval.");
      setVerificationCode("");
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_deleted: true,
          deleted_date: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (error) throw error;
      await supabase.auth.signOut();
      navigate('/Login');
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete account");
    }
  });

  // When a file is selected, store preview and file; upload will occur when user hits "Upload"
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    setSelectedAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  // Crop image to square center and resize to 512x512, return blob
  const cropImageToSquareBlob = (dataUrl, size = 512) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        // center-crop to square
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        try {
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob failed'));
          }, 'image/jpeg', 0.9);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (e) => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  };

  const performAvatarUpload = async () => {
    if (!selectedAvatarFile) return;
    try {
      setIsUploadingAvatar(true);
      // create data URL from file
      const reader = new FileReader();
      const dataUrl = await new Promise((res, rej) => {
        reader.onloadend = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(selectedAvatarFile);
      });

      const blob = await cropImageToSquareBlob(dataUrl, 512);
      const file = new File([blob], `avatar_${user.id}_${Date.now()}.jpg`, { type: 'image/jpeg' });

      // Upload file via local integration helper
  const uploadResult = await supabase.integrations.Core.UploadFile({ file, bucket: 'avatars' });
  console.info('Upload result', uploadResult);
  // store debug info for UI inspection when needed
  try { setLastUploadDebug(prev => ({ ...prev, uploadResult })); } catch {}

      // Support both { file_url } and { bucket, path } responses from integrations
      let file_url = uploadResult?.file_url;
      if (!file_url && uploadResult?.bucket && uploadResult?.path) {
        try {
          const { data: pub } = await supabase.storage.from(uploadResult.bucket).getPublicUrl(uploadResult.path);
          file_url = pub?.publicUrl || null;
        } catch (err) {
          console.warn('Failed to resolve public url from storage:', err?.message || err);
        }
      }

      if (!file_url) {
        // Provide actionable message when we couldn't obtain a public URL
        throw new Error('Upload succeeded but public URL could not be resolved. Check storage bucket visibility and CORS.');
      }

      let error = null;
      try {
        const r1 = await supabase.from('profiles').update({ avatar: file_url }).eq('id', user.id);
        error = r1.error || null;
        if (error) {
          const r2 = await supabase.from('profiles').update({ avatar_url: file_url }).eq('id', user.id);
          error = r2.error || null;
        }
      } catch (e) {
        error = e;
      }
      console.info('Profile update result for avatar', { avatar: file_url, error });
      try { setLastUploadDebug(prev => ({ ...prev, profileUpdate: { avatar: file_url, error } })); } catch {}
      if (error) {
        queryClient.setQueryData(['currentUser'], (prev) => prev ? { ...prev, avatar: file_url } : prev);
        try { localStorage.setItem(`tc_avatar_${user.id}`, file_url); } catch (_) {}
      }
      queryClient.invalidateQueries(['currentUser']);
      setSelectedAvatarFile(null);
      setAvatarPreview("");
      toast.success('Avatar updated!');
    } catch (error) {
      try {
        const reader2 = new FileReader();
        const dataUrl = await new Promise((res, rej) => {
          reader2.onloadend = () => res(reader2.result);
          reader2.onerror = rej;
          reader2.readAsDataURL(selectedAvatarFile);
        });
        queryClient.setQueryData(['currentUser'], (prev) => prev ? { ...prev, avatar: dataUrl } : prev);
        try { localStorage.setItem(`tc_avatar_${user.id}`, dataUrl); } catch (_) {}
        setSelectedAvatarFile(null);
        setAvatarPreview("");
        toast.success('Avatar updated!');
      } catch (e2) {
        console.error('Avatar upload failed', error);
        toast.error(error.message || 'Failed to upload avatar');
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const getTierInfo = (level) => {
    if (level >= 1 && level <= 9) return { tier: 1, color: "from-gray-500 to-slate-500", name: "Newbie" };
    if (level >= 10 && level <= 19) return { tier: 2, color: "from-blue-500 to-cyan-500", name: "Rising Star" };
    if (level >= 20 && level <= 29) return { tier: 3, color: "from-purple-500 to-pink-500", name: "Elite" };
    if (level >= 30) return { tier: 4, color: "from-yellow-500 to-orange-500", name: "Legend" };
    return { tier: 1, color: "from-gray-500 to-slate-500", name: "Newbie" };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-purple-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8 text-center max-w-md w-full">
          <h2 className="text-2xl font-bold text-white mb-4">Please login to view profile</h2>
          <Button onClick={() => navigate('/Login')}>Login</Button>
        </Card>
      </div>
    );
  }

  const tierInfo = getTierInfo(user.level || 1);

  // Fix: robust streaming hours across created_date/updated_date or created_at/updated_at
  const totalStreamingHours = useMemo(() => {
    if (!myStreams.length) return 0;
    let totalMinutes = 0;
    myStreams.forEach(stream => {
      const start = stream.created_date || stream.created_at;
      const end = stream.updated_date || stream.updated_at || new Date().toISOString();
      if (start) {
        const startTime = new Date(start);
        const endTime = new Date(end);
        const durationMs = endTime - startTime;
        totalMinutes += Math.floor(durationMs / 1000 / 60);
      }
    });
    return (totalMinutes / 60).toFixed(1);
  }, [myStreams]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Profile Header - Always Visible */}
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar preview" className="w-24 h-24 rounded-full object-cover" />
              ) : user.avatar ? (
                <img src={user.avatar} alt={user.username} className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-3xl font-bold">{user.username?.[0]?.toUpperCase()}</span>
                </div>
              )}
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              <div className="absolute bottom-0 right-0 flex gap-2">
                <Button size="icon" onClick={() => avatarInputRef.current?.click()} disabled={isUploadingAvatar} className="rounded-full bg-purple-600 hover:bg-purple-700">
                  <Camera className="w-4 h-4" />
                </Button>
                {selectedAvatarFile && (
                  <>
                    <Button size="icon" onClick={performAvatarUpload} disabled={isUploadingAvatar} className="rounded-full bg-green-600 hover:bg-green-700">
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button size="icon" onClick={() => { setSelectedAvatarFile(null); setAvatarPreview(""); }} disabled={isUploadingAvatar} className="rounded-full bg-red-600 hover:bg-red-700">
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">@{user.username || user.full_name}</h1>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge className={`bg-gradient-to-r ${tierInfo.color} text-white`}>
                  Level {user.level || 1} • {tierInfo.name}
                </Badge>
                <TrollFamilyBadge user={user} />
              </div>
            </div>
          </div>
        </Card>

        {/* Debug panel - visible when ?debug=1 is in the URL */}
        {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1' && (
          <Card className="bg-[#121218] border-[#2a2a3a] p-4">
            <h3 className="text-white font-semibold mb-2">Upload Debug</h3>
            <pre className="text-xs text-gray-200 overflow-auto max-h-48 p-2 bg-black/40 rounded">{JSON.stringify(lastUploadDebug, null, 2)}</pre>
            <p className="text-gray-400 text-sm mt-2">If empty, perform an upload and press Save to populate this panel. Copy the JSON and paste it here for help diagnosing.</p>
          </Card>
        )}

        {/* Profile Info - Collapsible */}
        <Collapsible open={openSections.profile} onOpenChange={() => toggleSection('profile')}>
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-white/5">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-purple-400" />
                <span className="text-white font-semibold">Profile Info</span>
              </div>
              {openSections.profile ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-4">
                {!isEditing ? (
                  <>
                    {user.bio && <p className="text-gray-300 text-sm">{user.bio}</p>}
                    <Button type="button" onClick={() => { setIsEditing(true); setEditData({ bio: user.bio || '', username: user.username || '' }); }} className="w-full bg-purple-600 hover:bg-purple-700">
                      <Edit className="w-4 h-4 mr-2" />Edit Profile
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-400 text-sm mb-1 block">Username</label>
                      <Input value={editData.username}
                        onChange={(e) => setEditData({
                          ...editData,
                          username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                        })}
                        className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm mb-1 block">Bio</label>
                      <Textarea value={editData.bio} onChange={(e) => setEditData({...editData, bio: e.target.value})} className="bg-[#0a0a0f] border-[#2a2a3a] text-white h-20" maxLength={200} />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => updateProfileMutation.mutate(editData)} disabled={updateProfileMutation.isPending} className="flex-1 bg-green-600 hover:bg-green-700">
                        <Save className="w-4 h-4 mr-2" />Save
                      </Button>
                      <Button onClick={() => setIsEditing(false)} variant="outline" className="flex-1 border-[#2a2a3a]">Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Stats - Collapsible */}
        <Collapsible open={openSections.stats} onOpenChange={() => toggleSection('stats')}>
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-white/5">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-white font-semibold">Stats</span>
              </div>
              {openSections.stats ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 grid grid-cols-2 gap-3">
                <div className="bg-[#0a0a0f] rounded-lg p-3 text-center">
                  <Coins className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                  <p className="text-gray-400 text-xs">Coins</p>
                  <p className="text-white font-bold">{(user.coins || 0).toLocaleString()}</p>
                </div>
                <div className="bg-[#0a0a0f] rounded-lg p-3 text-center">
                  <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-1" />
                  <p className="text-gray-400 text-xs">Earned</p>
                  <p className="text-white font-bold">{(user.earned_coins || 0).toLocaleString()}</p>
                </div>
                <div className="bg-[#0a0a0f] rounded-lg p-3 text-center">
                  <Users className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                  <p className="text-gray-400 text-xs">Followers</p>
                  <p className="text-white font-bold">{user.follower_count || 0}</p>
                </div>
                <div className="bg-[#0a0a0f] rounded-lg p-3 text-center">
                  <Radio className="w-6 h-6 text-red-400 mx-auto mb-1" />
                  <p className="text-gray-400 text-xs">Streams</p>
                  <p className="text-white font-bold">{myStreams.length}</p>
                </div>
                <div className="bg-[#0a0a0f] rounded-lg p-3 text-center col-span-2">
                  <Clock className="w-6 h-6 text-purple-400 mx-auto mb-1" />
                  <p className="text-gray-400 text-xs">Hours Streamed</p>
                  <p className="text-white font-bold">{totalStreamingHours}h</p>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Recent Streams - Collapsible */}
        <Collapsible open={openSections.streams} onOpenChange={() => toggleSection('streams')}>
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-white/5">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-400" />
                <span className="text-white font-semibold">Recent Streams</span>
                <Badge className="bg-red-500">{myStreams.length}</Badge>
              </div>
              {openSections.streams ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-2">
                {myStreams.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No streams yet</p>
                ) : (
                  myStreams.map(stream => (
                    <div key={stream.id} className="bg-[#0a0a0f] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-white font-semibold text-sm">{stream.title}</h3>
                        {stream.is_live && <Badge className="bg-red-500 text-xs">LIVE</Badge>}
                      </div>
                      <p className="text-gray-400 text-xs">{safeFormatDate(stream.created_date || stream.created_at, 'MMM d, yyyy')}</p>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Entrance Effects - Collapsible */}
        <Collapsible open={openSections.effects} onOpenChange={() => toggleSection('effects')}>
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-white/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span className="text-white font-semibold">Entrance Effects</span>
                <Badge className="bg-purple-500">{userEffects.length}</Badge>
              </div>
              {openSections.effects ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-2">
                {userEffects.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No effects owned</p>
                ) : (
                  userEffects.map(effect => (
                    <div key={effect.id} className="bg-[#0a0a0f] rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-white font-semibold text-sm">{effect.effect_name}</h3>
                        <p className="text-gray-400 text-xs">{effect.animation_type}</p>
                      </div>
                      <Button size="sm" onClick={() => activateEffectMutation.mutate(effect.id)} disabled={effect.is_active} className={effect.is_active ? "bg-green-600" : "bg-purple-600 hover:bg-purple-700"}>
                        {effect.is_active ? <><Check className="w-3 h-3 mr-1" />Active</> : "Activate"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Payment Methods - Collapsible */}
        <Collapsible open={openSections.payment} onOpenChange={() => toggleSection('payment')}>
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-white/5">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-green-400" />
                <span className="text-white font-semibold">Payment Methods</span>
              </div>
              {openSections.payment ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-3">
                {/* FIXED: Android-friendly payment method selector */}
                <div className="bg-[#0a0a0f] rounded-lg p-4">
                  <label className="text-white font-medium mb-3 block text-sm">Add Payment Method</label>
                  
                  <div className="space-y-2 mb-3">
                    {['stripe'].map(method => (
                      <button
                        key={method}
                        onClick={() => setSelectedPaymentMethod(method)}
                        className={`w-full p-3 rounded-lg text-left transition-all ${
                          selectedPaymentMethod === method 
                            ? 'bg-purple-600 text-white border-2 border-purple-400' 
                            : 'bg-[#1a1a24] text-gray-300 border-2 border-[#2a2a3a] hover:border-purple-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">Stripe</span>
                          {selectedPaymentMethod === method && (
                            <Check className="w-5 h-5 text-white" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedPaymentMethod && (
                    <div className="space-y-2">
                      <Input 
                        value={paymentDetails} 
                        onChange={(e) => setPaymentDetails(e.target.value)}
                        placeholder={`Enter your ${selectedPaymentMethod.replace('_', ' ')} details`}
                        className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                      />
                      <Button 
                        onClick={() => updatePaymentMethodMutation.mutate({ 
                          details: paymentDetails 
                        })}
                        disabled={!paymentDetails || updatePaymentMethodMutation.isPending}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        Update payment in my profile
                      </Button>
                    </div>
                  )}
                </div>

                {paymentVerifications.map(v => (
                  <div key={v.id} className="bg-[#0a0a0f] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-white font-semibold text-sm capitalize">{v.payment_method.replace('_', ' ')}</p>
                      <Badge className={v.verified_by_admin ? "bg-green-500" : v.verified_by_user ? "bg-yellow-500" : "bg-gray-500"}>
                        {v.verified_by_admin ? "Verified" : v.verified_by_user ? "Pending" : "Unverified"}
                      </Badge>
                    </div>
                    {!v.verified_by_user && (
                      <div className="flex gap-2 mt-2">
                        <Input 
                          value={verificationCode} 
                          onChange={(e) => setVerificationCode(e.target.value)} 
                          placeholder="Enter code" 
                          className="bg-[#1a1a24] border-[#2a2a3a] text-white text-sm" 
                        />
                        <Button 
                          size="sm" 
                          onClick={() => verifyCodeMutation.mutate({ verificationId: v.id, code: verificationCode })}
                        >
                          Verify
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Settings - Collapsible */}
        <Collapsible open={openSections.settings} onOpenChange={() => toggleSection('settings')}>
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-white/5">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-400" />
                <span className="text-white font-semibold">Account Settings</span>
              </div>
              {openSections.settings ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-3">
                <div className="bg-[#0a0a0f] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Member Since</p>
                  <p className="text-white text-sm">{safeFormatDate(user.created_date || user.created_at, 'MMMM d, yyyy')}</p>
                </div>
                <Button onClick={() => { if(confirm('Delete account? This cannot be undone!')) deleteAccountMutation.mutate(); }} variant="destructive" className="w-full">
                  <X className="w-4 h-4 mr-2" />Delete Account
                </Button>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
}
