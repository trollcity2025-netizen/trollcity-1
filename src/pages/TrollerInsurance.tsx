import React, { useState, useEffect } from 'react'
import { Shield, Clock, Zap, Crown } from 'lucide-react'
import { supabase, UserProfile } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { deductCoins } from '../lib/coinTransactions.ts'

interface InsurancePackage {
  id: 'basic' | 'premium' | 'ultimate'
  name: string
  duration: number
  price: number
  description: string
  features: string[]
  icon: React.ReactNode
  color: string
  popular?: boolean
}

const INSURANCE_PACKAGES: InsurancePackage[] = [
  {
    id: 'basic',
    name: 'Basic Shield',
    duration: 1,
    price: 50,
    description: 'Basic protection for casual trollers',
    features: ['Protection from kicks', '1 hour duration', 'Basic priority'],
    icon: <Shield className="w-6 h-6" />,
    color: '#22c55e'
  },
  {
    id: 'premium',
    name: 'Bronze Armor',
    duration: 3,
    price: 120,
    description: 'Good protection for regular trollers',
    features: ['Protection from kicks', '3 hour duration', 'Basic priority', 'Chat boost'],
    icon: <Shield className="w-6 h-6" />,
    color: '#cd7f32'
  },
  {
    id: 'premium',
    name: 'Silver Shield',
    duration: 6,
    price: 200,
    description: 'Extended protection for serious trollers',
    features: ['Protection from kicks & bans', '6 hour duration', 'Medium priority', 'Faster chat'],
    icon: <Zap className="w-6 h-6" />,
    color: '#c0c0c0',
    popular: true
  },
  {
    id: 'premium',
    name: 'Gold Fortress',
    duration: 12,
    price: 350,
    description: 'Strong protection for dedicated trollers',
    features: ['Full protection', '12 hour duration', 'High priority', 'Special badge', 'Extra perks'],
    icon: <Zap className="w-6 h-6" />,
    color: '#ffd700'
  },
  {
    id: 'ultimate',
    name: 'Platinum Guard',
    duration: 24,
    price: 500,
    description: 'Maximum protection for legendary trollers',
    features: ['Full protection', '24 hour duration', 'Highest priority', 'VIP badge', 'All perks'],
    icon: <Crown className="w-6 h-6" />,
    color: '#e5e4e2'
  },
  {
    id: 'ultimate',
    name: 'Diamond Elite',
    duration: 48,
    price: 850,
    description: 'Ultimate protection for elite trollers',
    features: ['Complete immunity', '48 hour duration', 'Elite priority', 'Diamond badge', 'Premium perks', 'Extra rewards'],
    icon: <Crown className="w-6 h-6" />,
    color: '#b9f2ff'
  }
]

const TrollerInsurance = () => {
  const { profile } = useAuthStore()
  const [activeInsurance, setActiveInsurance] = useState<any>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInsuranceStatus()
  }, [profile])

  const loadInsuranceStatus = async () => {
    if (!profile) return

    try {
      setLoading(true)

      if (profile.insurance_expires_at) {
        const expiresAt = new Date(profile.insurance_expires_at)
        if (expiresAt > new Date()) {
          setActiveInsurance({
            expires_at: profile.insurance_expires_at,
type: (profile as any).insurance_type || profile.insurance_level || 'basic'
          })
        }
      }
    } catch (error) {
      console.error('Error loading insurance status:', error)
    } finally {
      setLoading(false)
    }
  }

  const purchaseInsurance = async (package_: InsurancePackage) => {
    if (!profile) return

    if ((profile.paid_coin_balance || 0) < package_.price) {
      toast.error('Not enough coins! Visit the Coin Store.')
      return
    }

    try {
      setPurchasing(package_.id)

      // Calculate expiry time
      const newExpiry = new Date()
      newExpiry.setHours(newExpiry.getHours() + package_.duration)

      let finalExpiry = newExpiry
      if (activeInsurance && profile.insurance_expires_at) {
        const currentExpiry = new Date(profile.insurance_expires_at)
        if (currentExpiry > new Date()) {
          finalExpiry = new Date(currentExpiry.getTime() + package_.duration * 60 * 60 * 1000)
        }
      }

      // Deduct coins using centralized transaction logging
      const result = await deductCoins({
        userId: profile.id,
        amount: package_.price,
        type: 'insurance_purchase',
        coinType: 'paid',
        description: `Purchased ${package_.name} insurance`,
        metadata: {
          insurance_id: package_.id,
          insurance_name: package_.name,
          duration: package_.duration,
          protection_type: package_.id === 'basic' ? 'kick' : package_.id === 'premium' ? 'kick' : 'full'
        }
      })

      if (!result.success) {
        toast.error(result.error || 'Failed to deduct coins')
        return
      }

      // Update profile with insurance expiry (legacy fields)
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          insurance_expires_at: finalExpiry.toISOString(),
          insurance_type: package_.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id)

      if (updateError) throw updateError

      // Save to user_insurances table
      const { error: insuranceError } = await supabase
        .from('user_insurances')
        .insert({
          user_id: profile.id,
          insurance_id: `insurance_${package_.id}_${package_.duration}h`,
          purchased_at: new Date().toISOString(),
          expires_at: finalExpiry.toISOString(),
          is_active: true,
          protection_type: package_.id === 'basic' ? 'kick' : package_.id === 'premium' ? 'kick' : 'full',
          metadata: {
            package_name: package_.name,
            duration_hours: package_.duration,
            price: package_.price
          }
        })

      if (insuranceError) {
        console.error('Failed to save insurance record:', insuranceError)
        // Non-fatal, continue
      }

      // Refresh profile
      const { data: updatedProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', profile.id)
        .single()

      if (updatedProfile) {
        useAuthStore.getState().setProfile(updatedProfile as UserProfile)
        setActiveInsurance({
          expires_at: finalExpiry.toISOString(),
          type: package_.id
        })
      }

      toast.success(`Successfully purchased ${package_.name}!`)
    } catch (error) {
      console.error(error)
      toast.error('Failed to purchase insurance.')
    } finally {
      setPurchasing(null)
    }
  }

  const formatTimeRemaining = (expiryDate: string) => {
    const diff = new Date(expiryDate).getTime() - new Date().getTime()
    if (diff <= 0) return 'Expired'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  if (loading) {
    return <div className="p-8 text-center text-troll-gold text-xl">Loading insurance data...</div>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto text-white">
      {/* Banner */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-troll-green-neon mb-4">Troller Insurance</h1>
        <p className="text-troll-purple-300 text-lg mb-4">
          Protect yourself from kicks, bans, and consequences.
        </p>
      </div>

      {/* Active Insurance */}
      {activeInsurance && (
        <div className="bg-troll-green/20 border border-troll-green rounded-lg p-6 mb-6 flex justify-between">
          <div className="flex items-center space-x-3">
            <Shield />
            <div>
              <p className="font-semibold">Insurance Active</p>
              <p>{formatTimeRemaining(activeInsurance.expires_at)}</p>
            </div>
          </div>
          <Clock className="w-6 h-6" />
        </div>
      )}

      {/* Packages */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {INSURANCE_PACKAGES.map((pkg) => (
          <div
            key={pkg.id}
            className={`bg-troll-purple-dark border-2 rounded-lg p-6 ${
              pkg.popular ? 'border-troll-gold scale-105' : 'border-troll-purple'
            }`}>
            <div className="text-center mb-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-white"
                style={{ backgroundColor: pkg.color }}>
                {pkg.icon}
              </div>
              <h3 className="text-xl font-bold mb-2">{pkg.name}</h3>
              <div className="text-3xl font-bold text-troll-gold mb-2">{pkg.price} Coins</div>
              <div>{pkg.duration} Hour(s)</div>
            </div>
            <button
              onClick={() => purchaseInsurance(pkg)}
              disabled={purchasing === pkg.id}
              className="w-full bg-troll-green text-troll-purple-900 py-2 rounded-lg font-semibold">
              {purchasing === pkg.id ? 'Purchasing…' : 'Activate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TrollerInsurance
