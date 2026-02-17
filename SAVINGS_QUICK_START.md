# Savings Account System - Quick Start Guide

## What Changed?

Every user now has a **Savings Account** that automatically saves coins:
- **1 out of every 5 coins** received goes to savings
- Example: Receive 50 coins → 10 go to savings, 40 usable coins you keep

## For Developers

### 1. When Awarding Coins

**Before (Old Way):**
```typescript
await supabase.from('wallets')
  .update({ coin_balance: new_balance })
  .eq('user_id', userId)
```

**After (New Way):**
```typescript
// Call this instead - it handles the 5:1 split automatically
const result = await supabase.rpc('award_coins_to_user', {
  p_user_id: userId,
  p_coins: 50,  // amount being awarded
  p_description: 'Battle victory reward'  // optional
})

// Or in TypeScript:
import { depositToSavings } from '@/lib/supabase'
const result = await depositToSavings(userId, 50)
// result.new_coin_balance = 40
// result.new_savings_balance = 10 (added)
```

### 2. Quick Integration Checklist

Search these files and update them:

- [ ] `src/lib/supabase.ts` - Any place coins are awarded
- [ ] `src/pages/LivePage.tsx` - Gift/tip handling
- [ ] `src/pages/TrollBank.tsx` - Bank operations
- [ ] `src/pages/BattleRoyal.tsx` - Battle rewards (if exists)
- [ ] Any stream earnings calculation functions

### 3. Cashout Changes

Users can now cashout from **both** their coins AND savings:

```typescript
// In cashout flow
const details = await getSavingsDetails(userId)

// Available: details.coin_balance + details.savings_balance
const totalAvailable = details.coin_balance + details.savings_balance

// If user opts to use savings:
const result = await withdrawSavingsForCashout(savingsAmount)
if (!result.success) {
  toast.error(result.message)  // "Insufficient savings balance"
} else {
  // Continue with cashout using the withdrawn amount
}
```

### 4. Loan Payment Changes

Users can now pay loans with savings:

```typescript
// In loan payment flow
if (paymentSource === 'savings') {
  const result = await useSavingsForLoanPayment(paymentAmount, loanId)
  if (!result.success) {
    toast.error(result.message)
  }
}
```

### 5. Database Functions Available

```sql
-- Award coins (with automatic savings split)
SELECT * FROM award_coins_to_user(user_id, amount, description);

-- Award gift coins (stream gifts, tips)
SELECT * FROM award_stream_gift_coins(user_id, amount, gift_name);

-- Manually deposit to savings
SELECT * FROM deposit_to_savings(user_id, coins_received);

-- Withdraw for cashout
SELECT * FROM withdraw_savings_for_cashout(user_id, amount);

-- Use for loan payment
SELECT * FROM use_savings_for_loan_payment(user_id, amount, loan_id);

-- View savings details
SELECT * FROM get_savings_details(user_id);
```

## Display Examples

### Show User Their Savings

```tsx
import { getSavingsDetails } from '@/lib/supabase'

export function SavingsWidget() {
  const [details, setDetails] = useState(null)
  const { user } = useAuthStore()
  
  useEffect(() => {
    if (user?.id) {
      getSavingsDetails(user.id).then(setDetails)
    }
  }, [user?.id])
  
  if (!details) return null
  
  return (
    <div className="bg-blue-50 p-4 rounded">
      <h3>💰 Your Wallet</h3>
      <p>Spendable: {details.coin_balance.toLocaleString()} coins</p>
      <p>Savings: {details.savings_balance.toLocaleString()} coins</p>
      <p>Total: {details.total_balance.toLocaleString()} coins</p>
      <div className="progress-bar">
        <div style={{ width: details.savings_percentage + '%' }} className="bg-green-500" />
      </div>
      <small>{details.savings_percentage.toFixed(1)}% in savings</small>
    </div>
  )
}
```

## Files Modified

1. **`supabase/migrations/20260216000001_add_savings_account_system.sql`** ✅
   - Adds savings_balance to wallets
   - Creates savings_ledger table
   - Creates core functions

2. **`supabase/migrations/20260216000002_integrate_savings_with_coin_system.sql`** ✅
   - Updates coin award functions
   - Creates helper functions

3. **`src/lib/supabase.ts`** ✅
   - Added TypeScript wrappers:
     - `getSavingsDetails()`
     - `withdrawSavingsForCashout()`
     - `useSavingsForLoanPayment()`
     - `depositToSavings()`

## Testing Checkslist

- [ ] Create new user, receive 50 coins → verify 40 coins + 10 savings
- [ ] View savings widget → shows correct balances
- [ ] Cashout with savings → deducts from savings
- [ ] Pay loan with savings → deducts from savings
- [ ] View savings ledger → shows transaction history
- [ ] Multiple coins received → savings accumulate correctly

## Important Notes

⚠️ **Do NOT:**
- Manually update coin_balance without using the award functions
- Bypass the savings deposit system
- Directly modify savings_balance without logging to ledger

✅ **DO:**
- Always use `award_coins_to_user()` or `depositToSavings()` when awarding coins
- Check `getSavingsDetails()` to show accurate balances
- Log all transactions properly via the ledger

## Support

For questions about the savings system, refer to:
- `SAVINGS_ACCOUNT_SYSTEM.md` - Full documentation
- Migration files - SQL implementation details
- TypeScript types - `SavingsDetails` interface in supabase.ts
