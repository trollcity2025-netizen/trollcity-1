# Officer Work Credit (OWC) Pay System - Implementation

## ✅ System Overview

The new OWC system replaces the old free coins/hour system with a more sophisticated credit-based system:

### Levels & Rates

| Level | Title | OWC/hr | Conversion % | Final Paid Coins/hr (with 10% bonus) |
|-------|-------|--------|--------------|--------------------------------------|
| 1 | Junior Officer | 1,000,000 | 0.5% | 5,500 |
| 2 | Senior Officer | 1,500,000 | 0.7% | 11,550 |
| 3 | Commander | 1,800,000 | 0.8% | 15,840 |
| 4 | Elite Commander | 2,200,000 | 0.9% | 21,780 |
| 5 | HQ Master Officer | 2,600,000 | 1.1% | 31,460 |

## 📋 Files Created/Updated

### 1. Database Migration
**File**: `supabase/migrations/20250105_officer_owc_system.sql`
- Adds `owc_balance` and `total_owc_earned` to `user_profiles`
- Creates `owc_transactions` table for tracking
- Updates `officer_work_sessions` to track OWC
- Creates functions:
  - `get_owc_per_hour(level)` - Returns OWC per hour for level
  - `get_owc_conversion_rate(level)` - Returns conversion rate
  - `convert_owc_to_paid_coins(owc, level)` - Calculates paid coins with bonus
  - `award_owc_for_session()` - Awards OWC for completed shifts
  - `convert_owc_to_paid()` - Converts OWC to paid coins

### 2. Frontend Configuration
**File**: `src/lib/officerOWC.ts`
- `OFFICER_LEVELS` - Complete level configuration
- Helper functions for OWC calculations
- Formatting utilities

### 3. UI Components
**File**: `src/components/OfficerTierBadge.tsx`
- Updated to support levels 1-5
- Shows correct badge colors (blue, orange, red, purple, gold)
- Displays final paid coins/hr in tooltip

**File**: `src/pages/OfficerOWCDashboard.tsx`
- Complete OWC dashboard for officers
- Shows current balance, total earned, estimated value
- Convert OWC to paid coins interface
- Transaction history

### 4. Routes
**Route**: `/officer/owc`
- Officer-only OWC dashboard
- Requires active officer status

## 🔄 How It Works

### Earning OWC
1. Officer clocks in and works a shift
2. When shift ends (manual or auto-clockout), system calculates hours worked
3. `award_owc_for_session()` is called:
   - Calculates OWC based on level and hours
   - Updates `owc_balance` and `total_owc_earned`
   - Logs transaction in `owc_transactions`

### Converting OWC to Paid Coins
1. Officer goes to `/officer/owc` dashboard
2. Enters amount of OWC to convert
3. System calculates:
   - Base paid coins = OWC × conversion rate
   - Bonus = Base × 10%
   - Total = Base + Bonus
4. Updates balances and logs transactions

## 📊 Database Schema

### New Columns
- `user_profiles.owc_balance` - Current OWC balance
- `user_profiles.total_owc_earned` - Lifetime OWC earned
- `officer_work_sessions.owc_earned` - OWC earned in session
- `officer_work_sessions.paid_coins_converted` - Paid coins from conversion

### New Table: `owc_transactions`
- Tracks all OWC transactions (earned, converted, bonus, deducted)
- Links to work sessions
- Stores conversion rates and paid coin amounts

## 🚀 Next Steps

1. **Apply Migration**: Run `force_apply_new_migration.sql` in Supabase Dashboard
2. **Update Edge Functions**: 
   - Update `officer-leave-stream` to call `award_owc_for_session()` instead of old coin system
   - Update `officer-auto-clockout` to use OWC system
3. **Update Officer Lounge**: Add link to OWC dashboard
4. **Update Officer Dashboard**: Show OWC balance and conversion option
5. **Update UserProfile Interface**: Add `owc_balance` and `total_owc_earned` to TypeScript types

## 🎯 Benefits

- **Flexible**: Officers can convert OWC when they want
- **Transparent**: All transactions logged
- **Scalable**: Easy to adjust rates per level
- **Fair**: 10% bonus on all conversions
- **Trackable**: Complete audit trail

