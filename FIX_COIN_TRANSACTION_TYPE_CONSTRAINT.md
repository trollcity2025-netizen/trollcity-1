# Fix: Coin Transaction Type Constraint Error

## Problem
When purchasing entrance effects, error: `"new row for relation \"coin_transactions\" violates check constraint \"coin_transactions_type_check\""`

This happens because the code was trying to insert `type: 'purchase'` which wasn't in the allowed list of transaction types.

## Root Cause
The `coin_transactions` table has a CHECK constraint that validates the `type` field against an allowed list. Different migrations defined different sets of allowed types, causing inconsistency.

**Migration Timeline:**
- `20251125_add_transaction_fields_and_views.sql`: Defined limited types (didn't include 'purchase')
- `20260208_expand_coin_transaction_types.sql`: Expanded types to include 'purchase' (but may run after 20251125)

## Solution

### 1. Changed Frontend Code
**File:** `src/pages/EntranceEffects.tsx` (line 117)

Changed from:
```typescript
type: 'purchase',
```

To:
```typescript
type: 'entrance_effect',
```

The `'entrance_effect'` type is specifically for entrance effect purchases and is in all constraint definitions.

### 2. Created Migration to Ensure Constraint
**File:** `supabase/migrations/20260226_fix_coin_transaction_types_constraint.sql`

This migration:
- Drops the old constraint (if it exists)
- Creates a new constraint with all allowed types
- Ensures consistency regardless of migration execution order
- Is idempotent (safe to run multiple times)

**Allowed Transaction Types:**
```
- purchase
- gift
- spin
- insurance
- cashout
- admin_grant
- admin_deduct
- admin_adjustment
- admin_reset
- store_purchase
- perk_purchase
- entrance_effect (for entrance effect purchases)
- insurance_purchase
- gift_send / gift_sent
- gift_receive / gift_received
- kick_fee
- ban_fee
- wheel_spin
- wheel_win
- wheel_loss
- wheel_prize
- refund
- reward
- payout_request
- payout_hold
- payout_refund
- troll_pass_purchase
- daily_giveaway
```

## Deployment Steps

1. **Run the new migration** (creates correct constraint):
   ```sql
   -- Execute: supabase/migrations/20260226_fix_coin_transaction_types_constraint.sql
   ```

2. **Frontend code is already updated** (uses 'entrance_effect' type)

3. **Test:**
   - Try purchasing entrance effect
   - Should succeed with no constraint violation
   - Check `coin_transactions` table for entry with type='entrance_effect'

## Benefits

✅ **Fixes constraint violation** on entrance effect purchases
✅ **Uses specific type** ('entrance_effect' vs generic 'purchase')
✅ **Ensures consistency** across all transaction types
✅ **Idempotent migration** safe to run anytime
✅ **Future-proof** includes all known transaction types

## Troubleshooting

If the error still occurs after applying the fix:

1. **Verify migration ran:**
   ```sql
   -- Check constraint definition
   SELECT constraint_name, constraint_definition
   FROM information_schema.table_constraints
   WHERE table_name = 'coin_transactions'
   AND constraint_type = 'CHECK';
   ```

2. **Check allowed types:**
   ```sql
   -- Try inserting a test transaction
   INSERT INTO coin_transactions (user_id, type, amount, description)
   VALUES ('00000000-0000-0000-0000-000000000000', 'entrance_effect', -10, 'test');
   ```

3. **If constraint still wrong:**
   - Run the new migration manually
   - Or run migration that defines constraint last

## Related Files

- `20260226_fix_coin_transaction_types_constraint.sql` - New migration
- `src/pages/EntranceEffects.tsx` - Updated transaction type
- `20260208_expand_coin_transaction_types.sql` - Reference constraint definition

---

**Date Fixed:** December 26, 2024
**Status:** Ready for deployment
**Risk Level:** Low (constraint fix only, no data changes)
