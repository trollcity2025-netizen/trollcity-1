import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
      return;
    }

    // Android / Desktop - Capture event
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS Detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Show iOS prompt if on iOS and not standalone (and not dismissed recently?)
    if (isIosDevice && !isStandalone) {
      // Could check local storage to not annoy user every time
      const hasDismissed = localStorage.getItem('ios_install_dismissed');
      if (!hasDismissed) {
         // Wait a bit before showing
         setTimeout(() => setShowIOSPrompt(true), 3000);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isStandalone]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setDeferredPrompt(null);
  };

  const dismissIOS = () => {
    setShowIOSPrompt(false);
    localStorage.setItem('ios_install_dismissed', 'true');
  };

  if (isStandalone) return null;

  return (
    <>
      {/* Android / Chrome Install Button (Floating) */}
      {deferredPrompt && (
        <div className="fixed top-4 right-4 z-[100] animate-bounce-in">
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-full font-bold shadow-lg hover:shadow-purple-500/50 transition-all active:scale-95"
          >
            <Download size={18} />
            Install App
          </button>
        </div>
      )}

      {/* iOS Install Instructions (Bottom Sheet) */}
      {showIOSPrompt && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center pointer-events-none">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={dismissIOS} />
          
          {/* Card */}
          <div className="bg-[#1a1a1a] w-full max-w-md p-6 rounded-t-3xl border-t border-white/10 shadow-2xl pointer-events-auto animate-slide-up pb-10 safe-area-bottom">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-white">Install Troll City</h3>
              <button onClick={dismissIOS} className="p-1 bg-white/10 rounded-full text-white/70 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-white/70 mb-6">
              Install our app for the best experience. It's quick and easy!
            </p>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 text-white">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Share size={24} className="text-blue-400" />
                </div>
                <span>1. Tap the <span className="font-bold">Share</span> button below</span>
              </div>
              <div className="flex items-center gap-4 text-white">
                 <div className="p-2 bg-white/10 rounded-lg">
                  <PlusSquare size={24} className="text-white" />
                </div>
                <span>2. Select <span className="font-bold">Add to Home Screen</span></span>
              </div>
            </div>

            {/* Pointing arrow for Safari bottom bar */}
            <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 translate-y-full text-white/20 animate-bounce">
               ⬇
            </div>
          </div>
        </div>
      )}
    </>
  );
}
