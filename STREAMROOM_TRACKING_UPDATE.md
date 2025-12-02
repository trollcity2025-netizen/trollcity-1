# StreamRoom Officer Tracking Update

## ✅ Completed

1. **Edge Functions Created:**
   - `supabase/functions/officer-join-stream/index.ts` - Tracks when officers join streams
   - `supabase/functions/officer-leave-stream/index.ts` - Tracks when officers leave streams

2. **Admin Tracker Page Created:**
   - `src/pages/admin/AdminLiveOfficersTracker.tsx` - Shows active officer assignments
   - Route added: `/admin/officers-live`

3. **Tracking Hook Created:**
   - `src/hooks/useOfficerStreamTracking.ts` - Reusable hook for tracking

## 📝 To Complete: Add Tracking to StreamRoom

Add this import and hook call to `src/pages/StreamRoom.tsx`:

### Step 1: Add Import

At the top of the file, add:

```typescript
import { useOfficerStreamTracking } from '../hooks/useOfficerStreamTracking'
```

### Step 2: Add Hook Call

Inside the `StreamRoom` component function, after the state declarations (around line 120), add:

```typescript
// Track officer join/leave for admin dashboard
useOfficerStreamTracking(streamId)
```

That's it! The hook will automatically:
- Detect if the user is an officer
- Call `officer-join-stream` when they load the stream
- Call `officer-leave-stream` when they leave (unmount, navigate away, or close browser)

## 🗄️ Database Table Required

Make sure you have the `officer_live_assignments` table:

```sql
CREATE TABLE IF NOT EXISTS officer_live_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id),
  stream_id UUID NOT NULL REFERENCES streams(id),
  status TEXT NOT NULL DEFAULT 'active', -- 'active' or 'left'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_officer_live_assignments_officer_id ON officer_live_assignments(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_live_assignments_stream_id ON officer_live_assignments(stream_id);
CREATE INDEX IF NOT EXISTS idx_officer_live_assignments_status ON officer_live_assignments(status);
```

## 🚀 Deployment

Deploy the Edge Functions:

```bash
npx supabase functions deploy officer-join-stream
npx supabase functions deploy officer-leave-stream
```

## 📊 Admin Dashboard Access

Admins can view active officer assignments at:
- Route: `/admin/officers-live`
- Shows: Officer username, stream title, join time, duration

