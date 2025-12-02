# Quick Fixes Checklist

## 1. Messages Not Sending
**File**: `src/pages/Messages.tsx`
- Add `e.preventDefault()` to form submit handler
- Ensure message is inserted into `messages` table
- Check real-time subscription is active
- Add error handling with toast notifications

## 2. Remove "Save Payment Method" from Store
**File**: `src/pages/CoinStore.tsx`
- Remove any "Save Card" or "Save Payment Method" buttons
- Remove payment method selection UI
- Keep only PayPal checkout flow

## 3. Remove "Save Payment Method" from Profile
**File**: `src/pages/Profile.tsx`
- Remove payment method management section
- Remove card saving UI

## 4. Safety & Policy Page Not Working
**File**: `src/pages/Safety.tsx`
- Check for navigation redirects in useEffect
- Ensure no form submissions without preventDefault
- Remove any window.location usage
- Make it a static informational page

## 5. Application Page Not Working
**File**: `src/pages/Application.tsx`
- Check for navigation redirects
- Ensure form submissions use preventDefault
- Check if application submission is working
- Verify RPC calls are correct

## 6. Fix Troll Wheel
**File**: `src/pages/TrollWheel.tsx`
- Check auth token is being sent correctly
- Verify Edge Function endpoint
- Check coin deduction logic
- Ensure wheel spin animation completes

## 7. Profile Flash Issue
**File**: `src/pages/Profile.tsx`
- Add loading state
- Don't render form until data is loaded
- Use fresh data fetch instead of cached profile
- Prevent initial render with old data

