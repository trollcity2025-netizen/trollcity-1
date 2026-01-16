# Quick Setup Guide - New Features

## 🚀 Immediate Setup Steps

### 1. Get Gemini API Key (5 minutes)

1. Visit: https://ai.google.dev/
2. Click "Get API Key in Google AI Studio"
3. Sign in with Google account
4. Click "Create API Key"
5. Copy the key (starts with `AIza...`)

### 2. Add to Supabase (2 minutes)

1. Go to: https://supabase.com/dashboard
2. Select your project: **TrollCity**
3. Navigate to: **Settings** → **Edge Functions**
4. Find "Secrets" section
5. Click "Add new secret"
   - Name: `GEMINI_API_KEY`
   - Value: `[paste your key here]`
6. Click "Save"

### 3. Deploy Edge Function (1 minute)

```bash
cd e:\troll\trollcity-1\supabase
npx supabase functions deploy gemini-verify-user
```

**Expected Output**:
```
✅ gemini-verify-user function deployed successfully
```

---

## ✅ Feature Verification

### Test TrollsTown Restriction

1. **As Admin**:
   - Click "Troll Town" in sidebar
   - ✅ Should load 3D world normally

2. **As Regular User**:
   - Click "Troll Town" in sidebar
   - ✅ Should see "Under Construction" message

### Test Profile Completion

1. **Create Test Account**:
   - Use incognito/private window
   - Sign up with new Google account
   - ✅ Should immediately redirect to profile setup
   - ✅ Cannot access other pages until username entered

2. **Complete Profile**:
   - Enter username: `testuser123`
   - Enter full name: `Test User`
   - Click "Save Profile"
   - ✅ Should navigate to homepage
   - ✅ Can now access all pages

### Test ID Verification

1. **As Admin**:
   - Navigate to `/verify`
   - Upload any ID photo
   - Take selfie
   - ✅ Should auto-approve instantly (100% scores)

2. **As Regular User**:
   - Navigate to `/verify`
   - Upload clear ID photo
   - Take clear selfie
   - ✅ Should process with Gemini (2-3 seconds)
   - ✅ Should see match score and behavior score
   - ✅ If scores ≥75%, should auto-approve

---

## 🐛 Troubleshooting

### Issue: "Verification failed"
**Solution**: Check Gemini API key is correctly set in Supabase

### Issue: TrollsTown still accessible to non-admins
**Solution**: Hard refresh browser (Ctrl+Shift+R) to clear cache

### Issue: Profile setup not redirecting
**Solution**: 
1. Check user has no username in database
2. Clear browser cache and cookies
3. Sign out and sign in again

### Issue: Gemini verification slow (>10 seconds)
**Solution**: 
1. Check image file sizes (<5MB recommended)
2. Verify stable internet connection
3. Check Gemini API quota in Google AI Studio

---

## 📊 Monitoring

### Check Verification Status

**In Admin Dashboard**:
1. Go to User Management
2. Click any username
3. View "ID Verification" card
4. See verification history with scores

**In Database** (Supabase Studio):
```sql
SELECT 
  user_id, 
  status, 
  ai_match_score, 
  ai_behavior_score, 
  created_at 
FROM verification_requests 
ORDER BY created_at DESC 
LIMIT 20;
```

### Check User Profile Completion

```sql
SELECT 
  username, 
  full_name, 
  created_at 
FROM user_profiles 
WHERE username IS NULL OR username = '' 
ORDER BY created_at DESC;
```

---

## 🔧 Quick Fixes

### Reset User Profile Setup
```sql
-- Force user to redo profile setup
UPDATE user_profiles 
SET username = NULL 
WHERE id = '[user_id_here]';
```

### Manually Approve Verification
```sql
-- Approve a verification request
UPDATE verification_requests 
SET status = 'approved' 
WHERE user_id = '[user_id_here]';

-- Update user profile
UPDATE user_profiles 
SET 
  is_verified = true,
  id_verification_status = 'approved'
WHERE id = '[user_id_here]';
```

### Grant Admin Access to TrollsTown
```sql
-- Make user an admin
UPDATE user_profiles 
SET role = 'admin', is_admin = true 
WHERE id = '[user_id_here]';
```

---

## 📞 Need Help?

### Documentation Files
- **Full Implementation**: `USER_FLOW_SECURITY_IMPLEMENTATION.md`
- **Admin User Management**: `ADMIN_USER_MANAGEMENT_QUICK_REF.md`
- **Complete Audit**: `COMPREHENSIVE_AUDIT_COMPLETE.md`

### Contact Support
- Check console logs for errors
- Review Supabase Edge Function logs
- Test in incognito mode to rule out cache issues

---

**Setup Time**: ~10 minutes total  
**Status**: ✅ Ready to Deploy
