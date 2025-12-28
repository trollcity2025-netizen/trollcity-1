import { useEffect, useState } from 'react'
import { isAdmin } from '../lib/adminRoles'
import { useAuthStore } from '../lib/store'

export function useAdmin() {
  const storeIsAdmin = useAuthStore((state) => state.isAdmin)
  const setAdmin = useAuthStore((state) => state.setAdmin)
  const [loading, setLoading] = useState<boolean>(storeIsAdmin === null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (storeIsAdmin !== null) {
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const adminStatus = await isAdmin()
        if (cancelled) return
        setAdmin(adminStatus)
        setLoading(false)
        setError(null)
      } catch (err: any) {
        if (cancelled) return
        setAdmin(false)
        setLoading(false)
        setError(err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [storeIsAdmin, setAdmin])

  return {
    isAdmin: storeIsAdmin ?? false,
    loading,
    error
  }
}
