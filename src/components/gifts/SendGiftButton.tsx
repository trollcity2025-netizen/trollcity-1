import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { GiftCatalogItem, RARITY_COLORS } from '@/types/gifts';
import { sendGift, fetchGiftCatalog, getCoinBalance } from '@/lib/gifts/sendGift';
import { useGiftStore } from '@/lib/stores/useGiftStore';

interface SendGiftButtonProps {
  receiverId: string;
  sessionId?: string;
  variant?: 'icon' | 'button' | 'full';
  className?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export const SendGiftButton: React.FC<SendGiftButtonProps> = ({
  receiverId,
  sessionId,
  variant = 'button',
  className = '',
  onSuccess,
  onError,
}) => {
  const { profile } = useAuthStore();
  const { giftCatalog } = useGiftStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [userCoins, setUserCoins] = useState(0);
  const [selectedGift, setSelectedGift] = useState<GiftCatalogItem | null>(null);
  
  // Load user's coin balance
  useEffect(() => {
    const loadCoins = async () => {
      const coins = await getCoinBalance();
      setUserCoins(coins);
    };
    loadCoins();
  }, []);
  
  // Load gift catalog if not loaded
  useEffect(() => {
    if (giftCatalog.length === 0) {
      fetchGiftCatalog();
    }
  }, [giftCatalog.length]);
  
  const handleSendGift = async () => {
    if (!selectedGift || !profile) return;
    
    setIsSending(true);
    
    try {
      const result = await sendGift(receiverId, selectedGift.id, sessionId);
      
      if (result.success) {
        // Update local coin balance
        setUserCoins(prev => prev - selectedGift.price);
        setSelectedGift(null);
        setIsOpen(false);
        onSuccess?.();
      } else {
        onError?.(result.message);
      }
    } catch (err) {
      onError?.('Failed to send gift');
    } finally {
      setIsSending(false);
    }
  };
  
  // Group gifts by rarity
  const giftsByRarity = giftCatalog.reduce((acc, gift) => {
    if (!acc[gift.rarity]) {
      acc[gift.rarity] = [];
    }
    acc[gift.rarity].push(gift);
    return acc;
  }, {} as Record<string, GiftCatalogItem[]>);
  
  // Icon variant - just a gift button
  if (variant === 'icon') {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`p-2 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 transition-all ${className}`}
        title="Send Gift"
      >
        🎁
      </button>
    );
  }
  
  // Full panel
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white font transition-all shadow-bold rounded-full-lg shadow-yellow-600/30 ${className}`}
      >
        <span>🎁</span>
        <span>Send Gift</span>
        <span className="bg-black/20 px-2 py-0.5 rounded-full text-xs">
          🪙 {userCoins}
        </span>
      </button>
      
      {/* Gift Selection Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-yellow-500/30 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-yellow-500/20">
              <h3 className="text-xl font-bold text-white">Send a Gift</h3>
              <div className="flex items-center gap-2">
                <span className="text-yellow-400">🪙</span>
                <span className="text-white font-bold">{userCoins}</span>
              </div>
            </div>
            
            {/* Selected Gift Preview */}
            {selectedGift && (
              <div className="p-4 bg-gradient-to-r from-yellow-600/20 to-amber-600/20 border-b border-yellow-500/20">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                    style={{ 
                      backgroundColor: `${RARITY_COLORS[selectedGift.rarity]}20`,
                      border: `2px solid ${RARITY_COLORS[selectedGift.rarity]}`
                    }}
                  >
                    🎁
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold">{selectedGift.name}</p>
                    <p className="text-sm" style={{ color: RARITY_COLORS[selectedGift.rarity] }}>
                      {selectedGift.rarity.charAt(0).toUpperCase() + selectedGift.rarity.slice(1)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold text-lg">🪙 {selectedGift.price}</p>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setSelectedGift(null)}
                    className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendGift}
                    disabled={isSending || userCoins < selectedGift.price}
                    className="flex-1 py-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? 'Sending...' : 'Send Gift'}
                  </button>
                </div>
              </div>
            )}
            
            {/* Gift Grid */}
            {!selectedGift && (
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {Object.entries(giftsByRarity).map(([rarity, gifts]) => (
                  <div key={rarity} className="mb-4">
                    <p 
                      className="text-xs font-bold uppercase tracking-wider mb-2"
                      style={{ color: RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] }}
                    >
                      {rarity}
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {gifts.map((gift) => (
                        <button
                          key={gift.id}
                          onClick={() => setSelectedGift(gift)}
                          disabled={userCoins < gift.price}
                          className={`
                            relative p-2 rounded-xl border-2 transition-all
                            ${userCoins >= gift.price 
                              ? 'border-slate-600 hover:border-yellow-500 hover:bg-slate-800 cursor-pointer' 
                              : 'border-slate-800 opacity-50 cursor-not-allowed'
                            }
                          `}
                          style={{
                            borderColor: userCoins >= gift.price ? RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] + '40' : undefined,
                          }}
                        >
                          <div className="text-2xl mb-1">🎁</div>
                          <div className="text-xs text-yellow-400 font-bold">🪙 {gift.price}</div>
                          
                          {/* Not enough coins overlay */}
                          {userCoins < gift.price && (
                            <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                              <span className="text-red-400 text-xs">❌</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Close button */}
            <button
              onClick={() => {
                setIsOpen(false);
                setSelectedGift(null);
              }}
              className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default SendGiftButton;
