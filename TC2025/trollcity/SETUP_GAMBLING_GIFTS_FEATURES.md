# TrollCity - Gambling, Gifts & Streaming Features Setup Guide

## Overview
This guide covers the setup and deployment of the new gambling system, gift box, like button, age verification, and coin giveaway features added to TrollCity.

## New Features Added

### 1. **Gambling Page** (`/Gamble`)
- Users bet paid coins only (not free coins)
- 10% win chance (1 in 10 odds)
- Win 2x multiplier on success
- Real-time stats tracking: total wagered, paid out, house profit
- User statistics: wins, losses, win rate, total won/lost
- House statistics visible to users

**Files Created:**
- `src/pages/GamblePage.jsx` - Main gambling UI
- Database tables: `gambling_records`, `gambling_stats`

**Access:** Sidebar → Gamble (visible to all users)

---

### 2. **Gift Box System** 
- 30 unique gifts (animals, vehicles, houses, luxury items)
- Gifts range from 1 coin (Troll Gift) to 100,000 coins (Private Island)
- All gifts have emoji avatars
- Sent during live streams, visible to all viewers for 4 seconds
- Deducts coins from sender, displays with animation

**Files Created:**
- `src/lib/gifts.js` - Gift catalog and helpers
- `src/components/stream/GiftBox.jsx` - Gift selection modal
- `src/components/stream/GiftAnimationDisplay.jsx` - 4-second gift animation
- Database table: `stream_gifts` (extended)

**Integration:** StreamViewer chat sidebar (gift button visible to viewers only)

---

### 3. **Like Button System**
- Rapid-fire support (can like multiple times)
- Real-time counter updates
- Tracks likes per stream
- Displays on streamer's StreamerStatsPanel

**Files Created:**
- `src/components/stream/LikeButton.jsx` - Like button component
- Database table: `stream_likes`

**Integration:** StreamViewer chat sidebar (next to gift box)

---

### 4. **Streamer Stats Panel**
Real-time display on streamer's view showing:
- Coins earned in current stream
- Like count for current stream
- Follower count
- Auto-updates every 2-3 seconds

**Files Created:**
- `src/components/stream/StreamerStatsPanel.jsx`

**Integration:** Top-left corner of video container (streamer view only)

---

### 5. **Age Verification Modal**
- Appears on first login for all users
- Requires date of birth entry
- Enforces 18+ age requirement
- Private data (DOB stored securely)
- Can't proceed without verification

**Files Created:**
- `src/components/AgeVerificationModal.jsx`

**Integration:** Loaded in Layout or main App component

**Database Columns Added:**
- `profiles.is_age_verified` (BOOLEAN)
- `profiles.date_of_birth` (DATE)
- `profiles.age_verified_at` (TIMESTAMP)

---

### 6. **Random Coin Giveaway System**
- 5 random age-verified users get 10,000 free coins each
- Runs on schedule (via Edge Function)
- Records giveaway details for audit
- Users with activity priority

**Files Created:**
- `supabase/functions/randomCoinGiveaway/index.ts` - Deno Edge Function
- Database tables: `giveaway_records`

**Deployment:**
```bash
supabase functions deploy randomCoinGiveaway
```

**Schedule:** Daily/weekly via cron (see Deployment Options below)

---

### 7. **Top Trollers Leaderboard**
- Home page widget showing top 10 users by coin balance
- Displays: avatar, username, coins, followers
- Shows officer/family badges
- Updates every 30 seconds
- Click to view profile

**Files Created:**
- `src/components/TopTrollersCard.jsx`

**Integration:** Home page (above "New Trollerz" section)

---

## Database Schema Updates

### New Tables
```sql
-- Gambling tracking
CREATE TABLE gambling_records (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  bet_amount BIGINT,
  result TEXT ('win'|'loss'),
  winnings BIGINT,
  multiplier DECIMAL(5,2),
  created_date TIMESTAMP
);

CREATE TABLE gambling_stats (
  id UUID PRIMARY KEY,
  total_wagered BIGINT,
  total_paid_out BIGINT,
  total_house_profit BIGINT,
  last_updated TIMESTAMP
);

-- Giveaways
CREATE TABLE giveaway_records (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  amount BIGINT,
  giveaway_type TEXT,
  created_date TIMESTAMP
);

-- Likes
CREATE TABLE stream_likes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  stream_id UUID,
  created_date TIMESTAMP
);

-- Gifts (extended)
ALTER TABLE stream_gifts ADD COLUMN emoji TEXT;
ALTER TABLE stream_gifts ADD COLUMN color TEXT;

-- Message payments
CREATE TABLE message_payments (
  id UUID PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id),
  recipient_id UUID REFERENCES profiles(id),
  amount BIGINT,
  is_paid_coin BOOLEAN,
  created_date TIMESTAMP
);
```

### Columns Added to `profiles`
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_age_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMP;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS messages_enabled BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS message_cost BIGINT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS message_cost_is_paid BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS like_count BIGINT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stream_coins_earned BIGINT DEFAULT 0;
```

---

## Migration & Deployment

### 1. Apply Database Migration
```bash
# Using Supabase CLI
supabase db push

# OR manually in Supabase Dashboard:
# Go to SQL Editor → New Query → Paste contents of:
# supabase/migrations/20251113_gambling_giveaway_messaging.sql
```

### 2. Deploy Edge Functions

#### Random Coin Giveaway Function
```bash
supabase functions deploy randomCoinGiveaway
```

#### Schedule Weekly Cron
Option A: Supabase Scheduled Functions (via dashboard)
```
Function: randomCoinGiveaway
Schedule: 0 12 * * 0 (every Sunday 12 PM UTC)
```

Option B: External Cron Service (EasyCron, AWS EventBridge, etc.)
```
Webhook URL: https://YOUR_PROJECT.supabase.co/functions/v1/randomCoinGiveaway
Method: POST
Schedule: Weekly or daily as desired
```

Option C: Self-hosted Node.js Cron
```javascript
const cron = require('node-cron');
const fetch = require('node-fetch');

// Every Sunday at 12 PM UTC
cron.schedule('0 12 * * 0', async () => {
  await fetch('https://YOUR_PROJECT.supabase.co/functions/v1/randomCoinGiveaway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### 3. Add Age Verification Modal to Layout

In `src/pages/Layout.jsx` or main app component:
```jsx
import AgeVerificationModal from "@/components/AgeVerificationModal";

// Inside your main layout render:
<AgeVerificationModal userId={user?.id} onVerified={() => console.log("Age verified!")} />
```

---

## Feature Details

### Gambling Mechanics
- **Min Bet:** 1 coin
- **Max Bet:** User's paid coin balance
- **Win Odds:** 10% (1 in 10 chance)
- **Win Payout:** 2x multiplier
- **Coin Source:** Only paid coins allowed (real money purchases)
- **Winnings:** Credited as paid coins to user balance
- **House Edge:** 90% (matches 10% win rate)

### Gift Values
| Gift | Value | Category |
|------|-------|----------|
| Troll Gift | 1 | Special |
| Dog/Cat | 10-15 | Animal |
| Fish/Bird | 5-8 | Animal |
| Rabbit | 12 | Animal |
| Horse | 50 | Animal |
| Lion | 100 | Animal |
| Penguin | 20 | Animal |
| Sports Car | 500 | Vehicle |
| Helicopter | 1500 | Vehicle |
| Yacht | 2000 | Vehicle |
| Rocket | 5000 | Vehicle |
| House | 1000 | Property |
| Mansion | 5000 | Property |
| Castle | 8000 | Property |
| Island | 10000 | Property |
| Coin Bag | 100 | Currency |
| Money Stack | 500 | Currency |
| Diamond | 2000 | Currency |
| Gold Bar | 3000 | Currency |
| Crown | 1000 | Luxury |
| Ring | 800 | Luxury |
| Watch | 1200 | Luxury |
| Champagne | 300 | Luxury |
| Pizza | 25 | Food |
| Cake | 30 | Food |
| Burger | 20 | Food |

### Top Trollers Criteria
- Ranked by total coin balance (descending)
- Top 10 displayed
- Shows: avatar, username, coins, followers
- Officer/Family badges
- Click to view full profile

### Age Verification Rules
- Required before full access to gambling/streaming
- Must be 18+ years old
- DOB stored privately (encrypted recommended)
- One-time verification per account
- Warning shown if under 18

---

## Testing Checklist

- [ ] Database migration applied successfully
- [ ] Edge functions deployed and testable
- [ ] Gambling page loads and functions correctly
- [ ] 10% win odds working (test multiple bets)
- [ ] Gift box displays 30 gifts correctly
- [ ] Gifts deduct coins and animate for 4 seconds
- [ ] Like button works and updates in real-time
- [ ] Streamer stats panel updates every 2-3 seconds
- [ ] Age verification modal appears on login
- [ ] Top trollers card shows on home page
- [ ] Gamble link visible in sidebar
- [ ] House stats update after each bet
- [ ] User stats persist and update correctly
- [ ] Gift animations work on both viewer and streamer sides
- [ ] Cron job for giveaway runs successfully
- [ ] Giveaway coins credited to random users
- [ ] Admin dashboard shows gambling stats

---

## Admin Dashboard Updates

The Admin Dashboard now includes:
- **Gambling Tab:** House statistics (total wagered, paid out, profit)
- **Families Tab:** Weekly family payouts (existing feature)
- **Users Tab:** Can track user coin balances and gambling history

Access gambling stats at: `/Admin` → Gambling Tab

---

## Security Considerations

1. **RLS Policies:** Ensure Row-Level Security is enabled:
   - Users can only see their own gambling records
   - Users can only send/receive gifts they paid for
   - Admin only access to house statistics

2. **Coin Deduction:** Always verify paid coin balance before allowing gamble

3. **Age Verification:** Never allow under-18 users to access gambling/paid features

4. **Fraud Prevention:**
   - Validate all coin transactions
   - Monitor for unusual gambling patterns
   - Log all house transactions

---

## Troubleshooting

### Gambling Page Shows "No House Stats"
- **Cause:** `gambling_stats` table doesn't exist or is empty
- **Fix:** Run migration, then place first bet to initialize

### Gifts Not Deducting Coins
- **Cause:** User profile not updated with coin info
- **Fix:** Verify `profiles.coins` and `profiles.purchased_coins` columns exist

### Age Verification Modal Not Appearing
- **Cause:** Not imported in Layout/main app
- **Fix:** Add `<AgeVerificationModal userId={user?.id} />` to Layout

### Giveaway Function Fails
- **Cause:** `giveaway_records` table missing
- **Fix:** Run database migration
- **Alternative:** Edge Function type errors are non-blocking (Deno runtime handles them)

### Like Button Not Updating
- **Cause:** `stream_likes` table not found
- **Fix:** Ensure database migration was applied

### StreamerStatsPanel Blank
- **Cause:** Missing streamer_id or stream_id props
- **Fix:** Verify StreamViewer passes correct props to component

---

## Future Enhancements

1. **Messaging Payment System** - Users pay to unlock messages (1000 paid coins)
2. **Entrance Effect Purchases** - Custom entrance animations
3. **Admin Ban Protection** - Admins can't be banned/kicked from streams
4. **Unrestricted Admin Messaging** - Admins message anyone without payment
5. **Gamble Statistics** - Detailed leaderboard of biggest winners/losers
6. **Gift Achievements** - Badges for sending 100+ gifts, etc.
7. **VIP Features** - Premium users get bonus payouts from gambling

---

## Support & Questions

For issues or questions:
1. Check Supabase logs: `supabase functions logs`
2. Verify database tables exist: Supabase Dashboard → SQL Editor
3. Check browser console for errors: F12 → Console
4. Review migration logs in Supabase
