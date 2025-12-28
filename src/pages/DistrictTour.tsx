import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import DistrictOnboardingTour from '../components/DistrictOnboardingTour'

export default function DistrictTour() {
  const { districtName } = useParams<{ districtName: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [showTour, setShowTour] = useState(false)
  const [district, setDistrict] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (districtName && user?.id) {
      loadDistrictAndStartTour()
    }
  }, [districtName, user?.id])

  const loadDistrictAndStartTour = async () => {
    try {
      setLoading(true)

      // Get district info
      const { data: districts } = await supabase.rpc('get_user_accessible_districts', {
        p_user_id: user!.id
      })

      const foundDistrict = districts?.find((d: any) => d.name === districtName)

      if (!foundDistrict) {
        // District not accessible, redirect to home
        navigate('/live')
        return
      }

      setDistrict(foundDistrict)
      setShowTour(true)
    } catch (error) {
      console.error('Error loading district:', error)
      navigate('/live')
    } finally {
      setLoading(false)
    }
  }

  const handleTourComplete = () => {
    // Redirect back to the district's first feature or home
    if (district) {
      // Navigate to first available feature in the district
      const features = getDistrictFeatures(district.name)
      if (features.length > 0) {
        navigate(features[0].route_path)
      } else {
        navigate('/live')
      }
    } else {
      navigate('/live')
    }
  }

  const handleTourClose = () => {
    setShowTour(false)
    navigate('/live')
  }

  const getDistrictFeatures = (districtName: string) => {
    const features: { [key: string]: { feature_name: string, route_path: string }[] } = {
      main_plaza: [
        { feature_name: 'Live Streams', route_path: '/live' },
        { feature_name: 'Messages', route_path: '/messages' },
        { feature_name: 'Following', route_path: '/following' },
        { feature_name: 'Leaderboard', route_path: '/leaderboard' },
        { feature_name: 'Troll City Wall', route_path: '/wall' }
      ],
      entertainment_district: [
        { feature_name: 'Tromody Show', route_path: '/tromody' },
        { feature_name: 'Troll Wheel', route_path: '/troll-wheel' }
      ],
      commerce_district: [
        { feature_name: 'Coin Store', route_path: '/store' },
        { feature_name: 'Marketplace', route_path: '/marketplace' },
        { feature_name: 'Troll Gift Store', route_path: '/gift-store' },
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
        { feature_name: 'Admin HQ', route_path: '/admin/hq' },
        { feature_name: 'City Control Center', route_path: '/admin/control-center' },
        { feature_name: 'Marketplace Admin', route_path: '/admin/marketplace' },
        { feature_name: 'Applications Admin', route_path: '/admin/applications' }
      ]
    }

    return features[districtName] || []
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="text-2xl font-bold mb-2">Loading District Tour...</div>
          <div className="text-gray-400">Preparing your guided experience</div>
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
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">
            Welcome to {district?.display_name || 'Troll City'}
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            {district?.description || 'Exploring the districts of Troll City'}
          </p>
          <div className="animate-pulse text-gray-400">
            Starting your guided tour...
          </div>
        </div>
      </div>
    </>
  )
}
