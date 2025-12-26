# Admin Profile Actions Setup Guide

## Overview

When an admin views a user's profile by clicking on their username, they now see an **Admin Actions Panel** that allows them to:
- **Grant/Deduct Trollmonds** (free_coin_balance)
- **Grant/Deduct Troll Coins** (troll_coins_balance)
- **Grant/Deduct Levels**

All actions are logged with transaction records and audit metadata.

## Features

### Admin Actions Available

1. **Grant Coins**
   - Select coin type: Troll Coins or Trollmonds
   - Specify amount
   - Optional reason/note
   - Records transaction with type `admin_grant`

2. **Deduct Coins**
   - Select coin type: Troll Coins or Trollmonds
   - Specify amount to deduct
   - Optional reason/note
   - Prevents negative balances (minimum is 0)
   - Records transaction with type `admin_deduct`

3. **Grant Levels**
   - Specify number of levels to grant
   - Optional reason (achievement, bug fix, etc.)
   - Prevents level from going below 1

4. **Deduct Levels**
   - Specify number of levels to deduct
   - Optional reason
   - Prevents level from going below 1

### Current Balance Display

The admin panel shows the target user's current:
- Troll Coins balance
- Trollmonds balance
- Level

### Access Control

- Only **admin** users can see and use this panel
- Admins **cannot** manage their own profile (for safety)
- All actions require proper admin authentication

## Files Created/Modified

### New Files
- **`src/components/AdminProfilePanel.tsx`** - The admin action panel component
- **`ADMIN_PROFILE_ACTIONS_SETUP.md`** - This setup guide

### Modified Files
- **`src/lib/adminCoins.ts`** - Added 4 new functions:
  - `deductAdminCoins()` - Deduct coins from any user
  - `grantAdminLevels()` - Grant levels to any user
  - `deductAdminLevels()` - Deduct levels from any user
  
- **`src/components/UserProfilePopup.tsx`** - Integrated AdminProfilePanel

## How to Use

### As an Admin

1. Click on any user's username in the app
2. The user profile popup appears
3. If you're an admin, you'll see an **"Admin Actions"** section
4. Choose an action (Grant/Deduct Coins or Levels)
5. Enter the amount and optional reason
6. Click the action button to confirm
7. A toast notification confirms the action

### Examples

**Grant 1000 Trollmonds to a User:**
1. Click username → Admin Actions panel appears
2. Click "Grant Coins"
3. Select "Trollmonds"
4. Enter amount: 1000
5. Click "Grant"

**Deduct 5 Levels for Rule Violation:**
1. Click username → Admin Actions panel appears
2. Click "Deduct Levels"
3. Enter amount: 5
4. Enter reason: "Rule violation - harassment"
5. Click "Deduct"

## Database & Transactions

All admin actions are logged in the `coin_transactions` table with:

- **type**: `admin_grant` or `admin_deduct`
- **coin_type**: `troll_coins` or `trollmonds`
- **amount**: Positive (grant) or negative (deduct)
- **description**: Auto-generated with user context
- **metadata**: Includes:
  - `deducted_by`: Admin's user ID
  - `reason`: User-provided reason
  - For levels: no special metadata

## Security & Audit

### Validation
- Amount must be > 0
- Balances cannot go negative (deduct is capped at 0)
- Levels cannot go below 1
- Admin cannot modify their own profile

### Audit Trail
All actions create transaction records that can be audited in:
- `coin_transactions` table
- User balance history
- Admin action logs

### Admin Verification
The system verifies admin status by checking:
1. `profile.role === 'admin'`
2. `profile.is_admin === true`
3. User email matches ADMIN_EMAIL
4. Current auth user must be verified admin

## Component Architecture

### AdminProfilePanel
- Props: `userId`, `username`
- Shows: Current balances and level
- States: Admin check, action type, form data, loading
- Features: Automatic profile reload after action

### UserProfilePopup
- Enhanced with conditional AdminProfilePanel rendering
- Only shows panel if:
  - Current user is admin
  - Current user is NOT viewing their own profile
- Added scroll support (max-height with overflow)

### Integration
When admin clicks username → UserProfilePopup renders → AdminProfilePanel conditionally included

## Configuration

You can modify the panel's appearance by editing:
- Button colors/styling in `AdminProfilePanel.tsx`
- Currency display format
- Input validation rules
- Toast message text

## Troubleshooting

### Admin panel doesn't show
1. Verify user role is `admin` in database
2. Check that `is_admin` flag is true or email matches admin email
3. Ensure viewing a different user's profile (not yourself)
4. Check browser console for auth errors

### Coins not updating
1. Verify user profile exists in database
2. Check that `free_coin_balance` or `troll_coins_balance` columns exist
3. Review coin_transactions table for entries
4. Check Supabase RLS policies allow updates

### Transaction not logged
1. Verify `coin_transactions` table exists
2. Check that `recordCoinTransaction` function is available
3. Review Supabase error logs
4. Check metadata serialization (no circular references)

## Future Enhancements

Potential improvements:
- Batch operations (grant to multiple users)
- Reason templates/presets
- Reason is required checkbox
- Action history for this user (recent admin changes)
- Undo functionality (revert action)
- Admin approval workflow
- Scheduled grants/deductions
- Custom coin types support
- Tier-based caps (prevent single action being too large)

## Examples of Use Cases

**Compensation for Technical Issues:**
- Deduct coins due to game bug → Grant replacement coins + bonus

**Moderation:**
- Deduct levels for rule violations
- Grant coins/levels to rewarded community helpers

**Event/Promotion:**
- Grant levels to reward participation
- Grant trollmonds for special event bonuses

**Account Maintenance:**
- Adjust balances for duplicate accounts
- Fix balance calculation errors
- Migrate coins between account types

**Streamer Rewards:**
- Grant coins to featured/top streamers
- Deduct coins for policy violations
