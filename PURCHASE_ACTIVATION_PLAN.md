# Purchase Activation System & Avatar Customization Plan

## Overview
This document outlines the implementation strategy for:
1. Purchase activation system (for all coin store items)
2. User profile settings to manage purchased items
3. Full avatar customization with Troll Mart integration
4. TrollsTown restoration & sync with TrollCity

---

## Phase 1: Purchase Activation System

### Database Schema Changes

```sql
-- Table: user_purchases (tracks all purchases with activation status)
CREATE TABLE IF NOT EXISTS user_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL, -- 'effect', 'perk', 'insurance', 'ringtone', 'theme', 'clothing'
  item_id VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_active_items (currently active items per category)
CREATE TABLE IF NOT EXISTS user_active_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_category VARCHAR(50) NOT NULL, -- 'entrance_effect', 'ringtone', 'broadcast_theme', etc.
  item_id VARCHAR(255) NOT NULL,
  activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, item_category)
);

-- Table: troll_mart_clothing (avatar customization items)
CREATE TABLE IF NOT EXISTS troll_mart_clothing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'head', 'face', 'body', 'legs', 'feet', 'accessories'
  item_code VARCHAR(50) UNIQUE NOT NULL,
  price_coins INTEGER NOT NULL,
  image_url TEXT,
  model_url TEXT, -- 3D model file
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_avatar_customization (user's avatar setup)
CREATE TABLE IF NOT EXISTS user_avatar_customization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  head_item_id VARCHAR(50),
  face_item_id VARCHAR(50),
  body_item_id VARCHAR(50),
  legs_item_id VARCHAR(50),
  feet_item_id VARCHAR(50),
  accessories_ids TEXT[], -- Array of accessory IDs
  skin_tone VARCHAR(50),
  hair_color VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);
```

### Core Functions

#### 1. Purchase Item (Existing - Enhanced)
```typescript
// File: src/lib/purchases.ts
export async function purchaseItem(
  userId: string,
  itemType: string,
  itemId: string,
  cost: number,
  durationMinutes?: number,
  supabaseClient?: SupabaseClient
) {
  // Deduct coins
  // Create user_purchases record
  // Return purchase confirmation
}
```

#### 2. Activate Item (New)
```typescript
export async function activateItem(
  userId: string,
  itemType: string,
  itemId: string,
  supabaseClient?: SupabaseClient
) {
  // Update user_purchases SET is_active = true
  // For exclusive items (entrance effects), deactivate others
  // Update user_active_items
  // Return activation status
}
```

#### 3. Deactivate Item (New)
```typescript
export async function deactivateItem(
  userId: string,
  itemType: string,
  itemId: string,
  supabaseClient?: SupabaseClient
) {
  // Update user_purchases SET is_active = false
  // Update user_active_items if needed
  // Return deactivation status
}
```

#### 4. Get Active Items (New)
```typescript
export async function getActiveItems(
  userId: string,
  supabaseClient?: SupabaseClient
) {
  // Query user_active_items
  // Return list of active items by category
}
```

---

## Phase 2: Enhanced Coin Store

### Current Purchase Points (Items to Add Activation)

1. **Entrance Effects** - `buyEffect()`
   - File: `src/pages/CoinStore.jsx` line ~450
   - Add activation option after purchase

2. **Perks** - `buyPerk()`
   - File: `src/pages/CoinStore.jsx` line ~498
   - Add auto-activation or manual toggle

3. **Broadcast Themes** - `buyBroadcastTheme()`
   - File: `src/pages/CoinStore.jsx` line ~645
   - Add activation option

4. **Call Sounds/Ringtones** - `buyCallSound()`
   - File: `src/pages/CoinStore.jsx` line ~705
   - Add activation per type (audio/video)

5. **Insurance** - `buyInsurance()`
   - File: `src/pages/CoinStore.jsx` line ~579
   - May auto-activate or need manual activation

6. **Call Minutes** - `buyCallMinutes()`
   - File: `src/pages/CoinStore.jsx` line ~753
   - Adds to balance (no activation needed)

### Changes Required

- Add activation UI to purchase confirmation overlays
- Add "Manage Purchased Items" link to header
- Update each purchase function to create user_purchases record
- Track which items are currently activated

---

## Phase 3: Profile Settings - Purchased Items Management

### New Page: `src/pages/ProfileSettings.tsx`

Features:
```
├── Purchased Items Tab
│   ├── Entrance Effects
│   │   ├── List all purchased effects
│   │   ├── Toggle activation (one at a time)
│   │   └── Delete/Disown item option
│   ├── Perks
│   │   ├── List active perks with expiry
│   │   └── Show expired perks
│   ├── Insurance
│   │   ├── List active insurance with expiry
│   │   └── Renewal options
│   ├── Ringtones/Call Sounds
│   │   ├── Manage audio ringtones
│   │   ├── Manage video ringtones
│   │   └── Set active ringtone per type
│   ├── Broadcast Themes
│   │   ├── List owned themes
│   │   ├── Set active theme
│   │   └── Theme preview
│   └── Avatar Customization
│       ├── View current avatar setup
│       ├── Customize by part (head, body, etc.)
│       └── See which items are owned
└── Settings
    ├── Auto-activate new purchases
    ├── Notification preferences
    └── Item suggestions
```

---

## Phase 4: Avatar Customization System

### New Component: `src/components/AvatarCustomizer.tsx`

Features:
```
Avatar Customizer
├── Avatar Preview (3D/2D)
│   └── Live update as items change
├── Customization Panels
│   ├── Head/Face Panel
│   │   ├── Available heads (free + owned)
│   │   ├── Eye styles
│   │   └── Facial features
│   ├── Body Panel
│   │   ├── Body shapes
│   │   ├── Owned clothing
│   │   └── Skin tone selector
│   ├── Accessories Panel
│   │   ├── Multiple slots
│   │   ├── Browse Troll Mart
│   │   └── Quick purchase
│   └── Save Configuration
└── Link to Troll Mart for purchases
```

### Data Structure
```typescript
interface AvatarConfig {
  baseModel: string; // 'human', 'trollish', 'creature'
  head: string;
  face: string;
  body: string;
  legs: string;
  feet: string;
  accessories: string[];
  skinTone: string;
  hairColor: string;
  customizations: Record<string, any>;
}
```

---

## Phase 5: Troll Mart Clothing Integration

### New Page/Modal: `src/pages/TrollMart.tsx`

Features:
```
Troll Mart - Avatar Clothing Store
├── Category Browser
│   ├── Head Wear (20+ items)
│   ├── Tops (50+ items)
│   ├── Bottoms (40+ items)
│   ├── Shoes (30+ items)
│   └── Accessories (60+ items)
├── Item Cards
│   ├── 3D preview
│   ├── Price in Troll Coins
│   ├── "Try On" button
│   ├── "Buy" button
│   └── Owned indicator
├── Filters
│   ├── By price range
│   ├── By rarity
│   ├── New arrivals
│   └── Most popular
└── Integration with Avatar Customizer
    ├── Direct "Apply" after purchase
    ├── Sync to user profile
    └── Real-time preview
```

### Sample Pricing
```
- Common items: 500-2000 coins
- Rare items: 5000-10000 coins
- Epic items: 15000-30000 coins
- Legendary items: 50000+ coins
```

---

## Phase 6: TrollsTown Restoration

### Current State
- `src/pages/TrollsTown3DPage.tsx` - Full 3D implementation (restricted to admins)
- `src/pages/TrollsTownPage.tsx` - Original version exists

### Plan
1. **Keep 3D version** at `/admin/trolls-town-3d` (admin only)
2. **Restore original** at `/trolls-town` with:
   - Game controller drive animation
   - Popup interactions as before
   - Property purchasing system
   - Car/vehicle system
   - Property ownership display

### Integration Points
```
TrollsTown (Original)
├── Game World
│   ├── Properties for sale
│   ├── Vehicles/Cars
│   ├── NPCs and interactions
│   └── Event locations
├── Player Features
│   ├── Property ownership tracking
│   ├── Inventory (vehicles, deeds)
│   ├── Earnings from rentals
│   └── Gameplay progression
└── Sync with TrollCity
    ├── Shared avatar appearance
    ├── Unified coin balance
    ├── Cross-world inventory
    └── Unified leaderboards
```

---

## Implementation Sequence

### Week 1: Foundation
- [ ] Create database schema (Phase 1)
- [ ] Create user_purchases tracking system
- [ ] Add activation functions to coin transactions library
- [ ] Update CoinStore purchase functions

### Week 2: UI for Management
- [ ] Create ProfileSettings.tsx page
- [ ] Add purchased items listing
- [ ] Add activation/deactivation UI

### Week 3: Avatar System
- [ ] Create AvatarCustomizer component
- [ ] Implement 3D avatar rendering (if needed) or avatar builder
- [ ] Create user_avatar_customization table
- [ ] Link to profile setup

### Week 4: Troll Mart
- [ ] Seed troll_mart_clothing table
- [ ] Create TrollMart.tsx shop page
- [ ] Implement purchase flow
- [ ] Integrate with avatar customizer

### Week 5: TrollsTown & Sync
- [ ] Restore original TrollsTownPage.tsx
- [ ] Implement property/vehicle systems
- [ ] Create sync mechanisms for cross-world features
- [ ] Testing and integration

---

## Database Seed Data

### Initial Troll Mart Items
```sql
INSERT INTO troll_mart_clothing (name, category, item_code, price_coins, description) VALUES
-- Heads
('Classic Head', 'head', 'head_001', 0, 'Default head'),
('Round Head', 'head', 'head_002', 500, 'Rounder face shape'),
('Alien Head', 'head', 'head_003', 2000, 'Futuristic alien look'),

-- Bodies
('T-Shirt', 'body', 'body_001', 500, 'Classic white t-shirt'),
('Leather Jacket', 'body', 'body_002', 3000, 'Cool leather outfit'),
('Suit', 'body', 'body_003', 5000, 'Formal business suit'),

-- Accessories
('Crown', 'accessories', 'acc_crown', 5000, 'Royal crown'),
('Sunglasses', 'accessories', 'acc_sunglasses', 1000, 'Cool shades'),
('Chain', 'accessories', 'acc_chain', 2000, 'Gold chain necklace');
```

---

## API Endpoints Needed

```typescript
// Purchase activation
POST /api/purchases/:purchaseId/activate
POST /api/purchases/:purchaseId/deactivate

// Get user's purchases
GET /api/users/:userId/purchases?itemType=effect
GET /api/users/:userId/active-items

// Avatar customization
GET /api/users/:userId/avatar-config
POST /api/users/:userId/avatar-config
PUT /api/users/:userId/avatar-config

// Troll Mart
GET /api/troll-mart/items?category=head
GET /api/troll-mart/items/:itemId
```

---

## UI/UX Considerations

1. **Activation Flow**
   - After purchase → Show activation prompt
   - Some items auto-activate (insurance, perks)
   - Some items need manual activation (effects, themes)

2. **Profile Settings**
   - Easy toggle to switch active items
   - Show expiry dates for time-limited items
   - Quick "Buy More" links

3. **Avatar Customizer**
   - Real-time preview
   - "Try On" before buying from Troll Mart
   - Sync across all pages

4. **Notifications**
   - Item expiring soon
   - New Troll Mart items
   - Purchase confirmation

---

## Testing Checklist

- [ ] Purchase item → Creates user_purchases record
- [ ] Activate item → Updates is_active = true
- [ ] Deactivate item → Updates is_active = false
- [ ] Profile Settings shows all purchased items
- [ ] Can toggle activation for each item
- [ ] Troll Mart items display correctly
- [ ] Purchase Troll Mart item → Adds to user inventory
- [ ] Avatar customizer shows owned items only
- [ ] Avatar changes sync across pages
- [ ] TrollsTown original features work
- [ ] Cross-world sync works (TrollCity ↔ TrollsTown)

---

## Migration Notes

- Existing user_entrance_effects → Migrate to user_purchases
- Existing user_perks → Migrate to user_purchases
- Existing user_insurances → Migrate to user_purchases
- Existing user_broadcast_theme_purchases → Migrate to user_purchases
- Existing user_call_sound_purchases → Migrate to user_purchases

---

## Files to Create

1. `src/lib/purchases.ts` - Purchase management functions
2. `src/pages/ProfileSettings.tsx` - Settings page
3. `src/components/AvatarCustomizer.tsx` - Avatar builder
4. `src/pages/TrollMart.tsx` - Clothing shop
5. `src/types/purchases.ts` - TypeScript types
6. `src/hooks/usePurchases.ts` - Purchase hooks
7. `database/migrations/add_purchase_system.sql` - Schema

## Files to Modify

1. `src/pages/CoinStore.jsx` - Add activation logic
2. `src/pages/ProfileSetup.tsx` - Link to avatar customizer
3. Navigation/Router - Add new routes
4. `src/pages/TrollsTownPage.tsx` - Restore original features

---

## Priority: HIGH
This system unlocks:
- Better monetization (more purchase reasons)
- Deeper customization (avatar, items, effects)
- More engagement (management interface)
- Unified cross-world experience
