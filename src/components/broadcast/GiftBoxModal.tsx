import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Gift, Sparkles, Crown, Gem, Zap, Heart, Users, UserCircle, Radio } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useGiftSystem, GiftItem } from '../../hooks/useGiftSystem';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

export type GiftTargetType = 'broadcaster' | 'all' | 'specific';

export interface GiftTarget {
  type: GiftTargetType;
  userId?: string;
  username?: string;
  quantity?: number;
}

interface GiftBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  streamId: string;
  broadcasterId?: string;
  activeUserIds?: string[];
  userProfiles?: Record<string, { username: string; avatar_url?: string }>;
  onGiftSent?: (gift: GiftItem, target: GiftTarget) => void;
  sharedChannel?: any; // Supabase realtime channel for broadcasting gifts
}

type GiftCategory = 'all' | 'general' | 'cars' | 'houses' | 'boats' | 'planes' | 'luxury' | 'men' | 'women' | 'lgbt' | 'holiday' | 'smoking' | 'drinking' | 'funny' | 'seasonal';

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

const CATEGORIES: { id: GiftCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <Gift size={16} /> },
  { id: 'general', label: 'General', icon: <Sparkles size={16} /> },
  { id: 'cars', label: 'Cars', icon: '🏎️' },
  { id: 'houses', label: 'Houses', icon: '🏠' },
  { id: 'boats', label: 'Boats', icon: '🛥️' },
  { id: 'planes', label: 'Planes', icon: '✈️' },
  { id: 'luxury', label: 'Luxury', icon: <Crown size={16} /> },
  { id: 'men', label: 'Men', icon: '👨' },
  { id: 'women', label: 'Women', icon: '👩' },
  { id: 'lgbt', label: 'LGBT', icon: '🌈' },
  { id: 'holiday', label: 'Holiday', icon: '🎄' },
  { id: 'smoking', label: 'Smoking', icon: '🚬' },
  { id: 'drinking', label: 'Drinking', icon: '🍺' },
  { id: 'funny', label: 'Funny', icon: '😂' },
  { id: 'seasonal', label: 'Seasonal', icon: '🌸' },
];

const RARITY_COLORS: Record<Rarity, string> = {
  common: 'border-gray-500 bg-gray-500/10',
  uncommon: 'border-green-500 bg-green-500/10',
  rare: 'border-blue-500 bg-blue-500/10',
  epic: 'border-purple-500 bg-purple-500/10',
  legendary: 'border-orange-500 bg-orange-500/10',
  mythic: 'border-yellow-400 bg-yellow-400/20',
};

const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
};

export default function GiftBoxModal({ 
  isOpen, 
  onClose, 
  recipientId, 
  streamId, 
  broadcasterId = recipientId,
  activeUserIds = [],
  userProfiles = {},
  onGiftSent,
  sharedChannel
}: GiftBoxModalProps) {
  const { user, profile } = useAuthStore();
  const { sendGift, isSending } = useGiftSystem(recipientId, streamId, null, undefined, sharedChannel);
  
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<GiftCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  
  // Gift target selection state
  const [giftTarget, setGiftTarget] = useState<GiftTarget>({ type: 'specific', userId: recipientId });

  // Fetch gifts from database
  useEffect(() => {
    if (!isOpen) return;

    const fetchGifts = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('gifts')
          .select('id, name, icon_url, cost, category, rarity, class')
          .eq('is_active', true)
          .order('cost', { ascending: true });

        if (error) throw error;

        // Transform to GiftItem format
        const transformedGifts: GiftItem[] = (data || []).map((g: any) => ({
          id: g.id,
          name: g.name,
          icon: g.icon_url || '🎁',
          coinCost: g.cost || 0,
          type: g.cost > 0 ? 'paid' : 'free',
          slug: g.name.toLowerCase().replace(/\s+/g, '-'),
        }));

        setGifts(transformedGifts);
      } catch (err) {
        console.error('Error fetching gifts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGifts();
  }, [isOpen]);

  // Helper function to get gift category
  const getGiftCategory = (gift: GiftItem): GiftCategory => {
    // This would need to be enriched from the original data
    // For now, we'll try to infer from the gift name/icon
    const nameLower = gift.name.toLowerCase();
    const icon = gift.icon;
    
    if (nameLower.includes('car') || nameLower.includes('lamborghini') || nameLower.includes('ferrari')) return 'cars';
    if (nameLower.includes('house') || nameLower.includes('mansion') || nameLower.includes('castle')) return 'houses';
    if (nameLower.includes('boat') || nameLower.includes('yacht')) return 'boats';
    if (nameLower.includes('plane') || nameLower.includes('jet') || nameLower.includes('helicopter')) return 'planes';
    if (nameLower.includes('crown') || nameLower.includes('diamond') || nameLower.includes('gold')) return 'luxury';
    if (nameLower.includes('cigarette') || nameLower.includes('cigar') || nameLower.includes('smoke')) return 'smoking';
    if (nameLower.includes('beer') || nameLower.includes('wine') || nameLower.includes('champagne')) return 'drinking';
    if (nameLower.includes('clown') || nameLower.includes('meme') || nameLower.includes('troll')) return 'funny';
    if (nameLower.includes('christmas') || nameLower.includes('santa') || nameLower.includes('pumpkin')) return 'holiday';
    if (nameLower.includes('rainbow') || nameLower.includes('pride')) return 'lgbt';
    if (icon === '👨' || nameLower.includes('men') || nameLower.includes('muscle')) return 'men';
    if (icon === '👩' || nameLower.includes('women') || nameLower.includes('dress')) return 'women';
    if (nameLower.includes('sunny') || nameLower.includes('snow') || nameLower.includes('spring')) return 'seasonal';
    
    return 'general';
  };

  // Filter gifts
  const filteredGifts = useMemo(() => {
    let filtered = gifts;

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(g => {
        // Find the gift's category from original data
        const originalGift = gifts.find(gg => gg.id === g.id);
        return originalGift && getGiftCategory(g) === selectedCategory;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(g => 
        g.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [gifts, selectedCategory, searchQuery]);

  const handleSendGift = async () => {
    if (!selectedGift || !user) return;

    try {
      let success = false;
      
      if (giftTarget.type === 'all') {
        // Send to all active users (broadcaster + guests)
        const allRecipients = [broadcasterId, ...activeUserIds.filter(id => id !== broadcasterId)];
        let sentCount = 0;
        
        for (const targetId of allRecipients) {
          if (targetId && targetId !== user.id) {
            const result = await sendGift(selectedGift, targetId, quantity);
            if (result) sentCount++;
          }
        }
        
        success = sentCount > 0;
        if (success) {
          toast.success(`Sent ${quantity}x ${selectedGift.name} to ${sentCount} users!`);
          onGiftSent?.(selectedGift, { type: 'all', quantity });
        }
      } else if (giftTarget.type === 'broadcaster') {
        // Send to broadcaster only
        success = await sendGift(selectedGift, broadcasterId, quantity);
        if (success) {
          // Gift animation disabled per user request
          toast.success(`Sent ${quantity}x ${selectedGift.name} to broadcaster!`);
          onGiftSent?.(selectedGift, { type: 'broadcaster', userId: broadcasterId, quantity });
        }
      } else {
        // Send to specific user
        const targetId = giftTarget.userId || recipientId;
        success = await sendGift(selectedGift, targetId, quantity);
        if (success) {
          // Gift animation disabled per user request
          const targetName = userProfiles[targetId]?.username || 'user';
          toast.success(`Sent ${quantity}x ${selectedGift.name} to ${targetName}!`);
          onGiftSent?.(selectedGift, { type: 'specific', userId: targetId, username: targetName, quantity });
        }
      }
      
      if (success) {
        onClose();
        setSelectedGift(null);
        setQuantity(1);
        setGiftTarget({ type: 'specific', userId: recipientId });
      }
    } catch (err) {
      console.error('Error sending gift:', err);
    }
  };

  const getTotalCost = () => {
    if (!selectedGift) return 0;
    return selectedGift.coinCost * quantity;
  };

  const canAfford = profile && profile.troll_coins >= getTotalCost();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 100 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 100 }}
          className="bg-zinc-900 border-t-2 sm:border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:w-[90vw] max-w-4xl h-[75vh] sm:h-[80vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-white/10 bg-zinc-900/50 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <Gift className="text-yellow-400" size={20} />
              <h2 className="text-base sm:text-xl font-bold text-white">Send Gift</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={20} className="text-zinc-400" />
            </button>
          </div>

          {/* Balance Display */}
          <div className="px-3 sm:px-4 py-2 bg-zinc-800/50 border-b border-white/5 flex items-center justify-between text-xs sm:text-sm flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Balance:</span>
              <span className="text-yellow-400 font-bold">{(profile?.troll_coins || 0).toLocaleString()} 🪙</span>
            </div>
            {selectedGift && (
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Total:</span>
                <span className={cn("font-bold", canAfford ? "text-green-400" : "text-red-400")}>
                  {getTotalCost().toLocaleString()} 🪙
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-1 overflow-hidden flex-col sm:flex-row">
            {/* Categories - horizontal scroll on mobile, sidebar on desktop */}
            <div className="sm:w-48 border-b sm:border-r border-white/10 bg-zinc-900/30 overflow-x-auto overflow-y-hidden sm:overflow-y-auto py-2 flex-shrink-0">
              <div className="flex sm:flex-col gap-1 sm:gap-0 px-2 sm:px-0">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "px-3 py-2 text-left flex items-center gap-2 text-sm transition-colors whitespace-nowrap",
                      selectedCategory === cat.id
                        ? "bg-yellow-500/20 text-yellow-400 border-r-2 sm:border-r-0 sm:border-b-2 border-yellow-500"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <span className="flex-shrink-0">{cat.icon}</span>
                    <span className="hidden sm:inline">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Gift Grid */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search Bar */}
              <div className="p-2 sm:p-4 border-b border-white/5">
                <div className="relative">
                  <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <input
                    type="text"
                    placeholder="Search gifts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-yellow-500"
                  />
                </div>
              </div>

              {/* Gifts */}
              <div className="flex-1 overflow-y-auto p-2 sm:p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
                  </div>
                ) : filteredGifts.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-zinc-500">
                    No gifts found
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                    {filteredGifts.map((gift) => {
                      const isSelected = selectedGift?.id === gift.id;
                      const rarity = getGiftRarity(gift.coinCost);
                      
                      return (
                        <motion.button
                          key={gift.id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedGift(gift)}
                          className={cn(
                            "relative p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all flex flex-col items-center gap-0.5 sm:gap-1",
                            isSelected
                              ? "border-yellow-500 bg-yellow-500/20"
                              : "border-white/10 bg-zinc-800/50 hover:border-white/30",
                            RARITY_COLORS[rarity]
                          )}
                        >
                          <span className="text-2xl sm:text-3xl">{gift.icon}</span>
                          <span className="text-[9px] sm:text-xs text-white font-medium truncate w-full text-center">
                            {gift.name}
                          </span>
                          <span className="text-[10px] sm:text-xs text-yellow-400 font-bold">
                            {gift.coinCost} 🪙
                          </span>
                          
                          {rarity !== 'common' && (
                            <div className={cn(
                              "absolute -top-1 -right-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase",
                              rarity === 'uncommon' && "bg-green-500 text-white",
                              rarity === 'rare' && "bg-blue-500 text-white",
                              rarity === 'epic' && "bg-purple-500 text-white",
                              rarity === 'legendary' && "bg-orange-500 text-white",
                              rarity === 'mythic' && "bg-yellow-400 text-black"
                            )}>
                              {rarity[0].toUpperCase()}
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recipient Selection - Always show when a gift is selected */}
          {selectedGift && (
            <div className="p-2 sm:p-4 border-t border-white/10 bg-zinc-900/50 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <UserCircle size={16} sm:size={18} className="text-yellow-400" />
                <span className="text-xs sm:text-sm font-medium text-white">Send to:</span>
              </div>
              
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {/* Broadcaster Option */}
                <button
                  onClick={() => setGiftTarget({ type: 'broadcaster', userId: broadcasterId })}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all",
                    giftTarget.type === 'broadcaster'
                      ? "bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400"
                      : "bg-zinc-800 border-2 border-transparent text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  <Radio size={14} sm:size={16} />
                  <span className="hidden sm:inline">B (Broadcaster)</span>
                  <span className="sm:hidden">Broadcaster</span>
                </button>
                
                {/* All Users Option */}
                <button
                  onClick={() => setGiftTarget({ type: 'all' })}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all",
                    giftTarget.type === 'all'
                      ? "bg-purple-500/20 border-2 border-purple-500 text-purple-400"
                      : "bg-zinc-800 border-2 border-transparent text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  <Users size={14} sm:size={16} />
                  <span className="hidden sm:inline">A (All)</span>
                  <span className="sm:hidden">All</span>
                </button>
                
                {/* Specific User Options */}
                {activeUserIds.map((userId) => (
                  <button
                    key={userId}
                    onClick={() => setGiftTarget({ type: 'specific', userId, username: userProfiles[userId]?.username })}
                    className={cn(
                      "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all",
                      giftTarget.type === 'specific' && giftTarget.userId === userId
                        ? "bg-blue-500/20 border-2 border-blue-500 text-blue-400"
                        : "bg-zinc-800 border-2 border-transparent text-zinc-400 hover:bg-zinc-700"
                    )}
                  >
                    <img
                      src={userProfiles[userId]?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfiles[userId]?.username || 'U')}&background=random`}
                      alt=""
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full"
                    />
                    <span className="max-w-[60px] sm:max-w-[100px] truncate">{userProfiles[userId]?.username || 'User'}</span>
                  </button>
                ))}
                
                {/* Current recipient if not in active list */}
                {recipientId !== broadcasterId && !activeUserIds.includes(recipientId) && (
                  <button
                    onClick={() => setGiftTarget({ type: 'specific', userId: recipientId, username: userProfiles[recipientId]?.username })}
                    className={cn(
                      "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all",
                      giftTarget.type === 'specific' && giftTarget.userId === recipientId
                        ? "bg-blue-500/20 border-2 border-blue-500 text-blue-400"
                        : "bg-zinc-800 border-2 border-transparent text-zinc-400 hover:bg-zinc-700"
                    )}
                  >
                    <UserCircle size={14} sm:size={16} />
                    <span className="max-w-[60px] sm:max-w-[100px] truncate">{userProfiles[recipientId]?.username || 'Selected User'}</span>
                  </button>
                )}
              </div>
              
              {giftTarget.type === 'all' && (
                <p className="text-[10px] sm:text-xs text-amber-400 mt-1.5 sm:mt-2">
                  ⚠️ This will send gifts to all users (cost × {1 + activeUserIds.length} users)
                </p>
              )}
            </div>
          )}

          {/* Send Button */}
          {selectedGift && (
            <div className="p-2 sm:p-4 border-t border-white/10 bg-zinc-900/50 flex items-center justify-between gap-2 sm:gap-4 flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="text-zinc-400 text-xs sm:text-sm">Qty:</span>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white flex items-center justify-center text-sm"
                  >
                    -
                  </button>
                  <span className="w-8 sm:w-12 text-center text-white font-bold text-xs sm:text-sm">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(99, quantity + 1))}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white flex items-center justify-center text-sm"
                  >
                    +
                  </button>
                </div>
                
                <button
                  onClick={() => setQuantity(q => Math.min(99, Math.floor((profile?.troll_coins || 0) / selectedGift.coinCost)))}
                  className="px-2 sm:px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg"
                >
                  Max
                </button>
              </div>

              <button
                onClick={handleSendGift}
                disabled={isSending || !canAfford}
                className={cn(
                  "px-4 sm:px-8 py-2 sm:py-3 rounded-xl font-bold flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm transition-all",
                  isSending && "opacity-50",
                  canAfford
                    ? "bg-yellow-500 hover:bg-yellow-400 text-black"
                    : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                )}
              >
                <Gift size={16} sm:size={20} />
                <span className="hidden sm:inline">
                  {activeUserIds.length > 0 ? (
                    giftTarget.type === 'all' ? (
                      `Send to All (${1 + activeUserIds.length})`
                    ) : giftTarget.type === 'broadcaster' ? (
                      'Send to Broadcaster'
                    ) : (
                      `Send ${quantity}x ${selectedGift.name}`
                    )
                  ) : (
                    `Send ${quantity}x ${selectedGift.name}`
                  )}
                </span>
                <span className="sm:hidden">
                  Send {quantity}x
                </span>
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Helper function to determine rarity based on cost
function getGiftRarity(cost: number): Rarity {
  if (cost >= 5000) return 'mythic';
  if (cost >= 2500) return 'legendary';
  if (cost >= 500) return 'epic';
  if (cost >= 100) return 'rare';
  if (cost >= 50) return 'uncommon';
  return 'common';
}
