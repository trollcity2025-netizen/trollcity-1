# Production Deployment Checklist

## Pre-Deployment Steps Completed

### 1. ✅ Database Cleanup
- Created migration: `20251126_delete_test_accounts.sql`
- Removes all test users (is_test_user = true)
- Removes accounts with test/fake/demo emails
- Cleans up orphaned data
- Resets testing mode

### 2. ✅ Code Ready
- TypeScript compilation: PASSING
- Build successful: dist/ generated
- All errors fixed
- Environment variables configured

### 3. ✅ Features Complete
- Testing mode system
- Wheel spin (fixed animation)
- Insurance packages (6 options)
- Coin transactions
- Admin dashboard
- Edge Functions API support

## Deployment Instructions

### Step 1: Execute Database Migration

Login to Supabase Dashboard (trollcity2025@gmail.com):
1. Go to SQL Editor
2. Execute: `supabase/migrations/20251126_delete_test_accounts.sql`
3. Verify test accounts are deleted

### Step 2: Deploy to Vercel

#### Option A: Via Vercel Dashboard (kaintowns83@gmail.com)

1. **Login to Vercel**
   ```
   https://vercel.com
   Email: kaintowns83@gmail.com
   ```

2. **Import Project**
   - Click "Add New" → "Project"
   - Import from GitHub: `kaintowns83-cmd/trollcity`
   - Framework Preset: Vite
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Configure Environment Variables**
   Add all variables from `.env`:
   ```
   VITE_SUPABASE_URL=https://yjxpwfalenorzrqxwmtr.supabase.co
   VITE_SUPABASE_ANON_KEY=[from .env]
   VITE_API_URL=https://your-app.vercel.app
   VITE_EDGE_FUNCTIONS_URL=https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1
   VITE_AGORA_APP_ID=7b95b64b0e154f7ab931e2abf000e694
   VITE_BACKEND_TOKEN_SERVER_URL=https://your-app.vercel.app/api/agora-token
   VITE_SQUARE_APPLICATION_ID=sq0idp-CrLUQ0nBsGw514BdmRCKcw
   VITE_SQUARE_LOCATION_ID=LC50JZXVG8F0M
   VITE_SQUARE_ENVIRONMENT=production
   VITE_SQUARE_ACCESS_TOKEN=[from .env]
   VITE_ADMIN_EMAIL=trollcity2025@gmail.com
   
   # Backend variables
   SUPABASE_URL=https://yjxpwfalenorzrqxwmtr.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=[from .env]
   SQUARE_ACCESS_TOKEN=[from .env]
   SQUARE_ENVIRONMENT=production
   SQUARE_APPLICATION_ID=sq0idp-CrLUQ0nBsGw514BdmRCKcw
   SQUARE_LOCATION_ID=LC50JZXVG8F0M
   AGORA_APP_ID=7b95b64b0e154f7ab931e2abf000e694
   AGORA_APP_CERTIFICATE=[from .env]
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Note the deployment URL

#### Option B: Via Vercel CLI

```powershell
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Follow prompts:
# - Link to existing project? No
# - Project name: trollcity
# - Directory: ./
# - Override settings? No
```

### Step 3: Post-Deployment Configuration

1. **Update Dynamic URLs**
   
   After deployment, update these environment variables in Vercel:
   ```
   VITE_API_URL=https://your-deployment-url.vercel.app
   VITE_BACKEND_TOKEN_SERVER_URL=https://your-deployment-url.vercel.app/api/agora-token
   ```
   
   Then redeploy.

2. **Configure Square Webhook**
   
   Login to Square Developer Dashboard:
   - Go to Webhooks
   - Add: `https://your-deployment-url.vercel.app/api/square/webhook`
   - Subscribe to: payment.created, payment.updated
   - Copy signature key → Add to Vercel env vars as `SQUARE_WEBHOOK_SIGNATURE_KEY`

3. **Verify Production**
   - Visit deployment URL
   - Test signup (should be blocked by testing mode being disabled)
   - Login as admin (trollcity2025@gmail.com)
   - Enable testing mode from admin dashboard if needed
   - Test wheel spin
   - Test coin purchase
   - Verify insurance packages

### Step 4: Enable Production Access

**Option A: Keep Testing Mode (Recommended for soft launch)**
- Login as admin
- Go to Admin Dashboard
- Enable testing mode
- Set limit (e.g., 50 users)
- Share signup link with early testers

**Option B: Full Public Launch**
- Disable testing mode
- Open signups to everyone
- Monitor admin dashboard for activity

## Rollback Plan

If issues occur:
1. Revert Vercel deployment to previous version
2. Check Vercel logs for errors
3. Verify environment variables
4. Contact support if needed

## Support Contacts

- **Vercel Account**: kaintowns83@gmail.com
- **Supabase Account**: trollcity2025@gmail.com
- **Admin Email**: trollcity2025@gmail.com

---

**Deployment Date**: 2025-11-26
**Status**: Ready for deployment ✅
