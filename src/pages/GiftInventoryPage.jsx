import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '../lib/store'
import { getUserInventory } from '../lib/giftEngine'
import { Sparkles, RefreshCw, Gift, ChevronDown, ChevronUp } from 'lucide-react'

export default function GiftInventoryPage() {
  const { user } = useAuthStore()
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(false)
  const [expandedGift, setExpandedGift] = useState(null)

  const refreshInventory = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await getUserInventory(user.id)
      setInventory(data)
    } catch (error) {
      console.error('Gift inventory error', error)
      toast.error('Unable to load your Gift Inventory.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshInventory()
  }, [user?.id])

  const totalGifts = useMemo(
    () => inventory.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [inventory]
  )

  const totalValue = useMemo(
    () =>
      inventory.reduce(
        (sum, item) => sum + (item.gift?.coinCost || 0) * (Number(item.quantity) || 0),
        0
      ),
    [inventory]
  )

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#03030a] to-[#0a0814] text-white px-6">
        <div className="text-center space-y-3 max-w-md">
          <Gift className="w-16 h-16 mx-auto text-yellow-400" />
          <p className="text-2xl font-bold">Your Troll Gift Vault</p>
          <p className="text-gray-400">
            Sign in to view the Troll Gift stash you've built with Troll Coins for broadcast moments.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#02020a] via-[#040214] to-[#0c0712] text-white px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.5em] text-gray-400">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              Troll Gift Vault
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Gift className="w-10 h-10 text-yellow-300" />
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight">Gift Inventory</h1>
                <p className="text-sm text-gray-400">
                  {totalGifts.toLocaleString()} gifts • {totalValue.toLocaleString()} Troll Coins invested
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={refreshInventory}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-500/40 bg-[#0a0813] text-xs uppercase tracking-[0.3em] text-yellow-100 transition hover:border-yellow-300/80"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="h-48 rounded-3xl border border-yellow-500/20 bg-[#050309]/60 animate-pulse" />
            ))}
          </div>
        ) : inventory.length === 0 ? (
          <div className="rounded-3xl border border-yellow-500/20 bg-[#06030b]/80 p-8 text-center text-gray-300 space-y-3">
            <p className="text-lg font-semibold">No gifts in the vault yet</p>
            <p className="text-sm">Visit the Troll Gift Store to stock up with Troll Coins-only purchases.</p>
            <p className="text-xs uppercase tracking-[0.4em] text-yellow-200">
              Gifts are added immediately after purchase.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {inventory.map((slot) => {
              const gift = slot.gift
              const isExpanded = expandedGift === slot.giftSlug
              return (
                <article
                  key={`${slot.giftSlug}-${slot.quantity}`}
                  className="rounded-3xl border border-yellow-500/20 bg-gradient-to-br from-[#05030a] to-[#080816] p-5 shadow-[0_0_40px_rgba(255,201,60,0.15)]"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {gift?.imageUrl && (
                      <div className="h-24 w-24 overflow-hidden rounded-2xl border border-yellow-500/20 shadow-inner">
                        <img src={gift.imageUrl} alt={gift.name} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <h3 className="text-2xl font-bold">{gift?.name || slot.giftSlug}</h3>
                          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">
                            {gift?.category || 'Unknown'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-200 uppercase tracking-[0.3em]">
                            x{slot.quantity || 0}
                          </span>
                          <span className="px-3 py-1 rounded-full bg-white/10 border border-yellow-500/30 text-yellow-100 text-[10px] uppercase tracking-[0.3em]">
                            {gift?.tier || 'Unknown Tier'}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-300 h-20 overflow-hidden">
                        {gift?.description || 'No description available.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setExpandedGift(isExpanded ? null : slot.giftSlug)}
                      className="self-start flex items-center gap-1 text-xs uppercase tracking-[0.3em] text-yellow-200"
                    >
                      {isExpanded ? 'Hide' : 'View'} details
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-400">
                    <span>Value: {gift?.coinCost?.toLocaleString() || '0'} T each</span>
                    <span>Animation: {gift?.animationType || 'none'}</span>
                    <span>Popularity: {gift?.popularityScore ?? '—'}</span>
                  </div>
                  {isExpanded && (
                    <p className="mt-4 text-sm text-gray-300 leading-relaxed">{gift?.description || 'No description available.'}</p>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
