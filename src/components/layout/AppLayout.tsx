import React, { useCallback, useEffect, useRef, useState } from 'react'
import BottomNavigation from '../BottomNavigation'
import Sidebar from '../Sidebar'
import Header from '../Header'
import { useLocation } from 'react-router-dom'
import PWAInstallPrompt from '../PWAInstallPrompt'
import UserCompliancePrompt from '../UserCompliancePrompt'
import PurchaseRequiredModal from '../PurchaseRequiredModal'

interface AppLayoutProps {
  children: React.ReactNode
  showSidebar?: boolean
  showHeader?: boolean
  showBottomNav?: boolean
}

export default function AppLayout({ 
  children, 
  showSidebar = true, 
  showHeader = true, 
  showBottomNav = true 
}: AppLayoutProps) {
  const location = useLocation();
  // Hide UI elements on specific routes if needed, or rely on props
  const isAuthPage = location.pathname.startsWith('/auth');
  const isLivePage = location.pathname.startsWith('/live/') || location.pathname.startsWith('/broadcast/');
  const [showLiveNav, setShowLiveNav] = useState(false);
  const revealTimerRef = useRef<number | null>(null);

  // Overrides based on route
  const effectiveShowSidebar = showSidebar && !isAuthPage && !isLivePage;
  const effectiveShowHeader = showHeader && !isAuthPage && !isLivePage;
  // On Live page, we might want BottomNav on mobile for navigation, but maybe not if it covers controls.
  // User said "Bottom Nav 'SIDEBAR' ... for main pages". Live page is a main page.
  // Let's keep it for now, unless it's the broadcaster view.
  const effectiveShowBottomNav = showBottomNav && !isAuthPage && (!isLivePage || showLiveNav);
  const mainPaddingClass = effectiveShowBottomNav ? 'pb-16 md:pb-0' : 'pb-[env(safe-area-inset-bottom)]';

  const revealLiveNav = useCallback(() => {
    setShowLiveNav(true);
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
    }
    revealTimerRef.current = window.setTimeout(() => {
      setShowLiveNav(false);
    }, 3000);
  }, []);

  useEffect(() => {
    if (!isLivePage) {
      setShowLiveNav(false);
      if (revealTimerRef.current) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    }
  }, [isLivePage]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        window.clearTimeout(revealTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden text-white flex">
      <PurchaseRequiredModal />
      <PWAInstallPrompt />
      {/* Desktop Sidebar - Hidden on Mobile */}
      {effectiveShowSidebar && (
        <div className="hidden md:block w-64 h-full shrink-0 border-r border-white/5 bg-[#0A0814] z-20">
          <Sidebar />
        </div>
      )}

      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Header - Sticky or Fixed */}
        {effectiveShowHeader && (
          <div className="shrink-0 z-20">
            <Header />
          </div>
        )}

        {/* User Compliance Prompt */}
        {!isAuthPage && <UserCompliancePrompt />}

        {/* Main Content Area */}
        <main className={`flex-1 w-full h-full relative overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-purple-900/50 scrollbar-track-transparent ${mainPaddingClass}`}>
          {children}
        </main>

        {isLivePage && !showLiveNav && (
          <button
            type="button"
            onClick={revealLiveNav}
            className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom)+8px)] left-1/2 -translate-x-1/2 z-40 w-14 h-2 rounded-full bg-white/30 backdrop-blur border border-white/20"
            aria-label="Show navigation"
          />
        )}

        {/* Mobile Bottom Navigation - Fixed at bottom */}
        {effectiveShowBottomNav && (
          <div className="md:hidden shrink-0 z-30">
            <BottomNavigation />
          </div>
        )}
      </div>
    </div>
  )
}
