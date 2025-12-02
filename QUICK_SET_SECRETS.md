# Quick Guide: Set Square Secrets

## Fast Method (Copy & Paste)

Run these commands one by one, replacing the values with your actual Square credentials:

```bash
npx supabase secrets set SQUARE_ACCESS_TOKEN=EAAxxxxxxxxxxxxx
npx supabase secrets set SQUARE_LOCATION_ID=xxxxxxxxxxxxx
npx supabase secrets set SQUARE_APPLICATION_ID=sandbox-sq0idb-xxxxxxxxxxxxx
npx supabase secrets set SQUARE_ENVIRONMENT=production
```

## Or Use the Interactive Script

```powershell
.\set-square-secrets.ps1
```

## Get Your Square Credentials

1. Go to: https://developer.squareup.com/apps
2. Select your app
3. Go to **Credentials** tab
4. Copy:
   - **Sandbox Access Token** → `SQUARE_ACCESS_TOKEN`
   - **Application ID** → `SQUARE_APPLICATION_ID`
   - **Location ID** → Found in **Locations** section

## Verify It Worked

After setting secrets, the error should disappear. You can verify by:
- Checking Admin Dashboard → Test Square button
- Or visiting: `/payments-status` endpoint

