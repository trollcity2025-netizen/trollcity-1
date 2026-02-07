import { useMemo, useState } from 'react'
import { Search, Filter, Gift, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../lib/store'
import { purchaseGift } from '../lib/giftEngine'
import { giftCategories, giftTiers, tierPriority } from '../lib/giftCatalog'
import { usePurchasableItems } from '../hooks/usePurchasableItems'

const priceFilters = [
  { label: 'Any price', value: 'any' },
  { label: 'Under 300', value: 300 },
  { label: 'Under 600', value: 600 },
  { label: 'Under 1,200', value: 1200 },
  { label: 'Above 1,200', value: 'high' },
]

const sortOptions = [
  { label: 'Price: Low → High', value: 'price-asc' },
  { label: 'Price: High → Low', value: 'price-desc' },
  { label: 'Rarity', value: 'rarity' },
]

export default function GiftStorePage() {
  const { profile, refreshProfile } = useAuthStore()
  const { items: purchasableItems, loading } = usePurchasableItems('gift')
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedTier, setSelectedTier] = useState('all')
  const [priceFilter, setPriceFilter] = useState('any')
  const [sortBy, setSortBy] = useState('price-asc')
  const [purchasingGiftSlug, setPurchasingGiftSlug] = useState(null)

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const giftCatalog = useMemo(() => {
    return purchasableItems.map(item => ({
      ...item.metadata,
      gift_slug: item.item_key,
      name: item.display_name,
      coinCost: item.coin_price || 0,
      category: item.metadata?.category || 'Other',
      imageUrl: item.metadata?.imageUrl,
      icon: item.metadata?.icon,
      tier: item.metadata?.tier || 'Common',
      description: item.metadata?.description || ''
    }))
  }, [purchasableItems])

  const filteredGifts = useMemo(() => {
    return giftCatalog
      .filter((gift) => {
        if (selectedCategory !== 'all' && gift.category !== selectedCategory) return false
        if (selectedTier !== 'all' && gift.tier !== selectedTier) return false
        if (priceFilter !== 'any') {
          if (priceFilter === 'high') {
            if (gift.coinCost <= 1200) return false
          } else if (gift.coinCost > Number(priceFilter)) {
            return false
          }
        }
        if (!normalizedSearch) return true
        const target = `${gift.name} ${gift.description}`.toLowerCase()
        return target.includes(normalizedSearch)
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.coinCost - b.coinCost
        if (sortBy === 'price-desc') return b.coinCost - a.coinCost
        const aPriority = tierPriority[a.tier] || 0
        const bPriority = tierPriority[b.tier] || 0
        return aPriority - bPriority
      })
  }, [normalizedSearch, selectedCategory, selectedTier, priceFilter, sortBy])

  const handlePurchase = async (gift) => {
    if (!profile?.id) {
      toast.error('Log in to purchase gifts.')
      return
    }
    setPurchasingGiftSlug(gift.gift_slug)
    try {
      const result = await purchaseGift({
        userId: profile.id,
        giftSlug: gift.gift_slug,
        quantity: 1,
      })

      if (!result.success) {
        throw new Error(result.error || 'Purchase failed')
      }

      toast.success(`Added ${gift.name} to your Gift Inventory.`)
      await refreshProfile()
    } catch (error) {
      toast.error(error.message || 'Unable to purchase gift')
    } finally {
      setPurchasingGiftSlug(null)
    }
  }

  const totalMatches = filteredGifts.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#03030a] via-[#05050f] to-[#0c0a14] text-white px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="bg-[#0b0912]/80 border border-yellow-500/30 rounded-3xl p-6 shadow-[0_0_30px_rgba(255,201,60,0.25)]">
          <div className="flex items-center gap-3 text-yellow-300 text-xs uppercase tracking-[0.5em]">
            <Sparkles className="w-4 h-4" />
            Neon Requiem
          </div>
          <div className="mt-3 flex items-start gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-4xl font-black">
              <Gift className="w-10 h-10 text-yellow-200" />
              Troll Gift Store
            </div>
            <p className="text-gray-300 max-w-2xl text-sm">
              A Ledger Court inspired Troll Coins-only boutique. Shop the dark neon gold catalog, stack your inventory, and send lux gifts exclusively via the broadcast Gift Tray.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <div className="px-4 py-2 bg-[#0d0b16] border border-yellow-500/10 rounded-2xl text-sm text-gray-400">
              <p>You already have a Troll Coin balance; purchases deduct from it automatically.</p>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-[#0d0b16] border border-yellow-500/10 rounded-2xl text-sm text-gray-400">
              <p>
                {totalMatches} / {giftCatalog.length} gifts visible
              </p>
            </div>
          </div>
        </header>

        <div className="bg-[#060510]/80 border border-yellow-500/20 rounded-3xl p-5 shadow-[0_0_30px_rgba(255,201,60,0.2)] space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-400" />
            <input
              type="text"
              placeholder="Search by gift name, description, or spell..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full bg-[#04040a] border border-yellow-500/20 rounded-2xl px-12 py-3 text-sm text-white focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/30 outline-none transition"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Filters</p>
              <div className="text-xs text-gray-400 tracking-[0.2em]">Buy only</div>
            </div>
            <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${selectedCategory === 'all'
                  ? 'bg-yellow-400 text-black'
                  : 'bg-[#0b0812] border border-yellow-500/20 text-yellow-200 hover:border-yellow-400/60'}`}
              >
                All
              </button>
              {giftCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${selectedCategory === category
                    ? 'bg-yellow-400 text-black'
                    : 'bg-[#0b0812] border border-yellow-500/20 text-yellow-200 hover:border-yellow-400/60'}`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex flex-wrap gap-2">
                {['all', ...giftTiers].slice(0, giftTiers.length + 1).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.3em] transition ${selectedTier === tier
                      ? 'bg-yellow-400 text-black'
                      : 'bg-[#0b0812] border border-yellow-500/20 text-yellow-200 hover:border-yellow-400/60'}`}
                  >
                    {tier === 'all' ? 'All Tiers' : tier}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs text-gray-300">
                <Filter className="w-4 h-4" />
                Price
                <select
                  value={priceFilter}
                  onChange={(event) => setPriceFilter(event.target.value)}
                  className="bg-[#05050a] border border-yellow-500/30 rounded-full px-3 py-1 text-xs font-semibold text-yellow-100 focus:outline-none"
                >
                  {priceFilters.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                Sort
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="bg-[#05050a] border border-yellow-500/30 rounded-full px-3 py-1 text-xs font-semibold text-yellow-100 focus:outline-none"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <section className="space-y-6">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm text-gray-400">
                <span>{totalMatches} gifts aligned with your filters</span>
                <span className="italic text-xs text-yellow-300">Buy now, send later via the broadcast Gift Tray</span>
              </div>
              {filteredGifts.length === 0 ? (
                <div className="border border-yellow-500/20 rounded-3xl p-6 text-center text-gray-400">
                  <p>No gifts match those filters yet.</p>
                  <p>Try a different tier, lower the price, or broaden your search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredGifts.map((gift) => {
                    const isPurchasing = purchasingGiftSlug === gift.gift_slug
                    return (
                      <article
                        key={gift.gift_slug}
                        className="relative rounded-3xl border border-yellow-500/20 bg-gradient-to-br from-[#05030a] to-[#090714] p-0 shadow-[0_0_35px_rgba(255,201,60,0.2)] transition hover:-translate-y-1"
                      >
                        <div className="relative h-44 rounded-t-3xl overflow-hidden border-b border-yellow-500/10">
                          <img
                            src={gift.imageUrl}
                            alt={gift.name}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-[#030207] to-transparent" />
                          <div className="absolute inset-0 flex items-start justify-between px-4 pt-3">
                            <span className="text-4xl drop-shadow text-yellow-100">{gift.icon || '🎁'}</span>
                            <span className="px-3 py-1 rounded-full border border-yellow-500/40 bg-black/60 text-[11px] uppercase tracking-[0.3em] text-yellow-200">
                              {gift.tier}
                            </span>
                          </div>
                          <div className="absolute bottom-3 left-4 right-4 text-center">
                            <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500 drop-shadow-sm truncate">
                              {gift.name}
                            </h3>
                          </div>
                        </div>

                        <div className="p-4 space-y-4">
                          <p className="text-sm text-gray-400 leading-relaxed min-h-[3rem] line-clamp-2">
                            {gift.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 bg-yellow-500/10 px-3 py-1.5 rounded-xl border border-yellow-500/20">
                              <span className="text-yellow-400 font-bold">{gift.coinCost.toLocaleString()}</span>
                              <span className="text-[10px] text-yellow-200 uppercase tracking-wider">Coins</span>
                            </div>
                            <button
                              onClick={() => handlePurchase(gift)}
                              disabled={isPurchasing}
                              className="group relative px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase text-xs tracking-wider rounded-xl transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                            >
                              {isPurchasing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span>Buy</span>
                                  <Gift className="w-3 h-3 group-hover:rotate-12 transition-transform" />
                                </div>
                              )}
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {!profile && (
            <div className="text-center text-sm text-gray-400">
              Please sign in to use Troll Coins and purchase gifts.
            </div>
        )}
      </div>
    </div>
  )
}
