import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Store, ShoppingCart, Coins, DollarSign, Truck, FileText, TrendingUp, AlertTriangle, CheckCircle, XCircle, Clock, Plus, Edit, Trash, Package } from 'lucide-react'

export default function SellOnTrollCity() {
  console.log('🛍️ SellOnTrollCity component rendering');
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [shop, setShop] = useState<any>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [earnings, setEarnings] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('requirements')
  const [applicationSubmitted, setApplicationSubmitted] = useState(false)
  const [applicationLoading, setApplicationLoading] = useState(false)
  const [existingApplication, setExistingApplication] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', image_url: '' })

  // Seller application form state
  const [storeName, setStoreName] = useState('')
  const [storeDescription, setStoreDescription] = useState('')
  const [productTypes, setProductTypes] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  
  // Product editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editProduct, setEditProduct] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image_url: ''
  })

  // Shop deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingShop, setDeletingShop] = useState(false)

  useEffect(() => {
    if (!user) return
    loadShop()
  }, [user?.id])

  // Check if user is verified seller
  const isVerifiedSeller = user && existingApplication?.status === 'approved'

  const loadShop = async () => {
    setLoading(true)

    // Check for existing seller application
    const { data: appData } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', user!.id)
      .eq('type', 'seller')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setExistingApplication(appData)
    setApplicationSubmitted(!!appData)

    const { data } = await supabase
      .from('trollcity_shops')
      .select('*')
      .eq('owner_id', user!.id)
      .maybeSingle()
    setShop(data)

    // Load earnings and products data if shop exists
    if (data) {
      const { data: earningsData } = await supabase
        .from('shop_transactions')
        .select('*')
        .eq('shop_id', data.id)
        .order('created_at', { ascending: false })
      setEarnings(earningsData || [])

      const { data: productsData } = await supabase
        .from('shop_items')
        .select('*')
        .eq('shop_id', data.id)
        .order('created_at', { ascending: false })
      setProducts(productsData || [])
    }

    setLoading(false)
  }

  const createShop = async () => {
    if (!name.trim()) return toast.error('Enter a shop name')
    const { data, error } = await supabase
      .from('trollcity_shops')
      .insert([{ owner_id: user!.id, name }])
      .select('*')
      .maybeSingle()
    if (error) return toast.error(error.message)
    setShop(data)
    toast.success('Shop created')
  }

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!storeName.trim() || !storeDescription.trim() || !contactEmail.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    setApplicationLoading(true)
    try {
      const { error } = await supabase
        .from('applications')
        .insert([{
          user_id: user!.id,
          type: 'seller',
          store_name: storeName.trim(),
          store_description: storeDescription.trim(),
          product_types: productTypes.trim(),
          contact_email: contactEmail.trim(),
          status: 'pending'
        }])

      if (error) throw error

      setApplicationSubmitted(true)
      toast.success('Seller application submitted successfully!')

      // Redirect to home/dashboard with state
      navigate('/live', {
        state: { submitted: 'seller' }
      })
    } catch (error: any) {
      console.error('Error submitting application:', error)
      toast.error('Failed to submit application')
    } finally {
      setApplicationLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.price) return toast.error('Name and price required')
    
    try {
      const price = parseFloat(formData.price)
      if (isNaN(price) || price < 0) return toast.error('Invalid price')

      if (isEditing && editProduct) {
        // Update existing product
        const { error } = await supabase
          .from('shop_items')
          .update({
            name: formData.name,
            description: formData.description,
            price: price,
            image_url: formData.image_url || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editProduct.id)
        
        if (error) throw error
        toast.success('Product updated')
      } else {
        // Create new product
        const { data, error } = await supabase
          .from('shop_items')
          .insert([{
            shop_id: shop.id,
            name: formData.name,
            description: formData.description,
            price: price,
            image_url: formData.image_url || null
          }])
          .select()
          .single()

        if (error) throw error

        setProducts([data, ...products])
        toast.success('Product added successfully!')
      }
      
      setFormData({ name: '', description: '', price: '', image_url: '' })
      setIsEditing(false)
      setEditProduct(null)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleEdit = (product: any) => {
    setEditProduct(product)
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      image_url: product.image_url || ''
    })
    setIsEditing(true)
  }

  const deleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('shop_items')
        .delete()
        .eq('id', productId)

      if (error) throw error

      setProducts(products.filter(p => p.id !== productId))
      toast.success('Product deleted successfully!')
    } catch (error: any) {
      console.error('Error deleting product:', error)
      toast.error('Failed to delete product')
    }
  }

  const deleteShop = async () => {
    if (!shop) return

    setDeletingShop(true)
    try {
      const { error } = await supabase
        .from('trollcity_shops')
        .update({ is_active: false })
        .eq('id', shop.id)
        .eq('owner_id', user!.id)

      if (error) throw error

      setShop(null)
      setProducts([])
      setShowDeleteModal(false)
      toast.success('Shop deleted successfully!')
    } catch (error: any) {
      console.error('Error deleting shop:', error)
      toast.error('Failed to delete shop')
    } finally {
      setDeletingShop(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">Please log in</p>
          <button onClick={() => navigate('/auth')} className="px-4 py-2 bg-purple-600 rounded-lg">Log In</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Store className="w-8 h-8 text-purple-400" />
            Sell on Troll City
          </h1>
          <p className="text-gray-400">Create your shop, manage products, and track earnings</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center">
          <div className="bg-[#1A1A1A] rounded-lg p-1 border border-[#2C2C2C]">
            {isVerifiedSeller || shop ? (
              <>
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-6 py-2 rounded-md transition-colors ${activeTab === 'overview' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Overview
                </button>
                {shop && (
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-6 py-2 rounded-md transition-colors ${activeTab === 'dashboard' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Dashboard
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('requirements')}
                  className={`px-6 py-2 rounded-md transition-colors ${activeTab === 'requirements' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Requirements
                </button>
                {shop && (
                  <button
                    onClick={() => setActiveTab('earnings')}
                    className={`px-6 py-2 rounded-md transition-colors ${activeTab === 'earnings' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Earnings
                  </button>
                )}
              </>
            ) : (
              <button
                className="px-6 py-2 rounded-md bg-purple-600 text-white"
                disabled
              >
                Requirements
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Store className="w-5 h-5 text-purple-400" />
                Create Your Shop
              </h2>
              {loading ? (
                <p className="text-gray-400">Loading...</p>
              ) : shop ? (
                <div className="space-y-4">
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-green-400 font-semibold">✓ Shop Active: {shop.name}</p>
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                      >
                        Delete Shop
                      </button>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('dashboard')} className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
                    Seller Dashboard
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-yellow-400 text-sm">⚠️ You must apply and meet all requirements before creating a shop</p>
                  </div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Shop name"
                    className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                  <button onClick={createShop} className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                    Create Shop
                  </button>
                </div>
              )}
            </div>

            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-400" />
                Manage Products
              </h2>
              <p className="text-gray-300 mb-4">Add and update your product listings</p>
              {shop ? (
                <button onClick={() => setActiveTab('dashboard')} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                  Product Management
                </button>
              ) : (
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-gray-400 text-sm">Create your shop first to manage products</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && shop && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] h-fit">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                {isEditing ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {isEditing ? 'Edit Product' : 'Add New Product'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Product Name</label>
                  <input
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 outline-none"
                    placeholder="e.g. Rare Troll Card"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 outline-none resize-none h-24"
                    placeholder="Product details..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Price (USD)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={e => setFormData({...formData, price: e.target.value})}
                      className="w-full pl-10 pr-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 outline-none"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Image URL (optional)</label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={e => setFormData({...formData, image_url: e.target.value})}
                    className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 outline-none"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className={`flex-1 py-2 rounded-lg font-semibold ${isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} transition-colors`}
                  >
                    {isEditing ? 'Update Product' : 'Add Product'}
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false)
                        setEditProduct(null)
                        setFormData({ name: '', description: '', price: '', image_url: '' })
                      }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* List */}
            <div className="lg:col-span-2 bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
              <h2 className="text-xl font-semibold mb-4">Your Products ({products.length})</h2>
              <div className="space-y-4">
                {products.map(product => (
                  <div key={product.id} className="bg-[#0D0D0D] p-4 rounded-lg border border-[#2C2C2C] flex justify-between items-center group hover:border-purple-500/50 transition-colors">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-white">{product.name}</h3>
                      <p className="text-gray-400 text-sm mb-1">{product.description}</p>
                      <div className="flex items-center gap-4">
                        <p className="text-green-400 font-semibold">${product.price.toFixed(2)}</p>
                        {product.image_url && (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(product)}
                        className="p-2 bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="p-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition-colors"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {products.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>No products listed yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'requirements' && (
          <div className="space-y-6">
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-400" />
                Seller Requirements
              </h2>

              <div className="space-y-4">
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-red-400 mb-1">Application Required</h3>
                      <p className="text-gray-300 text-sm">All users must apply to become sellers. Your application will be reviewed before approval.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Truck className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-blue-400 mb-1">Shipping Costs</h3>
                      <p className="text-gray-300 text-sm">Sellers are responsible for all shipping costs. Calculate shipping fees into your product prices.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-yellow-400 mb-1">Weekly Platform Fee</h3>
                      <p className="text-gray-300 text-sm">$40 per week must be paid to PayPal for platform access. This fee is deducted automatically.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Coins className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-purple-400 mb-1">Payment Processing</h3>
                      <p className="text-gray-300 text-sm">All payments are processed through PayPal. Sellers receive payments after platform fees and PayPal processing fees.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-900/50 rounded-lg">
                {isVerifiedSeller ? (
                  <div className="text-center">
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mb-4">
                      <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                      <p className="text-green-400 font-semibold">Application Approved!</p>
                      <p className="text-gray-400 text-sm">You can now create and manage your shop. Switch to the Overview tab to get started.</p>
                    </div>
                  </div>
                ) : existingApplication?.status === 'rejected' ? (
                  <div className="text-center">
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
                      <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                      <p className="text-red-400 font-semibold">Application Rejected</p>
                      <p className="text-gray-400 text-sm">Your application was not approved. Please contact support for more information.</p>
                    </div>
                  </div>
                ) : existingApplication ? (
                  <div className="text-center">
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
                      <Clock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                      <p className="text-yellow-400 font-semibold">Application Under Review</p>
                      <p className="text-gray-400 text-sm">Your application has been submitted and is being reviewed by admins. You'll receive a notification when it's processed.</p>
                    </div>
                    <p className="text-gray-400 text-sm">Application submitted on {new Date(existingApplication.created_at).toLocaleDateString()}</p>
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold mb-2">Ready to Apply?</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Fill out the application form below. Once submitted, it will be reviewed by admins.
                      Approval unlocks seller features and shop creation.
                    </p>

                    <form onSubmit={submitApplication} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Store Name *
                        </label>
                        <input
                          type="text"
                          value={storeName}
                          onChange={(e) => setStoreName(e.target.value)}
                          className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
                          placeholder="e.g. Troll Collectibles Shop"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Store Description *
                        </label>
                        <textarea
                          value={storeDescription}
                          onChange={(e) => setStoreDescription(e.target.value)}
                          className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white resize-none h-24"
                          placeholder="Describe what your store sells and your unique selling points..."
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Product Types
                        </label>
                        <input
                          type="text"
                          value={productTypes}
                          onChange={(e) => setProductTypes(e.target.value)}
                          className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
                          placeholder="e.g. Digital art, collectibles, merchandise"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Contact Email *
                        </label>
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
                          placeholder="your@email.com"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={applicationLoading}
                        className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors font-semibold"
                      >
                        {applicationLoading ? 'Submitting Application...' : 'Submit Seller Application'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'earnings' && shop && (
          <div className="space-y-6">
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Shop Earnings
              </h2>

              {earnings && earnings.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-green-400">
                        ${earnings.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0).toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-400">Total Sales</p>
                    </div>
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-blue-400">
                        {earnings.length}
                      </p>
                      <p className="text-sm text-gray-400">Total Orders</p>
                    </div>
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-yellow-400">
                        ${(earnings.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0) * 0.1).toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-400">Platform Fees</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">Recent Transactions</h3>
                    {earnings.slice(0, 10).map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3">
                        <div>
                          <p className="font-medium">{tx.item_name || 'Item Sale'}</p>
                          <p className="text-sm text-gray-400">{new Date(tx.created_at).toLocaleDateString()}</p>
                        </div>
                        <p className="text-green-400 font-bold">${tx.amount?.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Earnings Yet</h3>
                  <p className="text-gray-400">Start selling products to see your earnings here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delete Shop Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1A1A1A] rounded-xl p-6 max-w-md w-full border border-red-500/30">
              <h3 className="text-xl font-bold mb-4 text-center text-red-400">Delete Shop</h3>
              <div className="text-center mb-6">
                <p className="text-gray-300 mb-2">
                  Are you sure you want to delete <span className="text-red-400 font-bold">"{shop?.name}"</span>?
                </p>
                <p className="text-sm text-gray-400">
                  This action cannot be undone. Your shop will be removed from the marketplace and all products will be deleted.
                </p>
              </div>
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-6">
                <p className="text-sm text-red-300">
                  ⚠️ Deleting your shop will permanently remove it from the marketplace. Any pending orders may be affected.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteShop}
                  disabled={deletingShop}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {deletingShop ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete Shop'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

