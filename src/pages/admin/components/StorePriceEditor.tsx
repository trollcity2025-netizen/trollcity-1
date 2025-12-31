import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type TableKey = 'coin_packages' | 'entrance_effects' | 'perks' | 'insurance_options'

const initialCatalogs: Record<TableKey, any[]> = {
  coin_packages: [],
  entrance_effects: [],
  perks: [],
  insurance_options: [],
}

const fallbackCatalogs: Record<TableKey, any[]> = {
  coin_packages: [
    { id: 'baby_troll', name: 'Baby Troll', coin_amount: 500, currency: 'USD', price: 6.49, description: 'Perfect for getting started' },
    { id: 'little_troll', name: 'Little Troll', coin_amount: 1100, currency: 'USD', price: 12.99, description: 'Great for casual streams' },
    { id: 'mischief_troll', name: 'Mischief Troll', coin_amount: 2500, currency: 'USD', price: 24.99, description: 'Popular mid tier' },
    { id: 'empire_troll', name: 'Empire Troll', coin_amount: 12000, currency: 'USD', price: 99.99, description: 'Top-tier bundle' },
  ],
  entrance_effects: [
    { id: 'effect_confetti_pop', name: 'Confetti Pop', coin_cost: 1000, rarity: 'Common', animation_type: 'confetti' },
    { id: 'effect_royal_throne', name: 'Royal Throne', coin_cost: 5200, rarity: 'Legendary', animation_type: 'throne' },
    { id: 'effect_firework', name: 'Firework Explosion', coin_cost: 50000, rarity: 'Mythic', animation_type: 'firework' },
  ],
  perks: [
    { id: 'perk_chat_shine', name: 'Chat Shine', cost: 2000, duration_minutes: 1440, perk_type: 'visibility' },
    { id: 'perk_coin_magnet', name: 'Coin Magnet', cost: 4500, duration_minutes: 1440, perk_type: 'boost' },
    { id: 'perk_global_highlight', name: 'Glowing Username', cost: 3000, duration_minutes: 60, perk_type: 'cosmetic' },
    { id: 'perk_rgb_username', name: 'RGB Username', cost: 420, duration_minutes: 1440, perk_type: 'cosmetic' },
  ],
  insurance_options: [
    { id: 'insurance_basic_week', name: 'Basic Coverage', cost: 8000, duration_hours: 168, protection_type: 'gambling' },
    { id: 'insurance_vip_month', name: 'VIP Monthly', cost: 60000, duration_hours: 720, protection_type: 'penalty' },
    { id: 'insurance_supreme_week', name: 'Supreme Court Shield', cost: 120000, duration_hours: 168, protection_type: 'supreme' },
  ],
}

const isMissingTableError = (error: any) =>
  Boolean(
    error?.message?.includes('schema cache') ||
      error?.message?.includes('Could not find the table') ||
      error?.message?.includes('relation') ||
      error?.message?.includes('does not exist'),
  )

type SectionDefinition = {
  key: TableKey
  title: string
  description: string
  field: string
  fieldLabel: string
  helper?: (item: any) => string
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
}

const sections: SectionDefinition[] = [
  {
    key: 'coin_packages',
    title: 'Coin Packages',
    description: 'PayPal bundles sold to users.',
    field: 'price',
    fieldLabel: 'USD Price',
    helper: (item) =>
      `${item.coin_amount?.toLocaleString() || '0'} coins · ${item.currency || 'USD'}`,
    inputProps: { step: '0.01', min: '0', placeholder: 'USD' },
  },
  {
    key: 'entrance_effects',
    title: 'Entrance Effects',
    description: 'Cosmetic light/sound effects that cost troll_coins.',
    field: 'coin_cost',
    fieldLabel: 'Troll Coin Cost',
    helper: (item) => `${item.rarity || 'Standard'} · ${item.animation_type || 'Visual'}`,
    inputProps: { step: '1', min: '0', placeholder: 'Coins' },
  },
  {
    key: 'perks',
    title: 'Perks',
    description: 'Time-based perks and boosts customers purchase.',
    field: 'cost',
    fieldLabel: 'Troll Coin Cost',
    helper: (item) =>
      `${item.duration_minutes || 0} min · ${item.perk_type || 'General'}`,
    inputProps: { step: '1', min: '0', placeholder: 'Coins' },
  },
  {
    key: 'insurance_options',
    title: 'Insurance Packages',
    description: 'Protection plans that trigger automatically when active.',
    field: 'cost',
    fieldLabel: 'Troll Coin Cost',
    helper: (item) =>
      `${item.duration_hours || 0}h · ${item.protection_type || 'Coverage'}`,
    inputProps: { step: '1', min: '0', placeholder: 'Coins' },
  },
]

const buildKey = (section: TableKey, id: string, field: string) => `${section}-${id}-${field}`

export default function StorePriceEditor() {
  const [catalogs, setCatalogs] = useState<Record<TableKey, any[]>>(initialCatalogs)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKeys, setSavingKeys] = useState<string[]>([])
  const [editedValues, setEditedValues] = useState<Record<string, string>>({})
  const [catalogNotes, setCatalogNotes] = useState<Record<TableKey, string | null>>({
    coin_packages: null,
    entrance_effects: null,
    perks: null,
    insurance_options: null,
  })

  const loadCatalogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        coinRes,
        effectsRes,
        perksRes,
        insuranceRes,
      ] = await Promise.all([
        supabase
          .from('coin_packages')
          .select('id, name, coin_amount, currency, price, description')
          .order('created_at', { ascending: true }),
        supabase
          .from('entrance_effects')
          .select('id, name, coin_cost, rarity, animation_type')
          .order('created_at', { ascending: true }),
        supabase
          .from('perks')
          .select('id, name, cost, duration_minutes, perk_type')
          .order('created_at', { ascending: true }),
        supabase
          .from('insurance_options')
          .select('id, name, cost, duration_hours, protection_type')
          .order('created_at', { ascending: true }),
      ])

      const handleResult = (result: any, table: TableKey) => {
        if (result.error) {
          const missing = isMissingTableError(result.error)
          setCatalogNotes((prev) => ({
            ...prev,
            [table]: missing
              ? `Table "${table}" is not provisioned here; showing fallback samples.`
              : `Failed to load "${table}": ${result.error.message || 'unknown error'}.`,
          }))
          if (!missing) {
            console.error('Store catalog error:', result.error)
          }
          return missing ? fallbackCatalogs[table] : []
        }
        setCatalogNotes((prev) => ({ ...prev, [table]: null }))
        return result.data || []
      }

      const coinData = handleResult(coinRes, 'coin_packages')
      const effectsData = handleResult(effectsRes, 'entrance_effects')
      const perksData = handleResult(perksRes, 'perks')
      const insuranceData = handleResult(insuranceRes, 'insurance_options')

      setCatalogs({
        coin_packages: coinData,
        entrance_effects: effectsData,
        perks: perksData,
        insurance_options: insuranceData,
      })
    } catch (err) {
      console.error('Failed to load store catalogs', err)
      setError('Failed to load store catalogs. Please try again later.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCatalogs()
  }, [loadCatalogs])

  const handleSave = async (section: SectionDefinition, item: any) => {
    const key = buildKey(section.key, item.id, section.field)
    const raw = editedValues[key]
    const baseValue = item[section.field]
    const stringBase = baseValue != null ? String(baseValue) : ''
    const candidate = raw ?? stringBase

    if (!candidate) {
      toast.error('Please enter a value before saving.')
      return
    }

    const parsed = Number(candidate)
    if (Number.isNaN(parsed)) {
      toast.error('Enter a valid numeric value.')
      return
    }
    if (parsed < 0) {
      toast.error('Value cannot be negative.')
      return
    }

    if (candidate === stringBase) {
      toast.info('No changes detected.')
      return
    }

    setSavingKeys((prev) => [...prev, key])
    try {
      const updatePayload = { [section.field]: parsed }
      const { error: updateError } = await supabase
        .from(section.key)
        .update(updatePayload)
        .eq('id', item.id)

      if (updateError) {
        console.error('Price update failed:', updateError)
        toast.error('Failed to update price.')
        return
      }

      toast.success(`${section.title} updated successfully.`)
      setEditedValues((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      await loadCatalogs()
    } finally {
      setSavingKeys((prev) => prev.filter((k) => k !== key))
    }
  }

  const isSaving = (key: string) => savingKeys.includes(key)

  const handleInputChange = (section: SectionDefinition, item: any, value: string) => {
    const key = buildKey(section.key, item.id, section.field)
    setEditedValues((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-white">Store Price Editor</h3>
          <p className="text-sm text-gray-400">
            Edit prices for coins, effects, perks, and insurance without touching SQL.
          </p>
        </div>
        <button
          onClick={loadCatalogs}
          disabled={loading}
          className="px-4 py-2 bg-cyan-600 rounded-lg text-sm font-semibold hover:bg-cyan-500 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh Catalogs'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {sections.map((section) => {
          const items = catalogs[section.key] || []
          return (
            <div
              key={section.key}
              className="rounded-2xl border border-[#2C2C2C] bg-[#0B0912] p-5 shadow-lg shadow-black/20"
            >
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-semibold text-white">{section.title}</p>
                  <p className="text-xs uppercase tracking-wider text-gray-400">
                    {section.description}
                  </p>
                </div>
                <div className="text-xs text-gray-400">{items.length} items loaded</div>
              </div>
              {catalogNotes[section.key] && (
                <p className="mt-1 text-xs text-yellow-300">{catalogNotes[section.key]}</p>
              )}
              <div className="mt-4 space-y-3">
                {loading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading {section.title.toLowerCase()}…
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-sm text-gray-500">No entries found.</p>
                ) : (
                  items.map((item) => {
                    const baseValue =
                      item[section.field] != null ? String(item[section.field]) : ''
                    const key = buildKey(section.key, item.id, section.field)
                    const edited = editedValues[key]
                    const currentValue = edited !== undefined ? edited : baseValue
                    const hasChanges =
                      currentValue !== '' &&
                      currentValue !== baseValue &&
                      !isSaving(key)
                    return (
                      <div
                        key={item.id}
                        className="grid gap-3 rounded-xl border border-[#1F1B2A] bg-[#141023] p-3 md:grid-cols-[1fr,280px] md:items-center"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{item.name}</p>
                          {section.helper && (
                            <p className="text-xs text-gray-400">{section.helper(item)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="sr-only">
                            {section.fieldLabel} for {item.name}
                          </label>
                          <input
                            type="number"
                            step={section.inputProps?.step || '1'}
                            min={section.inputProps?.min || '0'}
                            placeholder={section.inputProps?.placeholder || ''}
                            value={currentValue}
                            onChange={(event) =>
                              handleInputChange(section, item, event.target.value)
                            }
                            className="w-full rounded-lg border border-[#2C2C2C] bg-[#0E0C16] px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={!hasChanges}
                            onClick={() => handleSave(section, item)}
                            className="px-4 py-2 rounded-lg bg-purple-600 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isSaving(key) ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
