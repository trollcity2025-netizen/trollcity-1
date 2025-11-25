// src/pages/PaymentSettings.tsx

import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'

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

  useEffect(() => { load() }, [profile?.id])

  // Attach ONLY ONE Square card input
  useEffect(() => {
    const initSquare = async () => {
      if (attachedRef.current) return

      const appId = import.meta.env.VITE_SQUARE_APPLICATION_ID
      const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID
      if (!appId || !locationId) return

      const scriptUrl = 'https://web.squarecdn.com/v1/square.js'

      const attachCard = async () => {
        try {
          const payments = await (window as any).Square.payments(appId, locationId)
          const key = '__tc_global_card_attached'
          if ((window as any)[key]) return

          // Remove duplicate containers and stray Square iframes
          document.querySelectorAll('#card-container').forEach((el, idx) => { if (idx > 0) el.remove() })
          document.querySelectorAll('iframe').forEach((el: any) => {
            const src = String(el?.src || '')
            if (src.includes('squarecdn.com') || src.includes('square')) el.remove()
          })

          let container = document.getElementById('card-container')
          if (container) {
            const parent = container.parentElement
            const fresh = document.createElement('div')
            fresh.id = 'card-container'
            fresh.className = container.className
            if (parent) parent.replaceChild(fresh, container)
            container = fresh
          }

          const card = await payments.card()
          await card.attach('#card-container')

          cardRef.current = card
          attachedRef.current = true
          ;(window as any)[key] = true
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

      const res = await fetch('/api/square/save-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          cardToken: tokenResult.token,
          saveAsDefault: true
        })
      })

      if (!res.ok) throw new Error('Failed to save card')

      toast.success('Card linked and set as default!')
      await load()
    } catch (err: any) {
      toast.error(err?.message || 'Card link failed')
    } finally {
      setLinking(false)
    }
  }

  const remove = async (id: string) => {
    if (!profile) return
    const res = await fetch(`/api/square/delete-method/${id}?userId=${profile.id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return toast.error(j?.error || 'Remove failed')
    toast.success('Payment method removed')
    await load()
  }

  return (
    <div className="min-h-screen bg-[#0D0D1A] text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-6">Wallet & Payments</h1>

        <div className="p-6 bg-[#121212] rounded-lg border border-[#2C2C2C] mb-6">
          <h2 className="text-lg font-semibold mb-3">Link New Card</h2>

          {/* SINGLE Square Input Container */}
          <div id="card-container" className="p-3 rounded border border-[#2C2C2C] bg-black" />

          <button
            onClick={handleLinkCard}
            disabled={linking}
            className="mt-4 w-full py-2 bg-purple-600 hover:bg-purple-700 rounded transition"
          >
            {linking ? 'Saving…' : 'Save Debit Card'}
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
