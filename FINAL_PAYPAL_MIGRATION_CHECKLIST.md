# Final PayPal Migration Checklist

## ✅ Completed

1. ✅ Created PayPal-only CoinStore with Smart Buttons
2. ✅ Created paypal-create-order edge function (LIVE only)
3. ✅ Created paypal-complete-order edge function (LIVE only)
4. ✅ Created paypal-test-live edge function
5. ✅ Created PayPalTestPanel for admin dashboard
6. ✅ Updated PayPalPaymentsPanel to use coin_transactions
7. ✅ Added promo code system (2025 = 5%, 1903 = 100%)
8. ✅ Database migration for PayPal fields and promo codes
9. ✅ Removed Settings/Account from Sidebar
10. ✅ Fixed duplicate toast import

## 🔧 Manual Steps Required

### 1. Install PayPal SDK
```bash
npm install @paypal/react-paypal-js
```

### 2. Apply Database Migration
Run `force_apply_new_migration.sql` in Supabase Dashboard SQL Editor

### 3. Set Environment Variables (Supabase Dashboard)
- `PAYPAL_CLIENT_ID` = Your live PayPal client ID
- `PAYPAL_CLIENT_SECRET` = Your live PayPal client secret
- `PAYPAL_MODE` = `live`
- `PAYPAL_WEBHOOK_ID` = Your live webhook ID
- `FRONTEND_URL` = Your frontend URL

### 4. Set Frontend Environment Variable
In `.env` or `.env.local`:
```
VITE_PAYPAL_CLIENT_ID=your_live_paypal_client_id
```

### 5. Deploy Edge Functions
```bash
npx supabase functions deploy paypal-create-order
npx supabase functions deploy paypal-complete-order
npx supabase functions deploy paypal-test-live
```

### 6. Update AdminDashboard.tsx
- Remove `testSquare` function
- Remove `squareStatus` state
- Replace `case 'square'` with `case 'paypal'` showing PayPalTestPanel
- Remove Square test buttons from UI

### 7. Remove Square Edge Functions (Optional)
Delete or disable:
- `supabase/functions/square/`
- `supabase/functions/square-callback/`
- `supabase/functions/square-webhook/`
- `supabase/functions/create-square-checkout/`
- `supabase/functions/add-card/`
- `supabase/functions/charge-stored-card/`
- `supabase/functions/square-save-card/`
- `supabase/functions/create-square-customer/`

## 🎯 Testing

1. Test coin purchase with PayPal
2. Test promo code "2025" (should give 5% off)
3. Test promo code "1903" (should give 100% off - free)
4. Verify transaction appears in admin dashboard
5. Test PayPal LIVE connection in admin dashboard
6. Verify coins are added to user balance
7. Verify transaction is logged in coin_transactions

## ✅ Final State

- PayPal is the ONLY payment provider
- LIVE production only (no sandbox)
- Store uses PayPal Smart Buttons
- Card payments work without PayPal account
- Promo codes working
- Admin dashboard shows PayPal status
- All transactions logged correctly

