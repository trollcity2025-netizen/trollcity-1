# Troll Drop Feature Setup Guide

## Overview
The troll drop feature spawns animated trolls during live broadcasts that walk across the stream. Users can click on them to gain or lose trollmonds based on the troll color:
- **Green Troll**: Gives trollmonds (+5000 split among clickers)
- **Red Troll**: Takes trollmonds (-5000 split among clickers)

## Features

### Spawn Rules
- **Max drops per broadcast**: 2
- **Broadcast duration threshold**: 1 hour
  - Under 1 hour: Max 1 troll drop
  - 1 hour or more: Max 2 troll drops
- **Spawn interval**: Every 45 seconds after initial spawn (with 15-30s random delay)

### User Interaction
- Each troll drop lasts **15 seconds** before expiring
- Amount split **equally** among all users who click
- **Green trolls** add coins to `free_coin_balance` (trollmonds)
- **Red trolls** deduct coins from `free_coin_balance` (trollmonds)
- Users can only claim each drop once

## Database Setup

### 1. Create the `troll_drops` Table

Run this SQL in your Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS public.troll_drops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  color VARCHAR(10) NOT NULL CHECK (color IN ('red', 'green')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  participants JSONB DEFAULT '[]'::jsonb,
  total_amount INTEGER NOT NULL DEFAULT 5000,
  claimed BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_troll_drops_stream_id ON public.troll_drops(stream_id);
CREATE INDEX IF NOT EXISTS idx_troll_drops_created_at ON public.troll_drops(created_at);
CREATE INDEX IF NOT EXISTS idx_troll_drops_expires_at ON public.troll_drops(expires_at);

-- Enable RLS
ALTER TABLE public.troll_drops ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow read access to troll drops"
  ON public.troll_drops
  FOR SELECT
  USING (true);

CREATE POLICY "Allow streamer to manage troll drops"
  ON public.troll_drops
  FOR UPDATE
  USING (
    stream_id IN (
      SELECT id FROM public.streams WHERE broadcaster_id = auth.uid()
    )
  );

CREATE POLICY "Allow creation of troll drops"
  ON public.troll_drops
  FOR INSERT
  WITH CHECK (true);
```

The SQL script is also provided in `TROLL_DROP_DATABASE_SETUP.sql`

### 2. Verify Table Structure

After creating the table, verify it exists:
```sql
SELECT * FROM public.troll_drops LIMIT 1;
```

## File Structure

### New Files Created
- **`src/types/trollDrop.ts`** - Type definitions for troll drops
- **`src/components/stream/TrollDrop.tsx`** - Main troll drop component
- **`src/lib/trollDropUtils.ts`** - Utility functions for troll drop logic
- **`TROLL_DROP_DATABASE_SETUP.sql`** - Database schema
- **`TROLL_DROP_SETUP.md`** - This setup guide

### Modified Files
- **`src/pages/StreamRoom.tsx`** - Added troll drop spawning and rendering logic

## How It Works

### Spawning Logic
1. When a stream loads, the troll drop system initializes
2. After a random delay (15-30 seconds), a troll drop is spawned
3. Every 45 seconds, the system checks if a new troll can be spawned
4. Maximum spawns are enforced based on broadcast duration

### Click Handling
1. User clicks on a troll during the 15-second window
2. System calculates split amount: `5000 / (participants + 1)`
3. For green trolls: `addCoins()` adds trollmonds to user balance
4. For red trolls: `deductCoins()` removes trollmonds from user balance
5. Coin transactions are logged with metadata:
   - `troll_drop_id`: ID of the troll drop
   - `stream_id`: ID of the broadcast
   - `participants_count`: Total number of clickers

### Visual Feedback
- Troll walks across the broadcast from left to right
- Shows total amount and participant count below troll
- "✓ Claimed" indicator appears after user clicks
- Toast notifications confirm coin gains/losses

## SVG Troll Designs

Both green and red trolls use the same body structure with different color schemes:
- **Green**: Colors derived from `#22c55e` (emerald-500) and `#10b981` (emerald-600)
- **Red**: Colors derived from `#dc2626` (red-600) and `#b91c1c` (red-700)

The trolls feature:
- Muscular body with defined chest
- Glowing eyes (cyan for green, red for red)
- Golden horns with highlights
- Menacing expression with visible teeth
- Clawed hands and feet
- Proper anatomical proportions

## Configuration

You can adjust these constants in `src/lib/trollDropUtils.ts`:
- `TROLL_DROP_DURATION`: Duration each troll is visible (default: 15000ms)
- `TROLL_DROP_MAX_PER_BROADCAST`: Max drops for long broadcasts (default: 2)
- `BROADCAST_DURATION_THRESHOLD`: Hour threshold (default: 3600000ms)

And in `src/pages/StreamRoom.tsx` useEffect:
- `randomDelay`: Change spawn delay math
- Interval in `setInterval`: Change spawn frequency

## Testing

### Manual Testing Steps
1. Go to a live broadcast (or create one)
2. Wait for troll drops to spawn (15-45 seconds)
3. Verify trolls walk across the screen
4. Click green troll and confirm trollmonds increase
5. Click red troll and confirm trollmonds decrease
6. Verify 2-drop limit is enforced after 1 hour

### Console Checks
Open browser DevTools console and check for:
- "Error spawning troll drop" - if spawn fails
- "Error claiming troll drop" - if claim fails
- Check network tab for database updates

## Troubleshooting

### Trolls don't appear
1. Check browser console for errors
2. Verify `troll_drops` table exists in Supabase
3. Check that stream is actually live (`is_live = true`)
4. Ensure RLS policies allow reads

### Coins not updating
1. Verify user has sufficient balance for red trolls
2. Check that user profile `free_coin_balance` exists
3. Verify coin transaction logs in database
4. Check Supabase auth/RLS policies

### Performance Issues
1. Check database indexes are created
2. Monitor concurrent troll drops (shouldn't exceed 1 per stream)
3. Profile React components if rendering is slow

## Future Enhancements

Potential improvements:
- Different troll designs for special occasions
- Custom drop amounts per stream tier
- Combo bonuses for quick successive clicks
- Leaderboard for most coins from troll drops
- Sound effects when trolls spawn/are clicked
- Animated particle effects on claim
- Host control panel to manually spawn trolls
