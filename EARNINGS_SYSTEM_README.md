# Earnings System - Implementation Summary

## Overview
Comprehensive earnings tracking and payout management system for TrollCity, including user-facing earnings dashboard, admin earnings dashboard, monthly breakdowns, payout history, IRS $600 threshold tracking, and CSV export functionality.

## Database Structure

### Table: `payout_requests`
- `id` UUID (primary key)
- `user_id` UUID (references user_profiles)
- `cash_amount` numeric(10,2) - USD amount
- `coins_redeemed` bigint - Coins redeemed for payout
- `status` text - 'pending', 'approved', 'paid', 'rejected'
- `created_at` timestamptz
- `processed_at` timestamptz (nullable)
- `admin_id` UUID (references user_profiles, nullable) - Admin who processed
- `notes` text (nullable)

**Indexes:**
- `idx_payout_requests_user_id` on `user_id`
- `idx_payout_requests_status` on `status`
- `idx_payout_requests_created_at` on `created_at`
- `idx_payout_requests_user_status` on `(user_id, status)`

### SQL Views Created

1. **`earnings_view`** - Comprehensive earnings summary per user
   - Total earned coins
   - Current month earnings
   - Yearly paid USD
   - IRS threshold status
   - Pending requests count
   - Lifetime paid USD
   - Last payout date

2. **`monthly_earnings_breakdown`** - Monthly earnings by user
   - Coins earned from gifts
   - Gift count
   - Unique gifters
   - Paid vs free coins breakdown

3. **`payout_history_view`** - Complete payout history
   - All payout requests with user info
   - Admin who processed
   - Status and dates

4. **`irs_threshold_tracking`** - IRS 1099 threshold tracking
   - Yearly totals per user
   - $600 threshold status
   - 1099 requirement flag

## Frontend Pages

### 1. User Earnings Dashboard (`/account/earnings`)
**File:** `src/pages/EarningsDashboard.tsx`

**Features:**
- Earnings summary cards (Total Earned, Withdrawable, This Month, Lifetime Paid)
- IRS $600 threshold progress bar with warnings
- Monthly earnings breakdown table
- Payout history table
- Recent earnings transactions list
- Pending payout alerts
- "Request Payout" button linking to `/withdraw`

**Data Sources:**
- `earnings_view` for summary
- `monthly_earnings_breakdown` for monthly data
- `payout_history_view` for payout history
- `coin_transactions` for recent transactions

### 2. Admin Earnings Dashboard (`/admin/earnings`)
**File:** `src/pages/admin/AdminEarningsDashboard.tsx`

**Features:**
- Summary cards (Total Earnings, Total Paid Out, Over $600 Count, Pending Requests)
- Creator earnings table with:
  - Search by username
  - Filter by IRS threshold status
  - Sort by earnings/payouts/threshold
  - Year selector
- IRS 1099 threshold tracking table
- Payout history table
- CSV export buttons:
  - Export Earnings Report
  - Export Payout History

**Data Sources:**
- `earnings_view` for creator list
- `irs_threshold_tracking` for threshold data
- `payout_history_view` for payout history

### 3. Withdraw Page (`/withdraw`)
**File:** `src/pages/Withdraw.tsx`

**Features:**
- Display current withdrawable balance (paid_coin_balance)
- Minimum withdrawal: 10,000 coins ($100)
- Submit payout request to `payout_requests` table
- Uses `coins_redeemed` and `cash_amount` columns

## Migration File

**File:** `supabase/migrations/20251231_earnings_system.sql`

**What it does:**
1. Ensures `payout_requests` table has correct structure:
   - Adds `cash_amount` (migrates from `amount_usd` if exists)
   - Adds `coins_redeemed` (migrates from `requested_coins`, `coin_amount`, or `coins_used` if exists)
   - Adds `admin_id` (migrates from `processed_by` if exists)
   - Ensures status constraint is correct

2. Creates all SQL views for earnings tracking

3. Grants SELECT permissions to authenticated users

## Key Features

### IRS $600 Threshold Tracking
- Automatically calculates yearly payout totals
- Flags users over $600 threshold (requires 1099)
- Warns users approaching $600 (nearing threshold)
- Shows progress bar on user dashboard
- Admin dashboard shows all users over threshold

### Monthly Breakdown
- Tracks earnings by month
- Shows gift count and unique gifters
- Separates paid vs free coins earned
- Available in both user and admin dashboards

### Payout History
- Complete history of all payout requests
- Shows status, amounts, dates
- Tracks which admin processed each payout
- Filterable and sortable in admin dashboard

### CSV Export
- Admin can export earnings report (all creators)
- Admin can export payout history
- Includes all relevant columns for accounting/tax purposes

## Routes

- `/account/earnings` - User earnings dashboard (protected)
- `/admin/earnings` - Admin earnings dashboard (admin only)
- `/withdraw` - Request payout page (protected)

## Data Flow

1. **Earnings Calculation:**
   - Gifts received → `gifts` table → `total_earned_coins` in `user_profiles`
   - Coin transactions → `coin_transactions` table (type: 'gift_receive')
   - Views aggregate both sources

2. **Payout Request:**
   - User submits request → `payout_requests` table (status: 'pending')
   - Admin reviews → Updates status to 'approved' or 'rejected'
   - Admin processes → Updates status to 'paid', sets `processed_at`, deducts coins

3. **IRS Tracking:**
   - Calculates yearly totals from `payout_requests` where status = 'paid'
   - Flags users over $600
   - Updates in real-time as payouts are processed

## Notes

- Coin-to-USD conversion: 100 coins = $1 (0.01 per coin)
- Minimum withdrawal: 10,000 coins ($100)
- Views handle multiple column name variations for backward compatibility
- All views use COALESCE to handle null values gracefully

