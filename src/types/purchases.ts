// Type definitions for purchase and activation system

export type ItemType = 'effect' | 'perk' | 'insurance' | 'ringtone' | 'theme' | 'clothing' | 'call_minutes';
export type ItemCategory = 'entrance_effect' | 'perk' | 'insurance' | 'audio_ringtone' | 'video_ringtone' | 'broadcast_theme' | 'avatar_clothing';
export type ClothingCategory = 'head' | 'body' | 'legs' | 'feet' | 'accessories';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface UserPurchase {
  id: string;
  user_id: string;
  item_type: ItemType;
  item_id: string;
  item_name: string;
  purchase_price: number;
  is_active: boolean;
  purchased_at: string;
  expires_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UserActiveItem {
  id: string;
  user_id: string;
  item_category: ItemCategory;
  item_id: string;
  activated_at: string;
}

export interface TrollMartClothing {
  id: string;
  name: string;
  category: ClothingCategory;
  item_code: string;
  price_coins: number;
  image_url: string | null;
  model_url: string | null;
  description: string | null;
  rarity: Rarity;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface UserAvatarCustomization {
  id: string;
  user_id: string;
  head_item_id: string | null;
  face_item_id: string | null;
  body_item_id: string | null;
  legs_item_id: string | null;
  feet_item_id: string | null;
  accessories_ids: string[] | null;
  skin_tone: string | null;
  hair_color: string | null;
  beard_style: string | null;
  avatar_config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UserTrollMartPurchase {
  id: string;
  user_id: string;
  clothing_id: string;
  purchased_at: string;
}

export interface AvatarConfig {
  baseModel: string;
  head: string;
  face: string;
  body: string;
  legs: string;
  feet: string;
  accessories: string[];
  skinTone: string;
  hairColor: string;
  beardStyle?: string;
  customizations?: Record<string, any>;
}

export interface PurchaseActivationOptions {
  autoActivate?: boolean;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}
