# Global Message Notifications & Expanded OPS Access

## ✅ Changes Complete

### 1. Expanded OPS Access to All Specified Roles

**File**: [src/lib/supabase.ts](src/lib/supabase.ts)

**Now includes all these roles:**
- ✅ **Admin** (`role = 'admin'` or `is_admin = true`)
- ✅ **Lead Troll Officer** (`officer_role = 'lead_officer'` or `troll_role = 'lead_officer'`)
- ✅ **Secretary** (`troll_role = 'secretary'`)
- ✅ **Troll Officer** (`is_troll_officer = true`)
- ✅ **Pastor** (`is_pastor = true` or `troll_role = 'pastor'`)

```typescript
export async function isOfficer(userId?: string): Promise<boolean> {
  // Checks: is_troll_officer, is_pastor, officer_role, role, is_admin, troll_role
  return (
    data?.is_troll_officer === true ||
    data?.is_pastor === true ||
    data?.role === 'admin' ||
    data?.is_admin === true ||
    data?.officer_role === 'lead_officer' ||
    data?.officer_role === 'owner' ||
    data?.troll_role === 'secretary' ||
    data?.troll_role === 'lead_officer' ||
    data?.troll_role === 'pastor'
  )
}
```

### 2. Global Message Notification System

**File**: [src/lib/supabase.ts](src/lib/supabase.ts) + [src/components/layout/AppLayout.tsx](src/components/layout/AppLayout.tsx)

**How it works:**
1. **Listens for ALL incoming messages** (DMs and OPS)
2. **Auto-opens chat bubble** when new message arrives
3. **Shows toast notification** with sender name
4. **Works on ANY page** - no matter where user is
5. **Smart filtering** - only shows messages meant for that user

**Features:**
- 📩 **DM Notifications**: "💬 New message from [username]"
- 🛡️ **OPS Notifications**: "🛡️ Officer Operations: New message from [username]"
- 🔔 **Toast + Auto-Open**: Shows notification AND opens bubble automatically
- 🎯 **Smart Detection**: Doesn't notify for your own messages
- 🚫 **No Duplicate**: Won't open if bubble already open

### 3. Implementation Details

**Global Listener** (`setupGlobalMessageNotifications`):
```typescript
setupGlobalMessageNotifications(
  userId,
  (senderId, senderUsername, senderAvatar, isOpsMessage) => {
    if (isOpsMessage) {
      // Officer Operations message
      openChatBubble(OFFICER_GROUP_CONVERSATION_ID, '🛡️ Officer Operations', null)
    } else {
      // Regular DM
      openChatBubble(senderId, senderUsername, senderAvatar)
    }
  }
)
```

**Subscribes to:**
- `conversation_messages` table (for DMs)
- `officer_chat_messages` table (for OPS - if user has access)

**Filters:**
- Only messages in conversations user is member of
- Excludes user's own messages
- Auto-checks officer status for OPS access

---

## User Experience

### For All Users (DMs):
1. User A sends message to User B
2. **Anywhere on the site**, User B sees:
   - Toast: "💬 New message from User A"
   - Chat bubble auto-opens with User A's conversation
   - Can reply immediately

### For Officers (OPS + DMs):
1. Officer A sends OPS message
2. **All officers** (regardless of page) see:
   - Toast: "🛡️ Officer Operations: New message from Officer A"
   - Chat bubble auto-opens showing Officer Operations group
   - Can reply to entire officer team

3. Officer also receives regular DMs same way

### Smart Behavior:
- ✅ Works on homepage, profile pages, live streams, anywhere
- ✅ Doesn't interrupt if bubble already open
- ✅ Toast has "Open" button as backup
- ✅ No notifications for messages you send
- ✅ Proper permissions - only officers see OPS notifications

---

## Technical Details

### Database Subscriptions

**DM Subscription**:
```typescript
supabase
  .channel(`global-dms:${userId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'conversation_messages'
  }, handleNewDM)
  .subscribe()
```

**OPS Subscription** (officers only):
```typescript
supabase
  .channel(`global-ops:${userId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'officer_chat_messages'
  }, handleNewOPS)
  .subscribe()
```

### Performance
- ✅ **Lightweight**: Only active when user logged in
- ✅ **Auto-cleanup**: Unsubscribes when component unmounts
- ✅ **Efficient**: Uses Supabase realtime (WebSocket)
- ✅ **No polling**: Event-driven, instant notifications

---

## Files Modified

1. **[src/lib/supabase.ts](src/lib/supabase.ts)**
   - Expanded `isOfficer()` to include all 5 roles
   - Added `setupGlobalMessageNotifications()` function

2. **[src/components/layout/AppLayout.tsx](src/components/layout/AppLayout.tsx)**
   - Added global notification listener
   - Auto-opens chat bubble on new messages
   - Shows toast notifications

---

## Testing Checklist

### OPS Access Testing
- [ ] Log in as **admin** → Should see Officer Operations
- [ ] Log in as **lead officer** → Should see Officer Operations
- [ ] Log in as **secretary** → Should see Officer Operations
- [ ] Log in as **troll officer** → Should see Officer Operations
- [ ] Log in as **pastor** → Should see Officer Operations
- [ ] Log in as **regular user** → Should NOT see Officer Operations

### Global Notification Testing

**DM Notifications:**
- [ ] User A on homepage
- [ ] User B sends DM to User A
- [ ] User A sees toast + bubble opens
- [ ] User A on stream page
- [ ] User B sends another DM
- [ ] User A sees notification even on stream page

**OPS Notifications:**
- [ ] Officer A on profile page
- [ ] Officer B sends OPS message
- [ ] Officer A sees OPS toast + bubble opens
- [ ] Officer A on admin panel
- [ ] Officer C sends OPS message
- [ ] Officer A still gets notification

**Edge Cases:**
- [ ] Bubble already open → No duplicate open
- [ ] Send message to self → No notification
- [ ] Non-officer → No OPS notifications
- [ ] Page navigation → Listener persists
- [ ] Logout → Listener cleans up

---

## Summary

✅ **OPS access expanded** to 5 roles: admin, lead officer, secretary, troll officer, pastor  
✅ **Global notifications** for all messages on any page  
✅ **Auto-open chat bubble** when messages arrive  
✅ **Toast notifications** with sender info  
✅ **Works for both** DMs and OPS messages  
✅ **Smart filtering** - only relevant messages  
✅ **No errors** - TypeScript validated  

**Impact**: Officers and users now have instant messaging across the entire platform!
