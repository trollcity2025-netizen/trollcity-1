import React from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { recordAppEvent, recordEvent } from '../lib/progressionEngine'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

const ProfileSetup = () => {
  const navigate = useNavigate()
  const { user, profile, setProfile } = useAuthStore()

  const suggestedUsername = React.useMemo(() => {
    if (profile?.username) return profile.username
    if (user?.id) {
      // Generate username from user ID instead of email
      return `user${user.id.substring(0, 8)}`
    }
    return ''
  }, [user?.id, profile?.username])

  const [username, setUsername] = React.useState(profile?.username || suggestedUsername)
  const [bio, setBio] = React.useState(profile?.bio || '')
  const [loading, setLoading] = React.useState(false)
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
  const [usernameError, setUsernameError] = React.useState('')

  const handleUsernameChange = (value: string) => {
    // Only allow letters and numbers
    const alphanumeric = value.replace(/[^a-zA-Z0-9]/g, '')
    setUsername(alphanumeric)
    
    if (value !== alphanumeric) {
      setUsernameError('Username can only contain letters and numbers')
    } else {
      setUsernameError('')
    }
  }

  const [paymentsClient, setPaymentsClient] = React.useState<any>(null)
  const [card, setCard] = React.useState<any>(null)
  const [linking, setLinking] = React.useState('')
  const [methods, setMethods] = React.useState<any[]>([])

  React.useEffect(() => {
    if (!username && suggestedUsername) {
      setUsername(suggestedUsername)
    }
  }, [suggestedUsername, username])

  const loadMethods = React.useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
    setMethods(data || [])
  }, [user?.id])

  React.useEffect(() => { loadMethods() }, [loadMethods])

  React.useEffect(() => {
    const init = async () => {
      if (!useAuthStore.getState().profile) return
      const appId = (import.meta as any).env.VITE_SQUARE_APPLICATION_ID
      const locationId = (import.meta as any).env.VITE_SQUARE_LOCATION_ID
      if (!appId || !locationId) {
        console.error('Square credentials missing:', { appId, locationId })
        toast.error('Payment configuration error')
        return
      }
      
      // Detect sandbox/test mode and warn
      const isSandbox = appId.includes('sandbox') || locationId.includes('sandbox')
      if (isSandbox && useAuthStore.getState().profile?.role === 'admin') {
        console.warn('⚠️ SQUARE SANDBOX MODE DETECTED - Cards will show as TestCard')
        toast.warning('Payment system in test mode. Production credentials needed.', { duration: 5000 })
      }
      
      const src = 'https://web.squarecdn.com/v1/square.js'
      const attach = async () => {
        try {
          const payments = await (window as any).Square.payments(appId, locationId)
          console.log('Square payments initialized with appId:', appId)
          setPaymentsClient(payments)
          const k = '__tc_profile_card_attached'
          if ((window as any)[k]) return
          document.querySelectorAll('#profile-card-container').forEach((el, idx) => { if (idx > 0) el.remove() })
          document.querySelectorAll('iframe').forEach((el: any) => {
            const src = String(el?.src || '')
            if (src.includes('squarecdn.com') || src.includes('square')) el.remove()
          })
          let container = document.getElementById('profile-card-container')
          if (container) {
            const parent = container.parentElement
            const fresh = document.createElement('div')
            fresh.id = 'profile-card-container'
            fresh.className = container.className
            if (parent) parent.replaceChild(fresh, container)
            container = fresh
          }
          const containerExists = !!document.getElementById('profile-card-container')
          if (!containerExists) return
          const c = await payments.card()
          setCard(c)
          await c.attach('#profile-card-container')
          ;(window as any)[k] = true
        } catch (e: any) {
          console.error('Card attachment error:', e)
          toast.error(e?.message || 'Payment form setup failed')
        }
      }
      if (!(window as any).Square) {
        const s = document.createElement('script')
        s.src = src
        s.async = true
        s.onerror = () => {
          console.error('Failed to load Square SDK from', src)
          toast.error('Failed to load payment form')
        }
        s.onload = attach
        document.body.appendChild(s)
      } else {
        attach()
      }
    }
    init()
  }, [useAuthStore.getState().profile?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!user) {
      toast.error('Please sign in')
      return
    }
    const uname = username.trim()
    if (!uname) {
      toast.error('Username is required')
      return
    }
    if (!/^[a-zA-Z0-9_]{2,20}$/.test(uname)) {
      toast.error('Use 2–20 letters, numbers, or underscores')
      return
    }
    setLoading(true)
    try {
      if (profile?.username !== uname) {
        const { data: existing } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', uname)
          .neq('id', user.id)
          .maybeSingle()
        if (existing) {
          toast.error('Username is taken')
          setLoading(false)
          return
        }
      }
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('user_profiles')
        .update({ username: uname, bio: bio || null, updated_at: now })
        .eq('id', user.id)
      if (error) throw error
      const { data: updated } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (updated) {
        setProfile(updated as any)
        try {
          localStorage.setItem(
            `tc-profile-${user.id}`,
            JSON.stringify({ data: updated, timestamp: Date.now() })
          )
        } catch {}
      }
      toast.success('Profile saved')
      navigate('/')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  const avatarInputRef = React.useRef<HTMLInputElement>(null)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    try {
      setUploadingAvatar(true)
      if (!file.type.startsWith('image/')) throw new Error('File must be an image')
      if (file.size > 5 * 1024 * 1024) throw new Error('Image too large (max 5MB)')
      const ext = file.name.split('.').pop()
      const name = `${user.id}-${Date.now()}.${ext}`
      const path = `avatars/${name}`
      const { error: uploadErr } = await supabase.storage
        .from('troll-city-assets')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage
        .from('troll-city-assets')
        .getPublicUrl(path)

      const { error: updateErr } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (updateErr) throw updateErr

      const { data: updated } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (updated) setProfile(updated as any)
      toast.success('Avatar uploaded')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Avatar & Display */}
        <div className="flex items-center gap-4 mb-6">
          <img
            src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
            alt="avatar"
            className="w-20 h-20 rounded-full border border-[#2C2C2C] object-cover"
          />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="px-4 py-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white rounded"
          >
            {uploadingAvatar ? 'Uploading…' : 'Change Avatar'}
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </div>

        {/* Profile Info */}
        <details className="bg-[#1A1A1A] rounded-lg border border-[#2C2C2C]" open>
          <summary className="cursor-pointer px-6 py-4 flex items-center justify-between">
            <span className="font-semibold">Profile Info</span>
            <span className="text-sm bg-[#7C3AED] text-white px-3 py-1 rounded">Edit</span>
          </summary>

          <div className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm mb-2">Username (letters and numbers only)</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className="w-full px-4 py-2 rounded bg-[#23232b] text-white border border-gray-600 focus:outline-none"
                />
                {usernameError && (
                  <p className="text-red-400 text-xs mt-1">{usernameError}</p>
                )}
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm mb-2">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-4 py-2 rounded bg-[#23232b] text-white border border-gray-600 focus:outline-none"
                  rows={4}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white rounded"
              >
                {loading ? 'Saving…' : 'Save Profile'}
              </button>
            </form>
          </div>
        </details>

        {/* Payment Methods */}
        <details className="bg-[#1A1A1A] rounded-lg border border-[#2C2C2C] mt-4">
          <summary className="cursor-pointer px-6 py-4 font-semibold">Payment Methods</summary>
          <div className="px-6 pb-6 space-y-4">
            <div className="space-y-2">
              <div className="text-sm text-gray-300">Add a debit card as your default payment method. Payments are processed via Square and coins are credited instantly after success.</div>
              <div id="profile-card-container" className="mt-2" />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!user) { toast.error('Sign in required'); return }
                    try {
                      const { data: sessionData } = await supabase.auth.getSession()
                      const authToken = sessionData?.session?.access_token || ''
                      const cRes = await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/square/create-customer`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }, body: JSON.stringify({ userId: user.id }) })
                      const cJson = await cRes.json().catch(() => ({}))
                      if (!cRes.ok) { toast.error(cJson?.error || 'Customer create failed'); return }
                      if (!card) { toast.error('Card form not ready'); return }
                      setLinking('card')
                      const cardToken = await card.tokenize()
                      if (!cardToken || cardToken.status !== 'OK' || !cardToken.token) throw new Error('Card tokenize failed')
                      const sRes = await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/square/save-card`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }, body: JSON.stringify({ userId: user.id, cardToken: cardToken.token, saveAsDefault: true }) })
                      const sJson = await sRes.json().catch(() => ({}))
                      if (!sRes.ok) { toast.error(sJson?.error || 'Save card failed'); return }
                      toast.success('Card saved')
                      
                      // Instant UI update if method is returned
                      if (sJson?.method) {
                        setMethods(prev => {
                          const filtered = prev.filter(m => m.id !== sJson.method.id)
                          const updated = filtered.map(m => ({ ...m, is_default: false }))
                          return [{ ...sJson.method, is_default: true }, ...updated]
                        })
                      }
                      
                      // Identity hooks
                      try { if (user?.id) await recordAppEvent(user.id, 'PAYMENT_METHOD_LINKED', { provider: 'card' }) } catch {}
                      try { if (user?.id) await recordAppEvent(user.id, 'HIGH_SPENDER_EVENT', { xp: 100 }) } catch {}
                      await loadMethods()
                    } catch (e: any) {
                      toast.error(e?.message || 'Card link failed')
                    } finally {
                      setLinking('')
                    }
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white rounded"
                >
                  {linking === 'card' ? 'Saving…' : 'Save Card'}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold mb-2">Saved Methods</div>
              <div className="space-y-2">
                {methods.length === 0 && (
                  <div className="text-sm text-gray-400">No payment methods saved.</div>
                )}
                {methods.map(m => (
                  <div key={m.id} className="flex items-center justify-between bg-[#121212] border border-[#2C2C2C] rounded px-4 py-2">
                    <div className="text-sm">
                      <div className="font-semibold">{m.display_name || (m.provider === 'card' ? 'Card' : m.provider)}</div>
                      {m.provider === 'card' && (
                        <div className="text-xs text-gray-400">{m.brand || ''} ·•••• {m.last4 || ''} {m.exp_month && m.exp_year ? `· exp ${String(m.exp_month).padStart(2,'0')}/${m.exp_year}` : ''}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!user) return
                          await supabase.from('user_payment_methods').update({ is_default: false }).eq('user_id', user.id).eq('is_default', true)
                          await supabase.from('user_payment_methods').update({ is_default: true }).eq('id', m.id)
                          await loadMethods()
                        }}
                        className={`px-3 py-1 rounded text-xs ${m.is_default ? 'bg-green-600 text-white' : 'bg-gray-700 text-white'}`}
                      >
                        {m.is_default ? 'Default' : 'Set Default'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!user) return
                          const { data: s2 } = await supabase.auth.getSession()
                          const authToken2 = s2?.session?.access_token || ''
                          const res = await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/square/delete-method/${m.id}?userId=${user.id}`, { method: 'DELETE', headers: { ...(authToken2 ? { Authorization: `Bearer ${authToken2}` } : {}) } })
                          const j = await res.json().catch(() => ({}))
                          if (!res.ok) { toast.error(j?.error || 'Remove failed'); return }
                          await loadMethods()
                        }}
                        className="px-3 py-1 rounded bg-red-600 text-white text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>
        
      </div>
    </div>
  )
}

export default ProfileSetup
