// Entrance Effects System
// Permanent purchases with activation/deactivation and stream entrance animations

import { supabase } from './supabase';
import { runStandardPurchaseFlow } from './purchases';

export interface EntranceEffect {
  id: string
  name: string
  icon: string
  description: string
  coin_cost: number
  rarity: string
  animation_type: string
  image_url: string
  category: string
}

export const ENTRANCE_EFFECTS_DATA: EntranceEffect[] = [
  // 💃 FEMALE-STYLE ENTRANCE EFFECTS
  { id: 'effect_soft_glow', name: 'Soft Glow', icon: '✨', description: 'Subtle pink/purple glow fade-in', coin_cost: 100, rarity: 'Common', animation_type: 'soft_glow', category: 'female_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=soft%20pink%20glow%20aura&image_size=square' },
  { id: 'effect_spark_step', name: 'Spark Step', icon: '👠', description: 'Small sparkles appear with footsteps', coin_cost: 250, rarity: 'Common', animation_type: 'spark_step', category: 'female_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=sparkles%20footsteps%20neon&image_size=square' },
  { id: 'effect_heart_drift', name: 'Heart Drift', icon: '💖', description: 'Floating hearts dissolve upward', coin_cost: 400, rarity: 'Common', animation_type: 'heart_drift', category: 'female_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=floating%20hearts%20neon&image_size=square' },
  { id: 'effect_rose_petals', name: 'Rose Petals', icon: '🌹', description: 'Rose petals fall briefly', coin_cost: 650, rarity: 'Uncommon', animation_type: 'rose_petals', category: 'female_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=falling%20rose%20petals&image_size=square' },
  { id: 'effect_lip_gloss_flash', name: 'Lip Gloss Flash', icon: '💄', description: 'Light shimmer flash on entrance', coin_cost: 900, rarity: 'Uncommon', animation_type: 'lip_gloss_flash', category: 'female_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=shimmer%20flash%20glitter&image_size=square' },
  { id: 'effect_halo_pop', name: 'Halo Pop', icon: '😇', description: 'Thin halo appears then fades', coin_cost: 1200, rarity: 'Rare', animation_type: 'halo_pop', category: 'female_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=angel%20halo%20glowing&image_size=square' },
  { id: 'effect_crown_flicker', name: 'Crown Flicker', icon: '👑', description: 'Crown outline flickers once', coin_cost: 2000, rarity: 'Rare', animation_type: 'crown_flicker', category: 'female_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=crown%20outline%20neon&image_size=square' },
  { id: 'effect_diamond_drop', name: 'Diamond Drop', icon: '💎', description: 'Single diamond falls and shatters', coin_cost: 3500, rarity: 'Epic', animation_type: 'diamond_drop', category: 'female_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=diamond%20falling%20shatter&image_size=square' },
  { id: 'effect_runway_light', name: 'Runway Light', icon: '🔦', description: 'Spotlight sweep across avatar', coin_cost: 5000, rarity: 'Epic', animation_type: 'runway_light', category: 'female_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=spotlight%20runway%20beam&image_size=square' },
  { id: 'effect_queen_arrival', name: 'Queen Arrival', icon: '👸', description: 'Gold crown + applause sound', coin_cost: 10000, rarity: 'Legendary', animation_type: 'queen_arrival', category: 'female_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=queen%20arrival%20gold%20crown&image_size=square' },

  // 🕺 MALE-STYLE ENTRANCE EFFECTS
  { id: 'effect_shadow_step', name: 'Shadow Step', icon: '🌑', description: 'Dark shadow ripple', coin_cost: 100, rarity: 'Common', animation_type: 'shadow_step', category: 'male_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=shadow%20ripple%20dark&image_size=square' },
  { id: 'effect_bass_thump', name: 'Bass Thump', icon: '🔊', description: 'Low bass pulse effect', coin_cost: 250, rarity: 'Common', animation_type: 'bass_thump', category: 'male_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=bass%20pulse%20shockwave&image_size=square' },
  { id: 'effect_smoke_fade', name: 'Smoke Fade', icon: '💨', description: 'Smoke clears around avatar', coin_cost: 500, rarity: 'Uncommon', animation_type: 'smoke_fade', category: 'male_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=smoke%20clearing%20dark&image_size=square' },
  { id: 'effect_power_stance', name: 'Power Stance', icon: '💥', description: 'Ground shock ring', coin_cost: 800, rarity: 'Uncommon', animation_type: 'power_stance', category: 'male_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=ground%20shock%20ring%20cracks&image_size=square' },
  { id: 'effect_neon_outline', name: 'Neon Outline', icon: '👤', description: 'Neon body outline flicker', coin_cost: 1200, rarity: 'Rare', animation_type: 'neon_outline', category: 'male_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=neon%20body%20outline%20blue&image_size=square' },
  { id: 'effect_ember_sparks', name: 'Ember Sparks', icon: '🔥', description: 'Red embers float upward', coin_cost: 2000, rarity: 'Rare', animation_type: 'ember_sparks', category: 'male_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=red%20embers%20floating&image_size=square' },
  { id: 'effect_thunder_crack', name: 'Thunder Crack', icon: '⚡', description: 'Lightning crack sound', coin_cost: 3500, rarity: 'Epic', animation_type: 'thunder_crack', category: 'male_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=lightning%20bolt%20crack&image_size=square' },
  { id: 'effect_alpha_entry', name: 'Alpha Entry', icon: '🦁', description: 'Heavy stomp + glow', coin_cost: 5000, rarity: 'Epic', animation_type: 'alpha_entry', category: 'male_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=heavy%20stomp%20impact%20glow&image_size=square' },
  { id: 'effect_kingpin_walk', name: 'Kingpin Walk', icon: '🕴️', description: 'Red carpet roll-out', coin_cost: 7500, rarity: 'Legendary', animation_type: 'kingpin_walk', category: 'male_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=red%20carpet%20rollout&image_size=square' },
  { id: 'effect_apex_arrival', name: 'Apex Arrival', icon: '👑', description: 'Full cinematic pause', coin_cost: 10000, rarity: 'Legendary', animation_type: 'apex_arrival', category: 'male_style', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=cinematic%20spotlight%20arrival&image_size=square' },

  // 🔧 MECHANICS / BUILDERS
  { id: 'effect_wrench_pop', name: 'Wrench Pop', icon: '🔧', description: 'Floating wrench spins', coin_cost: 100, rarity: 'Common', animation_type: 'wrench_pop', category: 'mechanics', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=floating%20wrench%20tool&image_size=square' },
  { id: 'effect_metal_sparks', name: 'Metal Sparks', icon: '✨', description: 'Welding sparks', coin_cost: 300, rarity: 'Common', animation_type: 'metal_sparks', category: 'mechanics', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=welding%20sparks%20bright&image_size=square' },
  { id: 'effect_oil_drip', name: 'Oil Drip', icon: '🛢️', description: 'Oil splash animation', coin_cost: 600, rarity: 'Uncommon', animation_type: 'oil_drip', category: 'mechanics', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=oil%20splash%20black&image_size=square' },
  { id: 'effect_tool_belt', name: 'Tool Belt', icon: '🛠️', description: 'Tool icons appear', coin_cost: 900, rarity: 'Uncommon', animation_type: 'tool_belt', category: 'mechanics', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=tools%20icons%20floating&image_size=square' },
  { id: 'effect_engine_rev', name: 'Engine Rev', icon: '⚙️', description: 'Engine rev sound', coin_cost: 1500, rarity: 'Rare', animation_type: 'engine_rev', category: 'mechanics', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=engine%20piston%20moving&image_size=square' },
  { id: 'effect_piston_slam', name: 'Piston Slam', icon: '🔨', description: 'Piston stomp', coin_cost: 2500, rarity: 'Rare', animation_type: 'piston_slam', category: 'mechanics', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=mechanical%20piston%20slam&image_size=square' },
  { id: 'effect_garage_lights', name: 'Garage Lights', icon: '💡', description: 'Fluorescent flicker', coin_cost: 4000, rarity: 'Epic', animation_type: 'garage_lights', category: 'mechanics', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=fluorescent%20lights%20flicker&image_size=square' },
  { id: 'effect_industrial_fog', name: 'Industrial Fog', icon: '🌫️', description: 'Thick workshop fog', coin_cost: 6000, rarity: 'Epic', animation_type: 'industrial_fog', category: 'mechanics', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=industrial%20fog%20steam&image_size=square' },
  { id: 'effect_master_mechanic', name: 'Master Mechanic', icon: '👨‍🔧', description: 'Full shop animation', coin_cost: 10000, rarity: 'Legendary', animation_type: 'master_mechanic', category: 'mechanics', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=mechanic%20workshop%20scene&image_size=square' },

  // 🌿 STONERS / CHILL VIBES
  { id: 'effect_smoke_puff', name: 'Smoke Puff', icon: '☁️', description: 'Soft cloud puff', coin_cost: 100, rarity: 'Common', animation_type: 'smoke_puff', category: 'stoners', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=soft%20smoke%20puff&image_size=square' },
  { id: 'effect_green_drift', name: 'Green Drift', icon: '🍃', description: 'Green mist', coin_cost: 300, rarity: 'Common', animation_type: 'green_drift', category: 'stoners', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=green%20mist%20haze&image_size=square' },
  { id: 'effect_ember_glow', name: 'Ember Glow', icon: '🔥', description: 'Warm ember aura', coin_cost: 600, rarity: 'Uncommon', animation_type: 'ember_glow', category: 'stoners', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=warm%20ember%20glow&image_size=square' },
  { id: 'effect_calm_waves', name: 'Calm Waves', icon: '🌊', description: 'Slow wave distortion', coin_cost: 1000, rarity: 'Uncommon', animation_type: 'calm_waves', category: 'stoners', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=calm%20waves%20distortion&image_size=square' },
  { id: 'effect_bong_bubble', name: 'Bong Bubble', icon: '🫧', description: 'Bubble pop effect', coin_cost: 1500, rarity: 'Rare', animation_type: 'bong_bubble', category: 'stoners', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=bubbles%20rising%20water&image_size=square' },
  { id: 'effect_psy_ripple', name: 'Psy Ripple', icon: '🌀', description: 'Psychedelic ripple', coin_cost: 2500, rarity: 'Rare', animation_type: 'psy_ripple', category: 'stoners', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=psychedelic%20ripple%20colors&image_size=square' },
  { id: 'effect_zen_entrance', name: 'Zen Entrance', icon: '🧘', description: 'Ambient chime + fade', coin_cost: 4000, rarity: 'Epic', animation_type: 'zen_entrance', category: 'stoners', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=zen%20garden%20peaceful&image_size=square' },
  { id: 'effect_cosmic_chill', name: 'Cosmic Chill', icon: '🌌', description: 'Nebula overlay', coin_cost: 7000, rarity: 'Epic', animation_type: 'cosmic_chill', category: 'stoners', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=nebula%20space%20stars&image_size=square' },
  { id: 'effect_high_ascension', name: 'High Ascension', icon: '🚀', description: 'Full slow-motion float', coin_cost: 10000, rarity: 'Legendary', animation_type: 'high_ascension', category: 'stoners', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=floating%20ascension%20clouds&image_size=square' },

  // 🍻 DRINKERS / PARTY
  { id: 'effect_ice_clink', name: 'Ice Clink', icon: '🧊', description: 'Ice sound', coin_cost: 100, rarity: 'Common', animation_type: 'ice_clink', category: 'drinkers', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=ice%20cubes%20glass&image_size=square' },
  { id: 'effect_beer_foam', name: 'Beer Foam', icon: '🍺', description: 'Foam splash', coin_cost: 300, rarity: 'Common', animation_type: 'beer_foam', category: 'drinkers', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=beer%20foam%20splash&image_size=square' },
  { id: 'effect_glass_raise', name: 'Glass Raise', icon: '🥂', description: 'Toast animation', coin_cost: 600, rarity: 'Uncommon', animation_type: 'glass_raise', category: 'drinkers', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=toasting%20glasses%20cheers&image_size=square' },
  { id: 'effect_neon_bar', name: 'Neon Bar', icon: '🍸', description: 'Bar light flicker', coin_cost: 1000, rarity: 'Uncommon', animation_type: 'neon_bar', category: 'drinkers', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=neon%20bar%20sign&image_size=square' },
  { id: 'effect_whiskey_smoke', name: 'Whiskey Smoke', icon: '🥃', description: 'Barrel smoke', coin_cost: 2000, rarity: 'Rare', animation_type: 'whiskey_smoke', category: 'drinkers', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=whiskey%20glass%20smoke&image_size=square' },
  { id: 'effect_party_flash', name: 'Party Flash', icon: '🎉', description: 'Strobe pulse', coin_cost: 3500, rarity: 'Rare', animation_type: 'party_flash', category: 'drinkers', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=disco%20strobe%20lights&image_size=square' },
  { id: 'effect_club_drop', name: 'Club Drop', icon: '🎧', description: 'DJ bass hit', coin_cost: 5000, rarity: 'Epic', animation_type: 'club_drop', category: 'drinkers', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=dj%20turntable%20bass&image_size=square' },
  { id: 'effect_vip_bottle', name: 'VIP Bottle', icon: '🍾', description: 'Bottle spark spray', coin_cost: 7500, rarity: 'Epic', animation_type: 'vip_bottle', category: 'drinkers', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=champagne%20bottle%20sparkler&image_size=square' },
  { id: 'effect_nightlife_king', name: 'Nightlife King', icon: '🕺', description: 'Full club entrance', coin_cost: 10000, rarity: 'Legendary', animation_type: 'nightlife_king', category: 'drinkers', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=nightclub%20entrance%20vip&image_size=square' },

  // 🚗 CAR ENTHUSIASTS
  { id: 'effect_tire_smoke', name: 'Tire Smoke', icon: '💨', description: 'Tire smoke puff', coin_cost: 100, rarity: 'Common', animation_type: 'tire_smoke', category: 'cars', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=tire%20smoke%20burnout&image_size=square' },
  { id: 'effect_rev_start', name: 'Rev Start', icon: '🏎️', description: 'Engine rev', coin_cost: 300, rarity: 'Common', animation_type: 'rev_start', category: 'cars', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=car%20engine%20revving&image_size=square' },
  { id: 'effect_neon_underglow', name: 'Neon Underglow', icon: '🚘', description: 'Underglow effect', coin_cost: 700, rarity: 'Uncommon', animation_type: 'neon_underglow', category: 'cars', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=car%20neon%20underglow&image_size=square' },
  { id: 'effect_burnout_ring', name: 'Burnout Ring', icon: '🍩', description: 'Burnout animation', coin_cost: 1500, rarity: 'Uncommon', animation_type: 'burnout_ring', category: 'cars', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=car%20burnout%20circle&image_size=square' },
  { id: 'effect_gear_shift', name: 'Gear Shift', icon: '🕹️', description: 'Gear click sound', coin_cost: 2500, rarity: 'Rare', animation_type: 'gear_shift', category: 'cars', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=gear%20stick%20shift&image_size=square' },
  { id: 'effect_turbo_blowoff', name: 'Turbo Blowoff', icon: '🐌', description: 'Turbo burst', coin_cost: 3500, rarity: 'Rare', animation_type: 'turbo_blowoff', category: 'cars', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=turbo%20charger%20flame&image_size=square' },
  { id: 'effect_drift_slide', name: 'Drift Slide', icon: '🛞', description: 'Sliding motion', coin_cost: 5000, rarity: 'Epic', animation_type: 'drift_slide', category: 'cars', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=car%20drifting%20sideways&image_size=square' },
  { id: 'effect_garage_king', name: 'Garage King', icon: '🏰', description: 'Lift + lights', coin_cost: 7500, rarity: 'Epic', animation_type: 'garage_king', category: 'cars', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=luxury%20garage%20showroom&image_size=square' },
  { id: 'effect_supercar_arrival', name: 'Supercar Arrival', icon: '🏁', description: 'Cinematic rev', coin_cost: 10000, rarity: 'Legendary', animation_type: 'supercar_arrival', category: 'cars', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=supercar%20cinematic%20lights&image_size=square' },

  // 🐾 ANIMAL LOVERS
  { id: 'effect_paw_prints', name: 'Paw Prints', icon: '🐾', description: 'Paw trail', coin_cost: 100, rarity: 'Common', animation_type: 'paw_prints', category: 'animals', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=paw%20prints%20trail&image_size=square' },
  { id: 'effect_bird_chirp', name: 'Bird Chirp', icon: '🐦', description: 'Bird sound', coin_cost: 300, rarity: 'Common', animation_type: 'bird_chirp', category: 'animals', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=singing%20bird%20note&image_size=square' },
  { id: 'effect_cat_stretch', name: 'Cat Stretch', icon: '🐱', description: 'Cat animation', coin_cost: 600, rarity: 'Uncommon', animation_type: 'cat_stretch', category: 'animals', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=cat%20stretching%20silhouette&image_size=square' },
  { id: 'effect_puppy_hop', name: 'Puppy Hop', icon: '🐶', description: 'Dog hop', coin_cost: 900, rarity: 'Uncommon', animation_type: 'puppy_hop', category: 'animals', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=happy%20puppy%20jumping&image_size=square' },
  { id: 'effect_wing_flutter', name: 'Wing Flutter', icon: '🦋', description: 'Wings briefly', coin_cost: 1500, rarity: 'Rare', animation_type: 'wing_flutter', category: 'animals', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=butterfly%20wings%20flutter&image_size=square' },
  { id: 'effect_wolf_howl', name: 'Wolf Howl', icon: '🐺', description: 'Howl sound', coin_cost: 2500, rarity: 'Rare', animation_type: 'wolf_howl', category: 'animals', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=wolf%20howling%20moon&image_size=square' },
  { id: 'effect_eagle_glide', name: 'Eagle Glide', icon: '🦅', description: 'Shadow flyover', coin_cost: 4000, rarity: 'Epic', animation_type: 'eagle_glide', category: 'animals', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=eagle%20shadow%20flying&image_size=square' },
  { id: 'effect_spirit_animal', name: 'Spirit Animal', icon: '🦌', description: 'Aura animal', coin_cost: 7000, rarity: 'Epic', animation_type: 'spirit_animal', category: 'animals', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=glowing%20spirit%20animal&image_size=square' },
  { id: 'effect_natures_chosen', name: 'Nature’s Chosen', icon: '🌿', description: 'Full wildlife scene', coin_cost: 10000, rarity: 'Legendary', animation_type: 'natures_chosen', category: 'animals', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=nature%20forest%20animals&image_size=square' },

  // 💰 MONEY MAKERS / HUSTLERS
  { id: 'effect_coin_drop', name: 'Coin Drop', icon: '🪙', description: 'Coins fall', coin_cost: 100, rarity: 'Common', animation_type: 'coin_drop', category: 'money', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=falling%20gold%20coins&image_size=square' },
  { id: 'effect_cash_flash', name: 'Cash Flash', icon: '💵', description: 'Dollar flash', coin_cost: 300, rarity: 'Common', animation_type: 'cash_flash', category: 'money', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=dollar%20bill%20flash&image_size=square' },
  { id: 'effect_money_rain', name: 'Money Rain', icon: '🌧️', description: 'Bills rain', coin_cost: 800, rarity: 'Uncommon', animation_type: 'money_rain', category: 'money', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=raining%20money%20bills&image_size=square' },
  { id: 'effect_gold_ring', name: 'Gold Ring', icon: '💍', description: 'Gold ripple', coin_cost: 1500, rarity: 'Uncommon', animation_type: 'gold_ring', category: 'money', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=gold%20ring%20ripple&image_size=square' },
  { id: 'effect_credit_swipe', name: 'Credit Swipe', icon: '💳', description: 'Swipe sound', coin_cost: 2500, rarity: 'Rare', animation_type: 'credit_swipe', category: 'money', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=credit%20card%20swipe&image_size=square' },
  { id: 'effect_vault_pop', name: 'Vault Pop', icon: '🏦', description: 'Vault door', coin_cost: 4000, rarity: 'Rare', animation_type: 'vault_pop', category: 'money', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=bank%20vault%20opening&image_size=square' },
  { id: 'effect_diamond_stack', name: 'Diamond Stack', icon: '💎', description: 'Diamond stack', coin_cost: 6000, rarity: 'Epic', animation_type: 'diamond_stack', category: 'money', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=stack%20of%20diamonds&image_size=square' },
  { id: 'effect_wealth_aura', name: 'Wealth Aura', icon: '🌟', description: 'Gold aura', coin_cost: 7500, rarity: 'Epic', animation_type: 'wealth_aura', category: 'money', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=golden%20aura%20glow&image_size=square' },
  { id: 'effect_boss_entrance', name: 'Boss Entrance', icon: '🕴️', description: 'Full wealth display', coin_cost: 10000, rarity: 'Legendary', animation_type: 'boss_entrance', category: 'money', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=boss%20wealth%20luxury&image_size=square' },

  // 🏳️‍🌈 PRIDE
  { id: 'effect_rainbow_pulse', name: 'Rainbow Pulse', icon: '🌈', description: 'Quick rainbow glow ripple', coin_cost: 100, rarity: 'Common', animation_type: 'rainbow_pulse', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=rainbow%20ripple%20pulse&image_size=square' },
  { id: 'effect_pride_spark', name: 'Pride Spark', icon: '✨', description: 'Multicolor spark pop', coin_cost: 200, rarity: 'Common', animation_type: 'pride_spark', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=multicolor%20sparks%20fireworks&image_size=square' },
  { id: 'effect_color_drift', name: 'Color Drift', icon: '🎨', description: 'Soft pride mist fade', coin_cost: 350, rarity: 'Common', animation_type: 'color_drift', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=colorful%20mist%20fade&image_size=square' },
  { id: 'effect_flag_trail', name: 'Flag Trail', icon: '🏳️‍🌈', description: 'Faint pride color trail', coin_cost: 500, rarity: 'Uncommon', animation_type: 'flag_trail', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=pride%20flag%20trail&image_size=square' },
  { id: 'effect_pride_outline', name: 'Pride Outline', icon: '👤', description: 'Rainbow outline flicker', coin_cost: 750, rarity: 'Uncommon', animation_type: 'pride_outline', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=rainbow%20body%20outline&image_size=square' },
  { id: 'effect_love_is_love', name: 'Love Is Love', icon: '❤️', description: 'Heart + rainbow shimmer', coin_cost: 1000, rarity: 'Rare', animation_type: 'love_is_love', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=heart%20rainbow%20shimmer&image_size=square' },
  { id: 'effect_unity_glow', name: 'Unity Glow', icon: '🌟', description: 'Smooth multicolor aura', coin_cost: 1500, rarity: 'Rare', animation_type: 'unity_glow', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=multicolor%20aura%20glow&image_size=square' },
  { id: 'effect_spectrum_wave', name: 'Spectrum Wave', icon: '🌊', description: 'Horizontal color wave', coin_cost: 2000, rarity: 'Rare', animation_type: 'spectrum_wave', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=color%20spectrum%20wave&image_size=square' },
  { id: 'effect_trans_light', name: 'Trans Light', icon: '🏳️‍⚧️', description: 'Trans-flag gradient flash', coin_cost: 1000, rarity: 'Rare', animation_type: 'trans_light', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=trans%20flag%20gradient%20light&image_size=square' },
  { id: 'effect_identity_bloom', name: 'Identity Bloom', icon: '🌸', description: 'Soft pastel burst', coin_cost: 1800, rarity: 'Epic', animation_type: 'identity_bloom', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=pastel%20flower%20burst&image_size=square' },
  { id: 'effect_affirmation_rise', name: 'Affirmation Rise', icon: '🕊️', description: 'Upward glow + chime', coin_cost: 2500, rarity: 'Epic', animation_type: 'affirmation_rise', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=upward%20glow%20light&image_size=square' },
  { id: 'effect_pride_crown', name: 'Pride Crown', icon: '👑', description: 'Rainbow crown appears once', coin_cost: 3500, rarity: 'Legendary', animation_type: 'pride_crown', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=rainbow%20crown%20neon&image_size=square' },
  { id: 'effect_spectrum_aura', name: 'Spectrum Aura', icon: '💫', description: 'Continuous color cycle', coin_cost: 5000, rarity: 'Legendary', animation_type: 'spectrum_aura', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=color%20cycle%20aura&image_size=square' },
  { id: 'effect_unity_entrance', name: 'Unity Entrance', icon: '🤝', description: 'Flags blend into glow', coin_cost: 7500, rarity: 'Legendary', animation_type: 'unity_entrance', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=blending%20flags%20glow&image_size=square' },
  { id: 'effect_pride_icon', name: 'Pride Icon', icon: '🏆', description: 'Cinematic rainbow arrival', coin_cost: 10000, rarity: 'Mythic', animation_type: 'pride_icon', category: 'pride', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=cinematic%20rainbow%20arrival&image_size=square' },

  // 🎉 HOLIDAY & SEASONAL
  // Halloween
  { id: 'effect_bat_flick', name: 'Bat Flick', icon: '🦇', description: 'Bats fly out', coin_cost: 100, rarity: 'Common', animation_type: 'bat_flick', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=flying%20bats%20silhouette&image_size=square' },
  { id: 'effect_spooky_fog', name: 'Spooky Fog', icon: '🌫️', description: 'Purple fog', coin_cost: 300, rarity: 'Common', animation_type: 'spooky_fog', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=purple%20fog%20mist&image_size=square' },
  { id: 'effect_pumpkin_pop', name: 'Pumpkin Pop', icon: '🎃', description: 'Pumpkin burst', coin_cost: 600, rarity: 'Uncommon', animation_type: 'pumpkin_pop', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=exploding%20pumpkin&image_size=square' },
  { id: 'effect_ghost_glide', name: 'Ghost Glide', icon: '👻', description: 'Ghost passes through', coin_cost: 1200, rarity: 'Rare', animation_type: 'ghost_glide', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=ghost%20floating%20transparent&image_size=square' },
  { id: 'effect_haunted_arrival', name: 'Haunted Arrival', icon: '🏚️', description: 'Full spooky scene', coin_cost: 5000, rarity: 'Epic', animation_type: 'haunted_arrival', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=haunted%20house%20scene&image_size=square' },
  { id: 'effect_nightmare_king', name: 'Nightmare King', icon: '🧛', description: 'Cinematic horror entrance', coin_cost: 10000, rarity: 'Legendary', animation_type: 'nightmare_king', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=horror%20villain%20entrance&image_size=square' },
  // Christmas
  { id: 'effect_snow_dust', name: 'Snow Dust', icon: '❄️', description: 'Snowflakes', coin_cost: 100, rarity: 'Common', animation_type: 'snow_dust', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=falling%20snowflakes&image_size=square' },
  { id: 'effect_bell_jingle', name: 'Bell Jingle', icon: '🔔', description: 'Bell sound', coin_cost: 300, rarity: 'Common', animation_type: 'bell_jingle', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=christmas%20bells&image_size=square' },
  { id: 'effect_candy_cane', name: 'Candy Cane', icon: '🍭', description: 'Cane spin', coin_cost: 600, rarity: 'Uncommon', animation_type: 'candy_cane', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=candy%20cane%20spinning&image_size=square' },
  { id: 'effect_gift_drop', name: 'Gift Drop', icon: '🎁', description: 'Present drops', coin_cost: 1200, rarity: 'Rare', animation_type: 'gift_drop', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=falling%20gift%20box&image_size=square' },
  { id: 'effect_santa_spark', name: 'Santa Spark', icon: '🎅', description: 'Festive glow', coin_cost: 3500, rarity: 'Epic', animation_type: 'santa_spark', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=red%20green%20sparkles&image_size=square' },
  { id: 'effect_winter_royal', name: 'Winter Royal', icon: '👑', description: 'Full holiday scene', coin_cost: 10000, rarity: 'Legendary', animation_type: 'winter_royal', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=winter%20wonderland%20throne&image_size=square' },
  // New Year
  { id: 'effect_countdown_pop', name: 'Countdown Pop', icon: '⏱️', description: '“3-2-1” flash', coin_cost: 200, rarity: 'Common', animation_type: 'countdown_pop', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=countdown%20numbers%20neon&image_size=square' },
  { id: 'effect_firework_spark', name: 'Firework Spark', icon: '🎆', description: 'Small fireworks', coin_cost: 600, rarity: 'Uncommon', animation_type: 'firework_spark', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=small%20fireworks&image_size=square' },
  { id: 'effect_confetti_burst', name: 'Confetti Burst', icon: '🎊', description: 'Confetti blast', coin_cost: 1200, rarity: 'Rare', animation_type: 'confetti_burst', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=confetti%20explosion&image_size=square' },
  { id: 'effect_champagne_spray', name: 'Champagne Spray', icon: '🍾', description: 'Bottle pop', coin_cost: 2500, rarity: 'Epic', animation_type: 'champagne_spray', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=champagne%20spray&image_size=square' },
  { id: 'effect_midnight_moment', name: 'Midnight Moment', icon: '🕛', description: 'Clock + fireworks', coin_cost: 5000, rarity: 'Legendary', animation_type: 'midnight_moment', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=midnight%20clock%20fireworks&image_size=square' },
  { id: 'effect_new_era', name: 'New Era', icon: '🌟', description: 'Cinematic celebration', coin_cost: 10000, rarity: 'Mythic', animation_type: 'new_era', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=new%20year%20celebration%20cinematic&image_size=square' },
  // Valentine's
  { id: 'effect_rose_float', name: 'Rose Float', icon: '🌹', description: 'Roses drift', coin_cost: 200, rarity: 'Common', animation_type: 'rose_float', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=floating%20roses&image_size=square' },
  { id: 'effect_heart_pop', name: 'Heart Pop', icon: '💖', description: 'Heart burst', coin_cost: 500, rarity: 'Uncommon', animation_type: 'heart_pop', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=exploding%20hearts&image_size=square' },
  { id: 'effect_cupid_shot', name: 'Cupid Shot', icon: '💘', description: 'Arrow flies', coin_cost: 1000, rarity: 'Rare', animation_type: 'cupid_shot', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=cupid%20arrow%20flying&image_size=square' },
  { id: 'effect_love_aura', name: 'Love Aura', icon: '💓', description: 'Pink glow', coin_cost: 2000, rarity: 'Epic', animation_type: 'love_aura', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=pink%20love%20aura&image_size=square' },
  { id: 'effect_sweet_arrival', name: 'Sweet Arrival', icon: '🍫', description: 'Romantic entry', coin_cost: 5000, rarity: 'Legendary', animation_type: 'sweet_arrival', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=romantic%20scene%20pink&image_size=square' },
  { id: 'effect_eternal_love', name: 'Eternal Love', icon: '💍', description: 'Full love scene', coin_cost: 10000, rarity: 'Mythic', animation_type: 'eternal_love', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=wedding%20scene%20romantic&image_size=square' },
  // 4th of July
  { id: 'effect_sparkler', name: 'Sparkler', icon: '🎇', description: 'Sparkler effect', coin_cost: 100, rarity: 'Common', animation_type: 'sparkler', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=handheld%20sparkler&image_size=square' },
  { id: 'effect_firecracker', name: 'Firecracker', icon: '🧨', description: 'Small bang', coin_cost: 400, rarity: 'Uncommon', animation_type: 'firecracker', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=exploding%20firecracker&image_size=square' },
  { id: 'effect_flag_wave', name: 'Flag Wave', icon: '🇺🇸', description: 'Flag ripple', coin_cost: 900, rarity: 'Rare', animation_type: 'flag_wave', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=waving%20american%20flag&image_size=square' },
  { id: 'effect_freedom_glow', name: 'Freedom Glow', icon: '🗽', description: 'Red/white/blue glow', coin_cost: 2000, rarity: 'Epic', animation_type: 'freedom_glow', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=red%20white%20blue%20glow&image_size=square' },
  { id: 'effect_liberty_burst', name: 'Liberty Burst', icon: '🎆', description: 'Fireworks', coin_cost: 5000, rarity: 'Legendary', animation_type: 'liberty_burst', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=statue%20of%20liberty%20fireworks&image_size=square' },
  { id: 'effect_independence_legend', name: 'Independence Legend', icon: '🦅', description: 'Full patriotic scene', coin_cost: 10000, rarity: 'Mythic', animation_type: 'independence_legend', category: 'seasonal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=patriotic%20eagle%20flag&image_size=square' },

  // KEEPING LEGACY ITEMS FOR COMPATIBILITY (marked with 'legacy' category if needed, or mapped to closest new one)
  { id: 'effect_flame_burst', name: 'Flame Burst', icon: '🔥', description: 'Enter with a burst of flames', coin_cost: 500, rarity: 'Rare', animation_type: 'flame', category: 'legacy', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=fire%20burst&image_size=square' },
  { id: 'effect_money_shower', name: 'Money Shower', icon: '💸', description: 'Rain money when you arrive', coin_cost: 1500, rarity: 'Epic', animation_type: 'money_shower', category: 'legacy', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=money%20rain&image_size=square' },
  { id: 'effect_electric_flash', name: 'Electric Flash', icon: '⚡', description: 'Electric lightning entrance', coin_cost: 2800, rarity: 'Epic', animation_type: 'electric', category: 'legacy', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=electric%20flash&image_size=square' },
  { id: 'effect_royal_throne', name: 'Royal Throne', icon: '👑', description: 'Descend on a royal throne', coin_cost: 5200, rarity: 'Legendary', animation_type: 'throne', category: 'legacy', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=royal%20throne&image_size=square' },
  { id: 'effect_rainbow_descent', name: 'Rainbow Descent', icon: '🌈', description: 'Arrive on a rainbow', coin_cost: 8500, rarity: 'Legendary', animation_type: 'rainbow', category: 'legacy', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=rainbow%20descent&image_size=square' },
  { id: 'effect_troll_rollup', name: 'Troll Roll-Up', icon: '🚗', description: 'Drive in with style', coin_cost: 12000, rarity: 'Mythic', animation_type: 'car', category: 'legacy', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=troll%20car&image_size=square' },
  { id: 'effect_vip_siren', name: 'VIP Siren Rush', icon: '🚨', description: 'VIP siren announcement', coin_cost: 25000, rarity: 'Mythic', animation_type: 'siren', category: 'legacy', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=police%20siren&image_size=square' },
  { id: 'effect_firework', name: 'Firework Explosion', icon: '🎆', description: 'Explode onto the scene', coin_cost: 50000, rarity: 'Mythic', animation_type: 'firework', category: 'legacy', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=firework%20explosion&image_size=square' },
  { id: 'effect_troll_king', name: 'Troll King Arrival', icon: '🤴', description: 'Ultimate king entrance', coin_cost: 100000, rarity: 'Exclusive', animation_type: 'king', category: 'legacy', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=troll%20king&image_size=square' },
];

export const ENTRANCE_EFFECTS_CONFIG = ENTRANCE_EFFECTS_DATA.reduce((acc, effect) => {
  acc[effect.id] = {
    name: effect.name,
    cost: effect.coin_cost,
    rarity: effect.rarity,
    description: effect.description,
    animationType: effect.animation_type,
    soundEffect: 'default', // Placeholder, would need to map these properly
    durationSeconds: 4
  };
  return acc;
}, {} as Record<string, any>);

export const ENTRANCE_EFFECTS_MAP = ENTRANCE_EFFECTS_DATA.reduce((acc, effect) => {
  acc[effect.id] = effect;
  return acc;
}, {} as Record<string, EntranceEffect>);

export type EntranceEffectKey = keyof typeof ENTRANCE_EFFECTS_CONFIG | string;

/**
 * Unified effect configuration type
 */
export interface EffectConfig {
  name: string;
  description: string;
  animationType: string;
  soundEffect: string;
  durationSeconds: number;
  priority?: number;
  cost?: number;
  rarity?: string;
  imageUrl?: string;
}

/**
 * Get the fully resolved entrance effect for a user (checking specific -> role -> active)
 */
export async function getUserEntranceEffect(userId: string): Promise<{ config: EffectConfig | null }> {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, username, active_entrance_effect')
      .eq('id', userId)
      .single();

    if (!profile) return { config: null };

    // 1. User Specific
    if (profile.username && USER_SPECIFIC_ENTRANCE_EFFECTS[profile.username]) {
      return { config: USER_SPECIFIC_ENTRANCE_EFFECTS[profile.username] };
    }

    // 2. Role Based
    if (profile.role && ROLE_BASED_ENTRANCE_EFFECTS[profile.role]) {
      return { config: ROLE_BASED_ENTRANCE_EFFECTS[profile.role] };
    }

    // 3. Purchased/Active
    if (profile.active_entrance_effect && ENTRANCE_EFFECTS_MAP[profile.active_entrance_effect]) {
        const effect = ENTRANCE_EFFECTS_MAP[profile.active_entrance_effect];
        return {
            config: {
                name: effect.name,
                description: effect.description,
                animationType: effect.animation_type,
                soundEffect: 'default',
                durationSeconds: 4,
                cost: effect.coin_cost,
                rarity: effect.rarity,
                imageUrl: effect.image_url
            }
        };
    }

    return { config: null };
  } catch (e) {
    console.error('Error getting user entrance effect:', e);
    return { config: null };
  }
}

/**
 * Role-based entrance effects - automatically triggered based on user role
 * These are not purchasable and override any purchased effects
 */
export const ROLE_BASED_ENTRANCE_EFFECTS: Record<string, EffectConfig> = {
  'admin': {
    name: 'Troll City CEO',
    description: 'Troll City CEO storms the screen with trolls and city lights',
    animationType: 'troll_city_ceo',
    soundEffect: 'city_siren',
    durationSeconds: 8,
    priority: 100
  },
  'secretary': {
    name: 'Cash Flow Entrance',
    description: 'Make it rain!',
    animationType: 'secretary_money',
    soundEffect: 'coins',
    durationSeconds: 5,
    priority: 85
  },
  'lead_troll_officer': {
    name: 'Presidential Salute',
    description: 'Hail to the Chief',
    animationType: 'lead_officer_presidential',
    soundEffect: 'elite_command',
    durationSeconds: 6,
    priority: 90
  },
  'troll_officer': {
    name: 'Police Raid',
    description: 'Freeze! Troll Police!',
    animationType: 'officer_police',
    soundEffect: 'elite_command',
    durationSeconds: 4,
    priority: 80
  }
};

/**
 * User-specific entrance effects - overrides everything else
 */
export const USER_SPECIFIC_ENTRANCE_EFFECTS: Record<string, EffectConfig> = {
  'JustK': {
    name: 'The Matrix Architect',
    description: 'Welcome to the real world.',
    animationType: 'matrix_theme',
    soundEffect: 'divine_bass',
    durationSeconds: 8,
    priority: 200
  },
  'Mitzie': {
    name: 'Feline Queen Arrival',
    description: 'Purr-fect entrance!',
    animationType: 'cat_theme',
    soundEffect: 'magical',
    durationSeconds: 6,
    priority: 200
  }
};

export type RoleBasedEffectKey = keyof typeof ROLE_BASED_ENTRANCE_EFFECTS;

/**
 * Check if user owns a specific entrance effect
 */
export async function userOwnsEntranceEffect(userId: string, effectKey: EntranceEffectKey): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_entrance_effects')
      .select('id')
      .eq('user_id', userId)
      .eq('effect_id', effectKey)
      .maybeSingle();

    if (error) {
      console.error('Error checking effect ownership:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('Error checking entrance effect ownership:', err);
    return false;
  }
}

/**
 * Get all entrance effects owned by a user
 */
export async function getUserOwnedEffects(userId: string): Promise<EntranceEffectKey[]> {
  try {
    const { data, error } = await supabase
      .from('user_entrance_effects')
      .select('effect_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching owned effects:', error);
      return [];
    }

    return data?.map(item => item.effect_id as EntranceEffectKey) || [];
  } catch (err) {
    console.error('Error getting user owned effects:', err);
    return [];
  }
}

/**
 * Get user's active entrance effect
 */
export async function getUserActiveEffect(userId: string): Promise<EntranceEffectKey | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('active_entrance_effect')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching active effect:', error);
      return null;
    }

    return data?.active_entrance_effect as EntranceEffectKey || null;
  } catch (err) {
    console.error('Error getting user active effect:', err);
    return null;
  }
}

/**
 * Purchase an entrance effect
 */
export async function purchaseEntranceEffect(userId: string, effectKey: EntranceEffectKey): Promise<{success: boolean, error?: string}> {
  try {
    const effectConfig = ENTRANCE_EFFECTS_CONFIG[effectKey];
    if (!effectConfig) {
      return { success: false, error: 'Invalid entrance effect' };
    }

    // Check if user already owns it
    const alreadyOwns = await userOwnsEntranceEffect(userId, effectKey);
    if (alreadyOwns) {
      return { success: true, error: 'Already owned' };
    }

    // Check if user has enough coins
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return { success: false, error: 'User profile not found' };
    }

    if ((userProfile.troll_coins || 0) < effectConfig.cost) {
      return { success: false, error: 'Not enough Troll Coins' };
    }

    const purchasedAt = new Date().toISOString();

    const flowResult = await runStandardPurchaseFlow({
      userId,
      amount: effectConfig.cost,
      transactionType: 'entrance_effect',
      description: `Purchased ${effectConfig.name} entrance effect`,
      metadata: {
        effect_id: effectKey,
        effect_name: effectConfig.name
      },
      ensureOwnership: async (client) => {
        const { error: insertError } = await client
          .from('user_entrance_effects')
          .insert({
            user_id: userId,
            effect_id: effectKey,
            purchased_at: purchasedAt
          });

        if (insertError) {
          console.error('Effect ownership error:', insertError);
          await client.rpc('add_coins', {
            p_user_id: userId,
            p_amount: effectConfig.cost,
            p_coin_type: 'paid'
          });
          return { success: false, error: 'Failed to add effect ownership' };
        }

        return { success: true };
      }
    });

    if (!flowResult.success) {
      return { success: false, error: flowResult.error || 'Purchase failed' };
    }

    return { success: true };

  } catch (err) {
    console.error('Entrance effect purchase error:', err);
    return { success: false, error: 'Purchase failed' };
  }
}

/**
 * Set active entrance effect for a user
 */
export async function setActiveEntranceEffect(userId: string, effectKey: EntranceEffectKey | null): Promise<{success: boolean, error?: string}> {
  try {
    // If setting an effect, verify ownership
    if (effectKey) {
      const ownsEffect = await userOwnsEntranceEffect(userId, effectKey);
      if (!ownsEffect) {
        return { success: false, error: 'Effect not owned' };
      }
    }

    // Update active effect using RPC to ensure consistency across all tables
    const { error } = await supabase.rpc('set_active_entrance_effect', {
      p_effect_id: effectKey,
      p_item_type: 'effect'
    });

    if (error) {
      console.error('Error setting active effect:', error);
      return { success: false, error: 'Failed to set active effect' };
    }

    return { success: true };

  } catch (err) {
    console.error('Error setting active entrance effect:', err);
    return { success: false, error: 'Failed to update active effect' };
  }
}

export async function toggleEntranceEffectByUuid(userId: string, itemUuid: string, active: boolean): Promise<{success: boolean, error?: string}> {
  try {
    const { error } = await supabase.rpc('toggle_entrance_effect', {
      p_user_id: userId,
      p_item_id: itemUuid,
      p_active: active
    })
    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to toggle effect' }
  }
}

/**
 * Get entrance effect configuration
 */
export function getEntranceEffectConfig(effectKey: EntranceEffectKey): EffectConfig {
  return ENTRANCE_EFFECTS_CONFIG[effectKey] as EffectConfig;
}

/**
 * Get role-based entrance effect configuration
 */
export function getRoleBasedEffectConfig(role: string): EffectConfig | null {
  return ROLE_BASED_ENTRANCE_EFFECTS[role] || null;
}

/**
 * Determine which entrance effect to play for a user
 * Priority: Role-based effects > Purchased active effects > None
 */
export async function getUserEntranceEffect(userId: string): Promise<{
  effectKey: EntranceEffectKey | RoleBasedEffectKey | null;
  isRoleBased: boolean;
  config: any;
}> {
  try {
    // First check user's role for role-based effects
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (userProfile?.role && ROLE_BASED_ENTRANCE_EFFECTS[userProfile.role as RoleBasedEffectKey]) {
      const roleEffect = ROLE_BASED_ENTRANCE_EFFECTS[userProfile.role as RoleBasedEffectKey];
      return {
        effectKey: userProfile.role as RoleBasedEffectKey,
        isRoleBased: true,
        config: roleEffect
      };
    }

    // Fall back to purchased active effect
    const activeEffect = await getUserActiveEffect(userId);
    if (activeEffect) {
      return {
        effectKey: activeEffect,
        isRoleBased: false,
        config: getEntranceEffectConfig(activeEffect)
      };
    }

    return { effectKey: null, isRoleBased: false, config: null };
  } catch (err) {
    console.error('Error determining user entrance effect:', err);
    return { effectKey: null, isRoleBased: false, config: null };
  }
}

/**
 * Get all available entrance effects
 */
export function getAllEntranceEffects() {
  return ENTRANCE_EFFECTS_DATA;
}

/**
 * Check if user can afford an entrance effect
 */
export async function canAffordEntranceEffect(userId: string, effectKey: EntranceEffectKey): Promise<boolean> {
  try {
    const effectConfig = ENTRANCE_EFFECTS_CONFIG[effectKey];
    if (!effectConfig) return false;

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', userId)
      .single();

    return (userProfile?.troll_coins || 0) >= effectConfig.cost;
  } catch (err) {
    console.error('Error checking affordability:', err);
    return false;
  }
}

/**
 * Trigger entrance effect for user entering a room/stream
 * Automatically determines the appropriate effect based on role hierarchy
 */
export async function triggerUserEntranceEffect(userId: string, targetElement?: HTMLElement): Promise<void> {
  try {
    const { effectKey, isRoleBased } = await getUserEntranceEffect(userId);

    if (effectKey) {
      // Import the animation function dynamically to avoid circular imports
      const { playEntranceAnimation } = await import('./entranceAnimations');
      await playEntranceAnimation(userId, effectKey, targetElement);

      console.log(`🎪 Triggered ${isRoleBased ? 'role-based' : 'purchased'} entrance effect: ${effectKey} for user ${userId}`);
    }
  } catch (err) {
    console.error('Error triggering entrance effect:', err);
  }
}
