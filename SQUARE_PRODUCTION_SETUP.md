# Square Production Setup - Fix "TestCard" Issue

## Problem
Cards are displaying as "TestCard •••• 5734" instead of showing real card brands (Visa, Mastercard, etc.).

## Root Cause
The application is currently using **SANDBOX** Square credentials instead of **PRODUCTION** credentials.

Current Application ID: `sq0idp-CrLUQ0nBsGw514BdmRCKcw` (SANDBOX)

## Solution: Switch to Production Credentials

### Step 1: Access Your Square Dashboard
1. Go to https://developer.squareup.com/apps
2. Log in with your Square account
3. Select your application

### Step 2: Get Production Credentials
Click on **Production** tab (not Sandbox) and copy:

1. **Production Application ID** 
   - Looks like: `sq0idp-XXXXXXXXXXXXXXXX` (production format)
   - Do NOT use the sandbox ID

2. **Production Access Token**
   - Looks like: `EAAAl...` (production tokens start with EAAAl)
   - Do NOT use sandbox token (starts with EAAA)

3. **Production Location ID**
   - Find this in your Square Dashboard > Locations
   - Do NOT use sandbox location

### Step 3: Update Environment Variables

Update your `.env` file with production credentials:

```env
# Square Production Credentials
VITE_SQUARE_APPLICATION_ID=sq0idp-YOUR_PRODUCTION_APP_ID
SQUARE_APPLICATION_ID=sq0idp-YOUR_PRODUCTION_APP_ID
VITE_SQUARE_LOCATION_ID=YOUR_PRODUCTION_LOCATION_ID
SQUARE_LOCATION_ID=YOUR_PRODUCTION_LOCATION_ID
SQUARE_ACCESS_TOKEN=YOUR_PRODUCTION_ACCESS_TOKEN
```

### Step 4: Restart Your Application

```powershell
# Stop all Node processes
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

# Start the dev server
npm run dev
```

### Step 5: Verify the Fix

1. Go to your Coin Store or Payment Settings
2. Try adding a real debit/credit card
3. The card should now save with the correct brand (Visa, Mastercard, Amex, etc.) instead of "TestCard"

## Verification Endpoint

Check your current Square mode:
```
GET /api/square/environment-check
```

Response will show:
- `mode`: "sandbox" or "production"
- `configured`: true/false
- `warning`: null (if production) or warning message (if sandbox)

## Important Notes

⚠️ **Do NOT commit production credentials to Git**
- Add `.env` to your `.gitignore` (should already be there)
- Use environment variables in production deployment (Vercel, Railway, etc.)

⚠️ **Square Requirements**
- Production mode processes REAL payments
- Test cards will be declined in production
- Real cards will incur actual charges

⚠️ **Testing After Switch**
- Use a real card with a small amount ($0.01-$1.00)
- Verify the transaction appears in Square Dashboard
- Check that card brand displays correctly

## Security Checklist

- [ ] Production credentials stored in `.env` (not committed)
- [ ] `.env` is in `.gitignore`
- [ ] Production environment variables set in deployment platform
- [ ] Sandbox credentials removed from production deployment
- [ ] Webhook signature verification enabled
- [ ] HTTPS enabled on production domain

## Still Showing TestCard?

If cards still show as "TestCard" after updating:

1. **Clear browser cache and cookies**
2. **Hard refresh** (Ctrl+Shift+R or Cmd+Shift+R)
3. **Verify environment variables loaded**:
   - Check browser console for Square initialization logs
   - Look for sandbox warning messages
4. **Check API response**:
   - Visit `/api/square/environment-check`
   - Should show `"mode": "production"`
5. **Restart server completely**:
   - Kill all Node processes
   - Restart both frontend and backend

## Contact Square Support

If issues persist after switching to production:
- Email: developers@squareup.com
- Developer Forum: https://developer.squareup.com/forums
- Support: https://squareup.com/help/contact

---

**Last Updated**: November 26, 2025
**Issue**: Cards saving as TestCard
**Status**: Requires production credentials from Square Dashboard
