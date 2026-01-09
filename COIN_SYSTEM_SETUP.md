# PayPal Coin Purchase System - Setup Guide

**Status**: Production-ready  
**Last Updated**: January 9, 2026  
**Environment**: Live PayPal + Supabase Edge Functions

---

## 📋 Overview

This guide walks you through setting up a complete coin purchase system using:
- **Supabase Edge Functions** (secure server-side coin crediting)
- **PayPal Checkout** (payment processing)
- **PostgreSQL** (transaction audit trail + fraud prevention)
- **React/TypeScript** (frontend UI)

**Key Security Features**:
- ✅ Coins ONLY credited server-side after PayPal verification
- ✅ Replay attack prevention (unique capture IDs)
- ✅ Atomic transactions (all-or-nothing coin grants)
- ✅ PayPal secret key stays server-side (never exposed to frontend)
- ✅ RLS policies enforce user data isolation

---

## 🗄️ Database Setup

### 1. Run Migration

Execute the SQL migration to create the required tables:

```bash
cd supabase
supabase db push
```

This creates:
- `coin_packages` - Available coin packages
- `coin_transactions` - Audit trail of all coin purchases
- Updates `user_profiles` with `paid_coins` column
- RLS policies for security

### 2. Verify Tables Created

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('coin_packages', 'coin_transactions');

-- Verify columns
\d coin_transactions
\d coin_packages
```

### 3. Seed Coin Packages (if not auto-seeded)

```sql
INSERT INTO coin_packages (name, coins, price_usd, paypal_sku, is_active)
VALUES
  ('Bronze Pack', 1000, 4.49, 'coins_1000', TRUE),
  ('Silver Pack', 5000, 20.99, 'coins_5000', TRUE),
  ('Gold Pack', 12000, 49.99, 'coins_12000', TRUE),
  ('Platinum Pack', 25000, 99.99, 'coins_25000', TRUE),
  ('Diamond Pack', 60000, 239.99, 'coins_60000', TRUE),
  ('Legendary Pack', 120000, 459.99, 'coins_120000', TRUE)
ON CONFLICT (paypal_sku) DO NOTHING;
```

---

## 🔐 PayPal Setup

### 1. Get PayPal API Credentials

**For Sandbox (Testing)**:
1. Go to [PayPal Developer Dashboard](https://developer.paypal.com)
2. Sign in or create account
3. Navigate to **Sandbox > Accounts**
4. Create a Business account (for API calls)
5. Create a Personal account (for customer testing)
6. Find credentials in **Apps & Credentials**

**For Live (Production)**:
1. In PayPal Developer Dashboard, click **Live** tab
2. Navigate to **Apps & Credentials** > **Sandbox**
3. Your app shows `Client ID` and `Secret`

### 2. Get Credentials

You need:
```
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_client_secret_here
```

---

## 🚀 Supabase Edge Function Setup

### 1. Set Environment Variables

In **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Environment Variables**:

```
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENV=live            # or "sandbox" for testing
PAYPAL_API_BASE=https://api-m.paypal.com  # or sandbox URL
```

**For Sandbox Testing**, use:
```
PAYPAL_ENV=sandbox
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
```

### 2. Deploy Edge Functions

#### Function 1: `paypal-create-order`

**Location**: `supabase/functions/paypal-create-order/index.ts`

**What it does**:
- Validates authenticated user
- Fetches coin package from database
- Creates PayPal order with correct amount
- Returns `orderId` to frontend

**Deploy**:
```bash
supabase functions deploy paypal-create-order --no-verify-jwt
```

**Test**:
```bash
curl -X POST http://localhost:54321/functions/v1/paypal-create-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"packageId":"coins_5000"}'
```

#### Function 2: `paypal-capture-order`

**Location**: `supabase/functions/paypal-capture-order/index.ts`

**What it does**:
- Receives PayPal `orderId` from frontend
- Calls PayPal API to capture payment
- Validates payment status = COMPLETED
- Checks for replay attacks (unique capture ID)
- Credits coins via `credit_coins()` function
- Updates user profile with new balance
- Returns success + new coin balance

**Deploy**:
```bash
supabase functions deploy paypal-capture-order --no-verify-jwt
```

**Test**:
```bash
curl -X POST http://localhost:54321/functions/v1/paypal-capture-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"PAYPAL_ORDER_ID_FROM_CREATE"}'
```

---

## 🎨 Frontend Setup

### 1. Install PayPal SDK

```bash
npm install @paypal/checkout-js
```

### 2. Add Environment Variables

In `.env.local`:
```
VITE_PAYPAL_CLIENT_ID=your_paypal_client_id
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Add React Component

**Option A**: Use the provided `CoinStoreProd.tsx`

```bash
cp src/pages/CoinStoreProd.tsx src/pages/CoinStore.tsx
```

**Option B**: Add to existing App.tsx routes:

```tsx
import CoinStoreProd from './pages/CoinStoreProd'

<Route path="/coins/buy" element={<CoinStoreProd />} />
```

### 4. Update package.json (if needed)

```json
{
  "dependencies": {
    "@paypal/checkout-js": "^5.x",
    "@supabase/supabase-js": "^2.38.x",
    "react": "^18.x",
    "react-router-dom": "^6.x",
    "zustand": "^4.x"
  }
}
```

---

## ✅ Testing the Flow (Sandbox)

### Test Flow:

1. **Switch to Sandbox Mode**
   ```
   Set PAYPAL_ENV=sandbox in Supabase Edge Function environment
   ```

2. **Frontend: Select a Package**
   - Navigate to `/coins/buy`
   - Click "Bronze Pack" ($4.49)

3. **Frontend: Click PayPal Checkout**
   - PayPal button should appear
   - Click "Pay with PayPal"

4. **PayPal Sandbox: Login**
   - Use sandbox Business account credentials
   - Email: `sb-xxxxx@business.example.com`
   - Password: Your sandbox password

5. **PayPal Sandbox: Approve Payment**
   - Review payment details
   - Click "Pay Now"
   - You should see success screen

6. **Backend: Verify Capture**
   - Edge function `/paypal-capture-order` is called
   - Check Supabase logs: `supabase functions logs paypal-capture-order`
   - Should see: "PayPal order captured successfully"

7. **Database: Verify Transaction**
   ```sql
   SELECT * FROM coin_transactions 
   ORDER BY created_at DESC LIMIT 1;
   
   SELECT troll_coins, paid_coins FROM user_profiles 
   WHERE id = 'YOUR_USER_ID';
   ```

8. **Frontend: Verify Coins Updated**
   - Page should show success message
   - Coin balance should increase by package amount

---

## 🔄 Switching Between Sandbox and Live

### For Sandbox (Testing)

**In Supabase Dashboard**:
```
PAYPAL_ENV = sandbox
PAYPAL_API_BASE = https://api-m.sandbox.paypal.com
PAYPAL_CLIENT_ID = sb_xxxxx_client_id
PAYPAL_CLIENT_SECRET = sb_xxxxx_client_secret
```

**Test Accounts**:
```
Buyer Email: sb-xxxxx@personal.example.com
Buyer Password: Your_sandbox_password

Business Email: sb-xxxxx@business.example.com
Business Password: Your_sandbox_password
```

### For Live (Production)

1. **Get Live Credentials** (from PayPal Dashboard > Live tab)
2. **Update Supabase Environment**:
   ```
   PAYPAL_ENV = live
   PAYPAL_API_BASE = https://api-m.paypal.com
   PAYPAL_CLIENT_ID = your_live_client_id
   PAYPAL_CLIENT_SECRET = your_live_client_secret
   ```
3. **Test with Real PayPal Account**
4. **Monitor**: Check `coin_transactions` table for all purchases

---

## 🛡️ Security Checklist

- [ ] `PAYPAL_CLIENT_SECRET` is in Edge Function env vars only (never in frontend)
- [ ] RLS policies enabled on `coin_packages` and `coin_transactions`
- [ ] `coin_transactions` table has UNIQUE constraints on `paypal_capture_id` and `paypal_order_id`
- [ ] Frontend never directly updates user coins
- [ ] Edge functions validate PayPal status = "COMPLETED" before crediting
- [ ] `credit_coins()` function prevents double-credits via capture ID check
- [ ] Auth tokens are required on all API calls
- [ ] Coins are credited inside a database transaction (atomic)

---

## 📊 Monitoring & Debugging

### View Edge Function Logs

```bash
supabase functions logs paypal-create-order
supabase functions logs paypal-capture-order
```

### Check Transaction Status

```sql
-- All transactions for a user
SELECT * FROM coin_transactions 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;

-- Check for duplicate captures (should be none)
SELECT paypal_capture_id, COUNT(*)
FROM coin_transactions
GROUP BY paypal_capture_id
HAVING COUNT(*) > 1;

-- Total revenue
SELECT 
  COUNT(*) as total_purchases,
  SUM(coins_granted) as total_coins_sold,
  SUM(amount_usd) as total_revenue
FROM coin_transactions;
```

### PayPal API Errors

Common errors and fixes:

| Error | Cause | Fix |
|-------|-------|-----|
| `Invalid API Signature` | Wrong client secret | Verify `PAYPAL_CLIENT_SECRET` in Supabase |
| `Order not found` | OrderID doesn't exist | Ensure order was created first |
| `Payment not completed` | PayPal status ≠ COMPLETED | Check PayPal dashboard for payment status |
| `Duplicate transaction` | Trying to capture twice | Use unique `paypal_order_id` |

---

## 🚨 Troubleshooting

### Problem: Coins not credited after payment

**Solution**:
```sql
-- Check if transaction was recorded
SELECT * FROM coin_transactions 
WHERE paypal_order_id = 'PAYPAL_ORDER_ID';

-- Check user coin balance
SELECT troll_coins, paid_coins FROM user_profiles 
WHERE id = 'USER_ID';

-- Check edge function logs
supabase functions logs paypal-capture-order
```

### Problem: "PayPal order not found" error

**Solution**:
1. Verify `orderId` was returned from create-order function
2. Check if order was created in PayPal (check PayPal dashboard)
3. Ensure same PayPal environment (sandbox vs live)

### Problem: "Unauthorized" error

**Solution**:
1. Verify JWT token is valid: `supabase auth whoami`
2. Check if user is authenticated in Supabase
3. Verify Authorization header format: `Authorization: Bearer YOUR_JWT_TOKEN`

---

## 📈 Performance Optimization

### Database Indexes

Already created in migration:
```sql
CREATE INDEX idx_coin_transactions_user_id ON coin_transactions(user_id);
CREATE INDEX idx_coin_transactions_paypal_order_id ON coin_transactions(paypal_order_id);
CREATE INDEX idx_coin_transactions_paypal_capture_id ON coin_transactions(paypal_capture_id);
CREATE INDEX idx_coin_packages_active ON coin_packages(is_active);
```

### Edge Function Performance

- PayPal token is fetched fresh each time (consider caching if needed)
- All DB queries use proper indexes
- Transaction capture takes ~1-2 seconds (expected with PayPal API)

---

## 🎯 Next Steps

1. ✅ Set up database schema
2. ✅ Configure PayPal credentials
3. ✅ Deploy Edge Functions
4. ✅ Add React component to frontend
5. ✅ Test with sandbox
6. ✅ Monitor production transactions
7. ✅ Handle edge cases (timeouts, retries, webhooks)

---

## 📞 Support

For PayPal API docs: https://developer.paypal.com/docs/checkout/  
For Supabase docs: https://supabase.com/docs  
For Edge Functions: https://supabase.com/docs/guides/functions

---

**Build Date**: January 9, 2026  
**Production Ready**: ✅
