import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Gift, Sparkles, Crown, Gem, Zap, Heart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useGiftSystem, GiftItem } from '../../hooks/useGiftSystem';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface GiftBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  streamId: string;
  onGiftSent?: (gift: GiftItem) => void;
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

export default function GiftBoxModal({ isOpen, onClose, recipientId, streamId, onGiftSent }: GiftBoxModalProps) {
  const { user, profile } = useAuthStore();
  const { sendGift, isSending } = useGiftSystem(recipientId, streamId);
  
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<GiftCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

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
      const success = await sendGift(selectedGift, undefined, quantity);
      if (success) {
        toast.success(`Sent ${quantity}x ${selectedGift.name}!`);
        onGiftSent?.(selectedGift);
        onClose();
        setSelectedGift(null);
        setQuantity(1);
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-zinc-900 border border-white/10 rounded-2xl w-[90vw] max-w-4xl h-[80vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <Gift className="text-yellow-400" size={24} />
              <h2 className="text-xl font-bold text-white">Send a Gift</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={20} className="text-zinc-400" />
            </button>
          </div>

          {/* Balance Display */}
          <div className="px-4 py-2 bg-zinc-800/50 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-sm">Your Balance:</span>
              <span className="text-yellow-400 font-bold">{(profile?.troll_coins || 0).toLocaleString()} 🪙</span>
            </div>
            {selectedGift && (
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 text-sm">Total:</span>
                <span className={cn("font-bold", canAfford ? "text-green-400" : "text-red-400")}>
                  {getTotalCost().toLocaleString()} 🪙
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Categories Sidebar */}
            <div className="w-48 border-r border-white/10 bg-zinc-900/30 overflow-y-auto py-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "w-full px-4 py-2 text-left flex items-center gap-2 text-sm transition-colors",
                    selectedCategory === cat.id
                      ? "bg-yellow-500/20 text-yellow-400 border-r-2 border-yellow-500"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Gift Grid */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search Bar */}
              <div className="p-4 border-b border-white/5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    type="text"
                    placeholder="Search gifts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-500"
                  />
                </div>
              </div>

              {/* Gifts */}
              <div className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
                  </div>
                ) : filteredGifts.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-zinc-500">
                    No gifts found
                  </div>
                ) : (
                  <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
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
                            "relative p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1",
                            isSelected
                              ? "border-yellow-500 bg-yellow-500/20"
                              : "border-white/10 bg-zinc-800/50 hover:border-white/30",
                            RARITY_COLORS[rarity]
                          )}
                        >
                          <span className="text-3xl">{gift.icon}</span>
                          <span className="text-xs text-white font-medium truncate w-full text-center">
                            {gift.name}
                          </span>
                          <span className="text-xs text-yellow-400 font-bold">
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

          {/* Send Button */}
          {selectedGift && (
            <div className="p-4 border-t border-white/10 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 text-sm">Quantity:</span>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-white font-bold">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(99, quantity + 1))}
                    className="w-8 h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
                
                <button
                  onClick={() => setQuantity(q => Math.min(99, Math.floor((profile?.troll_coins || 0) / selectedGift.coinCost)))}
                  className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg"
                >
                  Max
                </button>
              </div>

              <button
                onClick={handleSendGift}
                disabled={isSending || !canAfford}
                className={cn(
                  "px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all",
                  canAfford
                    ? "bg-yellow-500 hover:bg-yellow-400 text-black"
                    : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                )}
              >
                {isSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Gift size={20} />
                    Send {quantity}x {selectedGift.name}
                  </>
                )}
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
