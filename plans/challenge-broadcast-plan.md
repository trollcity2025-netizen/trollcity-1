# Challenge Broadcast Feature Plan

## Overview
A system where VIEWERS can challenge a live broadcaster. When the broadcaster accepts the challenge, their single broadcast transforms into a 5v5 battle grid - ALL within the SAME broadcast (not separate streams joining).

**Key Distinction:** This is NOT two separate broadcasts joining together. It's ONE broadcast that transforms into a battle arena when the broadcaster accepts a viewer's challenge.

---

## User Flow

### Step 1: Viewer Initiates Challenge
- Viewer is watching a live broadcast
- Viewer clicks "Challenge" button in the UI
- Challenge request is sent to the broadcaster

### Step 2: Broadcaster Receives Challenge
- Broadcaster sees incoming challenge requests in their controls
- Broadcaster can ACCEPT or DENY a challenge

### Step 3: Broadcast Transforms
- When broadcaster ACCEPTS:
  - The single broadcast transforms into a 5v5 battle grid
  - Broadcaster becomes one team (5 slots)
  - Challenger + 4 additional seats become the other team (5 slots)
  - All within the SAME broadcast ID/room

---

## NEW REQUIREMENTS

### Auto-Fit Grid Layout
- **Web:** Responsive grid that fits screen without scrolling
- **Mobile:** Compact grid optimized for small screens  
- **If not 5v5:** Grid auto-adjusts to available participants (1v1 through 5v5)
- Uses `min()` and `clamp()` CSS for fluid sizing

### Crown Rewards
- **Winner side:** 2 crowns per participant
- Crowns awarded to all participants on winning team

### Sudden Death Mode
- Triggered when scores are tied at end of battle duration
- Both sides get equal time in sudden death
- Visual indicator for sudden death state (red glow, "SUDDEN DEATH" banner)
- Score resets, first to lead wins

### Rematch System
- After sudden death ends, prompt for rematch
- If challenger requests rematch and broadcaster accepts → instant rematch
- If rematch denied → **IMMEDIATE** return to original grid state

### Post-Challenge Return (CRITICAL)
- When rematch denied:
  - **INSTANT** transition back to original broadcast grid
  - Broadcaster keeps their position
  - Original guest participants (if any) return to their seats
  - Challenger side returns to VIEWING mode
  - **NO loading screens whatsoever**

### Troll Engines Overlay
- **DISABLED** during challenge/battle mode
- Re-enables automatically when returning to normal broadcast

---

## Current State Analysis

### Existing Components
- `BattleControls.tsx` - Already has challenge functionality but tied to specific categories
- `TrollmersBattleControls.tsx` - Battle controls for trollmers category
- `BattleView.tsx` - Full battle grid with challenger/opponent layout
- `BroadcastGrid.tsx` - Current single-stream grid layout

### Existing Database Tables
- `battle_challenges` - Stores pending challenges between streamers
- `battles` - Stores active battle state
- `user_profiles` - Has `battle_crowns` column for crown tracking

---

## Implementation Plan

### Phase 1: Add Challenge Button for Viewers

**1.1 Modify BroadcastHeader.tsx or create viewer action component**
- Add "Challenge" button visible to VIEWERS (not broadcaster)
- Button placed in accessible location (next to like, gift buttons)
- Clicking opens a confirmation/selection modal

**1.2 Create ChallengeRequestModal Component**
- Viewer confirms they want to challenge broadcaster
- Submits challenge request to broadcaster

### Phase 2: Broadcaster Challenge Management

**2.1 Modify BroadcastControls.tsx**
- Add "Challenges" section showing pending challenges
- Show challenger username, time waiting
- ACCEPT and DENY buttons for each challenge

**2.2 Real-time Challenge Updates**
- Use Supabase realtime to receive new challenges instantly
- Update UI when challenges are accepted/denied

### Phase 3: Transform Broadcast to Battle Grid

**3.1 When Broadcaster Accepts Challenge:**
1. Update `streams` table: set `is_battle = true`, create `battle_id`
2. Create `battles` record linking challenger to broadcaster
3. Transform the CURRENT broadcast layout from single-grid to battle-grid
4. Broadcaster stays on their side, challenger joins the other side
5. **DISABLE Troll Engines overlay**

**3.2 Battle Grid Layout (Auto-Fit 5v5)**
- Maximum 10 total participants
- LEFT side = Broadcaster's Team (Green theme #22c55e) - 5 slots
- RIGHT side = Challenger's Team (Purple theme #a855f7) - 5 slots
- Auto-adjust for fewer participants (1v1 through 5v5)
- Use CSS Grid with `min()` for responsive sizing

### Phase 4: Sudden Death & Rematch

**4.1 Sudden Death Implementation**
- Monitor battle end time and score
- If tied → activate sudden death mode
- Visual indicator (red glow, "SUDDEN DEATH" banner)
- Reset scores, continue until someone leads

**4.2 Rematch System**
- After battle ends, show rematch prompt
- Challenger can request rematch
- Broadcaster can accept/deny
- **Instant transition if rematch accepted**

**4.3 Post-Challenge Return**
- If rematch denied:
  - **IMMEDIATELY** clear battle mode state
  - Return to `BroadcastGrid` with original participants
  - Challenger returns to viewer status
  - **NO page reload, NO loading states**
  - Re-enable troll engines overlay

### Phase 5: Crown Awards

**5.1 Crown Calculation**
- Determine winning team from final scores
- Award 2 crowns to each participant on winning side
- Use existing `update_battle_crowns` RPC or create new one

---

## Component Structure

```
src/components/broadcast/
├── ChallengeRequestModal.tsx    [NEW] - Viewer initiates challenge
├── BroadcastControls.tsx       [MODIFY] - Show pending challenges, accept/deny
├── BroadcastHeader.tsx        [MODIFY] - Add challenge button for viewers
├── BattleView.tsx            [MODIFY] - Sudden death, rematch, instant return
└── BroadcastGrid.tsx          [MODIFY] - Handle return from battle mode

src/hooks/
└── useBroadcastChallenges.ts  [NEW] - Challenge operations, battle state
```

---

## Database Schema

### broadcast_challenges (new table)
```sql
CREATE TABLE broadcast_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id UUID REFERENCES streams(id),
  challenger_id UUID REFERENCES auth.users(id),
  challenger_username TEXT,
  status TEXT DEFAULT 'pending', -- pending, accepted, denied, expired
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + interval '5 minutes'
);
```

### battles table (modify)
- Add `is_sudden_death` boolean
- Add `rematch_requested` boolean  
- Add `rematch_status` - 'none', 'requested', 'accepted', 'denied'

### Crown Awards RPC
```sql
CREATE OR REPLACE FUNCTION award_challenge_crowns(
  p_battle_id UUID,
  p_winner_team TEXT -- 'challenger' or 'opponent'
) RETURNS void AS $$
  -- Award 2 crowns to each participant on winning team
$$;
```

---

## Key State Management

### Battle Mode States
```typescript
type BattleState = 
  | 'none'           // Normal broadcast
  | 'challenged'     // Challenge received, awaiting accept
  | 'battle'         // Active battle
  | 'sudden_death'   // Tie → sudden death
  | 'rematch_prompt' // Battle ended, asking for rematch
  | 'returning';     // Instant return to normal (NO loading)
```

### Instant Return Logic
```typescript
const handleChallengeEnd = () => {
  // 1. Clear battle state (NO loading)
  setBattleState('returning');
  
  // 2. Return challenger to viewer
  setParticipantTeam(challengerId, null);
  
  // 3. Restore original participants
  restoreOriginalParticipants();
  
  // 4. Switch back to BroadcastGrid
  setIsBattleMode(false);
  
  // 5. Re-enable troll engines overlay
  setTrollEnginesEnabled(true);
  
  // All instant, no await
};
```

---

## Acceptance Criteria

1. ✅ Viewers can see "Challenge" button on live broadcasts
2. ✅ Clicking challenge sends request to broadcaster
3. ✅ Broadcaster sees pending challenges in controls
4. ✅ Broadcaster can ACCEPT or DENY challenges
5. ✅ When accepted, broadcast transforms to 5v5 grid IN-PLACE
6. ✅ Grid auto-fits for web and mobile (responsive)
7. ✅ Grid supports 1v1 through 5v5 automatically
8. ✅ Grid supports max 10 participants (5 per team)
9. ✅ Left side shows green theme, right side shows purple theme
10. ✅ Smaller team gets slightly larger tiles for balance
11. ✅ Sudden death activates on tie at end
12. ✅ Rematch option appears after sudden death
13. ✅ Instant return to original grid when rematch denied
14. ✅ NO loading screens during any transition
15. ✅ Winner side gets 2 crowns per participant
16. ✅ Troll engines overlay disabled during challenge

---

## Files to Modify

1. `src/components/broadcast/BroadcastHeader.tsx` - Add viewer challenge button
2. `src/components/broadcast/ChallengeRequestModal.tsx` (new)
3. `src/components/broadcast/BroadcastControls.tsx` - Show pending challenges
4. `src/components/broadcast/BattleView.tsx` - Sudden death, rematch, instant return
5. `src/components/broadcast/BroadcastGrid.tsx` - Handle return from battle
6. `src/hooks/useBroadcastChallenges.ts` (new)
7. Database migrations for new tables/columns

---

---

## Trollmonds Gift Discount System

### Overview
During challenges/battles, viewers sending gifts get a discount while receivers get full Trollmonds value.

### Rules
- **Gift Cost:** 100 coins example
- **Sender Pays:** 90 coins (10% discount)
- **Receiver Gets:** 100 Trollmonds (full value)
- **Trollmonds Balance:** Deducted from receiver's Trollmonds balance

### Implementation
- Modify gift sending logic to check if in challenge mode
- Apply discount to sender's coin cost
- Award full Trollmonds value to receiver
- Deduct from receiver's Trollmonds balance

### Database Changes
```sql
-- Add Trollmonds balance column if not exists
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS trollmonds_balance INTEGER DEFAULT 0;

-- Create RPC function for discounted gifting
CREATE OR REPLACE FUNCTION send_challenge_gift(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_gift_id UUID,
  p_discount_percent DECIMAL DEFAULT 0.10
) RETURNS JSONB AS $
  DECLARE
    gift_cost INTEGER;
    sender_payment INTEGER;
    receiver_value INTEGER;
  BEGIN
    -- Get gift cost
    SELECT price INTO gift_cost FROM gift_shop WHERE id = p_gift_id;
    
    -- Calculate sender payment (with discount)
    sender_payment := CAST(gift_cost * (1 - p_discount_percent) AS INTEGER);
    
    -- Receiver gets full value
    receiver_value := gift_cost;
    
    -- Deduct coins from sender
    UPDATE user_profiles 
    SET coins = coins - sender_payment 
    WHERE id = p_sender_id;
    
    -- Add Trollmonds to receiver
    UPDATE user_profiles 
    SET trollmonds_balance = trollmonds_balance + receiver_value 
    WHERE id = p_receiver_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'sender_paid', sender_payment,
      'receiver_got', receiver_value
    );
  END;
$ LANGUAGE plpgsql;
```

---

## Next Steps

Ready to implement. Want me to start with Phase 1 (Challenge button for viewers)?
