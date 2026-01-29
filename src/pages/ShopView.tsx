import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { deductCoins } from '../lib/coinTransactions'
import { Store, ShoppingCart, Coins, ArrowLeft, Package, Receipt, X } from 'lucide-react'

export default function ShopView() {
  const { username } = useParams<{ username: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [shop, setShop] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [purchaseReceipt, setPurchaseReceipt] = useState<any>(null)

  const loadShop = useCallback(async () => {
    if (!username) return

    setLoading(true)
    try {
      // Resolve owner by username
      const { data: owner, error: ownerErr } = await supabase
        .from('user_profiles')
        .select('id, username')
        .eq('username', username)
        .single()
      if (ownerErr) throw ownerErr
      if (!owner?.id) {
        toast.error('Seller not found')
        navigate('/marketplace')
        return
      }

      // Load shop details by owner_id
      const { data: shopData, error: shopError } = await supabase
        .from('trollcity_shops')
        .select('*')
        .eq('owner_id', owner.id)
        .eq('is_active', true)
        .single()

      if (shopError) throw shopError
      if (!shopData) {
        toast.error('Shop not found')
        navigate('/marketplace')
        return
      }

      setShop(shopData)

      // Load shop items
      const { data: itemsData, error: itemsError } = await supabase
        .from('shop_items')
        .select('*')
        .eq('shop_id', shopData.id)
        .order('created_at', { ascending: false })

      if (itemsError) throw itemsError
      setItems(itemsData || [])

    } catch (err) {
      console.error('Error loading shop:', err)
      toast.error('Failed to load shop')
      navigate('/marketplace')
    } finally {
      setLoading(false)
    }
  }, [username, navigate])

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true })
      return
    }
    if (username) {
      loadShop()
    }
  }, [user, username, navigate, loadShop])

  const purchaseItem = async (item: any) => {
    if (!user) return

    setPurchasing(item.id)
    try {
      // Check if user has enough troll_coins (purchases use troll_coins specifically)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', user.id)
        .single()

      if ((profile?.troll_coins || 0) < item.price) {
        toast.error('Not enough troll coins!')
        return
      }

      // Check item availability (if limited stock)
      if (item.stock_quantity !== null && item.stock_quantity <= 0) {
        toast.error('This item is out of stock!')
        return
      }

      // Deduct coins using the coin transaction system
      const deductResult = await deductCoins({
        userId: user.id,
        amount: item.price,
        type: 'purchase',
        description: `Purchase: ${item.name} from ${shop.name}`,
        metadata: {
          shop_id: shop.id,
          item_id: item.id,
          seller_id: shop.owner_id
        }
      })

      if (!deductResult.success) {
        toast.error('Failed to process payment')
        return
      }

      // Ensure a marketplace item exists to reference with a UUID
      const { data: createdMarketplaceItem, error: marketplaceItemError } = await supabase
        .from('marketplace_items')
        .insert([{
          seller_id: shop.owner_id,
          title: item.name,
          description: item.description,
          price_coins: item.price,
          stock: item.stock_quantity ?? null,
          thumbnail_url: item.thumbnail_url ?? null,
          type: item.category,
          status: 'active'
        }])
        .select()
        .single()

      if (marketplaceItemError) {
        throw marketplaceItemError
      }

      const marketplaceItemId = createdMarketplaceItem?.id
      if (!marketplaceItemId) {
        throw new Error('Failed to create marketplace item reference')
      }

      // Create purchase record (uses marketplace item UUID)
      const platformFee = 0
      const sellerEarnings = item.price

      const { data: purchaseData, error: purchaseError } = await supabase
        .from('marketplace_purchases')
        .insert([{
          buyer_id: user.id,
          seller_id: shop.owner_id,
          item_id: marketplaceItemId,
          price_paid: item.price,
          platform_fee: platformFee,
          seller_earnings: sellerEarnings,
          purchase_date: new Date().toISOString()
        }])
        .select()
        .single()

      if (purchaseError) throw purchaseError

      // Update item stock (if limited)
      if (item.stock_quantity !== null) {
        const { error: stockError } = await supabase
          .from('shop_items')
          .update({ stock_quantity: item.stock_quantity - 1 })
          .eq('id', item.id)

        if (stockError) {
          console.error('Error updating stock:', stockError)
          // Don't fail the purchase for stock update errors
        }

        // Update local state
        setItems(prev => prev.map(i =>
          i.id === item.id
            ? { ...i, stock_quantity: i.stock_quantity - 1 }
            : i
        ))
      }

      // Add to user inventory (references marketplace item UUID)
      const { error: inventoryError } = await supabase
        .from('user_inventory')
        .insert([{
          user_id: user.id,
          item_id: marketplaceItemId,
          acquired_at: new Date().toISOString()
        }])

      if (inventoryError) throw inventoryError

      const { error: transactionError } = await supabase
        .from('shop_transactions')
        .insert({
          item_id: item.id,
          quantity: 1,
          coins_spent: item.price
        })

      if (transactionError) throw transactionError

      // Handle insurance auto-expire
      if (item.category === 'insurance') {
        const expireDate = new Date()
        expireDate.setDate(expireDate.getDate() + 30) // 30 days for insurance

        const { error: expireError } = await supabase
          .from('user_inventory')
          .update({ expires_at: expireDate.toISOString() })
          .eq('user_id', user.id)
          .eq('item_id', item.id)
          .eq('acquired_at', new Date().toISOString())

        if (expireError) {
          console.error('Error setting insurance expiration:', expireError)
        }
      }

      // Create receipt data
      const receipt = {
        id: purchaseData.id,
        item: item,
        shop: shop,
        price: item.price,
        platformFee: platformFee,
        sellerEarnings: sellerEarnings,
        purchaseDate: purchaseData.purchase_date,
        buyerId: user.id
      }

      setPurchaseReceipt(receipt)
      setShowReceipt(true)

      toast.success(`Purchased ${item.name}!`)

    } catch (err: any) {
      console.error('Purchase error:', err)
      toast.error('Purchase failed: ' + err.message)
    } finally {
      setPurchasing(null)
    }
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-1/3 mb-6"></div>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-300 mb-6">
              All sales are final. Illegal items or sales are strictly prohibited and will result in enforcement actions.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C]">
                  <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-700 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <Store className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Shop Not Found</h2>
          <p className="text-gray-400 mb-6">This shop may have been removed or is no longer available.</p>
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-300 mb-6">
            All sales are final. Illegal items or sales are strictly prohibited and will result in enforcement actions.
          </div>
          <button
            onClick={() => navigate('/marketplace')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
          >
            Back to Marketplace
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/marketplace')}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Store className="w-8 h-8 text-purple-400" />
                {shop.name}
              </h1>
              <p className="text-gray-400">Browse and purchase items from this shop</p>
            </div>
          </div>
        </div>

        {/* Shop Info */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-purple-300">{shop.name}</h2>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Items Available</p>
              <p className="text-2xl font-bold text-green-400">{items.length}</p>
            </div>
          </div>
        </div>

        {/* Items Grid */}
        {items.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Items Available</h2>
            <p className="text-gray-400">This shop doesn't have any items listed yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div key={item.id} className="bg-zinc-900 rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all">
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-32 object-cover rounded-lg mb-4"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-bold text-purple-300 mb-2">{item.name}</h3>
                  {item.description && (
                    <p className="text-sm text-gray-400 mb-3">{item.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="text-xl font-bold text-yellow-400">{item.price.toLocaleString()}</span>
                      <span className="text-sm text-gray-400">Troll Coins</span>
                    </div>
                    {item.stock_quantity !== null && (
                      <div className="text-xs text-gray-400">
                        {item.item_type === 'broadcast_consumable' ? '' : (item.stock_quantity > 0 ? `${item.stock_quantity} left` : 'Out of stock')}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => purchaseItem(item)}
                  disabled={purchasing === item.id || (item.stock_quantity !== null && item.stock_quantity <= 0)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {purchasing === item.id ? (
                    <>Processing...</>
                  ) : item.stock_quantity !== null && item.stock_quantity <= 0 ? (
                    <>{item.item_type !== 'broadcast_consumable' && <>Out of Stock</>}</>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      Purchase
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Purchase Receipt Modal */}
        {showReceipt && purchaseReceipt && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-green-400" />
                  Purchase Receipt
                </h3>
                <button
                  onClick={() => {
                    setShowReceipt(false)
                    setPurchaseReceipt(null)
                    navigate('/inventory')
                  }}
                  className="p-1 hover:bg-zinc-700 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Item Details */}
                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {purchaseReceipt.item.image_url && (
                      <img
                        src={purchaseReceipt.item.image_url}
                        alt={purchaseReceipt.item.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <div>
                      <h4 className="font-semibold text-purple-300">{purchaseReceipt.item.name}</h4>
                      <p className="text-sm text-gray-400">from {purchaseReceipt.shop.name}</p>
                    </div>
                  </div>

                  {purchaseReceipt.item.description && (
                    <p className="text-sm text-gray-300 mb-3">{purchaseReceipt.item.description}</p>
                  )}
                </div>

                {/* Transaction Details */}
                <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Item Price:</span>
                    <span className="text-yellow-400">{purchaseReceipt.price.toLocaleString()} coins</span>
                  </div>
                  {purchaseReceipt.platformFee > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Platform Fee:</span>
                        <span className="text-red-400">-{purchaseReceipt.platformFee} coins</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold border-t border-zinc-600 pt-2">
                        <span>Seller Earnings:</span>
                        <span className="text-green-400">{purchaseReceipt.sellerEarnings} coins</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Receipt Info */}
                <div className="bg-zinc-800 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Receipt ID:</span>
                    <span className="font-mono text-xs">{purchaseReceipt.id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Purchase Date:</span>
                    <span>{new Date(purchaseReceipt.purchaseDate).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buyer ID:</span>
                    <span className="font-mono text-xs">{purchaseReceipt.buyerId.slice(0, 8)}...</span>
                  </div>
                </div>

                {/* Insurance Notice */}
                {purchaseReceipt.item.category === 'insurance' && (
                  <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-4 h-4 text-blue-400" />
                      <span className="font-semibold text-blue-400">Insurance Item</span>
                    </div>
                    <p className="text-sm text-gray-300">
                      This insurance policy will automatically expire 30 days from purchase.
                      You can view its status in your inventory.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowReceipt(false)
                    setPurchaseReceipt(null)
                    navigate('/inventory')
                  }}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 rounded font-semibold transition-colors"
                >
                  View in Inventory
                </button>
                <button
                  onClick={() => {
                    setShowReceipt(false)
                    setPurchaseReceipt(null)
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
