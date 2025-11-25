import { supabase } from './supabase'
import { useAuthStore } from './store'
import { useEffect, useState } from 'react'

// Coin rotation optimization system
export class CoinRotationOptimizer {
  private static instance: CoinRotationOptimizer
  private cache: Map<string, any> = new Map()
  private subscribers: Set<(data: any) => void> = new Set()
  private refreshInterval: number = 30000 // 30 seconds
  private intervalId: NodeJS.Timeout | null = null

  private constructor() {
    this.startAutoRefresh()
  }

  static getInstance(): CoinRotationOptimizer {
    if (!CoinRotationOptimizer.instance) {
      CoinRotationOptimizer.instance = new CoinRotationOptimizer()
    }
    return CoinRotationOptimizer.instance
  }

  private startAutoRefresh() {
    this.intervalId = setInterval(() => {
      this.refreshCoinData()
    }, this.refreshInterval)
  }

  private async refreshCoinData() {
    try {
      const { profile } = useAuthStore.getState()
      if (!profile) return

      const { data, error } = await supabase
        .from('user_profiles')
        .select('paid_coin_balance, free_coin_balance, total_earned_coins, total_spent_coins')
        .eq('id', profile.id)
        .single()

      if (error) return

      // Update cache
      this.cache.set('coin_data', data)
      
      // Update store
      useAuthStore.getState().setProfile({
        ...profile,
        paid_coin_balance: data.paid_coin_balance,
        free_coin_balance: data.free_coin_balance,
        total_earned_coins: data.total_earned_coins,
        total_spent_coins: data.total_spent_coins
      })

      // Notify subscribers
      this.subscribers.forEach(callback => callback(data))
    } catch (error) {
      console.error('Coin rotation refresh error:', error)
    }
  }

  subscribe(callback: (data: any) => void) {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  getCachedData(key: string) {
    return this.cache.get(key)
  }

  async getQuickCoinData(userId: string) {
    // Try cache first
    const cached = this.cache.get('coin_data')
    if (cached) return cached

    // Fallback to quick query
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('paid_coin_balance, free_coin_balance')
        .eq('id', userId)
        .single()

      if (error) throw error
      
      this.cache.set('coin_data', data)
      return data
    } catch (error) {
      console.error('Quick coin data fetch error:', error)
      return null
    }
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.cache.clear()
    this.subscribers.clear()
  }
}

// Export singleton instance
export const coinOptimizer = CoinRotationOptimizer.getInstance()

// Hook for components that need coin data
export function useCoinRotation() {
  const { profile } = useAuthStore()
  const [coinData, setCoinData] = useState<any>(null)

  useEffect(() => {
    if (!profile) return

    // Get initial data
    coinOptimizer.getQuickCoinData(profile.id).then(setCoinData)

    // Subscribe to updates
    const unsubscribe = coinOptimizer.subscribe(setCoinData)

    return () => {
      unsubscribe()
    }
  }, [profile?.id])

  return coinData
}