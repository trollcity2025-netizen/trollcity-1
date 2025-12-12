import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Crown, Sparkles } from 'lucide-react'
import RoyalCoronationAnimation from './RoyalCoronationAnimation'

interface RoyalCrownOverlayProps {
  streamId: string
  isAdminStream: boolean
  participants: any[]
}

interface RoyalFamilyMember {
  user_id: string
  title_type: string
  duration_days: number
  is_active: boolean
}

export default function RoyalCrownOverlay({
  streamId,
  isAdminStream,
  participants
}: RoyalCrownOverlayProps) {
  const [royalMember, setRoyalMember] = useState<RoyalFamilyMember | null>(null)
  const [crownLevel, setCrownLevel] = useState(0)
  const [showSparkles, setShowSparkles] = useState(false)
  const [showCoronation, setShowCoronation] = useState(false)
  const [coronationData, setCoronationData] = useState<{
    titleType: 'wife' | 'husband'
    username: string
  } | null>(null)
  const [previousMemberId, setPreviousMemberId] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdminStream) return

    loadRoyalFamilyStatus()
    // Check for updates every 30 seconds
    const interval = setInterval(loadRoyalFamilyStatus, 30000)
    return () => clearInterval(interval)
  }, [isAdminStream])

  const loadRoyalFamilyStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('get_royal_family_status')

      if (error) {
        console.warn('Error loading royal family status:', error)
        return
      }

      // Find active wife or husband
      const adminData = data?.[0]
      const activeMember = adminData?.current_wife || adminData?.current_husband

      if (activeMember) {
        const currentMemberId = activeMember.user_id
        const titleType = adminData.current_wife ? 'wife' : 'husband'

        // Check if this is a new royal family member (coronation)
        if (previousMemberId && previousMemberId !== currentMemberId) {
          // Trigger coronation animation
          setCoronationData({
            titleType: titleType as 'wife' | 'husband',
            username: activeMember.username
          })
          setShowCoronation(true)
        }

        setPreviousMemberId(currentMemberId)

        setRoyalMember({
          user_id: currentMemberId,
          title_type: titleType,
          duration_days: activeMember.duration_days || 0,
          is_active: true
        })

        // Determine crown level based on duration
        const days = activeMember.duration_days || 0
        let level = 0
        if (days >= 90) level = 5 // Imperial Crown
        else if (days >= 60) level = 4 // Regal Crown
        else if (days >= 30) level = 3 // Enhanced Crown
        else if (days >= 14) level = 2 // Decorated Crown
        else if (days >= 7) level = 1 // Base Crown

        setCrownLevel(level)

        // Show sparkles occasionally for higher level crowns
        if (level >= 3) {
          const sparkleInterval = setInterval(() => {
            setShowSparkles(true)
            setTimeout(() => setShowSparkles(false), 2000)
          }, 15000) // Every 15 seconds

          return () => clearInterval(sparkleInterval)
        }
      } else {
        setRoyalMember(null)
        setCrownLevel(0)
        setPreviousMemberId(null)
      }
    } catch (error) {
      console.error('Error loading royal family status:', error)
    }
  }

  // Handle coronation animation completion
  const handleCoronationComplete = () => {
    setShowCoronation(false)
    setCoronationData(null)
  }

  // Only show crowns in Admin streams
  if (!isAdminStream || !royalMember) {
    return (
      <>
        {/* Show coronation animation even when no crown is displayed */}
        {showCoronation && coronationData && (
          <RoyalCoronationAnimation
            isVisible={showCoronation}
            titleType={coronationData.titleType}
            username={coronationData.username}
            onComplete={handleCoronationComplete}
          />
        )}
      </>
    )
  }

  // Find the participant who is the royal family member
  const royalParticipant = participants.find(p =>
    p.identity === royalMember.user_id ||
    p.userId === royalMember.user_id
  )

  if (!royalParticipant) {
    return null
  }

  const getCrownStyle = () => {
    switch (crownLevel) {
      case 1: // Base Crown (7+ days)
        return {
          icon: <Crown className="w-8 h-8 text-yellow-400 drop-shadow-lg" />,
          glow: 'shadow-yellow-400/50',
          animation: 'animate-pulse'
        }
      case 2: // Decorated Crown (14+ days)
        return {
          icon: <Crown className="w-10 h-10 text-yellow-300 drop-shadow-xl" />,
          glow: 'shadow-yellow-300/60',
          animation: 'animate-pulse'
        }
      case 3: // Enhanced Crown (30+ days)
        return {
          icon: <Crown className="w-12 h-12 text-yellow-200 drop-shadow-2xl" />,
          glow: 'shadow-yellow-200/70',
          animation: 'animate-bounce'
        }
      case 4: // Regal Crown (60+ days)
        return {
          icon: (
            <div className="relative">
              <Crown className="w-14 h-14 text-yellow-100 drop-shadow-2xl" />
              <Sparkles className="w-6 h-6 text-blue-300 absolute -top-2 -right-2 animate-ping" />
            </div>
          ),
          glow: 'shadow-yellow-100/80',
          animation: 'animate-pulse'
        }
      case 5: // Imperial Crown (90+ days)
        return {
          icon: (
            <div className="relative">
              <Crown className="w-16 h-16 text-yellow-50 drop-shadow-2xl" />
              <Sparkles className="w-8 h-8 text-purple-300 absolute -top-3 -right-3 animate-ping" />
              <Sparkles className="w-6 h-6 text-pink-300 absolute -bottom-2 -left-2 animate-pulse" />
            </div>
          ),
          glow: 'shadow-yellow-50/90',
          animation: 'animate-bounce'
        }
      default:
        return {
          icon: <Crown className="w-6 h-6 text-yellow-500" />,
          glow: 'shadow-yellow-500/30',
          animation: ''
        }
    }
  }

  const crownStyle = getCrownStyle()

  return (
    <>
      {/* Crown Overlay */}
      <div className="absolute top-4 right-4 z-50 pointer-events-none">
        <div className={`relative ${crownStyle.animation}`}>
          {/* Crown */}
          <div className={`shadow-2xl ${crownStyle.glow} rounded-full p-2 bg-black/20 backdrop-blur-sm`}>
            {crownStyle.icon}
          </div>

          {/* Sparkle effects for high-level crowns */}
          {showSparkles && crownLevel >= 3 && (
            <div className="absolute -inset-4 pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-yellow-300 rounded-full animate-ping"
                  style={{
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${i * 0.2}s`,
                    animationDuration: '2s'
                  }}
                />
              ))}
            </div>
          )}

          {/* Title indicator */}
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
            <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1 text-xs font-bold text-yellow-300 whitespace-nowrap border border-yellow-500/30">
              Admin's {royalMember.title_type === 'wife' ? 'Wife' : 'Husband'}
            </div>
          </div>
        </div>
      </div>

      {/* Coronation Animation */}
      {showCoronation && coronationData && (
        <RoyalCoronationAnimation
          isVisible={showCoronation}
          titleType={coronationData.titleType}
          username={coronationData.username}
          onComplete={handleCoronationComplete}
        />
      )}
    </>
  )
}