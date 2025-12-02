# PayPal Edge Function Environment Variables Setup

## Issue: PayPal Coin Store Stuck on "Processing..."

This happens when environment variables are missing or incorrectly named in Supabase Edge Functions.

## Required Environment Variables

Verify these **EXACT** variable names in Supabase Dashboard:

### Step 1: Go to Supabase Dashboard
1. Navigate to: **Project → Settings → Edge Functions → Secrets**
2. Or: **Project → Functions → Environment Variables**

### Step 2: Verify These Exact Names

Make sure these environment variables exist with these **EXACT** names (case-sensitive):

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_MODE
FRONTEND_URL
```

### Step 3: Set Values

- **SUPABASE_URL**: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- **SUPABASE_SERVICE_ROLE_KEY**: Your service role key (found in Project Settings → API)
- **PAYPAL_CLIENT_ID**: Your live PayPal client ID
- **PAYPAL_CLIENT_SECRET**: Your live PayPal client secret
- **PAYPAL_MODE**: Set to `live` (must be exactly "live")
- **FRONTEND_URL**: Your frontend URL (e.g., `https://trollcity.app`)

### Step 4: Redeploy Functions

After setting/verifying environment variables, redeploy both functions:

```bash
npx supabase functions deploy paypal-create-order
npx supabase functions deploy paypal-complete-order
```

## Common Issues

### ❌ Wrong Variable Names
- `SUPABASE_SERVICE_KEY` (wrong) → `SUPABASE_SERVICE_ROLE_KEY` (correct)
- `PAYPAL_MODE=production` (wrong) → `PAYPAL_MODE=live` (correct)

### ❌ Missing Variables
If any of the required variables are missing, the function will return:
```json
{
  "error": "Server configuration error",
  "message": "Missing required environment variables. Please check Supabase Edge Function secrets."
}
```

### ✅ Verification
After deployment, check the function logs in Supabase Dashboard to ensure no environment variable errors appear.

## Testing

1. Try making a coin purchase
2. Check browser console for errors
3. Check Supabase Edge Function logs for detailed error messages
4. If still stuck on "Processing...", verify all environment variables are set correctly

