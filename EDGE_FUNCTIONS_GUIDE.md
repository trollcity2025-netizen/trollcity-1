# Supabase Edge Functions API Setup

## Overview

Your TrollCity project now has full support for Supabase Edge Functions through a centralized API helper (`src/lib/api.ts`).

## Configuration

### Environment Variables

The API base URL is automatically loaded from your `.env` file:

```env
VITE_API_URL=https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1
```

This works on both **localhost** and **production (Vercel)**.

### Fallback

If `VITE_API_URL` is not set, the helper defaults to:
```
https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1
```

## Usage

### Basic Examples

```typescript
import api from '@/lib/api'

// GET request
const response = await api.get('/my-function')

// POST request
const result = await api.post('/clever-api', { 
  message: 'hello' 
})

// PUT request
await api.put('/update-data', { 
  id: '123', 
  data: 'new value' 
})

// DELETE request
await api.delete('/delete-item', { id: '123' })
```

### With Query Parameters

```typescript
// GET with query params
const users = await api.get('/users', { 
  limit: 10, 
  offset: 0 
})
// Calls: /users?limit=10&offset=0
```

### Response Handling

All API methods return a standardized response:

```typescript
interface ApiResponse<T = any> {
  success?: boolean    // true if request succeeded
  data?: T            // response data
  error?: string      // error message if failed
  [key: string]: any  // other fields from API
}

// Example usage:
const response = await api.post('/clever-api', { message: 'hello' })

if (response.success) {
  console.log('Success:', response.data)
} else {
  console.error('Error:', response.error)
}
```

### Custom Headers

```typescript
// Add custom headers
const response = await api.post('/protected-function', 
  { data: 'value' },
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Custom-Header': 'value'
    }
  }
)
```

### Error Handling

The helper automatically handles:
- Network errors
- JSON parsing
- HTTP error status codes
- Non-JSON responses

```typescript
const response = await api.post('/clever-api', { message: 'test' })

if (!response.success) {
  // Handle error
  toast.error(response.error || 'Request failed')
  return
}

// Process successful response
const { data } = response
```

## Integration with Existing Code

Your current backend uses Express.js routes at `/api/*`. The new Edge Functions helper is **separate** and calls Supabase Edge Functions at `/functions/v1/*`.

### Current Backend (Express)
```typescript
// These continue to work as-is
await fetch('/api/admin/economy/summary')
await fetch('/api/wheel/spin')
await fetch('/api/square/create-customer')
```

### New Edge Functions (Supabase)
```typescript
// Use the new api helper for Edge Functions
import api from '@/lib/api'

await api.post('/clever-api', { message: 'hello' })
await api.get('/my-edge-function')
```

## Creating Your First Edge Function

### 1. Create Edge Function in Supabase

In your Supabase dashboard:
1. Go to **Edge Functions**
2. Create a new function (e.g., `clever-api`)
3. Deploy the function

Example function:
```typescript
// supabase/functions/clever-api/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { message } = await req.json()
  
  return new Response(
    JSON.stringify({ 
      success: true, 
      reply: `You said: ${message}` 
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

### 2. Call from Frontend

```typescript
import api from '@/lib/api'
import { toast } from 'sonner'

const sendMessage = async (text: string) => {
  const response = await api.post('/clever-api', { message: text })
  
  if (response.success) {
    toast.success(`API replied: ${response.reply}`)
  } else {
    toast.error(response.error || 'Failed to send message')
  }
}
```

## Available Methods

| Method | Usage | Description |
|--------|-------|-------------|
| `api.get(endpoint, params?, options?)` | GET request | Fetch data |
| `api.post(endpoint, body?, options?)` | POST request | Create/submit data |
| `api.put(endpoint, body?, options?)` | PUT request | Update data |
| `api.patch(endpoint, body?, options?)` | PATCH request | Partial update |
| `api.delete(endpoint, params?, options?)` | DELETE request | Delete data |
| `api.request(endpoint, options)` | Custom request | Full control |

## TypeScript Support

Full TypeScript support with generics:

```typescript
interface User {
  id: string
  name: string
  email: string
}

// Type-safe response
const response = await api.get<User[]>('/users')

if (response.success && response.data) {
  response.data.forEach((user: User) => {
    console.log(user.name)
  })
}
```

## Testing

### Local Development
The helper automatically uses `VITE_API_URL` from your `.env` file.

### Production (Vercel)
Set `VITE_API_URL` in your Vercel environment variables:
```
VITE_API_URL=https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1
```

## Notes

- ✅ Automatic JSON headers
- ✅ Error handling built-in
- ✅ Works on localhost and production
- ✅ TypeScript support
- ✅ Query parameter support
- ✅ Custom headers support
- ✅ Standardized response format
- ⚠️ Separate from existing Express backend routes

## Example: Complete Integration

```typescript
// src/components/CleverChat.tsx
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from 'sonner'

export default function CleverChat() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!message.trim()) return
    
    setLoading(true)
    try {
      const response = await api.post('/clever-api', { 
        message: message.trim() 
      })
      
      if (response.success) {
        toast.success(`AI: ${response.reply}`)
        setMessage('')
      } else {
        toast.error(response.error || 'Failed to send')
      }
    } catch (error) {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
      />
      <button onClick={sendMessage} disabled={loading}>
        {loading ? 'Sending...' : 'Send'}
      </button>
    </div>
  )
}
```

---

**Setup Complete!** 🎉

Your TrollCity app is now ready to use Supabase Edge Functions through the clean `api.ts` helper.
