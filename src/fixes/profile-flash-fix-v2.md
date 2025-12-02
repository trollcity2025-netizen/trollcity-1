# Profile Flash Fix v2

## Issue: Old profile settings flash before new ones appear

### Solution: Add loading state and prevent render until data is ready

### Fix in `src/pages/Profile.tsx`:

```typescript
const [loading, setLoading] = useState(true)
const [profileData, setProfileData] = useState(null)

useEffect(() => {
  const loadProfile = async () => {
    setLoading(true)
    try {
      // Fetch fresh profile data
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) throw error
      
      setProfileData(data)
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }
  
  loadProfile()
}, [userId])

// Don't render form until data is loaded
if (loading || !profileData) {
  return <div className="p-6 text-white">Loading profile...</div>
}

// Use profileData instead of profile prop directly
```

