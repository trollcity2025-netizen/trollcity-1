import React from 'react'
import BottomNavigation from '../BottomNavigation'
import Sidebar from '../Sidebar'
import Header from '../Header'
import { useLocation } from 'react-router-dom'

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

  // Overrides based on route
  const effectiveShowSidebar = showSidebar && !isAuthPage && !isLivePage;
  const effectiveShowHeader = showHeader && !isAuthPage;
  // On Live page, we might want BottomNav on mobile for navigation, but maybe not if it covers controls.
  // User said "Bottom Nav 'SIDEBAR' ... for main pages". Live page is a main page.
  // Let's keep it for now, unless it's the broadcaster view.
  const effectiveShowBottomNav = showBottomNav && !isAuthPage;

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#05010a] text-white flex">
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

        {/* Main Content Area */}
        <main className="flex-1 w-full h-full relative overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-purple-900/50 scrollbar-track-transparent">
          {children}
        </main>

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
