import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  Search, MapPin, Grid, Car, Wrench, ShoppingBag, 
  MessageCircle, DollarSign, Clock, Star,
  X, Image as ImageIcon, Send, Heart, Zap, Pin, Palette, Tv
} from 'lucide-react'

// Premium feature pricing
const PREMIUM_FEATURES = {
  featured: { cost: 50, label: 'Featured', icon: '⭐', description: 'Appear at top of search results' },
  pinned: { cost: 100, label: 'Pin to Top', icon: '📌', description: 'Stay at the very top of listings' },
  highlighted: { cost: 150, label: 'Highlight', icon: '✨', description: 'Stand out with special styling' },
  auto_promo: { cost: 200, label: 'Auto Promo', icon: '📺', description: 'Promoted automatically in streams' }
}

// Category definitions
const MARKETPLACE_CATEGORIES = [
  { id: 'electronics', label: 'Electronics', icon: '📱' },
  { id: 'clothing', label: 'Clothing', icon: '👕' },
  { id: 'furniture', label: 'Furniture', icon: '🪑' },
  { id: 'vehicles', label: 'Vehicles', icon: '🚗' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'toys', label: 'Toys & Games', icon: '🎮' },
  { id: 'home', label: 'Home & Garden', icon: '🏡' },
  { id: 'beauty', label: 'Beauty', icon: '💄' },
  { id: 'books', label: 'Books', icon: '📚' },
  { id: 'other', label: 'Other', icon: '📦' },
]

const SERVICE_CATEGORIES = [
  { id: 'mechanic', label: 'Mechanics', icon: '🔧' },
  { id: 'mover', label: 'Movers', icon: '📦' },
  { id: 'electrician', label: 'Electricians', icon: '⚡' },
  { id: 'plumber', label: 'Plumbers', icon: '🚿' },
  { id: 'barber', label: 'Barbers', icon: '💇' },
  { id: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { id: 'tutor', label: 'Tutors', icon: '📖' },
  { id: 'photographer', label: 'Photographers', icon: '📷' },
  { id: 'event_planner', label: 'Event Planners', icon: '🎉' },
  { id: 'contractor', label: 'Contractors', icon: '🏗️' },
  { id: 'freelancer', label: 'Freelancers', icon: '💼' },
  { id: 'other', label: 'Other', icon: '🔨' },
]

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Convert km to miles
function kmToMiles(km: number): number {
  return km * 0.621371
}

// Recenter map control component
function RecenterControl({ userLocation }: { userLocation: { lat: number, lon: number } }) {
  const map = useMap()

  useEffect(() => {
    map.setView([userLocation.lat, userLocation.lon], 13)
  }, [map, userLocation.lat, userLocation.lon])

  return null
}

// Custom marker icon for user location
const userLocationIcon = L.divIcon({
  className: 'custom-user-marker',
  html: `<div style="
    width: 24px;
    height: 24px;
    background: #8b5cf6;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
})

// Types
interface MarketplaceItem {
  id: string
  seller_id: string
  title: string
  description: string
  price_coins: number
  price_usd: number
  category: string
  condition: string
  delivery_type: string
  city: string
  state: string
  images: string[]
  stock: number
  status: string
  created_at: string
  latitude?: number
  longitude?: number
  // Premium features
  is_featured?: boolean
  is_pinned?: boolean
  is_highlighted?: boolean
  is_auto_promo?: boolean
  premium_expires_at?: string
  seller?: {
    username: string
    avatar_url?: string
  }
  distance_km?: number
}

interface VehicleListing {
  id: string
  seller_id: string
  title: string
  price_coins: number
  price_usd: number
  make: string
  model: string
  year: number
  mileage: number
  condition: string
  body_type: string
  fuel_type: string
  transmission: string
  color: string
  description: string
  city: string
  state: string
  images: string[]
  status: string
  created_at: string
  latitude?: number
  longitude?: number
  // Premium features
  is_featured?: boolean
  is_pinned?: boolean
  is_highlighted?: boolean
  is_auto_promo?: boolean
  premium_expires_at?: string
  seller?: {
    username: string
    avatar_url?: string
  }
  distance_km?: number
}

interface ServiceListing {
  id: string
  business_id: string
  title: string
  description: string
  price_type: string
  price_coins: number
  price_usd: number
  category: string
  is_remote: boolean
  city: string
  state: string
  images: string[]
  status: string
  created_at: string
  business_name?: string
  business_rating?: number
  distance_km?: number
}

export default function Trollifieds() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  
  // View state
  const [activeTab, setActiveTab] = useState<'marketplace' | 'vehicles' | 'services'>('marketplace')
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid')
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high' | 'distance'>('newest')
  
  // Data state
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>([])
  const [vehicleListings, setVehicleListings] = useState<VehicleListing[]>([])
  const [services, setServices] = useState<ServiceListing[]>([])
  
  // Loading state
  const [loading, setLoading] = useState(true)
  
  // Map state
  const [showMap, setShowMap] = useState(false)
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number} | null>(null)
  const [mapRadius, setMapRadius] = useState(1.6) // km (default 1 mile = 1.6 km)
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.8283, -98.5795]) // Default center US
  const [mapItems, setMapItems] = useState<MarketplaceItem[]>([])
  const mapRef = useRef<L.Map | null>(null)
  
  // Messaging state
  const [messageModal, setMessageModal] = useState<{open: boolean, recipientId?: string, listingId?: string, listingType?: string}>({open: false})
  const [messageText, setMessageText] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  // Premium features state
  const [premiumModal, setPremiumModal] = useState<{open: boolean, listingId?: string, listingType?: string}>({open: false})
  const [purchasingPremium, setPurchasingPremium] = useState(false)

  // Item detail modal state
  const [itemDetail, setItemDetail] = useState<{open: boolean, item?: any}>({open: false})

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          })
        },
        () => {
          // Default to a central US location if permission denied
          setUserLocation({ lat: 39.8283, lon: -98.5795 })
        }
      )
    }
  }, [])

  // Update map center when user location changes
  useEffect(() => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lon])
    }
  }, [userLocation])

  // Filter items within radius for map display
  useEffect(() => {
    if (!userLocation || marketplaceItems.length === 0) {
      setMapItems([])
      return
    }

    const itemsWithLocation = marketplaceItems.filter(item => {
      if (!item.latitude || !item.longitude) return false
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lon,
        item.latitude,
        item.longitude
      )
      return distance <= mapRadius
    })

    // Sort by distance
    itemsWithLocation.sort((a, b) => {
      const distA = a.latitude && a.longitude ? calculateDistance(userLocation.lat, userLocation.lon, a.latitude, a.longitude) : 0
      const distB = b.latitude && b.longitude ? calculateDistance(userLocation.lat, userLocation.lon, b.latitude, b.longitude) : 0
      return distA - distB
    })

    setMapItems(itemsWithLocation)
  }, [userLocation, marketplaceItems, mapRadius])

  // Load data based on active tab
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      if (activeTab === 'marketplace') {
        let query = supabase
          .from('marketplace_items')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(100)

        if (category) query = query.eq('category', category)
        if (searchQuery) query = query.ilike('title', `%${searchQuery}%`)
        
        const { data, error } = await query
        if (error) throw error
        setMarketplaceItems(data || [])
      } else if (activeTab === 'vehicles') {
        let query = supabase
          .from('vehicle_listings')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(50)

        if (searchQuery) query = query.ilike('title', `%${searchQuery}%`)
        
        const { data, error } = await query
        if (error) throw error
        setVehicleListings(data || [])
      } else if (activeTab === 'services') {
        // Load services
        const { data: servicesData } = await supabase
          .from('service_listings')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(50)

        // Get business names for services
        const businessIds = [...new Set((servicesData || []).map(s => s.business_id))]
        const { data: businessProfiles } = await supabase
          .from('business_profiles')
          .select('id, business_name, rating')
          .in('id', businessIds)

        const businessMap = (businessProfiles || []).reduce((acc, b) => {
          acc[b.id] = b
          return acc
        }, {})

        const servicesWithBusiness = (servicesData || []).map(s => ({
          ...s,
          business_name: businessMap[s.business_id]?.business_name,
          business_rating: businessMap[s.business_id]?.rating
        }))

        setServices(servicesWithBusiness)
      }
    } catch (err) {
      console.error('Error loading data:', err)
      toast.error('Failed to load listings')
    } finally {
      setLoading(false)
    }
  }, [activeTab, category, searchQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime subscriptions
  useEffect(() => {
    const tableName = activeTab === 'marketplace' ? 'marketplace_items' : 
                      activeTab === 'vehicles' ? 'vehicle_listings' : 'service_listings'
    
    const channel = supabase
      .channel(`trollifieds_${activeTab}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        () => {
          loadData()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [activeTab, loadData])

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    let items: any[] = []
    
    if (activeTab === 'marketplace') {
      items = [...marketplaceItems]
    } else if (activeTab === 'vehicles') {
      items = [...vehicleListings]
    } else if (activeTab === 'services') {
      items = services
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      items = items.filter(item => 
        item.title?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.business_name?.toLowerCase().includes(query) ||
        item.make?.toLowerCase().includes(query) ||
        item.model?.toLowerCase().includes(query)
      )
    }

    // Sort
    items.sort((a, b) => {
      // First priority: Pinned items
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      
      // Second priority: Featured items
      if (a.is_featured && !b.is_featured) return -1
      if (!a.is_featured && b.is_featured) return 1
      
      // Third priority: Highlighted items
      if (a.is_highlighted && !b.is_highlighted) return -1
      if (!a.is_highlighted && b.is_highlighted) return 1
      
      // Fourth priority: Auto promo items
      if (a.is_auto_promo && !b.is_auto_promo) return -1
      if (!a.is_auto_promo && b.is_auto_promo) return 1
      
      switch (sortBy) {
        case 'price_low':
          return (a.price_usd || 0) - (b.price_usd || 0)
        case 'price_high':
          return (b.price_usd || 0) - (a.price_usd || 0)
        case 'distance':
          return (a.distance_km || 999) - (b.distance_km || 999)
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return items
  }, [activeTab, marketplaceItems, vehicleListings, services, searchQuery, sortBy])

  // Send message
  const handleSendMessage = async () => {
    if (!user) {
      navigate('/auth')
      return
    }

    if (!messageText.trim()) {
      toast.error('Please enter a message')
      return
    }

    setSendingMessage(true)
    try {
      const { error } = await supabase.rpc('send_marketplace_message', {
        p_recipient_id: messageModal.recipientId,
        p_listing_id: messageModal.listingId,
        p_listing_type: messageModal.listingType,
        p_message: messageText.trim()
      })

      if (error) throw error

      toast.success('Message sent!')
      setMessageModal({ open: false })
      setMessageText('')
    } catch (err: any) {
      console.error('Error sending message:', err)
      toast.error('Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  // Open message modal
  const openMessageModal = (recipientId: string, listingId?: string, listingType?: string) => {
    if (!user) {
      navigate('/auth')
      return
    }
    setMessageModal({ open: true, recipientId, listingId, listingType })
  }

  // Open premium modal
  const openPremiumModal = (listingId: string, listingType: string) => {
    if (!user) {
      navigate('/auth')
      return
    }
    setPremiumModal({ open: true, listingId, listingType })
  }

  // Purchase premium feature
  const handlePurchasePremium = async (featureType: string) => {
    if (!user || !premiumModal.listingId) {
      toast.error('Please log in to purchase premium features')
      return
    }

    const cost = PREMIUM_FEATURES[featureType as keyof typeof PREMIUM_FEATURES]?.cost
    if (!cost) {
      toast.error('Invalid premium feature')
      return
    }

    setPurchasingPremium(true)
    try {
      const { error } = await supabase.rpc('purchase_listing_premium', {
        p_listing_id: premiumModal.listingId,
        p_listing_type: premiumModal.listingType || 'marketplace',
        p_feature_type: featureType,
        p_seller_id: user.id,
        p_duration_days: 7
      })

      if (error) throw error

      toast.success(`${PREMIUM_FEATURES[featureType as keyof typeof PREMIUM_FEATURES].label} purchased successfully!`)
      setPremiumModal({ open: false })
      loadData() // Refresh data
    } catch (err: any) {
      console.error('Error purchasing premium:', err)
      toast.error(err.message || 'Failed to purchase premium feature')
    } finally {
      setPurchasingPremium(false)
    }
  }

  // Open item detail
  const openItemDetail = (item: any) => {
    setItemDetail({ open: true, item })
  }

  // Get price display
  const getPriceDisplay = (item: any) => {
    if (item.price_coins && item.price_usd) {
      return (
        <span className="text-yellow-400 font-bold">
          💰 {item.price_coins.toLocaleString()} coins
          <span className="text-gray-400 text-sm ml-2">(${item.price_usd})</span>
        </span>
      )
    } else if (item.price_usd) {
      return <span className="text-green-400 font-bold">${item.price_usd?.toLocaleString()}</span>
    } else if (item.price_coins) {
      return <span className="text-yellow-400 font-bold">💰 {item.price_coins.toLocaleString()} coins</span>
    }
    return <span className="text-blue-400 font-bold">Contact for price</span>
  }

  // Get first image from images array
  const getImage = (item: any) => {
    if (item.images && item.images.length > 0) {
      return item.images[0]
    }
    if (item.image_url) {
      return item.image_url
    }
    return null
  }

  // Format date
  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="bg-[#1A1A1A] border-b border-[#2C2C2C] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                Trollifieds
              </h1>
              <span className="text-xs bg-purple-600 px-2 py-1 rounded-full">Local Marketplace</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/sell')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium text-sm flex items-center gap-2"
              >
                <DollarSign className="w-4 h-4" />
                Sell Item
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search marketplace, vehicles, services..."
              className="w-full pl-10 pr-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-700 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'marketplace' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-[#0D0D0D] text-gray-400 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Marketplace
            </button>
            <button
              onClick={() => setActiveTab('vehicles')}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'vehicles' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-[#0D0D0D] text-gray-400 hover:text-white'
              }`}
            >
              <Car className="w-4 h-4" />
              Vehicles
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'services' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-[#0D0D0D] text-gray-400 hover:text-white'
              }`}
            >
              <Wrench className="w-4 h-4" />
              Services
            </button>

            <div className="flex-1" />

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="distance">Nearest First</option>
            </select>

            {/* View Toggle */}
            <div className="flex bg-[#0D0D0D] rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-purple-600' : 'text-gray-400'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowMap(!showMap)}
                className={`p-2 rounded ${showMap ? 'bg-purple-600' : 'text-gray-400'}`}
              >
                <MapPin className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Category Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setCategory(null)}
              className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                !category ? 'bg-purple-600 text-white' : 'bg-[#0D0D0D] text-gray-400'
              }`}
            >
              All
            </button>
            {(activeTab === 'marketplace' ? MARKETPLACE_CATEGORIES : 
              activeTab === 'services' ? SERVICE_CATEGORIES : 
              [{ id: 'all', label: 'All Makes', icon: '🚗' }]).map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id === 'all' ? null : cat.id)}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap flex items-center gap-1 ${
                  category === cat.id ? 'bg-purple-600 text-white' : 'bg-[#0D0D0D] text-gray-400 hover:text-white'
                }`}
              >
                <span>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legal Disclaimer Banner */}
      <div className="bg-yellow-900/20 border-b border-yellow-500/30 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <p className="text-yellow-300 text-sm">
            ⚠️ Troll City does not verify packages or physical goods. Sellers are solely responsible for items shipped. 
            Illegal items are prohibited and may be reported to authorities.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-400">
            {filteredItems.length} {activeTab === 'marketplace' ? 'items' : 
             activeTab === 'vehicles' ? 'vehicles' : 'services'} found
          </p>
          {userLocation && (
            <p className="text-gray-500 text-sm flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Nearest location detected
            </p>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-4 animate-pulse">
                <div className="aspect-video bg-gray-700 rounded-lg mb-4" />
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold mb-2">No listings found</h3>
            <p className="text-gray-400 mb-4">Try adjusting your search or filters</p>
            <button
              onClick={() => {
                setSearchQuery('')
                setCategory(null)
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item: any) => (
              <div 
                key={item.id} 
                className={`bg-[#1A1A1A] rounded-xl border overflow-hidden hover:border-purple-500/50 transition-colors group cursor-pointer ${
                  item.is_highlighted ? 'border-yellow-400 ring-2 ring-yellow-400/30' : 
                  item.is_pinned ? 'border-red-500' : 
                  item.is_featured ? 'border-yellow-600' : 
                  'border-[#2C2C2C]'
                }`}
                onClick={() => openItemDetail(item)}
              >
                {/* Image */}
                <div className="aspect-video bg-[#0D0D0D] relative overflow-hidden">
                  {getImage(item) ? (
                    <img
                      src={getImage(item)}
                      alt={item.title}
                      className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${item.is_highlighted ? 'ring-4 ring-yellow-400' : ''}`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23222" width="100" height="100"/%3E%3Ctext fill="%23666" font-size="20" x="50" y="55" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E'
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-gray-600" />
                    </div>
                  )}
                  {/* Premium Badges */}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {item.is_pinned && (
                      <span className="bg-red-600 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                        <Pin className="w-3 h-3" /> Pinned
                      </span>
                    )}
                    {item.is_featured && !item.is_pinned && (
                      <span className="bg-yellow-600 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                        <Star className="w-3 h-3" /> Featured
                      </span>
                    )}
                    {item.is_auto_promo && (
                      <span className="bg-purple-600 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                        <Tv className="w-3 h-3" /> Auto Promo
                      </span>
                    )}
                  </div>
                  {/* Condition Badge */}
                  {item.condition && (
                    <span className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs capitalize">
                      {item.condition}
                    </span>
                  )}
                  {/* Distance Badge */}
                  {item.distance_km && (
                    <span className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {item.distance_km.toFixed(1)} km
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-bold text-white mb-1 line-clamp-1">{item.title}</h3>
                  {item.business_name && (
                    <p className="text-purple-400 text-sm mb-1">{item.business_name}</p>
                  )}
                  {item.make && item.model && (
                    <p className="text-gray-400 text-sm mb-1">{item.year} {item.make} {item.model}</p>
                  )}
                  {item.description && (
                    <p className="text-gray-500 text-sm mb-2 line-clamp-2">{item.description}</p>
                  )}
                  
                  {/* Price */}
                  <div className="mb-3">
                    {getPriceDisplay(item)}
                  </div>

                  {/* Location & Time */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {item.city}, {item.state}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  {/* Rating */}
                  {item.business_rating && (
                    <div className="flex items-center gap-1 mb-3">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-medium">{item.business_rating.toFixed(1)}</span>
                      <span className="text-gray-500 text-xs">({item.total_reviews || 0})</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openMessageModal(
                          item.seller_id || item.owner_id, 
                          item.id, 
                          activeTab
                        )
                      }}
                      className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Message
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        openPremiumModal(item.id, activeTab)
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 ${
                        item.is_featured || item.is_pinned || item.is_highlighted || item.is_auto_promo
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                          : 'bg-[#0D0D0D] hover:bg-[#2C2C2C] text-gray-400'
                      }`}
                      title="Boost your listing"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                    {activeTab !== 'services' && (
                      <button className="px-3 py-2 bg-[#0D0D0D] hover:bg-[#2C2C2C] rounded-lg" onClick={(e) => e.stopPropagation()}>
                        <Heart className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Map View with Leaflet */}
        {showMap && (
          <div className="mt-6 bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-4">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-400" />
              Nearby Listings Map
            </h3>
            
            {/* Leaflet Map */}
            <div className="aspect-video bg-[#0D0D0D] rounded-lg overflow-hidden">
              <MapContainer
                center={mapCenter}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                ref={mapRef}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* User Location Marker */}
                {userLocation && (
                  <Marker position={[userLocation.lat, userLocation.lon]} icon={userLocationIcon}>
                    <Popup>
                      <div className="text-center">
                        <p className="font-semibold text-purple-400">Your Location</p>
                        <p className="text-xs text-gray-400">You are here</p>
                      </div>
                    </Popup>
                  </Marker>
                )}
                
                {/* Listing Markers */}
                {mapItems.map((item) => (
                  item.latitude && item.longitude && (
                    <Marker
                      key={item.id}
                      position={[item.latitude, item.longitude]}
                    >
                      <Popup>
                        <div className="min-w-[180px]">
                          {item.images && item.images.length > 0 ? (
                            <img 
                              src={item.images[0]} 
                              alt={item.title}
                              className="w-full h-24 object-cover rounded-t-lg -mx-3 -mt-3 mb-2"
                            />
                          ) : (
                            <div className="w-full h-24 bg-gray-700 rounded-t-lg -mx-3 -mt-3 mb-2 flex items-center justify-center">
                              <ShoppingBag className="w-8 h-8 text-gray-500" />
                            </div>
                          )}
                          <p className="font-semibold text-white text-sm truncate">{item.title}</p>
                          <p className="font-bold text-purple-400 text-lg">{item.price_coins} coins</p>
                          {item.price_usd > 0 && (
                            <p className="text-xs text-gray-400">${item.price_usd.toFixed(2)} USD</p>
                          )}
                          {item.seller && (
                            <p className="text-xs text-gray-500 mt-1">by @{item.seller.username}</p>
                          )}
                          {item.latitude && item.longitude && userLocation && (
                            <p className="text-xs text-green-400 mt-1">
                              {kmToMiles(calculateDistance(userLocation.lat, userLocation.lon, item.latitude, item.longitude)).toFixed(2)} miles away
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  )
                ))}
                
                {/* Recenter button */}
                {userLocation && (
                  <RecenterControl userLocation={userLocation} />
                )}
              </MapContainer>
            </div>
            
            {/* Map Info */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Search Radius:</label>
                <input
                  type="range"
                  min="0.5"
                  max="50"
                  step="0.5"
                  value={mapRadius}
                  onChange={(e) => setMapRadius(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm text-purple-400 font-medium">{mapRadius.toFixed(1)} km ({kmToMiles(mapRadius).toFixed(1)} mi)</span>
              </div>
            </div>
            
            {/* Items count */}
            <div className="mt-2 text-sm text-gray-500">
              Showing {mapItems.length} listing{mapItems.length !== 1 ? 's' : ''} within {mapRadius.toFixed(1)} km
            </div>
          </div>
        )}
      </div>

      {/* Message Modal */}
      {messageModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Send Message</h3>
              <button
                onClick={() => setMessageModal({ open: false })}
                className="p-1 hover:bg-[#2C2C2C] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Write your message..."
              className="w-full h-32 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg p-3 focus:border-purple-500 outline-none resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setMessageModal({ open: false })}
                className="flex-1 px-4 py-2 bg-[#0D0D0D] hover:bg-[#2C2C2C] rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={sendingMessage || !messageText.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg flex items-center justify-center gap-2"
              >
                {sendingMessage ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Features Modal */}
      {premiumModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Boost Your Listing
              </h3>
              <button
                onClick={() => setPremiumModal({ open: false })}
                className="p-1 hover:bg-[#2C2C2C] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Make your listing stand out! Premium features last for 7 days.
            </p>
            <div className="space-y-3">
              {Object.entries(PREMIUM_FEATURES).map(([key, feature]) => (
                <button
                  key={key}
                  onClick={() => handlePurchasePremium(key)}
                  disabled={purchasingPremium}
                  className="w-full p-4 bg-[#0D0D0D] hover:bg-[#2C2C2C] rounded-lg border border-[#2C2C2C] hover:border-yellow-500/50 transition-colors text-left flex items-center gap-4"
                >
                  <span className="text-2xl">{feature.icon}</span>
                  <div className="flex-1">
                    <div className="font-bold text-white">{feature.label}</div>
                    <div className="text-xs text-gray-400">{feature.description}</div>
                  </div>
                  <span className="text-yellow-400 font-bold text-lg">{feature.cost} coins</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Item Detail Modal */}
      {itemDetail.open && itemDetail.item && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#1A1A1A] p-4 border-b border-[#2C2C2C] flex items-center justify-between">
              <h3 className="text-lg font-bold">Listing Details</h3>
              <button
                onClick={() => setItemDetail({ open: false })}
                className="p-1 hover:bg-[#2C2C2C] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              {/* Image */}
              <div className="aspect-video bg-[#0D0D0D] rounded-lg overflow-hidden mb-4">
                {getImage(itemDetail.item) ? (
                  <img
                    src={getImage(itemDetail.item)}
                    alt={itemDetail.item.title}
                    className={`w-full h-full object-contain ${itemDetail.item.is_highlighted ? 'ring-4 ring-yellow-400' : ''}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-gray-600" />
                  </div>
                )}
              </div>

              {/* Premium Badges */}
              {(itemDetail.item.is_pinned || itemDetail.item.is_featured || itemDetail.item.is_highlighted || itemDetail.item.is_auto_promo) && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {itemDetail.item.is_pinned && (
                    <span className="bg-red-600 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                      <Pin className="w-4 h-4" /> Pinned to Top
                    </span>
                  )}
                  {itemDetail.item.is_featured && (
                    <span className="bg-yellow-600 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                      <Star className="w-4 h-4" /> Featured
                    </span>
                  )}
                  {itemDetail.item.is_highlighted && (
                    <span className="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                      <Palette className="w-4 h-4" /> Highlighted
                    </span>
                  )}
                  {itemDetail.item.is_auto_promo && (
                    <span className="bg-purple-600 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                      <Tv className="w-4 h-4" /> Auto Promo
                    </span>
                  )}
                </div>
              )}

              <h2 className="text-2xl font-bold mb-2">{itemDetail.item.title}</h2>
              
              {/* Price */}
              <div className="mb-4">
                {getPriceDisplay(itemDetail.item)}
              </div>

              {/* Description */}
              {itemDetail.item.description && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-400 mb-1">Description</h4>
                  <p className="text-gray-300">{itemDetail.item.description}</p>
                </div>
              )}

              {/* Location - HIDE exact location, only show city/state */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-400 mb-1">Location</h4>
                <p className="text-gray-300 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {itemDetail.item.city}, {itemDetail.item.state}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Exact location is hidden for your safety
                </p>
              </div>

              {/* Seller */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-400 mb-1">Seller</h4>
                <p className="text-gray-300">@{itemDetail.item.seller?.username || 'Unknown'}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    openMessageModal(
                      itemDetail.item.seller_id || itemDetail.item.owner_id, 
                      itemDetail.item.id, 
                      activeTab
                    )
                    setItemDetail({ open: false })
                  }}
                  className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Message Seller
                </button>
                <button
                  onClick={() => {
                    openPremiumModal(itemDetail.item.id, activeTab)
                  }}
                  className="px-4 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium flex items-center gap-2"
                >
                  <Zap className="w-5 h-5" />
                  Boost
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
