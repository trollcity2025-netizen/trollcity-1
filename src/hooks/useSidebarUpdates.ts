import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

export interface SidebarUpdate {
  id: string
  path: string
  category: string
  created_at: string
  active: boolean
}

export function useSidebarUpdates() {
  const { profile } = useAuthStore()
  const [updates, setUpdates] = useState<SidebarUpdate[]>([])
  const [viewedPaths, setViewedPaths] = useState<Record<string, string>>({}) // path -> last_viewed_at

  useEffect(() => {
    if (!profile) return

    // 1. Fetch active updates
    const fetchUpdates = async () => {
      const { data } = await supabase
        .from('sidebar_updates')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })
      
      if (data) setUpdates(data)
    }

    // 2. Fetch user's view history
    const fetchViews = async () => {
      const { data } = await supabase
        .from('user_sidebar_views')
        .select('path, last_viewed_at')
        .eq('user_id', profile.id)
      
      if (data) {
        const views: Record<string, string> = {}
        data.forEach((row: any) => {
          views[row.path] = row.last_viewed_at
        })
        setViewedPaths(views)
      }
    }

    fetchUpdates()
    fetchViews()

    // 3. Subscribe to changes
    const channel = supabase
      .channel('sidebar-updates-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sidebar_updates'
        },
        () => {
            fetchUpdates()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile])

  const markAsViewed = async (path: string) => {
    if (!profile) return

    // Optimistic update
    setViewedPaths(prev => ({
      ...prev,
      [path]: new Date().toISOString()
    }))

    try {
        await supabase.rpc('mark_sidebar_viewed', { p_path: path })
    } catch (err) {
        console.error('Failed to mark sidebar viewed', err)
    }
  }

  const isUpdated = (path: string) => {
    const update = updates.find(u => u.path === path)
    if (!update) return false
    
    const lastViewed = viewedPaths[path]
    if (!lastViewed) return true // Never viewed
    
    return new Date(update.created_at) > new Date(lastViewed)
  }
  
  const isCategoryUpdated = (categoryTitle: string) => {
      // Find updates in this category
      const categoryUpdates = updates.filter(u => u.category === categoryTitle)
      
      // Check if any of them are unread
      return categoryUpdates.some(u => {
          const lastViewed = viewedPaths[u.path]
          if (!lastViewed) return true
          return new Date(u.created_at) > new Date(lastViewed)
      })
  }

  return { updates, isUpdated, isCategoryUpdated, markAsViewed }
}
