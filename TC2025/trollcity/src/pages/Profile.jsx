
import React, { useState, useRef, useMemo, useEffect } from "react"; // Added useEffect for BlockedUsersManagement
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
  CreditCard, Check, Sparkles, X, Clock, Square, Smartphone, Wallet, Building, MessageSquare // Added payment icons
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import TrollFamilyBadge from "../components/TrollFamilyBadge";
import UserBadges from "@/components/UserBadges";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const avatarInputRef = useRef(null);
  
  // Safely format dates to avoid runtime crashes on invalid/undefined values
  const formatDateOrUnknown = (value, pattern = 'MMMM d, yyyy') => {
    try {
      if (!value) return 'Unknown';
      const date = new Date(value);
      if (isNaN(date.getTime())) return 'Unknown';
      return format(date, pattern);
    } catch {
      return 'Unknown';
    }
  };
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [applePayDetails, setApplePayDetails] = useState("");
  const [googleWalletDetails, setGoogleWalletDetails] = useState("");
  const [chimeDetails, setChimeDetails] = useState("");
  const [cashappDetails, setCashappDetails] = useState("");
  const [messageChargeAmount, setMessageChargeAmount] = useState("");
  
  // Accordion states
  const [openSections, setOpenSections] = useState({
    profile: true,
    stats: false,
    moderation: false,
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
    queryFn: () => supabase.auth.me(),
    refetchInterval: 5000,
  });

  const { data: myStreams = [] } = useQuery({
    queryKey: ['myStreams', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await supabase.entities.Stream.filter({ streamer_id: user.id }, "-created_date", 10);
    },
    enabled: !!user,
    initialData: [],
  });

  // FIXED: Calculate total streaming hours
  const totalStreamingHours = useMemo(() => {
    if (!myStreams.length) return 0;
    
    // Calculate total hours from all streams
    let totalMinutes = 0;
    myStreams.forEach(stream => {
      if (stream.created_date) {
        const startTime = new Date(stream.created_date);
        const endTime = stream.updated_date ? new Date(stream.updated_date) : new Date();
        const durationMs = endTime - startTime;
        totalMinutes += Math.floor(durationMs / 1000 / 60);
      }
    });
    
    return (totalMinutes / 60).toFixed(1);
  }, [myStreams]);

  const { data: userEffects = [] } = useQuery({
    queryKey: ['userEffects', user?.id],
    queryFn: () => supabase.entities.UserEntranceEffect.filter({ user_id: user.id }),
    initialData: [],
    enabled: !!user?.id,
  });

  const { data: paymentVerifications = [] } = useQuery({
    queryKey: ['paymentVerifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await supabase.entities.PaymentVerification.filter({ user_id: user.id });
    },
    enabled: !!user,
    initialData: [],
  });

  // Get user's kick history
  const { data: kickHistory = [] } = useQuery({
    queryKey: ['kickHistory', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('kicked_users')
        .select(`
          *,
          kicked_by_user:profiles!kicked_by(id, username, full_name)
        `)
        .eq('user_id', user.id)
        .order('kicked_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching kick history:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Get user's ban history
  const { data: banHistory = [] } = useQuery({
    queryKey: ['banHistory', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('banned_users')
        .select(`
          *,
          banned_by_user:profiles!banned_by(id, username, full_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching ban history:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!user?.id,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      const updates = { ...data };

      // Sanitize and enforce username rules, plus uniqueness check
      if (typeof updates.username === 'string') {
        const raw = updates.username;
        const sanitized = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (sanitized.length < 3) {
          throw new Error('Username must be at least 3 characters and use a-z, 0-9, _');
        }
        // Check if username is already taken by another user
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

      // Try to update all fields at once
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (!error) return;

      // Per-field fallback: update one key at a time, skipping any invalid columns
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
      await supabase.entities.UserEntranceEffect.filter({ user_id: user.id }).then(effects => {
        effects.forEach(e => supabase.entities.UserEntranceEffect.update(e.id, { is_active: false }));
      });

      const targetEffect = userEffects.find(e => e.id === effectId);
      await supabase.entities.UserEntranceEffect.update(effectId, { is_active: true });
      // Update profile with active effect metadata directly in profiles table
      const { error } = await supabase
        .from('profiles')
        .update({
          active_entrance_effect: targetEffect?.animation_type || null,
          active_entrance_effect_name: targetEffect?.effect_name || null,
        })
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['userEffects']);
      queryClient.invalidateQueries(['currentUser']);
      toast.success("Entrance effect activated!");
    }
  });

  const startPaymentVerificationMutation = useMutation({
    mutationFn: async ({ method, details }) => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await supabase.entities.PaymentVerification.create({
        user_id: user.id,
        user_name: user.full_name,
        payment_method: method,
        payment_details: details,
        verification_code: code,
        verified_by_user: false,
        verified_by_admin: false
      });
      return code;
    },
    onSuccess: (code) => {
      queryClient.invalidateQueries(['paymentVerifications']);
      toast.success(`Verification started! Code: ${code}`);
      setSelectedPaymentMethod("");
      setPaymentDetails("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to start verification");
    }
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async ({ verificationId, code }) => {
      const verification = paymentVerifications.find(v => v.id === verificationId);
      if (verification.verification_code !== code) {
        throw new Error("Invalid verification code");
      }
      await supabase.entities.PaymentVerification.update(verificationId, {
        verified_by_user: true,
        verification_date: new Date().toISOString()
      });
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

  const setupApplePayMutation = useMutation({
    mutationFn: async ({ applePayId }) => {
      if (!applePayId.trim()) {
        throw new Error("Please enter Apple Pay details");
      }
      
      const { error } = await supabase
        .from('profiles')
        .update({
          payout_method: 'apple_pay',
          apple_pay_id: applePayId,
          last_payout_date: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      return applePayId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      toast.success("Apple Pay setup complete! Payment method updated.");
      setApplePayDetails("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to setup Apple Pay");
    }
  });

  const setupGoogleWalletMutation = useMutation({
    mutationFn: async ({ googleWalletId }) => {
      if (!googleWalletId.trim()) {
        throw new Error("Please enter Google Wallet details");
      }
      
      const { error } = await supabase
        .from('profiles')
        .update({
          payout_method: 'google_wallet',
          google_wallet_id: googleWalletId,
          last_payout_date: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      return googleWalletId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      toast.success("Google Wallet setup complete! Payment method updated.");
      setGoogleWalletDetails("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to setup Google Wallet");
    }
  });

  const setupChimeMutation = useMutation({
    mutationFn: async ({ chimeId }) => {
      if (!chimeId.trim()) {
        throw new Error("Please enter Chime details");
      }
      
      const { error } = await supabase
        .from('profiles')
        .update({
          payout_method: 'chime',
          chime_id: chimeId,
          last_payout_date: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      return chimeId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      toast.success("Chime setup complete! Payment method updated.");
      setChimeDetails("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to setup Chime");
    }
  });

  const setupCashAppMutation = useMutation({
    mutationFn: async ({ cashappTag }) => {
      if (!cashappTag.trim()) {
        throw new Error("Please enter CashApp tag");
      }
      
      if (!cashappTag.startsWith('$')) {
        throw new Error("CashApp tag must start with $ symbol");
      }
      
      const { error } = await supabase
        .from('profiles')
        .update({
          payout_method: 'cashapp',
          cashapp_tag: cashappTag,
          last_payout_date: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      return cashappTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      toast.success("CashApp setup complete! Payment method updated.");
      setCashappDetails("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to setup CashApp");
    }
  });

  const updateMessageChargeMutation = useMutation({
    mutationFn: async ({ chargeAmount }) => {
      const amount = parseInt(chargeAmount);
      if (isNaN(amount) || amount < 0) {
        throw new Error("Please enter a valid charge amount");
      }
      
      const { error } = await supabase
        .from('profiles')
        .update({
          message_charge_amount: amount,
          message_charge_enabled: amount > 0
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      return amount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      toast.success("Message charge settings updated!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update message charge");
    }
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await supabase.entities.User.update(user.id, {
        is_deleted: true,
        deleted_date: new Date().toISOString()
      });
      await supabase.auth.signOut();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete account");
    }
  });

  // Stripe Connect onboarding: start and redirect
  const connectStripeMutation = useMutation({
    mutationFn: async () => {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const payload = {
        user_id: user.id,
        user_email: user.email,
        return_url: `${base}/profile?connected=stripe`,
        refresh_url: `${base}/profile?connect=retry`,
      };
      // Ensure we call the Edge Function with proper body/options and parse standard supabase-js response shape
      const { data, error } = await supabase.functions.invoke('createstripeconnect', {
        body: payload,
        headers: {
          // Provide apikey for environments that require explicit key header
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          'x-client-info': 'trollcity-web',
        },
      });
      if (error) throw error;
      const url = data?.url || data?.onboarding_url || null;
      if (url) return url;
      throw new Error('Failed to start Stripe onboarding: missing URL from function');
    },
    onSuccess: (url) => {
      try {
        window.location.href = url;
      } catch {
        toast.error('Unable to redirect to Stripe onboarding');
      }
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to start Stripe onboarding');
    }
  });

  // Toast success on return from Stripe onboarding
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('connected') === 'stripe') {
        toast.success("Payouts connected with Stripe. You're all set!");
        // Optionally refetch profile to reflect stripe_account_id persistence
        queryClient.invalidateQueries(['currentUser']);
      }
    } catch (_) {
      // ignore
    }
  }, [queryClient]);

  // Resize the image client-side to control dimensions and file size
  const resizeImage = (file, { maxWidth = 512, maxHeight = 512, mimeType = 'image/jpeg', quality = 0.9 } = {}) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = reject;

      img.onload = () => {
        const width = img.width;
        const height = img.height;
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        const targetW = Math.round(width * ratio);
        const targetH = Math.round(height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetW, targetH);

        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Failed to resize image'));
          const ext = mimeType.includes('png') ? 'png' : 'jpg';
          const baseName = (file.name || 'avatar').replace(/\.[^/.]+$/, '');
          const resizedFile = new File([blob], `${baseName}.${ext}`, { type: mimeType });
          resolve(resizedFile);
        }, mimeType, quality);
      };
      img.onerror = reject;

      reader.readAsDataURL(file);
    });
  };

  const fileToDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const cropImageToSquareBlob = (dataUrl, size = 512) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        try {
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else {
              const fallback = canvas.toDataURL('image/jpeg', 0.9);
              fetch(fallback).then(r => r.blob()).then(resolve).catch(reject);
            }
          }, 'image/jpeg', 0.9);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  useEffect(() => {
    if (!user) return;
    try {
      const cached = localStorage.getItem(`tc_avatar_${user.id}`);
      if (cached) {
        queryClient.setQueryData(['currentUser'], (prev) => prev ? { ...prev, avatar: cached } : prev);
      }
    } catch (_) {}
  }, [user, queryClient]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const dataUrl = await fileToDataUrl(file);
      const blob = await cropImageToSquareBlob(dataUrl, 512);
      const baseName = (file.name || 'avatar').replace(/\.[^/.]+$/, '');
      const squaredFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
      let uploadedUrl = null;
      try {
        const { file_url } = await supabase.integrations.Core.UploadFile({ file: squaredFile, bucket: 'avatars', pathPrefix: 'avatars' });
        uploadedUrl = file_url;
      } catch (uploadErr) {
        uploadedUrl = dataUrl;
        try { localStorage.setItem(`tc_avatar_${user.id}`, dataUrl); } catch (_) {}
      }

      if (uploadedUrl) {
        if (supabase.__isConfigured) {
          try {
            const attempts = [ { avatar: uploadedUrl }, { avatar_url: uploadedUrl } ];
            let updated = false;
            for (const payload of attempts) {
              const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
              if (!error) { updated = true; break; }
            }
            if (!updated) {
              queryClient.setQueryData(['currentUser'], (prev) => prev ? { ...prev, avatar: uploadedUrl } : prev);
            }
          } catch (_) {
            queryClient.setQueryData(['currentUser'], (prev) => prev ? { ...prev, avatar: uploadedUrl } : prev);
          }
        } else {
          queryClient.setQueryData(['currentUser'], (prev) => prev ? { ...prev, avatar: uploadedUrl } : prev);
        }
        queryClient.invalidateQueries(['currentUser']);
        toast.success('Avatar updated!');
      } else {
        throw new Error('Failed to process avatar');
      }
    } catch (error) {
      const msg = error?.message || 'Failed to upload avatar';
      toast.error(msg);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const getTierInfo = (level) => {
    if (level >= 71) return { tier: 5, color: "from-red-600 to-black", name: "Graveyard" };
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
          <Button onClick={() => supabase.auth.redirectToLogin()}>Login</Button>
        </Card>
      </div>
    );
  }

  const tierInfo = getTierInfo(user.level || 1);

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Profile Header - Always Visible */}
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {user.avatar ? (
                <img src={user.avatar} alt={user.username} className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-3xl font-bold">{user.username?.[0]?.toUpperCase()}</span>
                </div>
              )}
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              <Button size="icon" onClick={() => avatarInputRef.current?.click()} disabled={isUploadingAvatar} className="absolute bottom-0 right-0 rounded-full bg-purple-600 hover:bg-purple-700">
                <Camera className="w-4 h-4" />
              </Button>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-2xl font-bold text-white">@{user.username || user.full_name}</h1>
                <UserBadges user={user} size="md" />
              </div>
              <p className="text-gray-400 text-sm">{user.email}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge className={`bg-gradient-to-r ${tierInfo.color} text-white`}>
                  Level {user.level || 1} • {tierInfo.name}
                </Badge>
                <TrollFamilyBadge user={user} />
              </div>
            </div>
          </div>
        </Card>

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
                    <Button onClick={() => { setIsEditing(true); setEditData({ bio: user.bio || '', username: user.username || '' }); }} className="w-full bg-purple-600 hover:bg-purple-700">
                      <Edit className="w-4 h-4 mr-2" />Edit Profile
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-400 text-sm mb-1 block">Username</label>
                      <Input value={editData.username} onChange={(e) => setEditData({...editData, username: e.target.value})} className="bg-[#0a0a0f] border-[#2a2a3a] text-white" />
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

        {/* Moderation History - Collapsible */}
        <Collapsible open={openSections.moderation} onOpenChange={() => toggleSection('moderation')}>
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-white/5">
              <div className="flex items-center gap-2">
                <X className="w-5 h-5 text-red-400" />
                <span className="text-white font-semibold">Moderation History</span>
                <Badge className="bg-red-500">{kickHistory.length + banHistory.length}</Badge>
              </div>
              {openSections.moderation ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-4">
                {/* Kick History */}
                <div className="bg-[#0a0a0f] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-red-400 font-semibold text-sm">Kick History</p>
                    <Badge className="bg-red-500 text-xs">{kickHistory.length}</Badge>
                  </div>
                  {kickHistory.length === 0 ? (
                    <p className="text-gray-500 text-xs">No kicks recorded</p>
                  ) : (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {kickHistory.map((kick, index) => (
                        <div key={index} className="bg-[#1a1a24] rounded p-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-white text-xs font-medium">Kicked by @{kick.kicked_by_user?.username || 'Unknown'}</p>
                              <p className="text-gray-400 text-xs">{kick.reason || 'No reason provided'}</p>
                            </div>
                            <span className="text-gray-500 text-xs">{formatDateOrUnknown(kick.kicked_at, 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ban History */}
                <div className="bg-[#0a0a0f] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-red-400 font-semibold text-sm">Ban History</p>
                    <Badge className="bg-red-500 text-xs">{banHistory.length}</Badge>
                  </div>
                  {banHistory.length === 0 ? (
                    <p className="text-gray-500 text-xs">No bans recorded</p>
                  ) : (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {banHistory.map((ban, index) => (
                        <div key={index} className="bg-[#1a1a24] rounded p-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-white text-xs font-medium">Banned by @{ban.banned_by_user?.username || 'Unknown'}</p>
                              <p className="text-gray-400 text-xs">{ban.reason || 'No reason provided'}</p>
                              {ban.expires_at && (
                                <p className="text-yellow-400 text-xs">Expires: {formatDateOrUnknown(ban.expires_at, 'MMM d, yyyy')}</p>
                              )}
                            </div>
                            <span className="text-gray-500 text-xs">{formatDateOrUnknown(ban.created_at, 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Troller Level */}
                <div className="bg-[#0a0a0f] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-purple-400 font-semibold text-sm">Troller Level</p>
                    <Badge className="bg-purple-500 text-xs">
                      {kickHistory.length + banHistory.length === 0 ? '0%' : 
                       `${Math.min(100, Math.round(((kickHistory.length + banHistory.length) / 10) * 100))}%`}
                    </Badge>
                  </div>
                  <div className="w-full bg-[#1a1a24] rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-red-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, ((kickHistory.length + banHistory.length) / 10) * 100)}%` }}
                    />
                  </div>
                  <p className="text-gray-400 text-xs mt-1">
                    {kickHistory.length + banHistory.length === 0 ? 'Clean record!' : 
                     kickHistory.length + banHistory.length < 3 ? 'Minor offenses' :
                     kickHistory.length + banHistory.length < 6 ? 'Moderate troller' :
                     kickHistory.length + banHistory.length < 10 ? 'Serious troller' : 'Maximum troll!'}
                  </p>
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
                          <p className="text-gray-400 text-xs">{formatDateOrUnknown(stream.created_date, 'MMM d, yyyy')}</p>
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
                {/* CashApp Payment Method */}
                <div className="bg-[#0a0a0f] rounded-lg p-4">
                  <label className="text-white font-medium mb-3 block text-sm">💰 CashApp</label>
                  <p className="text-xs text-gray-400 mb-3">Enter your CashApp tag (e.g., $YourTag)</p>
                  
                  <div className="space-y-2">
                    <Input 
                      value={cashappDetails} 
                      onChange={(e) => setCashappDetails(e.target.value)}
                      placeholder="$YourCashAppTag"
                      className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                    />
                    <div className="text-xs">
                      {cashappDetails && !cashappDetails.startsWith('$') && (
                        <p className="text-red-400">❌ Must start with $ symbol</p>
                      )}
                      {cashappDetails && cashappDetails.startsWith('$') && (
                        <p className="text-green-400">✓ Valid CashApp format</p>
                      )}
                    </div>
                    <Button 
                      onClick={() => {
                        if (!cashappDetails.trim()) {
                          alert('Please enter your CashApp tag');
                          return;
                        }
                        if (!cashappDetails.startsWith('$')) {
                          alert('CashApp tag must start with $ symbol');
                          return;
                        }
                        setupCashAppMutation.mutate({ cashappTag: cashappDetails });
                      }}
                      disabled={!cashappDetails || !cashappDetails.startsWith('$') || setupCashAppMutation.isPending}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                      <DollarSign className="w-4 h-4 mr-2" />Connect CashApp
                    </Button>
                  </div>
                  
                  {user.payout_method === 'cashapp' && (
                    <div className="mt-3 p-2 bg-green-900/30 rounded border border-green-600">
                      <p className="text-green-400 text-xs">✓ CashApp connected</p>
                      <p className="text-gray-400 text-xs">Tag: {user.cashapp_tag}</p>
                    </div>
                  )}
                </div>

                {/* Apple Pay Payment Method */}
                <div className="bg-[#0a0a0f] rounded-lg p-4">
                  <label className="text-white font-medium mb-3 block text-sm">📱 Apple Pay</label>
                  <p className="text-xs text-gray-400 mb-3">Enter your Apple Pay email or phone number</p>
                  
                  <div className="space-y-2">
                    <Input 
                      value={applePayDetails} 
                      onChange={(e) => setApplePayDetails(e.target.value)}
                      placeholder="Email or Phone Number"
                      className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                    />
                    <div className="text-xs">
                      {applePayDetails && applePayDetails.length < 3 && (
                        <p className="text-red-400">❌ Must be at least 3 characters</p>
                      )}
                      {applePayDetails && applePayDetails.length >= 3 && (
                        <p className="text-green-400">✓ Valid format</p>
                      )}
                    </div>
                    <Button 
                      onClick={() => {
                        if (!applePayDetails.trim()) {
                          alert('Please enter your Apple Pay details');
                          return;
                        }
                        if (applePayDetails.length < 3) {
                          alert('Apple Pay details must be at least 3 characters');
                          return;
                        }
                        setupApplePayMutation.mutate({ 
                          applePayId: applePayDetails 
                        });
                      }}
                      disabled={!applePayDetails || applePayDetails.length < 3 || setupApplePayMutation.isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <Smartphone className="w-4 h-4 mr-2" />Connect Apple Pay
                    </Button>
                  </div>
                  
                  {user.payout_method === 'apple_pay' && (
                    <div className="mt-3 p-2 bg-green-900/30 rounded border border-green-600">
                      <p className="text-green-400 text-xs">✓ Apple Pay connected</p>
                      <p className="text-gray-400 text-xs">ID: {user.apple_pay_id}</p>
                    </div>
                  )}
                </div>

                {/* Google Wallet Payment Method */}
                <div className="bg-[#0a0a0f] rounded-lg p-4">
                  <label className="text-white font-medium mb-3 block text-sm">👛 Google Wallet</label>
                  <p className="text-xs text-gray-400 mb-3">Enter your Google Wallet email</p>
                  
                  <div className="space-y-2">
                    <Input 
                      value={googleWalletDetails} 
                      onChange={(e) => setGoogleWalletDetails(e.target.value)}
                      placeholder="Google Email Address"
                      className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                    />
                    <div className="text-xs">
                      {googleWalletDetails && googleWalletDetails.length < 3 && (
                        <p className="text-red-400">❌ Must be at least 3 characters</p>
                      )}
                      {googleWalletDetails && googleWalletDetails.length >= 3 && (
                        <p className="text-green-400">✓ Valid format</p>
                      )}
                    </div>
                    <Button 
                      onClick={() => {
                        if (!googleWalletDetails.trim()) {
                          alert('Please enter your Google Wallet email');
                          return;
                        }
                        if (googleWalletDetails.length < 3) {
                          alert('Google Wallet email must be at least 3 characters');
                          return;
                        }
                        setupGoogleWalletMutation.mutate({ 
                          googleWalletId: googleWalletDetails 
                        });
                      }}
                      disabled={!googleWalletDetails || googleWalletDetails.length < 3 || setupGoogleWalletMutation.isPending}
                      className="w-full bg-orange-600 hover:bg-orange-700"
                    >
                      <Wallet className="w-4 h-4 mr-2" />Connect Google Wallet
                    </Button>
                  </div>
                  
                  {user.payout_method === 'google_wallet' && (
                    <div className="mt-3 p-2 bg-green-900/30 rounded border border-green-600">
                      <p className="text-green-400 text-xs">✓ Google Wallet connected</p>
                      <p className="text-gray-400 text-xs">Email: {user.google_wallet_id}</p>
                    </div>
                  )}
                </div>

                {/* Chime Payment Method */}
                <div className="bg-[#0a0a0f] rounded-lg p-4">
                  <label className="text-white font-medium mb-3 block text-sm">🏦 Chime</label>
                  <p className="text-xs text-gray-400 mb-3">Enter your Chime account email or username</p>
                  
                  <div className="space-y-2">
                    <Input 
                      value={chimeDetails} 
                      onChange={(e) => setChimeDetails(e.target.value)}
                      placeholder="Chime Email or Username"
                      className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                    />
                    <div className="text-xs">
                      {chimeDetails && chimeDetails.length < 3 && (
                        <p className="text-red-400">❌ Must be at least 3 characters</p>
                      )}
                      {chimeDetails && chimeDetails.length >= 3 && (
                        <p className="text-green-400">✓ Valid format</p>
                      )}
                    </div>
                    <Button 
                      onClick={() => {
                        if (!chimeDetails.trim()) {
                          alert('Please enter your Chime details');
                          return;
                        }
                        if (chimeDetails.length < 3) {
                          alert('Chime details must be at least 3 characters');
                          return;
                        }
                        setupChimeMutation.mutate({ 
                          chimeId: chimeDetails 
                        });
                      }}
                      disabled={!chimeDetails || chimeDetails.length < 3 || setupChimeMutation.isPending}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      <Building className="w-4 h-4 mr-2" />Connect Chime
                    </Button>
                  </div>
                  
                  {user.payout_method === 'chime' && (
                    <div className="mt-3 p-2 bg-green-900/30 rounded border border-green-600">
                      <p className="text-green-400 text-xs">✓ Chime connected</p>
                      <p className="text-gray-400 text-xs">Account: {user.chime_id}</p>
                    </div>
                  )}
                </div>

                {/* Message Charging Settings */}
                <div className="bg-[#0a0a0f] rounded-lg p-4">
                  <label className="text-white font-medium mb-3 block text-sm">💬 Message Charging</label>
                  <p className="text-xs text-gray-400 mb-3">Charge users paid coins to message you (0 = free)</p>
                  
                  <div className="space-y-2">
                    <Input 
                      value={messageChargeAmount} 
                      onChange={(e) => setMessageChargeAmount(e.target.value)}
                      placeholder="Amount in coins (e.g., 50)"
                      className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                      type="number"
                      min="0"
                    />
                    <div className="text-xs">
                      {messageChargeAmount && parseInt(messageChargeAmount) > 0 && (
                        <p className="text-green-400">✓ Users will pay {messageChargeAmount} coins per message</p>
                      )}
                      {messageChargeAmount && parseInt(messageChargeAmount) === 0 && (
                        <p className="text-blue-400">✓ Messaging is free</p>
                      )}
                    </div>
                    <Button 
                      onClick={() => {
                        const amount = parseInt(messageChargeAmount);
                        if (isNaN(amount) || amount < 0) {
                          alert('Please enter a valid amount (0 or positive number)');
                          return;
                        }
                        updateMessageChargeMutation.mutate({ 
                          chargeAmount: messageChargeAmount 
                        });
                      }}
                      disabled={!messageChargeAmount || updateMessageChargeMutation.isPending}
                      className="w-full bg-indigo-600 hover:bg-indigo-700"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />Update Message Charge
                    </Button>
                  </div>
                  
                  {user.message_charge_enabled && (
                    <div className="mt-3 p-2 bg-blue-900/30 rounded border border-blue-600">
                      <p className="text-blue-400 text-xs">✓ Message charging enabled</p>
                      <p className="text-gray-400 text-xs">Cost: {user.message_charge_amount} coins per message</p>
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
              <div className="p-4 pt-0 space-y-4">
                {/* Message Charge Settings */}
                <div className="bg-[#0a0a0f] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-2">Message Charge Amount</p>
                  <div className="space-y-2">
                    <Input 
                      value={messageChargeAmount} 
                      onChange={(e) => setMessageChargeAmount(e.target.value)}
                      placeholder="Amount in coins (e.g., 50)"
                      className="bg-[#1a1a24] border-[#2a2a3a] text-white text-sm"
                      type="number"
                      min="0"
                    />
                    <div className="text-xs">
                      {messageChargeAmount && parseInt(messageChargeAmount) > 0 && (
                        <p className="text-green-400">✓ Users pay {messageChargeAmount} coins per message</p>
                      )}
                      {messageChargeAmount && parseInt(messageChargeAmount) === 0 && (
                        <p className="text-blue-400">✓ Messaging is free</p>
                      )}
                    </div>
                    <Button 
                      onClick={() => {
                        const amount = parseInt(messageChargeAmount);
                        if (isNaN(amount) || amount < 0) {
                          alert('Please enter a valid amount (0 or positive number)');
                          return;
                        }
                        updateMessageChargeMutation.mutate({ 
                          chargeAmount: messageChargeAmount 
                        });
                      }}
                      disabled={!messageChargeAmount || updateMessageChargeMutation.isPending}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-xs py-2"
                      size="sm"
                    >
                      <MessageSquare className="w-3 h-3 mr-1" />Update Charge
                    </Button>
                  </div>
                </div>

                {/* Blocked Users Management */}
                <BlockedUsersManagement />

                <div className="bg-[#0a0a0f] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Member Since</p>
                  <p className="text-white text-sm">{formatDateOrUnknown(user.created_date, 'MMMM d, yyyy')}</p>
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

// Blocked Users Management Component
function BlockedUsersManagement() {
  const queryClient = useQueryClient();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const unblockUserMutation = useMutation({
    mutationFn: async (blockedUserId) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Remove from blocked_users table
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedUserId);
      
      if (error) throw error;
      return blockedUserId;
    },
    onSuccess: (blockedUserId) => {
      toast.success('User unblocked successfully');
      // Remove from local state
      setBlockedUsers(prev => prev.filter(user => user.id !== blockedUserId));
      queryClient.invalidateQueries(['blockedUsers']);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to unblock user');
    }
  });

  // Fetch blocked users
  useEffect(() => {
    const fetchBlockedUsers = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('blocked_users')
          .select(`
            blocked_id,
            created_at,
            blocked_user:profiles!blocked_id(id, username, full_name, avatar_url)
          `)
          .eq('blocker_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Error fetching blocked users (table may be new):', error);
          setBlockedUsers([]);
          return;
        }
        
        const formattedUsers = (data || []).map(item => ({
          id: item.blocked_id,
          username: item.blocked_user?.username || 'Unknown User',
          fullName: item.blocked_user?.full_name || 'Unknown User',
          avatarUrl: item.blocked_user?.avatar_url,
          blockedAt: item.created_at
        }));
        
        setBlockedUsers(formattedUsers);
      } catch (error) {
        console.warn('Failed to fetch blocked users:', error);
        setBlockedUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBlockedUsers();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-[#0a0a0f] rounded-lg p-3">
        <p className="text-gray-400 text-xs mb-2">Blocked Users</p>
        <div className="flex items-center justify-center py-4">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0f] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-gray-400 text-xs">Blocked Users</p>
        <Badge className="bg-red-500 text-white text-xs">{blockedUsers.length}</Badge>
      </div>
      
      {blockedUsers.length === 0 ? (
        <p className="text-gray-500 text-xs">No users blocked</p>
      ) : (
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {blockedUsers.map((blockedUser) => (
            <div key={blockedUser.id} className="flex items-center justify-between bg-[#1a1a24] rounded p-2">
              <div className="flex items-center gap-2">
                <img 
                  src={blockedUser.avatarUrl || '/default-avatar.png'} 
                  alt={blockedUser.username}
                  className="w-6 h-6 rounded-full object-cover"
                  onError={(e) => {
                    e.target.src = '/default-avatar.png';
                  }}
                />
                <div>
                  <p className="text-white text-xs font-medium">@{blockedUser.username}</p>
                  <p className="text-gray-400 text-xs">{blockedUser.fullName}</p>
                </div>
              </div>
              <Button
                onClick={() => unblockUserMutation.mutate(blockedUser.id)}
                disabled={unblockUserMutation.isPending}
                variant="outline"
                size="sm"
                className="text-xs py-1 px-2 border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
              >
                Unblock
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
