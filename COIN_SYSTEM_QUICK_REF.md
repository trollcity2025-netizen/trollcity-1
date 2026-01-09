# PayPal Coin System - Quick Reference

## ⚡ Quick Start (5 min)

### 1. Run Database Migration
```bash
supabase db push
```

### 2. Set Environment Variables (Supabase Dashboard)
```
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_ENV=live           # Use "sandbox" for testing
```

### 3. Deploy Edge Functions
```bash
supabase functions deploy paypal-create-order --no-verify-jwt
supabase functions deploy paypal-capture-order --no-verify-jwt
```

### 4. Install Frontend Dependencies
```bash
npm install @paypal/checkout-js
```

### 5. Add to .env.local
```
VITE_PAYPAL_CLIENT_ID=your_client_id
```

### 6. Use Component
```tsx
import CoinStoreProd from './pages/CoinStoreProd'
<Route path="/coins" element={<CoinStoreProd />} />
```

---

## 🔄 Transaction Flow

```
User                Frontend              Edge Function          PayPal              Database
 |                     |                       |                    |                  |
 ├─ Click "Buy" ─────→ |                       |                    |                  |
 |                     ├─ POST /create-order ──→                   |                  |
 |                     |                       ├─ Get Token ───────→ PayPal Auth      |
 |                     |                       ← orderId ────────────────────        |
 |                     ← orderId ─────────────→                    |                  |
 |                     |                       |                    |                  |
 ├─ Approve in PayPal─→ | PayPal Dialog                             |                  |
 |                     |                       |                    |                  |
 ├─ Return to App ────→ ├─ POST /capture ─────→                   |                  |
 |                     |                       ├─ Capture Order ───→ PayPal API       |
 |                     |                       ← COMPLETED ────────────────────      |
 |                     |                       ├─ Check Capture ID ──────────────────→ Check duplicate
 |                     |                       ├─ Credit Coins ──────────────────────→ Update balance
 |                     |                       ├─ Record Transaction────────────────→ Insert row
 |                     |                       ← success + coinsAdded ──────         |
 |                     ← success ─────────────→                    |                  |
 |                     ├─ Show "+XXX coins"    |                    |                  |
 |                     └─ Update UI            |                    |                  |
 |                                             |                    |                  |
```

---

## 📝 API Endpoints

### `POST /functions/v1/paypal-create-order`
**Request**:
```json
{
  "packageId": "coins_5000"
}
```

**Response** (Success):
```json
{
  "orderId": "9DW12345ABC",
  "packageId": "coins_5000"
}
```

**Response** (Error):
```json
{
  "error": "Invalid package"
}
```

---

### `POST /functions/v1/paypal-capture-order`
**Request**:
```json
{
  "orderId": "9DW12345ABC"
}
```

**Response** (Success):
```json
{
  "success": true,
  "coinsAdded": 5000,
  "orderId": "9DW12345ABC",
  "captureId": "1A234567K",
  "usdAmount": 20.99
}
```

**Response** (Error):
```json
{
  "success": false,
  "error": "Payment not completed",
  "status": "PENDING"
}
```

---

## 💰 Coin Packages

| Package | Coins | Price | $/1K Coins |
|---------|-------|-------|-----------|
| Bronze | 1,000 | $4.49 | $4.49 |
| Silver | 5,000 | $20.99 | $4.20 |
| Gold | 12,000 | $49.99 | $4.17 |
| Platinum | 25,000 | $99.99 | $4.00 |
| Diamond | 60,000 | $239.99 | $4.00 |
| Legendary | 120,000 | $459.99 | $3.83 |

---

## 🔐 Authentication

All endpoints require:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

Get JWT from Supabase:
```typescript
const { data } = await supabase.auth.getSession()
const token = data.session?.access_token
```

---

## 🧪 Sandbox Test Accounts

**Personal (Buyer)**:
```
Email: sb-xxxxx@personal.example.com
Password: From PayPal Dashboard
```

**Business (Receiver)**:
```
Email: sb-xxxxx@business.example.com
Password: From PayPal Dashboard
```

---

## 🗄️ Database Queries

**View all transactions**:
```sql
SELECT * FROM coin_transactions ORDER BY created_at DESC;
```

**View user's purchases**:
```sql
SELECT * FROM coin_transactions 
WHERE user_id = 'USER_UUID'
ORDER BY created_at DESC;
```

**Check for duplicate captures** (should be 0):
```sql
SELECT COUNT(*) FROM (
  SELECT paypal_capture_id, COUNT(*) 
  FROM coin_transactions 
  GROUP BY paypal_capture_id 
  HAVING COUNT(*) > 1
) duplicates;
```

**Revenue report**:
```sql
SELECT 
  DATE(created_at) as day,
  COUNT(*) as transactions,
  SUM(coins_granted) as coins_sold,
  SUM(amount_usd)::NUMERIC(10,2) as revenue
FROM coin_transactions
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

---

## ⚙️ Configuration

**Sandbox** (Testing):
```
PAYPAL_ENV=sandbox
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
```

**Live** (Production):
```
PAYPAL_ENV=live
PAYPAL_API_BASE=https://api-m.paypal.com
```

---

## 🐛 Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing orderId` | Request missing orderId field | Include `"orderId": "..."` in request |
| `Invalid package` | PackageId doesn't exist | Check package ID against database |
| `Unauthorized` | No JWT token or token expired | Sign in and get fresh token |
| `Payment not completed` | PayPal payment pending/failed | Check PayPal dashboard |
| `Transaction already processed` | Duplicate capture attempt | Use new orderId for new purchase |
| `Failed to get PayPal token` | Wrong client ID/secret | Verify credentials in Supabase |

---

## 📊 Monitoring

**Edge Function Logs**:
```bash
supabase functions logs paypal-create-order
supabase functions logs paypal-capture-order
```

**Check Last 5 Transactions**:
```sql
SELECT 
  created_at,
  user_id,
  coins_granted,
  amount_usd,
  paypal_status
FROM coin_transactions
ORDER BY created_at DESC
LIMIT 5;
```

---

## 🚀 Deploy Checklist

- [ ] Database migration applied
- [ ] PayPal credentials in Supabase env vars
- [ ] Edge functions deployed
- [ ] Frontend dependencies installed
- [ ] `.env.local` configured
- [ ] Component integrated in routes
- [ ] Tested with sandbox
- [ ] Verified coins credited correctly
- [ ] Checked transaction history in DB
- [ ] Monitoring setup complete

---

## 📚 Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260109_coin_system.sql` | Database schema |
| `supabase/functions/paypal-create-order/index.ts` | Create PayPal order |
| `supabase/functions/paypal-capture-order/index.ts` | Capture & credit coins |
| `src/pages/CoinStoreProd.tsx` | React component |
| `COIN_SYSTEM_SETUP.md` | Full setup guide |
| `COIN_SYSTEM_QUICK_REF.md` | This file |

---

**Build Date**: January 9, 2026  
**Environment**: Production + Live PayPal
