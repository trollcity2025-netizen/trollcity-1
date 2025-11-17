# 🚀 DEPLOYMENT READY - Copy & Paste Commands

## ⚡ QUICK START DEPLOYMENT

### Step 1: Deploy Supabase Functions (Copy & Paste)

```bash
# Deploy Agora token generation function
supabase functions deploy generateagoratoken

# Deploy AI moderation function (OpenAI integration)
supabase functions deploy openaiResponse

# Verify both functions deployed
supabase functions list
```

Expected output:
```
✓ Function "generateagoratoken" deployed
✓ Function "openaiResponse" deployed
✓ Listed 2 functions
```

---

### Step 2: Set OpenAI API Key (REQUIRED for AI Moderation)

```bash
# Set the secret
supabase secrets set OPENAI_API_KEY=sk-your-openai-key-here

# Verify it was set (password hidden)
supabase secrets list
```

⚠️ **IMPORTANT:** Replace `sk-your-openai-key-here` with your actual OpenAI API key from https://platform.openai.com/api-keys

---

### Step 3: Verify Supabase Functions are Working

```bash
# Check function logs for errors
supabase functions logs generateagoratoken
supabase functions logs openaiResponse

# Test token generation manually (optional)
curl -X POST http://localhost:54321/functions/v1/generateagoratoken \
  -H "Content-Type: application/json" \
  -d '{"body": {"channelName": "test_channel", "uid": 123, "role": "publisher"}}'
```

---

### Step 4: Vercel Environment Variables

Go to: **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Add these variables:

```
VITE_AGORA_APP_ID=<your_agora_app_id>
VITE_AGORA_APP_CERTIFICATE=<your_agora_app_certificate>
VITE_SUPABASE_URL=<your_supabase_url>
VITE_SUPABASE_ANON_KEY=<your_supabase_anon_key>
```

Where to find these:
- **VITE_AGORA_APP_ID**: Agora Console → Projects → Your Project → App ID
- **VITE_AGORA_APP_CERTIFICATE**: Agora Console → Projects → Your Project → Primary Certificate
- **VITE_SUPABASE_URL**: Supabase Dashboard → Project Settings → API → Project URL
- **VITE_SUPABASE_ANON_KEY**: Supabase Dashboard → Project Settings → API → anon public

---

### Step 5: Deploy to Vercel

**Option A: Git Auto-Deploy (Recommended)**
```bash
git add .
git commit -m "feat: CashApp-only payouts, AI chat moderation, verified Agora & Vercel compliance"
git push origin main
# Vercel auto-deploys on push
```

**Option B: Vercel CLI**
```bash
# Install CLI (if needed)
npm i -g vercel

# Deploy to production
vercel --prod

# Watch deployment logs
vercel logs <your-deployment-url>
```

---

## ✅ POST-DEPLOYMENT TESTS

### Test 1: CashApp Payment Validation
```bash
# In browser console, test validation
const input = '$100.00';
console.log(input.startsWith('$')); // Should be: true

const invalid = '100.00';
console.log(invalid.startsWith('$')); // Should be: false
```

**Manual Test:**
1. Go to deployed app
2. Navigate to Profile
3. Scroll to "💰 CashApp Payout (Primary)"
4. Type `100` → Should show red ❌ error
5. Type `$100` → Should show green ✓ valid
6. Button should enable only when valid

---

### Test 2: AI Chat Moderation
```bash
# Check function deployment
curl https://<your-supabase-url>/functions/v1/openaiResponse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-anon-key>" \
  -d '{
    "body": {
      "prompt": "Is \"hello world\" appropriate for a family stream? Reply with one word: approved, flag, or delete.",
      "model": "gpt-4o-mini",
      "max_tokens": 10
    }
  }'
```

**Manual Test:**
1. Go to deployed app → GoLive
2. Start a test stream
3. Open ChatBox
4. Send message: `"Hi everyone!"` → Should send (approved)
5. Send message with profanity → Should block (delete)
6. Send borderline message → Should flag (but send)

---

### Test 3: Verify All Files Deployed

```bash
# Check if dist folder exists and has files
ls dist/
# Should show: index.html, assets/, manifest.webmanifest, etc.

# Verify Vite build completed
npm run build
# Should output: dist/index.html (15KB) ...
```

---

## 🔍 TROUBLESHOOTING

### Issue: "OPENAI_API_KEY not found"

**Solution:**
```bash
# Verify secret is set
supabase secrets list

# If not found, set it again
supabase secrets set OPENAI_API_KEY=sk-your-key-here

# Wait 30 seconds for Supabase to propagate
```

---

### Issue: "Agora token generation failed"

**Solution:**
```bash
# Check function logs
supabase functions logs generateagoratoken

# Verify Agora credentials
echo $AGORA_APP_ID
echo $AGORA_APP_CERTIFICATE

# If empty, set them:
supabase secrets set AGORA_APP_ID=your-app-id
supabase secrets set AGORA_APP_CERTIFICATE=your-certificate
```

---

### Issue: "Chat moderation not working"

**Solution:**
```bash
# Check if openaiResponse function exists
supabase functions list

# Check function code
supabase functions download openaiResponse

# If missing, redeploy
supabase functions deploy openaiResponse

# Check recent logs
supabase functions logs openaiResponse --tail
```

---

### Issue: "Build failed on Vercel"

**Solution:**
```bash
# Verify local build works
npm run build
# Should complete without errors

# Check node_modules
npm install

# Try building again
npm run build

# If still fails, check Vercel build logs:
# Vercel Dashboard → Deployments → Failed Deployment → View Logs
```

---

## 📋 FINAL CHECKLIST BEFORE LAUNCH

- [ ] All Supabase functions deployed (`supabase functions list` shows 2 functions)
- [ ] OPENAI_API_KEY secret set (`supabase secrets list` shows key is set)
- [ ] Vercel env vars configured (4 VITE_ variables set)
- [ ] Code pushed to GitHub and deployed to Vercel
- [ ] CashApp validation works ($ symbol requirement)
- [ ] AI moderation works (test chat message)
- [ ] Earnings page shows CashApp notice
- [ ] GoLive stream starts without token errors
- [ ] Mobile responsive (tested on phone emulator)
- [ ] No console errors (check browser DevTools)

---

## 🎯 MONITORING DURING LAUNCH

**Watch for errors:**
```bash
# Real-time Supabase function logs
supabase functions logs generateagoratoken --tail
supabase functions logs openaiResponse --tail

# Vercel deployment logs
vercel logs <your-app-url>

# Supabase Analytics
# Dashboard → Analytics → Edge Functions → Response times & errors
```

---

## 📞 SUPPORT

If deployment fails:
1. Check Vercel build logs: https://vercel.com/dashboard
2. Check Supabase function logs: `supabase functions logs <function-name>`
3. Verify all env vars are set and correct
4. Check for typos in API keys (common issue)
5. Ensure Supabase and OpenAI credits are sufficient

---

**Status:** ✅ READY FOR DEPLOYMENT
**Last Updated:** November 13, 2025
**Estimated Deploy Time:** 5-10 minutes
**Downtime:** None (Vercel auto-scales)

