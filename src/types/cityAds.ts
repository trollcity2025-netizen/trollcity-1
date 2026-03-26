/**
 * City Ads / Promo System Types
 * Internal Troll City promotional ads
 */

export type AdPlacement = 'left_sidebar_screensaver' | 'right_panel_featured' | 'home_horizontal_banner';

export type CampaignType = 
  | 'troll_coins' 
  | 'trollmonds' 
  | 'go_live' 
  | 'event' 
  | 'feature' 
  | 'limited_offer' 
  | 'announcement';

export interface CityAd {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image_url: string;
  cta_text?: string;
  cta_link?: string;
  placement: AdPlacement;
  is_active: boolean;
  start_at?: string;
  end_at?: string;
  priority: number;
  display_order: number;
  label?: string;
  campaign_type?: CampaignType;
  background_style?: string;
  impressions_count: number;
  clicks_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CityAdFormData {
  title: string;
  subtitle?: string;
  description?: string;
  image_url: string;
  cta_text?: string;
  cta_link?: string;
  placement: AdPlacement;
  is_active: boolean;
  start_at?: string;
  end_at?: string;
  priority: number;
  display_order: number;
  label?: string;
  campaign_type?: CampaignType;
  background_style?: string;
}

export interface CityAdWithCreator extends CityAd {
  creator_username?: string;
}

export const AD_PLACEMENTS: { value: AdPlacement; label: string; description: string }[] = [
  { value: 'left_sidebar_screensaver', label: 'Left Sidebar', description: 'Tall card in empty sidebar area' },
  { value: 'right_panel_featured', label: 'Right Panel', description: 'Large featured card in right panel' },
  { value: 'home_horizontal_banner', label: 'Upper Panel', description: 'Horizontal banner on the home feed' },
];

export const CAMPAIGN_TYPES: { value: CampaignType; label: string }[] = [
  { value: 'troll_coins', label: 'Troll Coins Special' },
  { value: 'trollmonds', label: 'Trollmonds Bundle' },
  { value: 'go_live', label: 'Go Live Promotion' },
  { value: 'event', label: 'Event' },
  { value: 'feature', label: 'Feature Discovery' },
  { value: 'limited_offer', label: 'Limited Offer' },
  { value: 'announcement', label: 'Announcement' },
];

export const DEFAULT_LABELS = [
  'Troll City Promo',
  'Special Offer',
  'Featured',
  'Limited Time',
  'New',
  'Exclusive',
];