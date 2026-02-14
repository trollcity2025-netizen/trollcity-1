import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { Fuel, Plus, ChevronDown } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import GasStationModal from './GasStationModal';
import { useKeyboard } from "../../contexts/KeyboardContext";

export default function GasHUD() {
  const { profile } = useAuthStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [isHudOpen, setIsHudOpen] = useState(true);
  const location = useLocation();
  const { isKeyboardVisible: _isKeyboardVisible } = useKeyboard();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('openGas') === 'true') {
      setModalOpen(true);
    }
  }, [location.search]);

  // Listen for global event to open gas station
  useEffect(() => {
    const handleOpen = () => setModalOpen(true);
    window.addEventListener('open-gas-station', handleOpen);

    const handleKeyDown = (e: KeyboardEvent) => {
        // Use e.code for better reliability (KeyG) or e.key fallback
        if (e.code === 'KeyG' || e.key.toLowerCase() === 'g') {
            const target = e.target as HTMLElement;
            // Check if user is typing in an input, textarea, or contentEditable element
            const isInput = 
                target.tagName === 'INPUT' || 
                target.tagName === 'TEXTAREA' || 
                target.isContentEditable ||
                target.closest('[contenteditable="true"]');
            
            if (!isInput) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                setModalOpen(true);
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('open-gas-station', handleOpen);
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!profile) return null;

  // Hide Gas Bar in Broadcast Room and TrollPod Room (LiveKit pages)
  // Broadcasts are at /broadcast/:id
  // Pods are at /pods/:id (but not /pods listing)
  const isBroadcastRoom = location.pathname.startsWith('/broadcast/') && location.pathname !== '/broadcast/setup' && location.pathname !== '/broadcast/summary';
  const isPodRoom = location.pathname.startsWith('/pods/') && location.pathname.split('/').length > 2;
  // Also hide in TCPS to prevent blocking chat UI
  const isTCPS = location.pathname.startsWith('/tcps');
  // Hide in Mobile Shell to prevent blocking menu buttons
  const _isMobileShell = location.pathname === '/mobile';

  if (isBroadcastRoom || isPodRoom || isTCPS) {
      return null;
  }

  const gas = profile.gas_balance ?? 100;
  const isLow = gas <= 5;

  const isMobile = location.pathname === '/mobile';

  return (
    <>
      <div className={`fixed z-[100] flex items-center gap-2 pointer-events-none ${isMobile ? 'bottom-16 left-4 flex-col' : 'bottom-4 left-1/2 -translate-x-1/2 flex-row'}`}>
         {isHudOpen ? (
           <div className={`pointer-events-auto bg-black/80 backdrop-blur-md border border-white/10 rounded-full p-2 flex items-center gap-3 shadow-xl transition-all duration-300 ${isMobile ? 'flex-col' : 'flex-row px-4 py-2'}`}>
              <Fuel className={`w-5 h-5 ${isLow ? 'text-red-500 animate-pulse' : 'text-blue-400'}`} />
              <div className={`bg-gray-700 rounded-full overflow-hidden ${isMobile ? 'w-2 h-32' : 'w-32 h-2'}`}>
                 <div 
                   className={`transition-all duration-500 ${gas > 50 ? 'bg-green-500' : gas > 20 ? 'bg-yellow-500' : 'bg-red-500'} ${isMobile ? 'w-full' : 'h-full'}`}
                   style={isMobile ? { height: `${Math.max(gas, 0)}%` } : { width: `${Math.max(gas, 0)}%` }}
                 />
              </div>
              <span className="text-xs font-bold text-white">{Math.round(gas)}%</span>
              
              <button 
                onClick={() => setModalOpen(true)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
                title="Refill Gas"
              >
                <Plus className="w-4 h-4 text-green-400" />
              </button>

              <button 
                onClick={() => setIsHudOpen(false)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
                title="Hide Gas HUD"
              >
                <ChevronDown className="w-4 h-4 text-white" />
              </button>
           </div>
         ) : (
            <button 
              onClick={() => setIsHudOpen(true)}
              className="pointer-events-auto bg-black/80 backdrop-blur-md border border-white/10 rounded-full p-3 shadow-xl transition-all duration-300 hover:scale-110"
              title="Show Gas HUD"
            >
              <Fuel className={`w-5 h-5 ${isLow ? 'text-red-500 animate-pulse' : 'text-blue-400'}`} />
            </button>
         )}
      </div>
      
      <GasStationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
