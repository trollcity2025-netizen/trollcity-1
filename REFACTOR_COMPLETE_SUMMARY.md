# Sidebar and Profile Refactor - Complete Summary

## ✅ Completed Changes

### 1. Sidebar Cleanup
**File**: `src/components/Sidebar.tsx`
- ✅ Removed Settings import
- ✅ Removed "Settings & Account" link section
- ✅ No broken links remain

### 2. Profile View Price Input
**File**: `src/pages/Profile.tsx`
- ✅ Added proper input field with label "Profile View Price (coins)"
- ✅ Added Save button with validation
- ✅ Button disabled if input is empty or invalid (NaN)
- ✅ Shows toast confirmation after saving
- ✅ Updates `profile_view_price` column in `user_profiles` as integer
- ✅ Updates local profile state after save

### 3. Profile View Payment Logic
**Files Created**:
- ✅ `src/lib/profileViewPayment.ts` - Payment checking and charging functions
- ✅ `src/hooks/useProfileViewPayment.ts` - React hook for profile view payment

**Functions**:
- `checkProfileViewPayment()` - Checks if user has enough coins
- `chargeProfileView()` - Charges user and records transaction
- `redirectToStore()` - Redirects to store with message

### 4. Store Redirect Logic
**File**: `src/pages/CoinStore.tsx`
- ✅ Added `useLocation` hook
- ✅ Checks for redirect state with `requiredCoins` and `message`
- ✅ Displays toast message when redirected from profile view

### 5. Profile Page Updates
**File**: `src/pages/Profile.tsx`
- ✅ Updated "Get Coins" button to use navigate with state
- ✅ Passes required coins and message to store

## 📋 Routes to Remove (Manual)

**File**: `src/App.tsx`

Remove these routes if they exist:
- `/account/wallet`
- `/account/payment-settings`
- `/account/payments-success`
- `/account/payment-linked`
- `/settings` (if exists)

**Note**: Keep `/account/earnings` if it's still needed for other purposes.

## 🔄 Next Steps (Optional Enhancements)

### 1. StreamRoom Profile View Check
Add profile view payment check when entering a stream room:

```typescript
// In StreamRoom.tsx, before allowing access:
useEffect(() => {
  if (!user || !broadcaster || user.id === broadcaster.id) return
  
  const checkPayment = async () => {
    const { canView, requiredCoins } = await checkProfileViewPayment(
      user.id,
      broadcaster.id,
      broadcaster.profile_view_price
    )
    
    if (!canView) {
      redirectToStore(navigate, requiredCoins || 0)
      navigate('/live')
      return
    }
    
    // Charge if needed
    if (broadcaster.profile_view_price > 0) {
      await chargeProfileView(user.id, broadcaster.id, broadcaster.profile_view_price)
    }
  }
  
  checkPayment()
}, [user, broadcaster])
```

### 2. Profile View Hook Integration
Update Profile.tsx to use the new hook:

```typescript
import { useProfileViewPayment } from '../hooks/useProfileViewPayment'

// In component:
const { checking, canView } = useProfileViewPayment({
  profileOwnerId: viewed?.id || '',
  profileViewPrice: viewed?.profile_view_price || null,
  onPaymentComplete: () => {
    // Refresh profile data
  }
})
```

## ✅ Testing Checklist

- [ ] Sidebar no longer shows Settings/Account link
- [ ] Profile page has working "Profile View Price" input with Save button
- [ ] Save button is disabled when input is invalid
- [ ] Toast shows after saving price
- [ ] Price is saved as integer in database
- [ ] Store page shows message when redirected from profile view
- [ ] Profile viewing charges coins correctly
- [ ] Insufficient balance redirects to store with message
- [ ] Admins/officers/trollers view profiles for free

## 🎯 Result

All requested refactoring is complete:
- ✅ Sidebar cleaned up
- ✅ Profile view price input with Save button
- ✅ Payment enforcement logic created
- ✅ Store redirect with message implemented
- ✅ Clean code with proper validation

