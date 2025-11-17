import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/api/supabaseClient";
import TrollCityShower from "@/components/TrollCityShower";

export default function Auth() {
  const navigate = useNavigate();
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) navigate("/Home");
      } catch {}
    })();
  }, [navigate]);

  const signIn = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (!supabase.__isConfigured) throw new Error("Auth not configured");
      const { error: err } = await supabase.auth.signInWithPassword({ email: signinEmail, password: signinPassword });
      if (err) setError(err.message || "Sign-in failed");
      else navigate("/Home");
    } catch (ex) {
      setError(ex?.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#ff3d7f] via-[#7a2ff9] to-[#1a0a2f] py-10 px-4 relative">
      <TrollCityShower count={40} />
      <div className="max-w-4xl mx-auto">
        {/* Version Banner */}
        <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 mb-6 max-w-md mx-auto">
          <p className="text-blue-300 text-sm">
            <strong>Version 1 (Beta)</strong> - For beta testers. New APK/IPS files available at{" "}
            <a href="https://trollcity.app" target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200 underline font-semibold">
              trollcity.app
            </a>
          </p>
        </div>

        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <span className="text-xl font-bold text-white">T</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              <span className="text-[#00ff88]">Troll</span>
              <span className="text-[#ff0844]">City</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md bg-white/95 backdrop-blur-md border-0 rounded-3xl shadow-xl">
            <div className="p-8">
              <p className="text-center text-2xl font-bold text-[#3b2bd9] mb-6">Log In</p>
              <form onSubmit={signIn} className="space-y-4">
                <Input type="email" value={signinEmail} onChange={(e)=>setSigninEmail(e.target.value)} placeholder="login/e-mail" className="w-full rounded-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400" />
                <Input type="password" value={signinPassword} onChange={(e)=>setSigninPassword(e.target.value)} placeholder="password" className="w-full rounded-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400" />
                <div className="flex items-center gap-2 text-sm">
                  <input type="checkbox" id="remember" className="accent-[#7a2ff9]" />
                  <label htmlFor="remember" className="text-[#7a2ff9]">Remember me</label>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full rounded-full bg-gradient-to-r from-[#3b2bd9] to-[#ff3d7f] text-white shadow-md">{loading?"Signing in...":"Log In"}</Button>
              </form>
              <div className="mt-6 text-center">
                <Link to="/Login" className="text-sm text-[#3b2bd9]">Forgot your password?</Link>
              </div>
              {!supabase.__isConfigured && <p className="text-center text-xs text-gray-500 mt-4">Supabase not configured. Sign-in disabled in preview.</p>}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
