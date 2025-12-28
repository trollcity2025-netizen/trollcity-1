# Supabase Edge Functions Deployment Guide

## ✅ What's Been Done

I've migrated your Express API routes to Supabase Edge Functions:

> **Note:** This system now relies only on PayPal for payments/payouts; Square and Agora integrations are no longer used.

### Edge Functions Created:
1. **✅ wheel** - Complete (handles /spin, /deduct, /award)
2. **✅ auth** - Complete (handles /admin-create-user, /admin-exists, /whoami, /logout, /fix-admin-role, /signup)
3. **⏳ payments** - Needs manual completion (PayPal-based payment flow)
4. **⏳ payouts** - Needs manual completion
5. **⏳ admin** - Needs manual completion
6. **⏳ platform-fees** - Needs manual completion

## 🚀 Deployment Steps

### 1. Authenticate with Supabase

Open PowerShell and run:

```powershell
```

This will open your browser. Log in with: **trollcity2025@gmail.com**

### 2. Link to Your Supabase Project

```powershell
npx supabase link --project-ref yjxpwfalenorzrqxwmtr
```

Enter your database password when prompted (from your Supabase project settings).

### 3. Deploy Edge Functions

Deploy the completed edge functions:

```powershell
# Deploy wheel function
npx supabase functions deploy wheel --no-verify-jwt

# Deploy auth function
npx supabase functions deploy auth --no-verify-jwt
```

**Note:** `--no-verify-jwt` allows the function to handle authentication internally (like your Express routes did).

### 4. Set Environment Variables

After deploying, set the required secrets for each function:

```powershell
# Set environment variables for all functions
npx supabase secrets set SUPABASE_URL=https://yjxpwfalenorzrqxwmtr.supabase.co
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
npx supabase secrets set VITE_ADMIN_EMAIL=trollcity2025@gmail.com
npx supabase secrets set PAYPAL_CLIENT_ID=<your-paypal-client-id>
npx supabase secrets set PAYPAL_CLIENT_SECRET=<your-paypal-client-secret>
npx supabase secrets set PAYPAL_MODE=live
```

### 5. Test the Functions

Test the deployed functions:

```powershell
# Test wheel function
curl -X POST https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1/wheel/spin `
  -H "Authorization: Bearer <user-access-token>" `
  -H "Content-Type: application/json" `
  -d '{"userId":"<user-id>"}'

# Test auth function
curl -X GET https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1/auth/admin-exists
```

## 📝 Frontend Integration

### Update API Calls

Replace your Express API calls with Supabase Edge Function URLs:

#### Before (Express):
```typescript
await fetch('http://localhost:3001/api/wheel/spin', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ userId })
});
```

#### After (Edge Functions):
```typescript
await fetch('https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1/wheel/spin', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ userId })
});
```

### Files to Update:

1. **src/pages/TrollWheel.tsx**
   - Line ~250-280: Change API URL from `/api/wheel/spin` to Supabase edge function
   - Line ~320-340: Change `/api/wheel/deduct` 
   - Line ~390-410: Change `/api/wheel/award`

## Automatic Payouts (Mondays @ 1:00 PM MST)

- The `payouts` edge function now runs automatically every Monday at 1:00 PM Mountain Standard Time (`schedule: 0 20 * * 1`) and processes any creator `payout_requests` that have already been approved.
- It calculates the PayPal amount (USD/net/fees) from the stored request data, posts to PayPal using the shared credentials, and moves the record into `completed` with a `payout_audit_log` entry. Failures mark the request as `failed` so you can triage before the following Monday run.
- Keep the same PayPal secrets in both Supabase and Vercel (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=live`) so this scheduled job can authenticate and run against your production account.
- Monitor the job via `supabase functions logs payouts` and update `payout_requests` manually if a request stays `failed` for more than one cycle.

2. **src/pages/Auth.tsx**
   - Change `/api/auth/signup` to edge function URL

3. **src/pages/AdminDashboard.tsx**
   - Change `/api/auth/admin-create-user` to edge function URL

4. **Create Environment Variable**
   
   Add to `.env`:
   ```
   VITE_EDGE_FUNCTIONS_URL=https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1
   ```

5. **Update API Config**

   In `src/lib/config.ts`:
   ```typescript
   export const EDGE_FUNCTIONS_URL = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
     'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';
   ```

## 🎯 Next Steps

### For Vercel Deployment:

1. **Remove Express Dependencies** (after all functions migrated):
   ```powershell
   npm uninstall express cors @types/express @types/cors
   ```

2. **Delete /api folder** (after migrating all routes)

3. **Update Vercel Environment Variables**:
   - Remove `VITE_API_URL` 
   - Keep `VITE_EDGE_FUNCTIONS_URL=https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1`
   - Verify PayPal secrets (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=live`) are configured to match what the Supabase edge functions expect

4. **Remove `api` folder from build**:
   - Delete `api/` directory
   - Remove server-related scripts from `package.json`

### Remaining Edge Functions to Create:

To complete the migration, you need to create edge functions for:

- **payments** - PayPal payment processing and order handling
- **payouts** - Cashout requests
- **admin** - Admin dashboard operations
- **platform-fees** - Fee calculations

## ⚠️ Important Notes

1. **CORS**: Edge functions automatically handle CORS with the headers I've added
2. **Authentication**: Functions verify JWT tokens using `supabase.auth.getUser(token)`
3. **Environment**: All environment variables are accessed via `Deno.env.get()`
4. **No Node.js**: Edge functions run on Deno, not Node.js (different imports/APIs)

## 🔍 Function URLs

After deployment, your functions will be available at:

- **Wheel**: `https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1/wheel/{endpoint}`
  - `/spin` - Get a random prize
  - `/deduct` - Deduct coins for spinning
  - `/award` - Award prize to user

- **Auth**: `https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1/auth/{endpoint}`
  - `/admin-create-user` - Create user with role
  - `/admin-exists` - Check if admin exists
  - `/whoami` - Get current user info
  - `/logout` - Logout endpoint
  - `/fix-admin-role` - Fix admin role for email
  - `/signup` - User registration

## 📊 Benefits of Edge Functions

1. **No Express Server Needed** - Serverless, scales automatically
2. **Vercel-Friendly** - No server process required
3. **Global CDN** - Functions deployed to Supabase edge network
4. **Cost-Effective** - Pay per invocation, not per server hour
5. **Integrated Auth** - Direct access to Supabase auth
6. **Database Access** - Direct connection to your Supabase DB

## 🐛 Troubleshooting

### Function Fails to Deploy
```powershell
npx supabase functions deploy wheel --debug
```

### Check Function Logs
```powershell
npx supabase functions logs wheel
```

### Test Locally
```powershell
npx supabase start
npx supabase functions serve wheel
```

Then test at `http://localhost:54321/functions/v1/wheel/spin`

---

**Status**: ✅ 2/8 edge functions complete and ready to deploy
**Next**: Deploy wheel and auth functions, then migrate remaining routes
