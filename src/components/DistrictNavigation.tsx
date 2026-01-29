import React, { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { useGameNavigate } from './game/GameNavigation'
import {
  MapPin,
  Home,
  FerrisWheel,
  Store,
  Scale,
  Shield,
  Users,
  Crown,
  ChevronDown,
  ChevronRight,
  Sparkles,
  CheckCircle,
  Circle
} from 'lucide-react'

interface District {
  id: string
  name: string
  display_name: string
  description: string
  icon: string
  color: string
  required_role: string
  features: any
  onboarding_completed: boolean
  visit_count: number
}

interface DistrictFeature {
  feature_name: string
  route_path: string
  required_role: string
}

export default function DistrictNavigation() {
  const { user, profile } = useAuthStore()
  const location = useLocation()
  const gameNavigate = useGameNavigate()
  const [districts, setDistricts] = useState<District[]>([])
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set())
  const [currentDistrict, setCurrentDistrict] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Icon mapping
  const iconMap: { [key: string]: any } = {
    Home, MapPin, FerrisWheel, Store, Scale, Shield, Users, Crown
  }

  const getDistrictFeatures = (districtName: string): DistrictFeature[] => {
    const features: { [key: string]: DistrictFeature[] } = {
      main_plaza: [
        { feature_name: 'Live Streams', route_path: '/live', required_role: 'user' },
        { feature_name: 'TCPS', route_path: '/tcps', required_role: 'user' },
        { feature_name: 'Living & Housing', route_path: '/living', required_role: 'user' },
        { feature_name: 'Following', route_path: '/following', required_role: 'user' },
        { feature_name: 'Leaderboard', route_path: '/leaderboard', required_role: 'user' },
        { feature_name: 'Troll City Wall', route_path: '/wall', required_role: 'user' }
      ],
      entertainment_district: [
        { feature_name: 'Tromody Show', route_path: '/tromody', required_role: 'user' },
      ],
      commerce_district: [
        { feature_name: 'Coin Store', route_path: '/store', required_role: 'user' },
        { feature_name: 'Marketplace', route_path: '/marketplace', required_role: 'user' },
        { feature_name: 'My Inventory', route_path: '/inventory', required_role: 'user' },
        { feature_name: 'Gift Inventory', route_path: '/gift-inventory', required_role: 'user' },
        { feature_name: 'Sell on Troll City', route_path: '/sell', required_role: 'user' }
      ],
      justice_district: [
        { feature_name: 'Troll Court', route_path: '/troll-court', required_role: 'user' },
        { feature_name: 'Applications', route_path: '/apply', required_role: 'user' },
        { feature_name: 'Support', route_path: '/support', required_role: 'user' },
        { feature_name: 'Safety & Policies', route_path: '/safety', required_role: 'user' }
      ],
      officer_quarters: [
        { feature_name: 'Officer Lounge', route_path: '/officer/lounge', required_role: 'troll_officer' },
        { feature_name: 'Officer Moderation', route_path: '/officer/moderation', required_role: 'troll_officer' },
        { feature_name: 'Officer Dashboard', route_path: '/officer/dashboard', required_role: 'troll_officer' }
      ],
      family_neighborhood: [
        { feature_name: 'Family Lounge', route_path: '/family/lounge', required_role: 'family_member' },
        { feature_name: 'Family War Hub', route_path: '/family/wars-hub', required_role: 'family_member' },
        { feature_name: 'Family Leaderboard', route_path: '/family/leaderboard', required_role: 'family_member' },
        { feature_name: 'Family Shop', route_path: '/family/shop', required_role: 'family_member' }
      ],
      admin_tower: [
        { feature_name: 'Admin Dashboard', route_path: '/admin', required_role: 'admin' },
        { feature_name: 'Admin HQ', route_path: '/admin/control-panel', required_role: 'admin' },
        { feature_name: 'City Control Center', route_path: '/admin/system/health', required_role: 'admin' },
        { feature_name: 'Marketplace Admin', route_path: '/admin/marketplace', required_role: 'admin' },
        { feature_name: 'Applications Admin', route_path: '/admin/applications', required_role: 'admin' }
      ]
    }

    return features[districtName] || []
  }

  const loadDistricts = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_user_accessible_districts', {
        p_user_id: user.id
      })

      if (error) throw error

      setDistricts(data || [])

      // Auto-expand current district based on route
      const currentPath = location.pathname
      const matchingDistrict = data?.find((d: District) =>
        Object.values(d.features || {}).some((enabled: boolean) =>
          enabled && getDistrictFeatures(d.name).some(f => f.route_path === currentPath)
        )
      )

      if (matchingDistrict) {
        setCurrentDistrict(matchingDistrict.name)
        setExpandedDistricts(prev => new Set([...prev, matchingDistrict.name]))
      }

    } catch (error) {
      console.error('Error loading districts:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id, location.pathname])

  useEffect(() => {
    loadDistricts()
  }, [loadDistricts])

  const toggleDistrict = (districtName: string) => {
    setExpandedDistricts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(districtName)) {
        newSet.delete(districtName)
      } else {
        newSet.add(districtName)
      }
      return newSet
    })
  }

  const navigateToDistrict = async (district: District) => {
    setCurrentDistrict(district.name)

    // Update district progress
    if (user?.id) {
      await supabase.rpc('update_district_progress', {
        p_user_id: user.id,
        p_district_id: district.id
      })
    }

    // If district not completed onboarding, show tour
    if (!district.onboarding_completed && district.visit_count === 0) {
      const features = getDistrictFeatures(district.name)
      if (features.length > 0) {
        gameNavigate(features[0].route_path)
      }
    }
  }

  const isFeatureActive = (routePath: string) => {
    return location.pathname === routePath
  }

  if (!profile) {
    return null
  }

  if (loading) {
    return (
      <div className="w-64 min-h-screen bg-[#0A0A14] text-white flex flex-col border-r border-[#2C2C2C] shadow-xl p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded"></div>
          <div className="h-8 bg-gray-700 rounded"></div>
          <div className="h-8 bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-64 min-h-screen bg-[#0A0A14] text-white flex flex-col border-r border-[#2C2C2C] shadow-xl">
      <div className="p-4 border-b border-[#2C2C2C]">
        <div className="bg-gradient-to-br from-[#15122b] via-[#110d24] to-[#080516] rounded-2xl p-4 shadow-troll-glow border border-purple-500/40">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <img
                src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}&background=random`}
                alt={profile.username}
                className="w-10 h-10 rounded-full border border-purple-500/60"
              />
              <div className="absolute -bottom-1 -right-1 bg-purple-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-[#0A0814]">
                {profile.level || 1}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-sm truncate">{profile.username}</h3>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40">
                  {profile.role === 'admin' ? 'Admin' : profile.title || 'Citizen'}
                </span>
              </div>
            </div>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
              <span>XP</span>
              <span>{(profile.xp || 0).toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 rounded-full"
                style={{ width: `${Math.min(((profile.xp || 0) % 1000) / 10, 100)}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-yellow-400">
                <span className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center text-[9px] font-bold text-black border border-yellow-200">
                  C
                </span>
                <span>{(profile.troll_coins || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 text-blue-300">
                <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-bold border border-blue-300">
                  👑
                </span>
                <span>{profile.perk_tokens || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Districts List */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {districts.map((district) => {
          const IconComponent = iconMap[district.icon] || MapPin
          const features = getDistrictFeatures(district.name)
          const isExpanded = expandedDistricts.has(district.name)
          const isCurrent = currentDistrict === district.name

          return (
            <div key={district.id} className="space-y-1">
              {/* District Header */}
              <button
                onClick={() => {
                  toggleDistrict(district.name)
                  navigateToDistrict(district)
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${
                  isCurrent
                    ? 'bg-purple-600 text-white border border-purple-400'
                    : 'hover:bg-[#1F1F2E] text-gray-300'
                }`}
                style={{ borderLeftColor: district.color, borderLeftWidth: '3px' }}
              >
                <IconComponent
                  className={`w-5 h-5 flex-shrink-0 ${
                    isCurrent ? 'text-white' : ''
                  }`}
                  style={{ color: isCurrent ? undefined : district.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{district.display_name}</span>
                    {district.onboarding_completed && (
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    )}
                    {!district.onboarding_completed && district.visit_count > 0 && (
                      <Circle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {features.length} features
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                )}
              </button>

              {/* District Features */}
              {isExpanded && (
                <div className="ml-6 space-y-1">
                  {features.map((feature, index) => (
                    <button
                      key={index}
                      onClick={() => gameNavigate(feature.route_path)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                        isFeatureActive(feature.route_path)
                          ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                          : 'hover:bg-[#1F1F2E] text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                           style={{ backgroundColor: district.color }} />
                      <span className="text-sm truncate">{feature.feature_name}</span>
                    </button>
                  ))}

                  {/* Onboarding Tour Button */}
                  {!district.onboarding_completed && (
                    <button
                      onClick={() => {
                        gameNavigate(`/districts/${district.name}/tour`)
                      }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1F1F2E] text-yellow-400 hover:text-yellow-300 transition-all"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span className="text-sm">Take Tour</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#2C2C2C]">
        <div className="text-xs text-gray-500 text-center">
          {districts.length} districts available
        </div>
      </div>
    </div>
  )
}
