import React, { useState, useEffect } from 'react';
import { usePWA } from '../../contexts/PWAContext';
import { Download, X, Share2, Smartphone, PlusSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface InstallPromptProps {
  className?: string;
  variant?: 'banner' | 'modal' | 'minimal';
}

export function InstallPrompt({ className = '', variant = 'banner' }: InstallPromptProps) {
  const {
    canInstall,
    isInstalled,
    isIOS,
    isSafari,
    promptInstall,
    showIOSInstallInstructions,
    dismissIOSInstructions
  } = usePWA();
  
  const [isVisible, setIsVisible] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  
  useEffect(() => {
    // Don't show if already installed
    if (isInstalled) {
      setIsVisible(false);
      return;
    }
    
    // Show prompt after a delay
    const timer = setTimeout(() => {
      // Check if user has dismissed before
      const dismissed = localStorage.getItem('install_prompt_dismissed');
      const dismissedCount = parseInt(localStorage.getItem('install_prompt_dismiss_count') || '0', 10);
      
      // Don't show if dismissed 3+ times
      if (dismissedCount >= 3) return;
      
      // Don't show if dismissed in the last 3 days
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10);
        const threeDays = 3 * 24 * 60 * 60 * 1000;
        if (Date.now() - dismissedTime < threeDays) return;
      }
      
      // Show for Android/Chrome with install prompt
      if (canInstall) {
        setIsVisible(true);
        return;
      }
      
      // Show iOS instructions
      if (isIOS && isSafari && showIOSInstallInstructions) {
        setShowIOSModal(true);
      }
    }, 5000); // Show after 5 seconds
    
    return () => clearTimeout(timer);
  }, [canInstall, isInstalled, isIOS, isSafari, showIOSInstallInstructions]);
  
  const handleDismiss = () => {
    setIsVisible(false);
    
    // Track dismissals
    const dismissedCount = parseInt(localStorage.getItem('install_prompt_dismiss_count') || '0', 10);
    localStorage.setItem('install_prompt_dismiss_count', (dismissedCount + 1).toString());
    localStorage.setItem('install_prompt_dismissed', Date.now().toString());
  };
  
  const handleInstall = async () => {
    const result = await promptInstall();
    
    if (result === 'accepted') {
      setIsVisible(false);
      // Clear dismissal tracking on successful install
      localStorage.removeItem('install_prompt_dismissed');
      localStorage.removeItem('install_prompt_dismiss_count');
    }
  };
  
  const handleIOSDismiss = () => {
    setShowIOSModal(false);
    dismissIOSInstructions();
  };
  
  // Don't render if not applicable
  if (isInstalled) return null;
  
  // Banner variant
  if (variant === 'banner') {
    return (
      <>
        <AnimatePresence>
          {isVisible && canInstall && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className={`fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-violet-900 via-purple-900 to-violet-900 text-white shadow-lg ${className}`}
            >
              <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <Smartphone className="h-8 w-8 text-purple-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        Install Troll City for the best experience
                      </p>
                      <p className="text-xs text-purple-200">
                        Get notifications, offline access & instant loading
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 ml-4">
                    <button
                      onClick={handleInstall}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Install
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="p-2 text-purple-300 hover:text-white transition-colors"
                      aria-label="Dismiss"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* iOS Install Modal */}
        <IOSInstallModal 
          isOpen={showIOSModal} 
          onClose={handleIOSDismiss} 
        />
      </>
    );
  }
  
  // Modal variant
  if (variant === 'modal') {
    return (
      <>
        <AnimatePresence>
          {isVisible && canInstall && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0A0814] border border-purple-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl"
              >
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
                    <Smartphone className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Install Troll City
                  </h3>
                  <p className="text-gray-400 mb-6">
                    Add Troll City to your home screen for instant access, push notifications, and offline features.
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={handleInstall}
                      className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all"
                    >
                      <Download className="h-5 w-5 mr-2" />
                      Install Now
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="w-full px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                    >
                      Maybe Later
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <IOSInstallModal 
          isOpen={showIOSModal} 
          onClose={handleIOSDismiss} 
        />
      </>
    );
  }
  
  // Minimal variant - just a small button
  return (
    <>
      {canInstall && (
        <button
          onClick={handleInstall}
          className={`inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors ${className}`}
        >
          <PlusSquare className="h-4 w-4 mr-1.5" />
          Install App
        </button>
      )}
      
      <IOSInstallModal 
        isOpen={showIOSModal} 
        onClose={handleIOSDismiss} 
      />
    </>
  );
}

// ===== iOS INSTALL MODAL =====

interface IOSInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function IOSInstallModal({ isOpen, onClose }: IOSInstallModalProps) {
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#0A0814] border border-purple-500/30 rounded-2xl max-w-sm w-full p-6 shadow-2xl"
        >
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-2">
              Install Troll City
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              Install this app on your iPhone for the best experience
            </p>
            
            <div className="space-y-4 text-left bg-purple-500/10 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  1
                </div>
                <div className="flex items-center text-gray-300">
                  <span>Tap the</span>
                  <Share2 className="h-5 w-5 mx-2 text-blue-400" />
                  <span>Share button</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  2
                </div>
                <div className="flex items-center text-gray-300">
                  <span>Scroll and tap</span>
                  <span className="mx-2 font-semibold text-white">"Add to Home Screen"</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  3
                </div>
                <span className="text-gray-300">Tap "Add" in the top right</span>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="w-full px-4 py-3 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              Got it
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ===== OFFLINE BANNER =====

export function OfflineBanner() {
  const { networkState, wasOffline } = usePWA();
  const [showOffline, setShowOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);
  
  useEffect(() => {
    if (!networkState.isOnline) {
      setShowOffline(true);
      setShowBackOnline(false);
    } else if (wasOffline && networkState.isOnline) {
      setShowOffline(false);
      setShowBackOnline(true);
      
      // Hide "back online" after 3 seconds
      const timer = setTimeout(() => {
        setShowBackOnline(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [networkState.isOnline, wasOffline]);
  
  return (
    <>
      <AnimatePresence>
        {showOffline && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-100"></span>
              </span>
              <span className="text-sm font-medium">
                You are offline. Some features may be limited.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showBackOnline && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white px-4 py-2"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-center">
              <span className="text-sm font-medium">
                Back online! Syncing your data...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ===== UPDATE AVAILABLE BANNER =====

export function UpdateBanner() {
  const { swState, updateApp } = usePWA();
  
  if (!swState.isUpdateAvailable) return null;
  
  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-4 left-4 right-4 z-50 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl shadow-xl p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">Update Available</p>
          <p className="text-sm text-purple-100">A new version of Troll City is ready</p>
        </div>
        <button
          onClick={updateApp}
          className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-500 transition-colors"
        >
          Update Now
        </button>
      </div>
    </motion.div>
  );
}

// ===== CONNECTION STATUS INDICATOR =====

export function ConnectionStatus() {
  const { connectionHealth } = usePWA();
  
  const statusConfig = {
    healthy: { color: 'bg-green-500', label: 'Connected' },
    degraded: { color: 'bg-yellow-500', label: 'Slow Connection' },
    disconnected: { color: 'bg-red-500', label: 'Reconnecting...' }
  };
  
  const config = statusConfig[connectionHealth];
  
  if (connectionHealth === 'healthy') return null;
  
  return (
    <div className="flex items-center space-x-2 px-3 py-1 bg-black/50 rounded-full">
      <span className={`w-2 h-2 rounded-full ${config.color} animate-pulse`} />
      <span className="text-xs text-gray-400">{config.label}</span>
    </div>
  );
}

export default InstallPrompt;
