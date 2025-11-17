import { notifyGiftReceived } from './notifications';

// Gift catalog: 30 unique gifts with values from 1 to 100,000 coins
// Each gift has: id, name, value (coins), category, icon emoji, emoji-based avatar

export const GIFTS = [
  // Animals (1-1000 coins)
  { id: 'dog', name: 'Dog', value: 10, category: 'animal', emoji: '🐕', color: '#8B4513' },
  { id: 'cat', name: 'Cat', value: 15, category: 'animal', emoji: '🐱', color: '#FF8C00' },
  { id: 'bird', name: 'Bird', value: 5, category: 'animal', emoji: '🦅', color: '#DAA520' },
  { id: 'fish', name: 'Fish', value: 8, category: 'animal', emoji: '🐠', color: '#FF69B4' },
  { id: 'rabbit', name: 'Rabbit', value: 12, category: 'animal', emoji: '🐰', color: '#FFB6C1' },
  { id: 'horse', name: 'Horse', value: 50, category: 'animal', emoji: '🐴', color: '#8B4513' },
  { id: 'lion', name: 'Lion', value: 100, category: 'animal', emoji: '🦁', color: '#FFD700' },
  { id: 'penguin', name: 'Penguin', value: 20, category: 'animal', emoji: '🐧', color: '#000000' },

  // Vehicles & Transport (500-5000 coins)
  { id: 'car', name: 'Sports Car', value: 500, category: 'vehicle', emoji: '🏎️', color: '#FF0000' },
  { id: 'yacht', name: 'Yacht', value: 2000, category: 'vehicle', emoji: '⛵', color: '#4169E1' },
  { id: 'helicopter', name: 'Helicopter', value: 1500, category: 'vehicle', emoji: '🚁', color: '#A9A9A9' },
  { id: 'rocket', name: 'Rocket', value: 5000, category: 'vehicle', emoji: '🚀', color: '#FF6347' },

  // Houses & Property (1000-10000 coins)
  { id: 'house', name: 'House', value: 1000, category: 'property', emoji: '🏠', color: '#DC143C' },
  { id: 'mansion', name: 'Mansion', value: 5000, category: 'property', emoji: '🏰', color: '#FFD700' },
  { id: 'island', name: 'Private Island', value: 10000, category: 'property', emoji: '🏝️', color: '#32CD32' },
  { id: 'castle', name: 'Castle', value: 8000, category: 'property', emoji: '🏯', color: '#D2691E' },

  // Currency & Wealth (100-5000 coins)
  { id: 'coin_bag', name: 'Coin Bag', value: 100, category: 'currency', emoji: '💰', color: '#FFD700' },
  { id: 'money_stack', name: 'Money Stack', value: 500, category: 'currency', emoji: '💵', color: '#228B22' },
  { id: 'diamond', name: 'Diamond', value: 2000, category: 'currency', emoji: '💎', color: '#00CED1' },
  { id: 'gold_bar', name: 'Gold Bar', value: 3000, category: 'currency', emoji: '🏆', color: '#FFD700' },

  // Luxury Items (500-5000 coins)
  { id: 'crown', name: 'Crown', value: 1000, category: 'luxury', emoji: '👑', color: '#FFD700' },
  { id: 'ring', name: 'Diamond Ring', value: 800, category: 'luxury', emoji: '💍', color: '#FF1493' },
  { id: 'watch', name: 'Luxury Watch', value: 1200, category: 'luxury', emoji: '⌚', color: '#C0C0C0' },
  { id: 'champagne', name: 'Champagne', value: 300, category: 'luxury', emoji: '🍾', color: '#FFD700' },

  // Food & Beverage (5-100 coins)
  { id: 'pizza', name: 'Pizza', value: 25, category: 'food', emoji: '🍕', color: '#FF8C00' },
  { id: 'cake', name: 'Cake', value: 30, category: 'food', emoji: '🎂', color: '#FFB6C1' },
  { id: 'burger', name: 'Burger', value: 20, category: 'food', emoji: '🍔', color: '#8B4513' },
  { id: 'troll_gift', name: 'Troll Gift', value: 1, category: 'troll', emoji: '👹', color: '#9370DB' },
];

// Generate random gifts for viewer selection
export function generateRandomGifts(count = 30) {
  // Shuffle all gifts and return requested count
  const shuffled = [...GIFTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, GIFTS.length));
}

// Get gift by ID
export function getGiftById(id) {
  return GIFTS.find(gift => gift.id === id);
}

// Format gift for display
export function formatGift(gift) {
  return {
    ...gift,
    displayName: `${gift.emoji} ${gift.name}`,
    displayValue: `${gift.value} 🪙`,
  };
}

// Create a gift transaction record
export async function recordGiftTransaction(supabase, senderId, receiverId, giftId, streamId) {
  const gift = getGiftById(giftId);
  if (!gift) throw new Error('Gift not found');

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('stream_gifts')
    .insert({
      sender_id: senderId,
      recipient_id: receiverId,
      stream_id: streamId,
      gift_id: giftId,
      gift_name: gift.name,
      coin_value: gift.value,
      created_date: now,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to record gift transaction:', error);
    throw error;
  }

  // Send notification to the recipient
  try {
    await notifyGiftReceived(receiverId, senderId, gift.name, gift.value, streamId);
  } catch (notificationError) {
    console.error('Failed to send gift notification:', notificationError);
    // Don't throw here - gift was successfully recorded even if notification failed
  }

  return data;
}
