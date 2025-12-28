import { useMemo, useState } from 'react'
import { X, Gift, Sparkles } from 'lucide-react'

const quickQuantities = [1, 3, 5]

export default function GiftTray({
  isOpen,
  onClose,
  inventory = [],
  onSendGift,
  isLoading = false,
}) {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sendingGift, setSendingGift] = useState(null)

  const availableInventory = useMemo(
    () =>
      inventory
        .map((entry) => ({
          ...entry,
          gift: entry.gift || { name: entry.giftSlug || 'Unknown Gift', animationType: 'glow' },
        }))
        .filter((entry) => entry.quantity > 0 && entry.gift),
    [inventory]
  )

  const categories = useMemo(() => {
    const cats = new Set()
    availableInventory.forEach((entry) => {
      if (entry.gift?.category) cats.add(entry.gift.category)
    })

    return ['All', ...cats]
  }, [availableInventory])

  const filteredInventory = useMemo(() => {
    if (selectedCategory === 'All') return availableInventory
    return availableInventory.filter((entry) => entry.gift?.category === selectedCategory)
  }, [availableInventory, selectedCategory])

  const popularInventory = useMemo(() => {
    return [...filteredInventory]
      .sort((a, b) => (b.gift?.popularityScore || 0) - (a.gift?.popularityScore || 0))
      .slice(0, 6)
  }, [filteredInventory])

  const handleSend = async (giftSlug, quantity) => {
    if (!giftSlug || quantity <= 0) return
    setSendingGift({ giftSlug, quantity })
    try {
      await onSendGift(giftSlug, quantity)
    } finally {
      setSendingGift(null)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 transition duration-300 ${
        isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        className={`absolute inset-x-0 bottom-0 z-50 w-full max-h-[75vh] rounded-t-3xl border border-yellow-500/30 bg-gradient-to-t from-[#050409] to-[#080714] px-5 pt-4 pb-6 shadow-[0_-20px_60px_rgba(0,0,0,0.8)] transition duration-300 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.5em] text-yellow-300">
            <Sparkles className="w-4 h-4" />
            Gift Tray
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[#0b0912]/80 border border-yellow-500/30 text-yellow-200"
            aria-label="Close gift tray"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-1">Send gifts straight from your inventory — no store button needed.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.4em] transition ${
              selectedCategory === 'All'
                ? 'bg-yellow-400 text-black'
                : 'bg-[#0b0812] border border-yellow-500/20 text-yellow-100 hover:border-yellow-400/60'
            }`}
          >
            All Categories
          </button>
          {categories.slice(1).map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.4em] transition ${
                selectedCategory === category
                  ? 'bg-yellow-400 text-black'
                  : 'bg-[#0b0812] border border-yellow-500/20 text-yellow-100 hover:border-yellow-400/60'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="mt-4 max-h-[48vh] overflow-y-auto pr-2 space-y-4">
          {isLoading && (
            <div className="text-center text-sm text-gray-400">Loading inventory…</div>
          )}

          {!isLoading && availableInventory.length === 0 && (
            <div className="rounded-2xl border border-yellow-500/20 bg-[#040409] p-5 text-center text-sm text-gray-400">
              Your Gift Inventory is empty. Visit the Troll Gift Store to load up.
            </div>
          )}

          {!isLoading && availableInventory.length > 0 && popularInventory.length === 0 && (
            <div className="rounded-2xl border border-yellow-500/20 bg-[#040409] p-5 text-center text-sm text-gray-400">
              No gifts match this category. Try another filter or open the store.
            </div>
          )}

          {popularInventory.map((entry) => {
            const gift = entry.gift
            const sendingCurrent = sendingGift?.giftSlug === entry.giftSlug
            return (
              <div
                key={entry.giftSlug}
                className="rounded-3xl border border-yellow-500/20 bg-[#05030a] p-4 shadow-[0_0_30px_rgba(255,201,60,0.25)]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{gift?.icon || '🎁'}</span>
                    <div>
                      <h4 className="text-lg font-semibold">{gift?.name || entry.giftSlug}</h4>
                      <p className="text-[11px] uppercase tracking-[0.4em] text-gray-500">{gift?.tier || 'Common'}</p>
                    </div>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.4em] text-yellow-200">{gift?.category}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">{gift?.description}</p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Quantity: <span className="font-semibold text-yellow-300">x{entry.quantity}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {quickQuantities.map((qty) => (
                    <button
                      key={`${entry.giftSlug}-${qty}`}
                      onClick={() => handleSend(entry.giftSlug, qty)}
                      disabled={entry.quantity < qty || sendingCurrent}
                      className={`flex-1 min-w-[85px] rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] transition ${
                        entry.quantity < qty || sendingCurrent
                          ? 'bg-yellow-500/20 text-yellow-100 cursor-not-allowed'
                          : 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black hover:scale-105'
                      }`}
                    >
                      {sendingCurrent && sendingGift?.quantity === qty ? 'Sending...' : `Send x${qty}`}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}






