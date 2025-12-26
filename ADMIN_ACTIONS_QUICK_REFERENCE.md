# Admin Profile Actions - Quick Reference

## What Was Added

When an admin clicks on a user's profile, they can now manage:

| Action | Currency | Effect | Notes |
|--------|----------|--------|-------|
| **Grant Coins** | Trollmonds / Troll Coins | Add to balance | Can grant any amount |
| **Deduct Coins** | Trollmonds / Troll Coins | Remove from balance | Minimum balance is 0 |
| **Grant Levels** | N/A | Increase user level | Minimum level is 1 |
| **Deduct Levels** | N/A | Decrease user level | Minimum level is 1 |

## Files Created

```
src/
├── components/
│   └── AdminProfilePanel.tsx          (NEW - Admin action UI)
├── lib/
│   └── adminCoins.ts                  (MODIFIED - Added 3 new functions)
└── ADMIN_PROFILE_ACTIONS_SETUP.md     (NEW - Full documentation)
```

## Files Modified

- **`src/components/UserProfilePopup.tsx`** - Integrated admin panel
- **`src/lib/adminCoins.ts`** - Added new coin/level functions

## New Functions in adminCoins.ts

```typescript
// Deduct coins from a user
deductAdminCoins(
  targetUserId: string,
  coinAmount: number,
  reason?: string,
  coinType: 'troll_coins' | 'trollmonds'
)

// Grant levels to a user
grantAdminLevels(
  targetUserId: string,
  levelAmount: number,
  reason?: string
)

// Deduct levels from a user
deductAdminLevels(
  targetUserId: string,
  levelAmount: number,
  reason?: string
)
```

## How It Works

1. **User clicks username** → Profile popup opens
2. **Admin checks** → If admin: show action panel
3. **Select action** → Grant/Deduct Coins/Levels
4. **Enter amount** → Number input
5. **Optional reason** → Logged in transaction
6. **Confirm** → Updates database + logs transaction
7. **Toast notification** → Confirms success

## Access Control

- ✅ Show panel only if viewer is admin
- ✅ Prevent self-modifications (admin can't manage own profile)
- ✅ Verify authentication before each action
- ✅ Log all changes with admin ID and reason

## Data Storage

All actions create records in `coin_transactions`:
- Type: `admin_grant` or `admin_deduct`
- Amount: Positive (grant) or negative (deduct)
- Metadata: Admin ID, reason, timestamp
- Description: Auto-generated with context

## UI/UX Details

### Panel Location
Inside UserProfilePopup, below main profile buttons

### Visual Indicators
- Yellow/Red for grant/deduct actions
- Current balances displayed
- Form validation (amount > 0)
- Loading state during processing
- Success/error toast notifications

### Current Stats Display
```
┌─────────────────┐
│ Troll Coins: 50 │  (Yellow)
│ Trollmonds:  100│  (Green)
│ Level:        25│  (Blue)
└─────────────────┘
```

### Action Buttons
- **Grant Coins** (Yellow) 
- **Deduct Coins** (Red)
- **Grant Levels** (Blue)
- **Deduct Levels** (Purple)

## Security Notes

1. **Server-side validation** - All functions verify admin status
2. **Transaction logging** - Every action creates audit trail
3. **Balance safety** - Deduct operations respect minimums
4. **User context** - Records who made the change
5. **Reason tracking** - Optional notes for audit

## Testing Checklist

- [ ] Admin user can see panel on other users' profiles
- [ ] Non-admin users don't see admin panel
- [ ] Admin cannot see panel on their own profile
- [ ] Grant coins updates user balance
- [ ] Deduct coins respects minimum (0)
- [ ] Grant levels updates level
- [ ] Deduct levels respects minimum (1)
- [ ] Transactions are logged with correct type
- [ ] Metadata includes admin ID and reason
- [ ] Toast notifications work
- [ ] Profile auto-refreshes after action
- [ ] Cancel button closes form

## Common Workflows

### Grant Compensation
1. Click username
2. "Grant Coins" → Select Trollmonds → Enter 5000
3. Reason: "Compensation for technical issue"
4. Confirm

### Penalty for Violation
1. Click username
2. "Deduct Levels" → Enter 2
3. Reason: "Violated community guidelines"
4. Confirm

### Reward Top Streamer
1. Click username
2. "Grant Coins" → Select Troll Coins → Enter 10000
3. Reason: "Top streamer reward - December"
4. Confirm

## Database Fields Updated

- `user_profiles.troll_coins_balance` - Troll coins
- `user_profiles.free_coin_balance` - Trollmonds
- `user_profiles.level` - User level
- `user_profiles.updated_at` - Timestamp

## Transaction Fields Created

```json
{
  "user_id": "target-user-id",
  "type": "admin_grant|admin_deduct",
  "amount": -5000,
  "coin_type": "troll_coins|trollmonds",
  "description": "Admin grant: ...",
  "metadata": {
    "deducted_by": "admin-user-id",
    "reason": "User provided reason"
  },
  "balance_after": 95000,
  "created_at": "2025-12-26T04:20:00Z"
}
```

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| "Only admins can..." | User not admin | Give admin role |
| "User not found" | ID doesn't exist | Verify user ID |
| "Failed to update balance" | DB error | Check RLS policies |
| "Amount must be > 0" | Invalid input | Enter positive number |
| "Insufficient balance" | N/A (capped to 0) | N/A |

---

For full details, see `ADMIN_PROFILE_ACTIONS_SETUP.md`
