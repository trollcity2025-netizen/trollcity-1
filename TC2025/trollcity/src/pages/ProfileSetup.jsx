import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, User, AtSign, MessageSquare, DollarSign, CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentEmail, setPaymentEmail] = useState("");
  const [paymentUsername, setPaymentUsername] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankRouting, setBankRouting] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      console.log("🔗 Referral code detected:", refCode);
      sessionStorage.setItem('referral_code', refCode);
    }
  }, []);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => supabase.auth.me(),
  });

  // Inline username availability check with debounce
  useEffect(() => {
    let cancelled = false;
    const raw = username || "";
    const sanitized = raw.toLowerCase().replace(/[^a-z0-9_]/g, '').trim();
    // Basic validation first
    if (!sanitized) {
      setUsernameError("Username is required");
      setIsUsernameAvailable(false);
      return;
    }
    if (sanitized.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      setIsUsernameAvailable(false);
      return;
    }
    setIsCheckingUsername(true);
    setUsernameError("");
    const handle = setTimeout(async () => {
      try {
        const { data: taken, error } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', sanitized)
          .neq('id', user?.id || '')
          .limit(1);
        if (cancelled) return;
        if (error) {
          console.warn('Username availability check failed:', error.message);
          setUsernameError("Could not check username availability");
          setIsUsernameAvailable(false);
        } else if (Array.isArray(taken) && taken.length > 0) {
          setUsernameError("Username is already taken");
          setIsUsernameAvailable(false);
        } else {
          setUsernameError("");
          setIsUsernameAvailable(true);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('Username availability check exception:', e?.message || e);
          setUsernameError("Could not check username availability");
          setIsUsernameAvailable(false);
        }
      } finally {
        if (!cancelled) setIsCheckingUsername(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [username, user?.id]);

  const completeProfileMutation = useMutation({
    mutationFn: async () => {
      if (!username || username.length < 3) {
        throw new Error("Username must be at least 3 characters");
      }

      // Sanitize and enforce uniqueness for username
      const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '').trim();
      if (sanitizedUsername.length < 3) {
        throw new Error('Username must be at least 3 characters and use a-z, 0-9, _');
      }
      // Case-insensitive uniqueness check (exclude current user)
      const { data: taken } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', sanitizedUsername)
        .neq('id', user.id)
        .limit(1);
      if (Array.isArray(taken) && taken.length > 0) {
        throw new Error('Username is already taken. Please choose another.');
      }

      let avatarUrl = user?.avatar || "";

      if (avatar) {
        setIsUploading(true);
        const reader = new FileReader();
        const dataUrl = await new Promise((res, rej) => { reader.onloadend = () => res(reader.result); reader.onerror = rej; reader.readAsDataURL(avatar); });
        const blob = await cropImageToSquareBlob(dataUrl, 512);
        const baseName = (avatar.name || 'avatar').replace(/\.[^/.]+$/, '');
        const squaredFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
        const { file_url } = await supabase.integrations.Core.UploadFile({ file: squaredFile, bucket: 'avatars', pathPrefix: 'avatars' });
        avatarUrl = file_url;
        setIsUploading(false);
      }

      const referralCode = `${sanitizedUsername.toUpperCase().substring(0, 4)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const updates = {
        username: sanitizedUsername,
        display_name: displayName.trim() || user.full_name,
        bio: bio.trim() || "",
        avatar: avatarUrl,
        payment_method: paymentMethod,
        profile_completed: true,
        referral_code: referralCode,
      };

      if (paymentMethod === "paypal") {
        updates.payment_email = paymentEmail;
      } else if (paymentMethod === "zelle") {
        updates.payment_email = paymentEmail;
      } else if (paymentMethod === "cashapp" || paymentMethod === "venmo") {
        let formattedUsername = paymentUsername.trim();
        if (paymentMethod === "cashapp" && !formattedUsername.startsWith("$")) {
          formattedUsername = "$" + formattedUsername;
        }
        updates.payment_username = formattedUsername;
      } else if (paymentMethod === "bank_transfer") {
        updates.bank_account_number = bankAccount;
        updates.bank_routing_number = bankRouting;
      }

      // Robust update to profiles: attempt bulk update, fallback to per-field
      const { error: bulkError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (bulkError) {
        const keys = Object.keys(updates);
        let anySuccess = false;
        let lastErr = bulkError;
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
      }

      const refCode = sessionStorage.getItem('referral_code');
      if (refCode) {
        console.log("✅ Processing referral with code:", refCode);
        
        const referrers = await supabase.entities.User.filter({ referral_code: refCode });
        
        if (referrers.length > 0) {
          const referrer = referrers[0];
          console.log("✅ Found referrer:", referrer.username || referrer.full_name);
          
          await supabase.entities.Referral.create({
            referrer_id: referrer.id,
            referrer_name: referrer.full_name,
            referrer_username: referrer.username || referrer.full_name,
            referred_id: user.id,
            referred_name: user.full_name,
            referred_username: sanitizedUsername,
            referral_code: refCode,
            status: "pending",
            reward_given: false,
            referred_user_level: 1,
          });

          // Update referred_by_code with robust fallback
          const { error: refErr } = await supabase
            .from('profiles')
            .update({ referred_by_code: refCode })
            .eq('id', user.id);
          if (refErr) {
            const { error: singleErr } = await supabase
              .from('profiles')
              .update({ referred_by_code: refCode })
              .eq('id', user.id);
            if (singleErr) console.warn('Failed to set referred_by_code:', singleErr.message);
          }

          console.log("✅ Referral record created");
          toast.success(`Welcome! You were referred by ${referrer.username || referrer.full_name}`);
        } else {
          console.log("⚠️ Referrer not found for code:", refCode);
        }
        
        sessionStorage.removeItem('referral_code');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      toast.success("Profile setup complete! Welcome to TrollCity! 🎉");
      setTimeout(() => {
        navigate(createPageUrl('Home'));
      }, 1000);
    },
    onError: (error) => {
      console.error("❌ Profile setup error:", error);
      toast.error(error.message || "Failed to complete setup");
    }
  });

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!username) {
        toast.error("Username is required");
        return;
      }
      if (username.length < 3) {
        toast.error("Username must be at least 3 characters");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!paymentMethod) {
        toast.error("Please select a payment method");
        return;
      }

      if (paymentMethod === "paypal" && !paymentEmail.includes("@")) {
        toast.error("Please enter a valid PayPal email");
        return;
      }

      if ((paymentMethod === "cashapp" || paymentMethod === "venmo") && !paymentUsername.trim()) {
        toast.error(`Please enter your ${paymentMethod === "cashapp" ? "Cash App Tag" : "Venmo Username"}`);
        return;
      }

      if (paymentMethod === "bank_transfer" && (!bankAccount.trim() || !bankRouting.trim())) {
        toast.error("Please enter both bank account and routing numbers");
        return;
      }

      completeProfileMutation.mutate();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] p-6 flex items-center justify-center">
      <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8 w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">
            Welcome to <span className="text-emerald-400">Troll</span><span className="text-cyan-400">City</span>! 🎉
          </h1>
          <p className="text-gray-400">Let's set up your profile</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-purple-400' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-purple-500' : 'bg-gray-700'}`}>
                {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
              </div>
              <span className="font-semibold">Profile</span>
            </div>
            <div className="w-16 h-0.5 bg-gray-700" />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-green-400' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-green-500' : 'bg-gray-700'}`}>
                2
              </div>
              <span className="font-semibold">Payment</span>
            </div>
          </div>
        </div>

        {/* Step 1: Profile Info */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Avatar Upload */}
            <div className="flex justify-center">
              <div className="relative">
                {avatarPreview || user.avatar ? (
                  <img
                    src={avatarPreview || user.avatar}
                    alt="Avatar"
                    className="w-32 h-32 rounded-full object-cover ring-4 ring-purple-500"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center ring-4 ring-purple-500">
                    <User className="w-16 h-16 text-white" />
                  </div>
                )}
                <label className="absolute bottom-0 right-0 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full cursor-pointer">
                  <Camera className="w-5 h-5" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Username */}
            <div>
              <Label className="text-white mb-2 flex items-center gap-2">
                <AtSign className="w-4 h-4" />
                Username *
              </Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="coolstreamer123"
                className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                maxLength={20}
              />
              <div className="mt-1">
                {isCheckingUsername && (
                  <p className="text-xs text-gray-400">Checking availability…</p>
                )}
                {!isCheckingUsername && usernameError && (
                  <p className="text-xs text-red-400">{usernameError}</p>
                )}
                {!isCheckingUsername && !usernameError && username.length >= 3 && (
                  <p className="text-xs text-emerald-400">Username is available</p>
                )}
                <p className="text-xs text-gray-500">3-20 characters, letters, numbers and underscores only</p>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <Label className="text-white mb-2 flex items-center gap-2">
                <User className="w-4 h-4" />
                Display Name (optional)
              </Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={user.full_name}
                className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                maxLength={50}
              />
            </div>

            {/* Bio */}
            <div>
              <Label className="text-white mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Bio (optional)
              </Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                className="bg-[#0a0a0f] border-[#2a2a3a] text-white min-h-[100px]"
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">{bio.length}/500 characters</p>
            </div>

            <Button
              type="button"
              onClick={handleNext}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-6 text-lg"
              disabled={isCheckingUsername || !!usernameError}
            >
              Next: Payment Setup
            </Button>
          </div>
        )}

        {/* Step 2: Payment Method */}
        {step === 2 && (
          <div className="space-y-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(1)}
              className="text-gray-400 hover:text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-300 font-semibold mb-1">💰 Why add payment info now?</p>
                  <p className="text-blue-200 text-sm">
                    To cash out your earnings later, you'll need to reach your payout tier. 
                    Adding your payment method now saves time when you're ready to cash out!
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div>
              <Label className="text-white mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Payment Method *
              </Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#2a2a3a] text-white">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paypal">💳 PayPal</SelectItem>
                  <SelectItem value="cashapp">💵 Cash App</SelectItem>
                  <SelectItem value="venmo">💰 Venmo</SelectItem>
                  <SelectItem value="zelle">🏦 Zelle</SelectItem>
                  <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* PayPal Email */}
            {paymentMethod === "paypal" && (
              <div>
                <Label className="text-white mb-2">PayPal Email *</Label>
                <Input
                  type="email"
                  value={paymentEmail}
                  onChange={(e) => setPaymentEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
              </div>
            )}

            {/* Cash App */}
            {paymentMethod === "cashapp" && (
              <div>
                <Label className="text-white mb-2">Cash App Tag *</Label>
                <Input
                  value={paymentUsername}
                  onChange={(e) => setPaymentUsername(e.target.value)}
                  placeholder="$YourCashTag"
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Your $cashtag (e.g., $johndoe)</p>
              </div>
            )}

            {/* Venmo */}
            {paymentMethod === "venmo" && (
              <div>
                <Label className="text-white mb-2">Venmo Username *</Label>
                <Input
                  value={paymentUsername}
                  onChange={(e) => setPaymentUsername(e.target.value)}
                  placeholder="@YourVenmo"
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Your Venmo username (e.g., @johndoe)</p>
              </div>
            )}

            {/* Zelle */}
            {paymentMethod === "zelle" && (
              <div>
                <Label className="text-white mb-2">Zelle Email or Phone *</Label>
                <Input
                  value={paymentEmail}
                  onChange={(e) => setPaymentEmail(e.target.value)}
                  placeholder="your@email.com or phone number"
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
              </div>
            )}

            {/* Bank Transfer */}
            {paymentMethod === "bank_transfer" && (
              <>
                <div>
                  <Label className="text-white mb-2">Bank Account Number *</Label>
                  <Input
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="Account number"
                    className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                  />
                </div>
                <div>
                  <Label className="text-white mb-2">Routing Number *</Label>
                  <Input
                    value={bankRouting}
                    onChange={(e) => setBankRouting(e.target.value)}
                    placeholder="Routing number"
                    className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                  />
                </div>
              </>
            )}

            <Button
              onClick={handleNext}
              disabled={completeProfileMutation.isPending || isUploading}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 py-6 text-lg"
            >
              {completeProfileMutation.isPending || isUploading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                  {isUploading ? "Uploading avatar..." : "Completing setup..."}
                </div>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Complete Setup
                </>
              )}
            </Button>

            <p className="text-center text-xs text-gray-500">
              You can update your payment method later in your profile settings
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
