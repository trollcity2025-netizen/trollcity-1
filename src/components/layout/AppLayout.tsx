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
import { toast } from 'sonner'


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
  const { openChatBubble, isOpen } = useChatStore()
  const isAuthPage = location.pathname.startsWith('/auth');
  const isLivePage = location.pathname.startsWith('/live/') || location.pathname.startsWith('/broadcast/');
  const isKeyboardVisible = false;

  // Setup global message notifications
  useEffect(() => {
    if (!user?.id) return
    
    const cleanup = setupGlobalMessageNotifications(
      user.id,
      (senderId, senderUsername, senderAvatar, isOpsMessage) => {
        // Don't auto-open if bubble already open
        if (isOpen) return
        
        // Show toast notification
        if (isOpsMessage) {
          toast.info(`🛡️ Officer Operations: New message from ${senderUsername}`, {
            duration: 4000,
            action: {
              label: 'Open',
              onClick: () => openChatBubble(OFFICER_GROUP_CONVERSATION_ID, '🛡️ Officer Operations', null)
            }
          })
          // Auto-open OPS bubble
          openChatBubble(OFFICER_GROUP_CONVERSATION_ID, '🛡️ Officer Operations', null)
        } else {
          toast.info(`💬 New message from ${senderUsername}`, {
            duration: 4000,
            action: {
              label: 'Open',
              onClick: () => openChatBubble(senderId, senderUsername, senderAvatar)
            }
          })
          // Auto-open DM bubble
          openChatBubble(senderId, senderUsername, senderAvatar)
        }
      }
    )
    
    return cleanup
  }, [user?.id, isOpen, openChatBubble])

  useEffect(() => {
    if (typeof window === 'undefined') return;
  }, []);

  const effectiveShowSidebar = showSidebar && showLegacySidebar && !isAuthPage && !isLivePage;
  const effectiveShowHeader = showHeader && !isAuthPage && !isLivePage;
  const effectiveShowBottomNav = showBottomNav && !isAuthPage;
  const mainPaddingClass = effectiveShowBottomNav ? 'app-content app-content--with-nav' : 'app-content app-content--no-nav';

  return (
    <div className="app-viewport w-screen overflow-hidden text-white flex relative">
      <PurchaseRequiredModal />
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
        <main className={`flex-1 w-full h-full relative overflow-x-hidden scrollbar-thin scrollbar-thumb-purple-900/50 scrollbar-track-transparent ${mainPaddingClass}`}>
          {children}
        </main>

        {/* Mobile Bottom Navigation - Fixed at bottom */}
        {effectiveShowBottomNav && !isKeyboardVisible && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-30">
            <BottomNavigation />
          </div>
        )}

        {/* Global Chat Bubble */}
        <ChatBubble />
      </div>
    </div>
  )
}
