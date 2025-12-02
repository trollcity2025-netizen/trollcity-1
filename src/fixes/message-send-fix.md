# Message Send Fix

## Issue: Messages not sending

### Likely Causes:
1. Missing `e.preventDefault()` on form submit
2. Missing message insertion into database
3. Missing real-time subscription
4. Missing error handling

### Fix in `src/pages/Messages.tsx`:

```typescript
const handleSendMessage = async (e: React.FormEvent) => {
  e.preventDefault() // CRITICAL: Prevent page refresh
  
  if (!message.trim() || !selectedUser || !user) return
  
  try {
    const { error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: selectedUser.id,
        content: message.trim(),
        read: false
      })
    
    if (error) throw error
    
    setMessage('') // Clear input
    // Real-time subscription should auto-update UI
  } catch (error) {
    console.error('Error sending message:', error)
    toast.error('Failed to send message')
  }
}
```

### Ensure real-time subscription is active:
```typescript
useEffect(() => {
  if (!selectedUser || !user) return
  
  const channel = supabase
    .channel(`messages_${user.id}_${selectedUser.id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `sender_id=eq.${user.id},receiver_id=eq.${selectedUser.id}`
    }, (payload) => {
      setMessages(prev => [...prev, payload.new])
    })
    .subscribe()
  
  return () => {
    supabase.removeChannel(channel)
  }
}, [selectedUser, user])
```

