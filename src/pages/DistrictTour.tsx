import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import DistrictOnboardingTour from '../components/DistrictOnboardingTour'
import { useGameNavigate } from '../components/game/GameNavigation'
import { trollCityTheme } from '../styles/trollCityTheme'

// Hardcoded district data for tour - available to all users
const DISTRICT_DATA: { [key: string]: { display_name: string; description: string } } = {
  main_plaza: {
    display_name: 'Main Plaza',
    description: 'The heart of Troll City where live streams, TCPS, and community features come together.'
  },
  entertainment_district: {
    display_name: 'Entertainment District',
    description: 'Where the Tromody Show and other entertainment venues are located.'
  },
  commerce_district: {
    display_name: 'Commerce District',
    description: 'Shop, trade, and sell in Troll City\'s marketplace.'
  },
  justice_district: {
    display_name: 'Justice District',
    description: 'Troll Court, applications, and city support services.'
  },
  officer_quarters: {
    display_name: 'Officer Quarters',
    description: 'The headquarters for Troll City officers and moderation.'
  },
  family_neighborhood: {
    display_name: 'Family Neighborhood',
    description: 'A safe space for families to connect and grow together.'
  },
  admin_tower: {
    display_name: 'Admin Tower',
    description: 'City administration and management controls.'
  }
}

export default function DistrictTour() {
  const { districtName } = useParams<{ districtName: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const gameNavigate = useGameNavigate()
  const [showTour, setShowTour] = useState(false)
  const [district, setDistrict] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const loadDistrictAndStartTour = useCallback(async () => {
    if (!user?.id) {
      // Still show tour for unauthenticated users but redirect on complete
      setLoading(false)
      setShowTour(true)
      return
    }

    try {
      setLoading(true)

      // Small delay to show loading state, then show tour
      await new Promise(resolve => setTimeout(resolve, 500))

      // Use hardcoded district data - available to all users
      const districtInfo = DISTRICT_DATA[districtName || 'main_plaza'] || DISTRICT_DATA.main_plaza
      
      setDistrict({
        name: districtName || 'main_plaza',
        ...districtInfo
      })
      setShowTour(true)
    } catch (error) {
      console.error('Error loading district:', error)
      navigate('/live')
    } finally {
      setLoading(false)
    }
  }, [districtName, user, navigate])

  useEffect(() => {
    loadDistrictAndStartTour()
  }, [loadDistrictAndStartTour])

  const getDistrictFeatures = useCallback((districtName: string) => {
    const features: { [key: string]: { feature_name: string, route_path: string }[] } = {
      main_plaza: [
        { feature_name: 'Live Streams', route_path: '/live' },
        { feature_name: 'TCPS', route_path: '/tcps' },
        { feature_name: 'Following', route_path: '/following' },
        { feature_name: 'Leaderboard', route_path: '/leaderboard' },
        { feature_name: 'Troll City Wall', route_path: '/wall' }
      ],
      entertainment_district: [
        { feature_name: 'Tromody Show', route_path: '/tromody' }
      ],
      commerce_district: [
        { feature_name: 'Coin Store', route_path: '/store' },
        { feature_name: 'Marketplace', route_path: '/marketplace' },
        { feature_name: 'Troll Town', route_path: '/trollstown' },
        { feature_name: 'Troll Mart', route_path: '/trollmart' },
        { feature_name: 'Gift Inventory', route_path: '/gift-inventory' },
        { feature_name: 'My Inventory', route_path: '/inventory' },
        { feature_name: 'Sell on Troll City', route_path: '/sell' }
      ],
      justice_district: [
        { feature_name: 'Troll Court', route_path: '/troll-court' },
        { feature_name: 'Applications', route_path: '/apply' },
        { feature_name: 'Support', route_path: '/support' },
        { feature_name: 'Safety & Policies', route_path: '/safety' }
      ],
      government_sector: [
        { feature_name: "President's Office", route_path: '/president' },
        { feature_name: 'President Dashboard', route_path: '/president/dashboard' },
        { feature_name: 'Secretary Dashboard', route_path: '/president/secretary' }
      ],
      officer_quarters: [
        { feature_name: 'Officer Lounge', route_path: '/officer/lounge' },
        { feature_name: 'Officer Moderation', route_path: '/officer/moderation' },
        { feature_name: 'Officer Dashboard', route_path: '/officer/dashboard' }
      ],
      family_neighborhood: [
        { feature_name: 'Family Lounge', route_path: '/family/lounge' },
        { feature_name: 'Family War Hub', route_path: '/family/wars-hub' },
        { feature_name: 'Family Leaderboard', route_path: '/family/leaderboard' },
        { feature_name: 'Family Shop', route_path: '/family/shop' }
      ],
      admin_tower: [
        { feature_name: 'Admin Dashboard', route_path: '/admin' },
        { feature_name: 'Admin HQ', route_path: '/admin/control-panel' },
        { feature_name: 'City Control Center', route_path: '/admin/system/health' },
        { feature_name: 'Marketplace Admin', route_path: '/admin/marketplace' },
        { feature_name: 'Applications Admin', route_path: '/admin/applications' }
      ]
    }

    return features[districtName] || []
  }, [])

  const handleTourComplete = useCallback(() => {
    // Redirect back to the district's first feature or home
    const districtKey = district?.name || districtName || 'main_plaza'
    const features = getDistrictFeatures(districtKey)
    if (features.length > 0) {
      gameNavigate(features[0].route_path)
    } else {
      gameNavigate('/live')
    }
  }, [district, districtName, gameNavigate, getDistrictFeatures])

  const handleTourClose = useCallback(() => {
    setShowTour(false)
    navigate('/live')
  }, [navigate])

  if (loading) {
    return (
      <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} ${trollCityTheme.text.primary} flex items-center justify-center`}>
        <div className="animate-pulse text-center">
          <div className="text-2xl font-bold mb-2">Loading District Tour...</div>
          <div className={`${trollCityTheme.text.muted}`}>Preparing your guided experience</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <DistrictOnboardingTour
        isOpen={showTour}
        onClose={handleTourClose}
        districtName={districtName || ''}
        onComplete={handleTourComplete}
      />

      {/* Background content while tour loads */}
      <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} ${trollCityTheme.text.primary} flex items-center justify-center`}>
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">
            Welcome to {district?.display_name || 'Troll City'}
          </h1>
          <p className={`text-xl ${trollCityTheme.text.muted} mb-8`}>
            {district?.description || 'Exploring the districts of Troll City'}
          </p>
          <div className={`animate-pulse ${trollCityTheme.text.muted}`}>
            Starting your guided tour...
          </div>
        </div>
      </div>
    </>
  )
}
