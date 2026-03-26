import { useEffect } from 'react'
import BottomNavigation from '../BottomNavigation'
import Sidebar from '../Sidebar'
import Header from '../Header'
import { useLocation } from 'react-router-dom'
import UserCompliancePrompt from '../UserCompliancePrompt'
import PurchaseRequiredModal from '../PurchaseRequiredModal'
import { useAuthStore } from '../../lib/store'
import { useChatStore } from '../../lib/chatStore'
import { setupGlobalMessageNotifications, OFFICER_GROUP_CONVERSATION_ID } from '../../lib/supabase'
import ChatBubble from '../ChatBubble'
import { useSidebarStore } from '../../stores/useSidebarStore'


import GlobalTicker from '../header/GlobalTicker';

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
  const showLegacySidebar = useAuthStore((s) => s.showLegacySidebar)
  const user = useAuthStore((s) => s.user)
  const { isCollapsed } = useSidebarStore()
  useChatStore()
  const isAuthPage = location.pathname.startsWith('/auth');
  const isLivePage = location.pathname.startsWith('/live/') || (location.pathname.startsWith('/broadcast/') && !location.pathname.startsWith('/broadcast/setup')) || location.pathname.startsWith('/stream/') || location.pathname === '/live-swipe';
  const isKeyboardVisible = false;

  // Setup global message notifications - opens chat bubble when message received
  useEffect(() => {
    if (!user?.id) return
    
    const cleanup = setupGlobalMessageNotifications(
      user.id,
      (senderId, senderUsername, senderAvatar, isOpsMessage, _messageBody) => {
        const { openChatBubble } = useChatStore.getState()
        
        // Open chat bubble directly without toast notification
        if (isOpsMessage) {
          openChatBubble(OFFICER_GROUP_CONVERSATION_ID, '🛡️ Officer Operations', null)
        } else {
          openChatBubble(senderId, senderUsername, senderAvatar)
        }
      }
    )
    
    return cleanup
  }, [user?.id])

  useEffect(() => {
    if (typeof window === 'undefined') return;
  }, []);

  const effectiveShowSidebar = showSidebar && showLegacySidebar && !isAuthPage && !isLivePage;
  const effectiveShowHeader = showHeader && !isAuthPage && !isLivePage;
  const effectiveShowBottomNav = showBottomNav && !isAuthPage && !isLivePage;
  const mainOverflowClass = isLivePage ? 'overflow-hidden' : 'overflow-x-hidden overflow-y-auto scrollbar-thin scrollbar-thumb-purple-900/30 scrollbar-track-transparent';
  const mainPaddingClass = effectiveShowBottomNav && !isLivePage ? 'pb-[calc(var(--bottom-nav-height,64px)+env(safe-area-inset-bottom,0px))]' : '';

  return (
    <div className="app-viewport w-screen h-screen overflow-hidden text-white flex relative">
      <PurchaseRequiredModal />
      {/* Desktop Sidebar - Hidden on Mobile */}
      {effectiveShowSidebar && (
        <div className={`hidden md:block h-full shrink-0 z-20 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
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
        <main className={`flex-1 w-full h-full relative ${mainOverflowClass} ${mainPaddingClass}`}>
          {children}
        </main>

        {/* Bottom Navigation Bubble - Always visible on all screen sizes */}
        {effectiveShowBottomNav && !isKeyboardVisible && (
          <BottomNavigation />
        )}

        {/* Global Chat Bubble */}
        <ChatBubble />
      </div>
    </div>
  )
}
