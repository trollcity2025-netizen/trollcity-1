# Coin Transaction Logging System

## Overview
Complete audit trail system for tracking all coin movements in Troll City. Provides full transparency, user transaction history, and admin audit capabilities.

## Database Changes

### Migration File: `supabase/migrations/create_coin_transactions_log.sql`

**Purpose**: Enhance existing `coin_transactions` table with additional audit fields

**New Columns Added**:
- `balance_after` (integer) - Snapshot of total user balance after transaction
- Ensures existing columns: `coin_type`, `source`, `platform_profit`, `liability`

**New Indexes**:
- `idx_coin_transactions_type` - Query by transaction type
- `idx_coin_transactions_coin_type` - Query by paid/free coins

**Table Documentation**:
- Added comments explaining each column's purpose
- Clarified positive/negative amount conventions
- Documented platform_profit and liability tracking

## Backend Changes

### New File: `api/lib/coinTransactionLogger.ts`

**Exports**:

#### `logCoinTransaction(params)`
Main logging function for all coin movements.

**Parameters**:
```typescript
{
  userId: string
  amount: number              // positive = credit, negative = debit
  coinType: 'paid' | 'free'
  transactionType: string     // see types below
  source?: string            // 'square', 'system', etc.
  description?: string
  metadata?: object          // additional context
  platformProfit?: number    // USD profit (purchases)
  liability?: number         // USD liability
  balanceAfter?: number      // auto-calculated if omitted
}
```

**Transaction Types**:
- `store_purchase` - User buys coins with $ via Square
- `gift_sent` - User spends coins to send gift
- `gift_received` - User receives coins/diamonds from gift
- `wheel_spin` - Coins spent on wheel spin
- `wheel_prize` - Coins won from wheel
- `kick_fee` - User charged for being kicked
- `ban_fee` - User charged for ban appeal/unban
- `entrance_effect` - Entrance effect purchased
- `insurance` - Insurance coins purchased
- `adjustment` - Admin manual adjustment
- `cashout` - Coins removed when paid out in $
- `refund` - Coins refunded from failed transaction
- `bonus` - Promotional/bonus coins
- `initial_balance` - Starting coins for new users

#### `getUserTransactionHistory(userId, options)`
Fetch user's transaction list with pagination and filtering.

**Options**:
```typescript
{
  limit?: number
  offset?: number
  transactionType?: string
}
```

#### `getUserTransactionStats(userId)`
Calculate aggregate statistics for user.

**Returns**:
```typescript
{
  totalSpent: number
  totalEarned: number
  totalPurchased: number
  totalFree: number
  transactionCount: number
}
```

### Updated: `api/routes/payments.ts`

**Changes**:
- Now fetches updated profile after coin addition to calculate accurate `balance_after`
- Passes `balance_after` to transaction insert
- Ensures complete audit trail for all purchases

**Lines Modified**: 280-327 (added balance snapshot calculation)

## Frontend Changes

### New Page: `src/pages/TransactionHistory.tsx`

**Features**:
- **Stats Cards**: Total earned, spent, purchased, and free coins
- **Filtering**: Filter by transaction type (all, purchase, gift, wheel, etc.)
- **Transaction List**: 
  - Color-coded icons per transaction type
  - Shows amount (+ for credit, - for debit)
  - Displays balance snapshot after each transaction
  - Shows paid vs free coin type
  - Relative timestamps (5m ago, 2h ago, etc.)
  - Package names and metadata
- **Auto-refresh**: Loads last 100 transactions on mount
- **Empty State**: Helpful message when no transactions exist

**UI Design**:
- Dark theme consistent with app
- Gradient background (gray-900 → purple-900)
- Glass morphism cards with backdrop blur
- Hover effects on transaction rows
- Responsive grid layout for stats

### Updated: `src/App.tsx`

**Changes**:
- Added import: `TransactionHistory`
- Added route: `/transactions` → `<TransactionHistory />`

### Updated: `src/components/Sidebar.tsx`

**Changes**:
- Added import: `Receipt` icon from lucide-react
- Added menu link: "Transactions" with Receipt icon
- Positioned after "Coin Store" in navigation

## Usage Examples

### Log a Coin Purchase
```typescript
import { logCoinTransaction } from '../lib/coinTransactionLogger'

await logCoinTransaction({
  userId: user.id,
  amount: 1000,
  coinType: 'paid',
  transactionType: 'store_purchase',
  source: 'square',
  description: 'Purchased Starter Pack - 1000 coins',
  metadata: {
    payment_id: 'sq_xyz123',
    package_id: 'pkg_starter',
    amount_paid: 9.99,
    square_fee: 0.59
  },
  platformProfit: 9.40,
  liability: 0
})
```

### Log a Gift Sent
```typescript
// Debit sender
await logCoinTransaction({
  userId: senderId,
  amount: -500,
  coinType: 'paid',
  transactionType: 'gift_sent',
  description: 'Sent Rose gift to @username',
  metadata: {
    gift_id: 'gift_abc',
    recipient_id: receiverId,
    recipient_username: 'username',
    gift_name: 'Rose'
  }
})

// Credit receiver
await logCoinTransaction({
  userId: receiverId,
  amount: 450, // 90% of gift value
  coinType: 'paid',
  transactionType: 'gift_received',
  description: 'Received Rose gift from @sender',
  metadata: {
    gift_id: 'gift_abc',
    sender_id: senderId,
    sender_username: 'sender',
    gift_name: 'Rose',
    original_value: 500
  },
  liability: 4.50 // 10% platform fee
})
```

### Log a Wheel Spin
```typescript
// Debit for spin
await logCoinTransaction({
  userId: user.id,
  amount: -100,
  coinType: 'paid',
  transactionType: 'wheel_spin',
  description: 'Troll Wheel spin',
  metadata: {
    spin_id: 'spin_xyz'
  }
})

// Credit for prize (if won)
await logCoinTransaction({
  userId: user.id,
  amount: 500,
  coinType: 'free',
  transactionType: 'wheel_prize',
  description: 'Won 500 free coins from Troll Wheel',
  metadata: {
    spin_id: 'spin_xyz',
    prize_type: 'free_coins'
  }
})
```

### Get User History
```typescript
import { getUserTransactionHistory } from '../lib/coinTransactionLogger'

const { success, data } = await getUserTransactionHistory(userId, {
  limit: 50,
  offset: 0,
  transactionType: 'gift_received'
})

if (success) {
  console.log(`User has ${data.length} gift receipts`)
}
```

## Next Steps

### 1. Execute SQL Migration
```bash
# In Supabase Dashboard → SQL Editor
# Run: supabase/migrations/create_coin_transactions_log.sql
```

### 2. Integrate Logger in Existing Features

**Gift System** (`api/routes/GiftTransactionHandler.ts`):
- Log `gift_sent` when sender is debited
- Log `gift_received` when receiver is credited

**Wheel System** (`api/routes/wheel.ts`):
- Log `wheel_spin` when spin is purchased
- Log `wheel_prize` when prize is awarded

**Cashout System** (`api/routes/payouts.ts`):
- Log `cashout` when coins are converted to USD payout

**Admin Tools**:
- Log `adjustment` when admin manually modifies balances
- Log `refund` when failed transactions are reversed
- Log `bonus` for promotional coin grants

**User Onboarding**:
- Log `initial_balance` when new users receive starter coins

### 3. Create Admin Transaction Viewer

Create `/admin/transactions` page showing:
- All user transactions (not just own)
- Advanced filters (date range, user search, amount range)
- Export to CSV for financial reconciliation
- Fraud detection patterns
- Revenue analytics

### 4. Add Real-time Updates

Update `TransactionHistory.tsx` to subscribe to new transactions:
```typescript
useEffect(() => {
  const subscription = supabase
    .channel('transaction-updates')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'coin_transactions',
      filter: `user_id=eq.${user.id}`
    }, (payload) => {
      // Prepend new transaction to list
      setTransactions(prev => [payload.new, ...prev])
    })
    .subscribe()
    
  return () => subscription.unsubscribe()
}, [user?.id])
```

### 5. Testing Checklist

- [ ] Execute SQL migration successfully
- [ ] Test purchase flow logs correctly with balance_after
- [ ] Test gift sending logs both sender and receiver
- [ ] Verify wheel spins and prizes are logged
- [ ] Test cashout logging
- [ ] Verify RLS policies (users see own, admins see all)
- [ ] Test transaction history page loads and filters
- [ ] Verify balance_after calculations are accurate
- [ ] Test pagination and filtering on frontend
- [ ] Verify stats calculations are correct

## Benefits

1. **Full Transparency**: Every coin movement is permanently logged
2. **User Trust**: Users can see complete history of their coins
3. **Admin Auditing**: Track suspicious activity, verify balances
4. **Financial Reconciliation**: Match Square payments to coin credits
5. **Fraud Detection**: Identify unusual patterns or exploits
6. **Debug Tool**: Trace exactly where coins came from/went to
7. **Legal Compliance**: Audit trail for financial transactions
8. **Analytics**: Understand user behavior and platform economics

## Security Notes

- All transaction inserts use service role key (bypasses RLS)
- Users can only VIEW their own transactions (RLS enforced)
- Admins can VIEW all transactions
- Only service/admins can UPDATE transactions (corrections)
- Balance snapshots prevent tampering detection
- Metadata field stores complete context for verification
