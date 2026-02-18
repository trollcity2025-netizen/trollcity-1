import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../lib/store";
import { hasRole, UserRole } from "../lib/supabase";
import { Shield, Crown } from "lucide-react";
import CoinRain from '../components/MoneyRain';

// Background Image
const BackgroundImage = () => {
  return (
    <div
      className="absolute inset-0 bg-cover bg-center z-0"
      style={{
        backgroundImage: "url('/assets/troll-city-background.jpg')",
      }}
    />
  );
};

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!user) navigate("/login", { replace: true });
  }, [user, navigate]);

  const showOverlay = !user || !profile;

  const isAdmin = hasRole(profile as any, UserRole.ADMIN);
  const isOfficer = hasRole(profile as any, [UserRole.TROLL_OFFICER, UserRole.LEAD_TROLL_OFFICER], {
    allowAdminOverride: true,
  });

  const compact = pathname.startsWith("/watch") || pathname.startsWith("/pods");

  return (
    <div className="relative h-[100dvh] flex flex-col pb-[env(safe-area-inset-bottom)]">
      <BackgroundImage />
      <CoinRain />
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 border-b border-white/10 bg-black/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.3em] text-white/40">Troll City</div>
            <div className={compact ? "text-base font-bold text-white truncate" : "text-lg font-bold text-white"}>
              {compact ? "Live" : "Mobile Control Center"}
            </div>
            {!compact && <div className="text-xs text-white/60 mt-1">All your tools in one mobile view.</div>}
          </div>

          <div className="flex flex-col items-end text-right shrink-0">
            <div className="text-sm font-semibold text-white truncate max-w-[140px]">
              {profile?.username || profile?.email || "User"}
            </div>

            <div className="flex items-center gap-1 text-[11px] text-white/50">
              {isAdmin ? (
                <>
                  <Crown className="w-3 h-3 text-yellow-400" />
                  <span>Admin</span>
                </>
              ) : isOfficer ? (
                <>
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span>Officer</span>
                </>
              ) : (
                <span>Viewer</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain [WebkitOverflowScrolling:touch] pb-24">
        {children}
      </div>

      {showOverlay && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/70 z-50">
          <div className="animate-pulse">Loading...</div>
        </div>
      )}
    </div>
  );
}
