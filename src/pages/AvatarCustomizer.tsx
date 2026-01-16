import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { useAvatar } from '../lib/hooks/useAvatar'
import Avatar3D from '../components/avatar/Avatar3D'
import { getTrollMartItems, getUserAvatarConfig, updateUserAvatarConfig } from '../lib/purchases'
import { useTrollMartInventory } from '../hooks/usePurchases'
import type { ClothingCategory, TrollMartClothing } from '../types/purchases'
import { Sparkles, Save, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'

const categories: { key: ClothingCategory; label: string }[] = [
  { key: 'head', label: 'Head' },
  { key: 'body', label: 'Body' },
  { key: 'legs', label: 'Legs' },
  { key: 'feet', label: 'Feet' },
  { key: 'accessories', label: 'Accessories' }
]

export default function AvatarCustomizer() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { config, setConfig } = useAvatar()
  const { ownedItems, loadInventory } = useTrollMartInventory()
  const [items, setItems] = useState<TrollMartClothing[]>([])
  const [saving, setSaving] = useState(false)
  const [selection, setSelection] = useState<Record<ClothingCategory, string | null>>({
    head: null,
    body: null,
    legs: null,
    feet: null,
    accessories: null
  })

  useEffect(() => {
    if (!user) {
      navigate('/auth')
      return
    }

    const load = async () => {
      const data = await getTrollMartItems()
      setItems(data as TrollMartClothing[])

      const existing = await getUserAvatarConfig(user.id)
      if (existing) {
        setSelection({
          head: existing.head_item_id || null,
          body: existing.body_item_id || null,
          legs: existing.legs_item_id || null,
          feet: existing.feet_item_id || null,
          accessories: (existing.accessories_ids && existing.accessories_ids[0]) || null
        })
      }
    }

    load()
  }, [user, navigate])

  const itemsByCategory = useMemo(() => {
    const map: Record<string, TrollMartClothing[]> = {}
    items.forEach(item => {
      if (!map[item.category]) map[item.category] = []
      map[item.category].push(item)
    })
    return map
  }, [items])

  const handleSelect = (category: ClothingCategory, id: string | null) => {
    setSelection(prev => ({ ...prev, [category]: id }))
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const result = await updateUserAvatarConfig(user.id, {
        head_item_id: selection.head,
        body_item_id: selection.body,
        legs_item_id: selection.legs,
        feet_item_id: selection.feet,
        accessories_ids: selection.accessories ? [selection.accessories] : [],
        avatar_config: config
      })

      if (!result.success) {
        toast.error(result.error || 'Failed to save avatar')
        return
      }

      toast.success('Avatar updated')
      loadInventory()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save avatar')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Avatar Customizer</h1>
            <p className="text-sm text-gray-400">Style your character and equip owned clothing.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4">
            <Avatar3D config={config} size="lg" />
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save Avatar'}
            </button>
          </div>

          <div className="lg:col-span-2 bg-black/40 border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Base Style</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs text-gray-400">Skin Tone
                  <select
                    value={config.skinTone}
                    onChange={(e) => setConfig({ ...config, skinTone: e.target.value as any })}
                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2"
                  >
                    <option value="light">Light</option>
                    <option value="medium">Medium</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <label className="text-xs text-gray-400">Hair Style
                  <select
                    value={config.hairStyle}
                    onChange={(e) => setConfig({ ...config, hairStyle: e.target.value as any })}
                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2"
                  >
                    <option value="short">Short</option>
                    <option value="long">Long</option>
                    <option value="buzz">Buzz</option>
                    <option value="none">None</option>
                  </select>
                </label>
                <label className="text-xs text-gray-400">Hair Color
                  <select
                    value={config.hairColor}
                    onChange={(e) => setConfig({ ...config, hairColor: e.target.value as any })}
                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2"
                  >
                    <option value="black">Black</option>
                    <option value="brown">Brown</option>
                    <option value="blonde">Blonde</option>
                    <option value="red">Red</option>
                    <option value="neon">Neon</option>
                  </select>
                </label>
                <label className="text-xs text-gray-400">Outfit
                  <select
                    value={config.outfit}
                    onChange={(e) => setConfig({ ...config, outfit: e.target.value as any })}
                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2"
                  >
                    <option value="casual">Casual</option>
                    <option value="formal">Formal</option>
                    <option value="street">Street</option>
                  </select>
                </label>
                <label className="text-xs text-gray-400">Accessory
                  <select
                    value={config.accessory}
                    onChange={(e) => setConfig({ ...config, accessory: e.target.value as any })}
                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2"
                  >
                    <option value="none">None</option>
                    <option value="glasses">Glasses</option>
                    <option value="hat">Hat</option>
                    <option value="mask">Mask</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Clothing (Owned)</h2>
                <button
                  onClick={() => navigate('/trollmart')}
                  className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20"
                >
                  <ShoppingBag className="w-3 h-3" />
                  Visit Troll Mart
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map(cat => {
                  const options = (itemsByCategory[cat.key] || []).filter(item => ownedItems.has(item.id))
                  return (
                    <label key={cat.key} className="text-xs text-gray-400">
                      {cat.label}
                      <select
                        value={selection[cat.key] || ''}
                        onChange={(e) => handleSelect(cat.key, e.target.value || null)}
                        className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2"
                      >
                        <option value="">None</option>
                        {options.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-gray-500">Only owned items appear here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
