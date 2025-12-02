# Sidebar and Profile Refactor Guide

## Files to Update

### 1. Sidebar.tsx
**Remove:**
- Settings link
- Account link
- Any imports for Settings/Account components

**Keep:**
- All other navigation items

### 2. Profile.tsx
**Add:**
- Profile View Price input field
- Save button for profile view price
- Proper validation and error handling

### 3. Profile Viewing Logic
**Files to create/update:**
- `src/lib/profileViewPayment.ts` - Payment checking and charging logic
- `src/hooks/useProfileViewPayment.ts` - React hook for profile view payment
- Update Profile page to use the hook
- Update StreamRoom to check payment before allowing entry

### 4. Routes
**Remove:**
- `/settings` route
- `/account` route

### 5. Store Page
**Update:**
- Handle redirect state with requiredCoins message
- Display message if redirected from profile view

## Implementation Steps

1. Remove Settings/Account from Sidebar
2. Add profile view price input to Profile page
3. Implement payment checking logic
4. Add redirect to store with message
5. Update routes
6. Test payment flow

