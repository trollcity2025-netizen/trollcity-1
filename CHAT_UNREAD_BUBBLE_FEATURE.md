# Chat Unread Message Bubble Feature

## ✅ Implementation Complete

The unread message notification bubble has been fully implemented in [src/components/broadcast/BroadcastChat.tsx](src/components/broadcast/BroadcastChat.tsx).

## Features

### Visual Notification
- **Animated Badge**: Floating badge appears at top-right corner of chat component
- **Bounce Animation**: Badge bounces to attract attention
- **Glow Effect**: Red pulsing glow around badge for extra visibility
- **Count Display**: Shows number of unread messages (99+ for overflow)
- **Header Indicator**: "+X" badge in chat header showing new message count

### Smart Tracking
- **Focus Detection**: Tracks when user hovers over or clicks chat
- **Auto-Reset**: Unread count clears when user interacts with chat
- **User Filtering**: Only counts messages from other users (not your own)
- **Persistent State**: Maintains count until user focuses chat

## Implementation Details

### State Management
```typescript
const [unreadCount, setUnreadCount] = useState(0);
const [isChatFocused, setIsChatFocused] = useState(true);
const chatContainerRef = useRef<HTMLDivElement>(null);
```

### Event Handlers
- **mouseenter**: Clears unread count
- **mouseleave**: Allows unread tracking
- **focus**: Clears unread count
- **click**: Clears unread count

### Message Subscription
```typescript
// In realtime subscription
if (!isChatFocused && newMsg.user_id !== user?.id) {
    setUnreadCount(prev => prev + 1);
}
```

## UI Elements

### 1. Floating Badge (Top-Right)
```tsx
<div className="absolute -top-2 -right-2 z-50">
  <div className="relative animate-bounce">
    <div className="absolute inset-0 bg-red-500 rounded-full blur-md opacity-70 animate-pulse"></div>
    <div className="relative bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white text-xs font-bold rounded-full min-w-[28px] h-7 flex items-center justify-center px-2.5 border-2 border-white shadow-2xl ring-2 ring-red-300/50">
      {unreadCount > 99 ? '99+' : unreadCount}
    </div>
  </div>
</div>
```

### 2. Header Badge
```tsx
{unreadCount > 0 && (
  <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 animate-pulse font-normal">
    +{unreadCount}
  </span>
)}
```

## User Experience

1. **User receives message while not focused on chat**: 
   - Floating badge appears with count
   - Header shows "+X" indicator
   - Badge bounces and glows

2. **User hovers over chat**: 
   - Badge disappears
   - Count resets to 0
   - Ready to track new messages

3. **User leaves chat area**: 
   - New messages increment counter again
   - Visual indicators reappear

## Testing Checklist

- [ ] Open broadcast as viewer
- [ ] Have another user send messages
- [ ] Verify badge appears when not hovering chat
- [ ] Verify count increments correctly
- [ ] Verify badge disappears when hovering chat
- [ ] Verify count resets to 0 on focus
- [ ] Verify own messages don't increment count
- [ ] Verify badge handles 99+ overflow correctly

## Design Considerations

- **Red Color Scheme**: High contrast for visibility
- **Animations**: Bounce + pulse for attention
- **Z-Index**: 50 to ensure it appears above all chat elements
- **Positioning**: Absolute positioning relative to chat container
- **Responsive**: Works with chat's flex layout

## Integration Points

- **BroadcastChat Component**: Main chat UI for live streams
- **Realtime Subscriptions**: Supabase stream_messages table
- **Auth Store**: User identification for message filtering

## Related Files

- [src/components/broadcast/BroadcastChat.tsx](src/components/broadcast/BroadcastChat.tsx) - Main implementation
- [src/hooks/useStreamChat.ts](src/hooks/useStreamChat.ts) - Chat hook with diagnostics
- [src/lib/store.ts](src/lib/store.ts) - Auth store for user data

## Status

✅ **COMPLETE** - Feature fully implemented and tested for compilation errors.

## Next Steps

1. Deploy frontend build
2. Test in live broadcast environment
3. Verify across different browsers
4. Gather user feedback on visibility
