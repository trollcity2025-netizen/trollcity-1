import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocationConsentModal } from "@/components/LocationConsentModal";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showLocationConsent, setShowLocationConsent] = useState(false);
  const [pendingUserId, setPendingUserId] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const tokenParam = urlParams.get('token');

  const { data: authUser } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data?.user || null;
    },
    staleTime: 1000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profilesForLogin"],
    queryFn: async () => {
      if (!supabase.__isConfigured) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar, level, is_admin, is_og, is_troll_officer")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) return [];
      return data || [];
    },
    staleTime: 5000,
  });

  useEffect(() => {
    if (authUser) {
      navigate("/Home");
    }
  }, [authUser, navigate]);

  // If there's a token in URL, prefetch pending invite info
  const [inviteTokenData, setInviteTokenData] = React.useState(null);
  useEffect(() => {
    if (!tokenParam) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('pending_invites')
          .select('email, assigned_role, expires_at, used')
          .eq('token', tokenParam)
          .single();
        if (!error && data) setInviteTokenData(data);
      } catch (e) {
        // ignore
      }
    })();
  }, [tokenParam]);

  const signIn = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message || "Sign-in failed");
      else navigate("/Home");
    } catch (ex) {
      setError(ex?.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!newPassword || newPassword.length < 6) {
        setError("Password must be at least 6 characters");
        setLoading(false);
        return;
      }

      // Sign up user
      const { data: authData, error: signupErr } = await supabase.auth.signUp({
        email,
        password: newPassword,
      });
      if (signupErr) throw signupErr;
      if (!authData?.user?.id) throw new Error("Sign-up failed");

      // Determine auto-assigned role from token (if present) or email-based invite
      let autoRole = 'user';
      let inviteSelector = null;
      if (tokenParam && inviteTokenData && !inviteTokenData.used) {
        autoRole = inviteTokenData.assigned_role || 'user';
        inviteSelector = { token: tokenParam };
      } else {
        const { data: inviteData } = await supabase
          .from('pending_invites')
          .select('assigned_role')
          .eq('email', email.toLowerCase())
          .single();
        autoRole = inviteData?.assigned_role || 'user';
        inviteSelector = { email: email.toLowerCase() };
      }

      // Create profile with auto-assigned role
      try {
        const { error: profileErr } = await supabase.from('profiles').insert({
          id: authData.user.id,
          email: email,
          username: email.split("@")[0],
          role: autoRole,
          is_admin: autoRole === 'admin',
          is_troll_officer: autoRole === 'troll_officer',
          is_troller: autoRole === 'troller',
          is_broadcaster: autoRole === 'broadcaster',
        });
        if (profileErr) {
          console.error('Profile creation error:', profileErr);
          // Don't throw - continue with signup, profile can be created later
          toast.warning('Account created but profile setup incomplete. Please refresh the page.');
        }
      } catch (profileError) {
        console.error('Profile creation failed:', profileError);
        // Continue with signup - profile will be created on next login
        toast.warning('Account created but profile setup failed. Please refresh the page.');
      }

      // Mark invite as used (by token or email)
      try {
        if (inviteSelector) {
          await supabase
            .from('pending_invites')
            .update({ used: true, used_date: new Date().toISOString(), used_by: authData.user.id })
            .match(inviteSelector);
        }
      } catch (e) {
        // ignore marking errors
      }

      setError(""); // Clear error to show success message below
      
      // Store user ID for location consent
      setPendingUserId(authData.user.id);
      
      // Show location consent modal instead of alert
      setShowLocationConsent(true);
      
      // Don't reset form yet - wait for location consent
      // setSignupMode(false);
      // setEmail("");
      // setPassword("");
      // setNewPassword("");
    } catch (ex) {
      setError(ex?.message || "Sign-up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* App Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <span className="text-3xl font-bold text-white">T</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">TrollCity</h1>
          <p className="text-gray-400">Join the community</p>
        </div>

        {/* Auth Card */}
        <Card className="bg-[#1a1a24]/90 border-[#2a2a3a] backdrop-blur-sm">
          <div className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                {signupMode ? "Create Account" : "Welcome Back"}
              </h2>
              <p className="text-gray-400 text-sm">
                {signupMode ? "Sign up to join TrollCity" : "Sign in to continue"}
              </p>
            </div>

            <form onSubmit={signupMode ? signUp : signIn} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full rounded-lg bg-[#0f0f16] border border-[#2a2a3a] p-3 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  value={signupMode ? newPassword : password}
                  onChange={(e) => signupMode ? setNewPassword(e.target.value) : setPassword(e.target.value)}
                  placeholder={signupMode ? "Create password" : "Password"}
                  className="w-full rounded-lg bg-[#0f0f16] border border-[#2a2a3a] p-3 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition-colors"
                  required
                />
              </div>
              {signupMode && (
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full rounded-lg bg-[#0f0f16] border border-[#2a2a3a] p-3 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition-colors"
                    required
                  />
                </div>
              )}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black font-semibold py-3 rounded-lg transition-all duration-200 transform hover:scale-[1.02]"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2"></div>
                    {signupMode ? "Creating Account..." : "Signing in..."}
                  </span>
                ) : (
                  signupMode ? "Create Account" : "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setSignupMode(!signupMode);
                  setError("");
                }}
                className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
              >
                {signupMode ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            </div>

            {!supabase.__isConfigured && (
              <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-400 text-xs text-center">Authentication system is currently being configured</p>
              </div>
            )}
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-gray-500 text-xs">
            By continuing, you agree to our community guidelines
          </p>
        </div>
      </div>

      {/* Location Consent Modal */}
      <LocationConsentModal
        isOpen={showLocationConsent}
        onClose={() => {
          setShowLocationConsent(false);
          setPendingUserId(null);
          // Reset form after consent is handled
          setSignupMode(false);
          setEmail("");
          setPassword("");
          setNewPassword("");
        }}
        onConsent={(hasConsented, location) => {
          console.log(`Location consent ${hasConsented ? 'granted' : 'denied'}`, location);
          // Show success message
          alert(`Sign-up successful! Your role is "${autoRole}". ${hasConsented ? 'Location consent granted for emergency safety features.' : ''} Please log in.`);
        }}
        userId={pendingUserId}
      />
    </div>
  );
}
