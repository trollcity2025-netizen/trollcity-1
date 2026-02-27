// Live Commerce Types
import { UserProfile } from '../lib/supabase';

export interface BroadcastPinnedProduct {
  id: string;
  stream_id: string;
  product_id: string;
  pinned_by: string | null;
  pinned_at: string;
  is_active: boolean;
  position: number;
  // Joined data
  product?: ShopItem;
}

// Extended type with product data included
export interface PinnedProductWithItem extends BroadcastPinnedProduct {
  product?: ShopItem;
}

export interface ShopItem {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  price: number; // in coins
  image_url: string | null;
  stock_quantity: number | null;
  is_active: boolean;
  created_at: string;
}

export interface ShopOrder {
  id: string;
  order_number: string;
  buyer_id: string;
  seller_id: string;
  shop_id: string;
  status: OrderStatus;
  subtotal: number;
  shipping_cost: number;
  total_coins: number;
  escrow_status: EscrowStatus;
  escrow_released_at: string | null;
  shipping_name: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  tracking_number: string | null;
  carrier: ShippingCarrier | null;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  estimated_delivery: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  completed_at: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  // Joined data
  buyer?: Profile;
  seller?: Profile;
  items?: OrderItem[];
}

export type OrderStatus = 
  | 'pending' 
  | 'paid' 
  | 'processing' 
  | 'shipped' 
  | 'delivered' 
  | 'completed' 
  | 'cancelled' 
  | 'refunded';

export type EscrowStatus = 
  | 'pending' 
  | 'held' 
  | 'released' 
  | 'refunded';

export type ShippingCarrier = 
  | 'usps' 
  | 'ups' 
  | 'fedex' 
  | 'dhl' 
  | 'other';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  // Joined data
  product?: ShopItem;
}

export interface WalletEscrow {
  id: string;
  user_id: string;
  order_id: string;
  amount: number;
  status: 'held' | 'released' | 'refunded';
  created_at: string;
  released_at: string | null;
}

export interface ShippingCarrierInfo {
  id: string;
  name: string;
  tracking_url_template: string;
  is_active: boolean;
}

export type Profile = UserProfile;

// Purchase flow types
export interface PurchaseRequest {
  productId: string;
  quantity: number;
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
}

export interface PurchaseResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

export interface ShipOrderRequest {
  orderId: string;
  trackingNumber: string;
  carrier: ShippingCarrier;
}

// Gift system types
export interface Gift {
  id: string;
  name: string;
  icon_url: string;
  animation_url: string | null;
  cost: number;
  category: GiftCategory;
  rarity: GiftRarity;
  class: string | null;
  is_active: boolean;
  animation_type?: string;
}

export type GiftCategory = 
  | 'general' 
  | 'cars' 
  | 'houses' 
  | 'boats' 
  | 'planes' 
  | 'luxury' 
  | 'men' 
  | 'women' 
  | 'lgbtq' 
  | 'holiday' 
  | 'smoking' 
  | 'drinking' 
  | 'funny' 
  | 'seasonal';

export type GiftRarity = 
  | 'common' 
  | 'uncommon' 
  | 'rare' 
  | 'epic' 
  | 'legendary' 
  | 'mythic';

export type GiftAnimationType = 
  | 'float_up' 
  | 'steam' 
  | 'bounce' 
  | 'crumb' 
  | 'wrapper' 
  | 'pulse' 
  | 'twinkle' 
  | 'slap' 
  | 'wave' 
  | 'tear' 
  | 'cry' 
  | 'horn' 
  | 'poof' 
  | 'hide' 
  | 'smoke' 
  | 'flame' 
  | 'ring' 
  | 'foam' 
  | 'swirl' 
  | 'clink' 
  | 'gulp' 
  | 'bloom' 
  | 'shine' 
  | 'glint' 
  | 'sparkle' 
  | 'refract' 
  | 'flex' 
  | 'explode' 
  | 'rain' 
  | 'fullscreen';

export interface GiftAnimation {
  id: string;
  gift: Gift;
  senderId: string;
  senderName: string;
  receiverId: string;
  quantity: number;
  timestamp: number;
}
