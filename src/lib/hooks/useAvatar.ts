import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../store'
import { supabase } from '../supabase'

export type AvatarSkinTone = 'light' | 'medium' | 'dark'
export type AvatarHairStyle = 'short' | 'long' | 'buzz' | 'none'
export type AvatarHairColor = 'black' | 'brown' | 'blonde' | 'red' | 'neon'
export type AvatarOutfit = 'casual' | 'formal' | 'street'
export type AvatarAccessory = 'none' | 'glasses' | 'hat' | 'mask'

export interface AvatarConfig {
  skinTone: AvatarSkinTone
  hairStyle: AvatarHairStyle
  hairColor: AvatarHairColor
  outfit: AvatarOutfit
  accessory: AvatarAccessory
  useAsProfilePicture: boolean
}

const defaultConfig: AvatarConfig = {
  skinTone: 'medium',
  hairStyle: 'short',
  hairColor: 'brown',
  outfit: 'casual',
  accessory: 'none',
  useAsProfilePicture: false
}

export function useAvatar() {
  const { user } = useAuthStore()
  const [config, setConfigState] = useState<AvatarConfig>(defaultConfig)
  const userKey = user?.id ? `trollcity_avatar_${user.id}` : null

  useEffect(() => {
    let isMounted = true

    const loadConfig = async () => {
      if (!userKey || !user?.id) {
        setConfigState(defaultConfig)
        return
      }

      // Load from local storage first for instant UI
      try {
        const raw = localStorage.getItem(userKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (isMounted) {
            setConfigState({
              ...defaultConfig,
              ...parsed
            })
          }
        }
      } catch {}

      // Then try DB
      try {
        const { data } = await supabase
          .from('user_avatar_customization')
          .select('avatar_config')
          .eq('user_id', user.id)
          .maybeSingle()

        if (data?.avatar_config && isMounted) {
          setConfigState({
            ...defaultConfig,
            ...data.avatar_config
          })
        }
      } catch {}
    }

    loadConfig()
    return () => {
      isMounted = false
    }
  }, [userKey])

  const setConfig = useCallback(
    (updater: AvatarConfig | ((prev: AvatarConfig) => AvatarConfig)) => {
      setConfigState(prev => {
        const next = typeof updater === 'function' ? (updater as (p: AvatarConfig) => AvatarConfig)(prev) : updater
        if (userKey) {
          try {
            localStorage.setItem(userKey, JSON.stringify(next))
          } catch {
          }
        }
        return next
      })
    },
    [userKey]
  )

  return { config, setConfig }
}

