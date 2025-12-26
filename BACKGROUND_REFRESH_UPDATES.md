# Background Profile Refresh - Implementation Summary

## Overview
Updated all pages that modify coin balance to refresh profile data **silently in the background** instead of blocking UI or showing loading states.

## New Hook Created
**`src/hooks/useBackgroundProfileRefresh.ts`**
- Provides `refreshProfileInBackground()` function
- Silently fetches latest profile from DB
- Updates local state without UI interruption
- Handles errors gracefully (logs to console only)

## Pages Updated

### 1. **EntranceEffects.tsx** ✅
- **What changes**: Purchasing entrance effects
- **Background refresh**: After coin deduction and immediate UI update
- **Effect**: Coins deducted instantly, profile syncs quietly in background

### 2. **FamilyApplication.tsx** ✅
- **What changes**: Submitting family application (costs 1000 coins)
- **Background refresh**: After coin update and application submitted
- **Effect**: Coins deducted instantly, profile syncs quietly

### 3. **Profile.tsx** ✅
- **What changes**: Enabling private profile (costs 2000 coins)
- **Background refresh**: After coin deduction
- **Effect**: Coins updated immediately in UI, profile syncs in background

### 4. **AIVerificationPage.tsx** ✅
- **What changes**: Paying for verification with coins (costs 500 coins)
- **Background refresh**: After verification RPC call
- **Effect**: Uses both `refreshProfile()` and background refresh for dual coverage

### 5. **EntranceEffects.tsx** (updated earlier) ✅
- Already implemented with background refresh

## Implementation Pattern

All updated pages follow this pattern:

```typescript
import { useBackgroundProfileRefresh } from '../hooks/useBackgroundProfileRefresh'

export default function MyPage() {
  const { profile } = useAuthStore()
  const { refreshProfileInBackground } = useBackgroundProfileRefresh()
  
  const handleCoinDeduction = async () => {
    // Update DB
    await supabase.from('user_profiles').update({ ... })
    
    // Update local state immediately (optimistic)
    useAuthStore.getState().setProfile({ ...profile, troll_coins_balance: newBalance })
    
    // Refresh from DB silently in background
    refreshProfileInBackground()
  }
}
```

## Benefits

✅ **No loading states** - UI stays responsive
✅ **Instant feedback** - Coins update immediately in UI
✅ **Silent sync** - Background refresh ensures accuracy without showing spinners
✅ **Better UX** - Users don't see page flicker or loading screens
✅ **Reliable** - If local state drifts from DB, background refresh fixes it

## Testing Checklist

- [ ] Purchase entrance effect → coins deduct instantly, no visual refresh
- [ ] Apply to family → coins deduct instantly, page stays responsive
- [ ] Enable private profile → coins deduct instantly, no loading spinner
- [ ] Verify with coins → coins deduct instantly, verification completes smoothly
- [ ] Refresh page after any purchase → coin balance matches DB

## Pages NOT Modified

These don't modify coin balance for users:
- AdminDashboard.tsx (admin only, uses explicit refresh)
- AuthCallback.tsx (initial login, not a transaction)
- LiveProfileModal.tsx (modifies kick protection, not coins)
- LiveStreamPage.tsx (uses RPC for battle coins distribution)

## Migration Notes

All changes are **backward compatible**:
- New hook is additive, doesn't break existing code
- Existing `refreshProfile()` still works alongside new background refresh
- No database schema changes
- No breaking changes to component APIs

## Files Modified

1. `src/hooks/useBackgroundProfileRefresh.ts` (NEW)
2. `src/pages/EntranceEffects.tsx`
3. `src/pages/FamilyApplication.tsx`
4. `src/pages/Profile.tsx`
5. `src/pages/AIVerificationPage.tsx`
