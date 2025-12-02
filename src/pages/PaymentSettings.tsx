// src/pages/PaymentSettings.tsx

import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import api, { API_ENDPOINTS } from '../lib/api'

type Method = {
  id: string
  provider: string
  display_name: string
  is_default: boolean
  brand?: string
  last4?: string
  exp_month?: number
  exp_year?: number
}

export default function PaymentSettings() {
  const { profile } = useAuthStore()
  const [methods, setMethods] = useState<Method[]>([])
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)

  const cardRef = useRef<any>(null)
  const attachedRef = useRef(false)

  const load = async () => {
    if (!profile) return
    setLoading(true)
    const { data, error } = await supabase
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', profile.id)
      .order('is_default', { ascending: false })

    if (error) toast.error(error.message)
    setMethods(data || [])
    setLoading(false)
  }

  useEffect(() => { 
    load()
    
    // Set up real-time subscription for instant updates
    if (profile?.id) {
      const channel = supabase
        .channel(`payment_methods_settings_${profile.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_payment_methods',
          filter: `user_id=eq.${profile.id}`
        }, () => {
          load()
        })
        .subscribe()
      
      return () => {
        void supabase.removeChannel(channel)
      }
    }
  }, [profile?.id])

  // Attach ONLY ONE Square card input
  useEffect(() => {
    const initSquare = async () => {
      if (attachedRef.current) return

      const appId = import.meta.env.VITE_SQUARE_APPLICATION_ID
      const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID
      if (!appId || !locationId) return
      
      // Detect sandbox/test mode and warn admin users
      const isSandbox = appId.includes('sandbox') || locationId.includes('sandbox')
      const currentProfile = useAuthStore.getState().profile
      if (isSandbox && currentProfile?.role === 'admin') {
        console.warn('⚠️ SQUARE SANDBOX MODE - Production Application ID required for real cards')
        toast.warning('Payment system in sandbox mode - cards will appear as test cards', { duration: 5000 })
      }

      const scriptUrl = 'https://web.squarecdn.com/v1/square.js'

      const attachCard = async () => {
        try {
          // First, destroy any existing card instances
          if (cardRef.current) {
            try {
              await cardRef.current.destroy()
            } catch {}
            cardRef.current = null
          }

          // Remove ALL Square iframes from the entire document
          document.querySelectorAll('iframe').forEach((el: any) => {
            const src = String(el?.src || '')
            if (src.includes('squarecdn.com') || src.includes('square') || src.includes('web-sdk')) {
              el.remove()
            }
          })

          // Remove all card-container divs except the first one
          const containers = document.querySelectorAll('#card-container')
          containers.forEach((el, idx) => { 
            if (idx > 0) el.remove() 
          })

          // Get or create the container
          const container = document.getElementById('card-container')
          if (!container) {
            console.error('Card container not found')
            return
          }

          // Clear the container
          container.innerHTML = ''

          const payments = await (window as any).Square.payments(appId, locationId)
          const card = await payments.card({
            postalCode: true  // Enable postal code field
          })
          await card.attach('#card-container')

          cardRef.current = card
          attachedRef.current = true
          ;(window as any).__tc_square_attached = true
        } catch (err) {
          console.error('Square attach failed:', err)
        }
      }

      if (!(window as any).Square) {
        const script = document.createElement('script')
        script.src = scriptUrl
        script.async = true
        script.onload = attachCard
        document.body.appendChild(script)
      } else {
        attachCard()
      }
    }

    initSquare()

    // Cleanup on unmount
    return () => {
      if (cardRef.current) {
        try {
          cardRef.current.destroy()
        } catch {}
        cardRef.current = null
      }
      attachedRef.current = false
      ;(window as any).__tc_square_attached = false
    }
  }, [])

  const handleLinkCard = async () => {
    if (!profile?.id || !cardRef.current) return toast.error('Please sign in.')

    try {
      setLinking(true)
      const tokenResult = await cardRef.current.tokenize()
      if (!tokenResult || tokenResult.status !== 'OK') {
        const msg = Array.isArray((tokenResult as any)?.errors)
          ? (tokenResult as any).errors.map((e: any) => e.message || e.code).join(', ')
          : 'Tokenization failed'
        throw new Error(msg)
      }

      const data = await api.post('/payments', {
        userId: profile.id,
        nonce: tokenResult.token
      })
      if (!data.success) throw new Error(data?.error || 'Failed to save card')

      toast.success('Card linked and set as default!')
      
      // Always reload from server to get the latest saved card
      // Wait a moment for the database to update
      await new Promise(resolve => setTimeout(resolve, 500))
      await load()
      
      // Also try to update UI optimistically if method is returned
      if (data?.method) {
        setMethods(prev => {
          // Remove the new card from old position if it exists
          const filtered = prev.filter(m => m.id !== data.method.id)
          // Mark all as not default
          const updated = filtered.map(m => ({ ...m, is_default: false }))
          // Add new card as default at the top
          return [{ ...data.method, is_default: true }, ...updated]
        })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Card link failed')
    } finally {
      setLinking(false)
    }
  }

  const remove = async (id: string) => {
    if (!profile) return
    // Optimistically remove from UI
    const backup = methods
    setMethods(old => old.filter(m => m.id !== id))

    try {
      const j = await (await import('../lib/api')).default.delete(`/square/delete-method/${id}?userId=${profile.id}`)
      if (!j.success) {
        // Restore on failure
        setMethods(backup)
        return toast.error(j?.error || 'Remove failed')
      }
      toast.success('Payment method removed')
      // refresh from server to be safe
      await load()
    } catch (e) {
      setMethods(backup)
      toast.error('Remove failed')
    }
  }

  return (
    <div className="min-h-screen bg-[#0D0D1A] text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-6">Wallet & Payments</h1>

        <div className="p-6 bg-[#121212] rounded-lg border border-[#2C2C2C] mb-6">
          <h2 className="text-lg font-semibold mb-3">Link New Card</h2>
          <p className="text-sm text-gray-400 mb-4">
            Enter your card details including ZIP code. This card will be securely stored for future purchases.
          </p>

          {/* SINGLE Square Input Container */}
          <div id="card-container" className="p-3 rounded border border-[#2C2C2C] bg-black" />

          <button
            onClick={handleLinkCard}
            disabled={linking}
            className="mt-4 w-full py-2 bg-purple-600 hover:bg-purple-700 rounded transition disabled:opacity-50"
          >
            {linking ? 'Saving…' : 'Save Card'}
          </button>
        </div>

        {loading ? (
          <div>Loading…</div>
        ) : (
          <div className="space-y-3">
            {methods.map((m) => (
              <div key={m.id} className="p-4 rounded border border-[#2C2C2C] flex items-center justify-between">
                <div>
                  <div className="font-semibold">{m.display_name || 'Card'}</div>
                  {m.brand && (
                    <div className="text-xs text-gray-400">
                      {m.brand} •••• {m.last4} • exp {String(m.exp_month).padStart(2,'0')}/{m.exp_year}
                    </div>
                  )}
                  {m.is_default && <div className="text-xs text-green-400">Default</div>}
                </div>
                <div className="flex gap-2">
                  {!m.is_default && (
                    <button
                      onClick={() =>
                        setMethods(old => old.map(x => ({ ...x, is_default: x.id === m.id })))
                      }
                      className="px-3 py-2 rounded bg-green-500 text-black"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => remove(m.id)}
                    className="px-3 py-2 rounded bg-gray-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {methods.length === 0 && <div>No methods linked.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
