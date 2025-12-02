# Fixes Implementation Guide

This document outlines all the fixes that need to be implemented in the codebase.

## 1. Square Callback Webhook ✅
**File Created:** `supabase/functions/square-callback/index.ts`

**Square Dashboard Configuration:**
- Webhook Endpoint: `https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1/square-callback`
- Events to enable: `payment.created`, `payment.updated`, `payment.completed`

**Deploy:**
```bash
npx supabase functions deploy square-callback
```

## 2. Checkout Metadata ✅
**File Updated:** `supabase/functions/create-square-checkout/index.ts`

Metadata is now included in checkout creation. The webhook will receive:
- `userId`
- `coins` / `coinAmount`
- `type`
- `price`

## 3. Admin Reset API Fix
**File Created:** `src/fixes/admin-reset-api-fix.ts`

**Implementation:**
In `src/pages/admin/AdminResetPanel.tsx`, replace all `api.post('/admin-reset', ...)` calls with:
```typescript
import { resetTestData, resetLiveStreams, resetCoinBalances } from '../fixes/admin-reset-api-fix';

// Replace:
// api.post('/admin-reset', { action: 'reset_test_data' })
// With:
await resetTestData();
```

## 4. Profile Gift Send Fix
**File Created:** `src/fixes/profile-gift-fix.ts`

**Implementation:**
In `src/pages/Profile.tsx`, update the gift send handler:
```typescript
import { fixProfileGiftSend } from '../fixes/profile-gift-fix';

const handleSendGift = async (recipientId: string, giftId: string, coins: number) => {
  try {
    await fixProfileGiftSend(recipientId, giftId, coins, supabase, profile);
    toast.success('Gift sent successfully!');
  } catch (error: any) {
    toast.error(error.message || 'Failed to send gift');
  }
};
```

## 5. Profile Flash Fix
**File Created:** `src/fixes/profile-flash-fix.ts`

**Implementation:**
In `src/pages/Profile.tsx`, add loading state:
```typescript
import { useProfileData } from '../fixes/profile-flash-fix';

const { profileData, loading: profileLoading } = useProfileData(userId, supabase);

// Only render profile content when:
if (profileLoading) return <div>Loading...</div>;
if (!profileData) return <div>Profile not found</div>;

// Then use profileData instead of profile from store
```

## 6. Chat Broadcast Fix
**File Created:** `src/fixes/chat-broadcast-fix.ts`

**Implementation:**
In `src/pages/StreamRoom.tsx`:
```typescript
import { fixChatSend, setupChatRealtime } from '../fixes/chat-broadcast-fix';

// In component:
useEffect(() => {
  const cleanup = setupChatRealtime(streamId, setMessages, supabase);
  return cleanup;
}, [streamId]);

// In send message handler:
const handleSendMessage = async (message: string) => {
  try {
    await fixChatSend(message, streamId, user.id, supabase);
    // Message will appear via realtime subscription
  } catch (error) {
    toast.error('Failed to send message');
  }
};
```

## 7. Boo Sound Fix
**File Created:** `src/fixes/boo-sound-fix.ts`

**Implementation:**
In `src/pages/StreamRoom.tsx`:
```typescript
import { playBooSound } from '../fixes/boo-sound-fix';

const handleBoo = () => {
  playBooSound();
  // ... rest of boo logic (send to backend, etc.)
};
```

## 8. Application Lead Officer Fix
**File Created:** `src/fixes/application-lead-officer-fix.ts`

**Implementation:**
In `src/pages/Application.tsx`:
```typescript
import { useLeadOfficerApplication } from '../fixes/application-lead-officer-fix';

const { positionFilled, loading: positionLoading, submitLeadOfficerApplication, canApply } = useLeadOfficerApplication();

// In application types array:
{
  type: 'lead_officer',
  label: 'Lead Officer',
  description: 'Manage Troll Officers and approve applications',
  disabled: positionFilled,
  disabledReason: positionFilled ? 'Position already filled' : undefined,
  onSubmit: submitLeadOfficerApplication
}

// In render:
{positionFilled && (
  <div className="text-sm text-gray-500 mt-2">
    ⚠️ Lead Officer position is already filled
  </div>
)}
```

## 9. Clear Top Streams
**Migration Created:** `supabase/migrations/20250103_clear_top_streams.sql`

**Usage:**
```sql
SELECT clear_top_streams();
```

Or create a button in admin dashboard that calls this function.

## 10. Square Save Card Error Fix ✅
**File Updated:** `supabase/functions/square-save-card/index.ts`

Better error messages are now returned. The frontend should display the error details.

## Deployment Checklist

1. ✅ Deploy `square-callback` function
2. ✅ Update Square Dashboard webhook settings
3. ✅ Run migration: `20250103_clear_top_streams.sql`
4. ✅ Run migration: `20250103_lead_officer_application.sql`
5. ⏳ Implement fixes in Profile.tsx
6. ⏳ Implement fixes in StreamRoom.tsx
7. ⏳ Implement fixes in Application.tsx
8. ⏳ Implement fixes in AdminResetPanel.tsx

## Testing

1. Test Square checkout with metadata
2. Test Square webhook receives payment data
3. Test gift sending from profile
4. Test chat in broadcast
5. Test boo button sound
6. Test lead officer application (should grey out when filled)
7. Test admin reset functions

