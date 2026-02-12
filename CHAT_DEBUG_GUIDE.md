# Chat Not Sending - Diagnostic Guide

## Immediate Debugging Steps

### 1. Check Browser Console

Open Developer Tools (F12) and look for:

```
💬 [BroadcastChat] sendMessage called
💬 [useStreamChat] sendMessage called
```

**If you DON'T see these logs:**
- The send button onClick handler isn't firing
- Form submission is being prevented
- JavaScript error before the function runs

**If you see logs but then error:**
Look for the error message after:
```
💬 [BroadcastChat] Error sending message:
💬 [useStreamChat] Failed to send message:
```

### 2. Common Errors & Solutions

#### Error: "new row violates row-level security policy"
**Cause:** RLS policy blocking inserts
**Solution:** Run this SQL:
```sql
-- Check current policies
SELECT policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'stream_messages';

-- Verify authenticated users can insert
SELECT * FROM pg_policies 
WHERE tablename = 'stream_messages' 
AND cmd = 'INSERT';
```

If policy missing or wrong, apply migration:
```bash
supabase db push
```

#### Error: "null value in column ... violates not-null constraint"
**Cause:** Required column missing from INSERT
**Check:** Does `stream_messages` table have new required columns?

```sql
SELECT column_name, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'stream_messages' 
AND is_nullable = 'NO';
```

#### Error: "permission denied for table stream_messages"
**Cause:** User doesn't have INSERT grant
**Solution:**
```sql
GRANT INSERT ON public.stream_messages TO authenticated;
```

#### No error, but message doesn't appear
**Possible causes:**
1. **Realtime subscription not working** - Check Supabase realtime is enabled
2. **streamId mismatch** - Check console logs for streamId value
3. **Message inserted but not subscribed** - Check channel subscription

### 3. Manual Test Query

Run this in Supabase SQL Editor:

```sql
-- Check if you can manually insert
INSERT INTO public.stream_messages (
    stream_id,
    user_id,
    content,
    user_name
) VALUES (
    'your-stream-id-here',  -- Replace with actual stream ID
    auth.uid(),
    'Test message from SQL',
    'TestUser'
);

-- If successful, check if message appears
SELECT * FROM public.stream_messages 
WHERE stream_id = 'your-stream-id-here' 
ORDER BY created_at DESC 
LIMIT 5;
```

### 4. Check Realtime Subscription

In browser console:
```javascript
// Check active channels
supabase.getChannels()

// Should see something like:
// [{name: "chat:stream-id-here", state: "joined"}]
```

If no channels or state !== "joined":
- Realtime might be disabled in Supabase project settings
- Network blocking WebSocket connections
- Subscription failed silently

### 5. Check User Authentication

```javascript
// In browser console
const { data: { user } } = await supabase.auth.getUser()
console.log('Current user:', user)

// Should have valid user object with id
```

### 6. Network Tab Check

1. Open Network tab in DevTools
2. Try sending a message
3. Look for POST request to `/rest/v1/stream_messages`
4. Check response:
   - **201 Created** = Success
   - **400 Bad Request** = Validation error
   - **403 Forbidden** = RLS blocking
   - **401 Unauthorized** = Not logged in

## Quick Fix Commands

### Reset Chat RLS Policies
```sql
-- Apply the fix migration
\\i supabase/migrations/20260211105000_fix_stream_messages_rls.sql
```

### Or manually recreate policies:
```sql
-- Drop all policies
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'stream_messages'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.stream_messages';
    END LOOP;
END $$;

-- Create simple working policies
CREATE POLICY "Everyone can read messages" 
ON public.stream_messages FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert messages" 
ON public.stream_messages FOR INSERT 
TO authenticated WITH CHECK (true);

CREATE POLICY "Users can delete own messages" 
ON public.stream_messages FOR DELETE 
USING (auth.uid() = user_id);
```

### Check Realtime is Enabled
```sql
-- Enable realtime for stream_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_messages;

-- Verify
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

## Testing Checklist

- [ ] User is logged in (check `useAuthStore`)
- [ ] Stream ID is valid (not null/undefined)
- [ ] Console shows sendMessage called logs
- [ ] No JavaScript errors in console
- [ ] Network request shows 201 status
- [ ] RLS policy allows INSERT for authenticated
- [ ] Realtime subscription is active
- [ ] Message appears in database (check SQL)
- [ ] Message appears in UI after insert

## Emergency Bypass (Debug Only)

If you need to test without RLS temporarily:

```sql
-- DANGER: Only for debugging!
ALTER TABLE public.stream_messages DISABLE ROW LEVEL SECURITY;

-- Test sending messages

-- Re-enable when done!
ALTER TABLE public.stream_messages ENABLE ROW LEVEL SECURITY;
```

## Common Mistakes

1. **Wrong streamId** - Passing undefined or null
2. **Not awaiting user fetch** - Trying to send before auth loads
3. **RLS policy too restrictive** - Policy requires conditions that aren't met
4. **Missing required columns** - Table schema changed but code didn't
5. **Realtime not enabled** - Forgot to enable in Supabase dashboard

## Next Steps

1. Add the diagnostic logs (already done in code)
2. Try sending a message
3. Check browser console for the 💬 emoji logs
4. Share the console output to diagnose further

The logs will tell us exactly where it's failing!
