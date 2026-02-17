# Savings Account System - Implementation Guide

## Overview

The Savings Account System automatically moves **1 out of every 5 coins** received into a user's savings account. This serves as a forced savings mechanism that users can later access for:
- Cashing out
- Paying off loans
- Other financial transactions

## Database Structure

### New Tables
- **`savings_ledger`**: Tracks all savings transactions (deposits, withdrawals, cashouts, loan payments)

### Modified Tables
- **`wallets`**: Added `savings_balance` column to track user savings

## How It Works

### Automatic Savings Deposit
When a user receives coins, the system:

1. Calculates: `savings_to_add = coins_received / 5`
2. Moves that amount to `savings_balance`
3. Moves the remainder to `coin_balance` (usable coins)
4. Logs the transaction to `savings_ledger`

**Example:**
- User receives 50 coins
- 10 coins → savings account (50 / 5 = 10)
- 40 coins → regular coin balance

## API Functions

### TypeScript (Frontend)

```typescript
import { 
  getSavingsDetails, 
  withdrawSavingsForCashout, 
  useSavingsForLoanPayment 
} from '@/lib/supabase'

// Get user's savings info
const details = await getSavingsDetails(userId)
// Returns: { savings_balance, coin_balance, total_balance, savings_percentage, recent_transactions }

// Withdraw from savings for cashout
const result = await withdrawSavingsForCashout(100)
// Returns: { success: boolean, new_savings_balance: number, message: string }

// Use savings to pay loan
const loanResult = await useSavingsForLoanPayment(50, loanId)
// Returns: { success: boolean, new_savings_balance: number, message: string }
```

### PostgreSQL (Backend/RPC)

```sql
-- Deposit coins to savings (auto-called by coin receipt system)
SELECT * FROM deposit_to_savings(user_id, coins_received);

-- Withdraw from savings for cashout
SELECT * FROM withdraw_savings_for_cashout(user_id, amount);

-- Use savings for loan payment
SELECT * FROM use_savings_for_loan_payment(user_id, amount, loan_id);

-- Get savings details
SELECT * FROM get_savings_details(user_id);
```

## Integration Points

### When Coins Are Received
Every place coins are deposited to a user must call `deposit_to_savings()`:

**Current locations to update:**
- Gift/tips system
- Streaming earnings
- Battle rewards
- Manual coin purchases
- Any other coin earning mechanism

**Pattern:**
```typescript
// Before: just update coin_balance
await supabase.from('wallets').update({ 
  coin_balance: new_balance 
}).eq('user_id', userId)

// After: use the savings deposit function
const { savings_added, new_savings_balance, new_coin_balance } = await depositToSavings(userId, coinsReceived)
// This automatically splits the coins correctly
```

### Cashout System
Update cashout flows to offer savings as an option:

```typescript
// Get available balance (coins + can use savings)
const details = await getSavingsDetails(userId)

// Let user choose to use savings
if (useFromSavings && savingsAmount > 0) {
  const result = await withdrawSavingsForCashout(savingsAmount)
  if (!result.success) {
    toast.error(result.message)
    return
  }
  // Continue with cashout using the withdrawn amount
}
```

### Loan Payment System
Update loan payment to support savings:

```typescript
// When paying loan
if (paymentAmount > 0) {
  // Try to use savings first if user selects it
  if (useSavings) {
    const result = await useSavingsForLoanPayment(paymentAmount, loanId)
    if (!result.success) {
      // Fall back to regular coins
    }
  }
  // Or use regular coins
}
```

## UI Display Examples

### Wallet/Profile Page
```tsx
const details = await getSavingsDetails(user.id)

return (
  <div className="savings-display">
    <div>Spendable Coins: {details.coin_balance}</div>
    <div>Savings Balance: {details.savings_balance}</div>
    <div>Total: {details.total_balance}</div>
    <div className="progress-bar">
      Savings: {details.savings_percentage}%
    </div>
  </div>
)
```

### Cashout Page
```tsx
const details = await getSavingsDetails(user.id)

return (
  <div>
    <p>Available for cashout: {details.coin_balance + details.savings_balance}</p>
    
    <label>
      <input 
        type="checkbox" 
        onChange={(e) => setSaveFromSavings(e.target.checked)}
      />
      Use savings balance too (${details.savings_balance} available)
    </label>
  </div>
)
```

### Loan Payment Page
```tsx
const details = await getSavingsDetails(user.id)

return (
  <div>
    <div>Balance available to pay: {details.coin_balance}</div>
    <div>Can also use savings: {details.savings_balance}</div>
    
    <RadioGroup>
      <label>
        <input type="radio" name="payment" value="coins" />
        Pay from coins ({details.coin_balance} available)
      </label>
      <label>
        <input type="radio" name="payment" value="savings" />
        Pay from savings ({details.savings_balance} available)
      </label>
      <label>
        <input type="radio" name="payment" value="both" />
        Pay from both
      </label>
    </RadioGroup>
  </div>
)
```

## RLS Policies

Users can only view their own savings data:
- Can view their `savings_ledger` transactions
- Can view their wallet `savings_balance`
- Cannot view other users' savings

All functions properly enforce user ID checks to prevent unauthorized access.

## Migration

The migration `20260216000001_add_savings_account_system.sql` will:

1. ✅ Add `savings_balance` column to wallets
2. ✅ Create `savings_ledger` table
3. ✅ Create functions for managing savings
4. ✅ Set up RLS policies
5. ✅ Grant permissions to authenticated users

**To apply:**
```sql
-- Run via Supabase migrations or apply manually
SHOW search_path;
-- Then run the migration SQL
```

## Testing

```typescript
// Test deposit
const result = await depositToSavings(userId, 50)
console.log(result) // { savings_added: 10, new_savings_balance: 10, new_coin_balance: 40 }

// Test withdrawal
const cashoutResult = await withdrawSavingsForCashout(5)
console.log(cashoutResult) // { success: true, new_savings_balance: 5, message: "..." }

// Test loan payment
const loanResult = await useSavingsForLoanPayment(3, loanId)
console.log(loanResult) // { success: true, new_savings_balance: 2, message: "..." }
```

## Future Enhancements

- Interest-bearing savings (earn extra coins on savings balance)
- Savings withdrawal fees/penalties
- Tiered savings rates (different percentages for different achievement levels)
- Savings goal tracking
- Auto-transfer options between savings and coins
- Savings-only events or bonuses
