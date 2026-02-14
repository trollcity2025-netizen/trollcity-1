import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { getGlowingTextStyle } from '@/lib/perkEffects'
import { supabase } from '../lib/supabase'
import { Bell, X, Dot, CheckCircle, Video, Gift, User, MessageCircle, Shield, Car, DollarSign, FileText, Gavel } from 'lucide-react'
import { toast } from 'sonner'
import { Virtuoso } from 'react-virtuoso'

interface Notification {
  id: string
  type:
    | 'stream_live'
    | 'join_approved'
    | 'moderation_alert'
    | 'new_follower'
    | 'gift_received'
    | 'message'
    | 'announcement'
    | 'officer_update'
    | 'vehicle_auction'
    | 'kick'
    | 'ban'
    | 'mute'
    | 'report'
    | 'officer_clock_in'
    | 'officer_clock_out'
    | 'application_submitted'
    | 'support_ticket'
    | 'property_purchased'
    | 'item_purchased'
    | 'system'
  title: string
  message: string
  created_at: string
  is_read: boolean
  is_dismissed: boolean
  metadata?: any
  priority?: 'low' | 'normal' | 'high' | 'critical'
}

const MAX_NOTIFICATIONS = 100 // Memory cap for the frontend list

export default function Notifications() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    try {
      // Auto-delete notifications older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', profile.id)
        .lt('created_at', thirtyDaysAgo)

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(MAX_NOTIFICATIONS)

      if (error) {
        setNotifications([])
      } else {
        // Data from DB already has is_read, so we can cast directly if consistent
        setNotifications((data || []) as Notification[])
      }
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel(`notifications_${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => setNotifications((prev) => {
          const next = [payload.new as Notification, ...prev]
          return next.slice(0, MAX_NOTIFICATIONS) // Prune memory buffer
        })
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const updatedNotif = payload.new as Notification
          if (updatedNotif.is_dismissed) {
            setNotifications((prev) => prev.filter(n => n.id !== updatedNotif.id))
          } else {
            setNotifications((prev) => 
              prev.map(n => n.id === updatedNotif.id ? updatedNotif : n)
            )
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => setNotifications((prev) => prev.filter((n) => n.id !== (payload.old as any).id))
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [profile])

  const markAllAsRead = async () => {
    try {
      if (!profile?.id) return

      const { error } = await supabase
        .rpc('mark_all_notifications_read', { p_user_id: profile.id })

      if (error) throw error

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      toast.success('All notifications marked as read')
    } catch {
      toast.error('Error marking all as read')
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
    } catch {
      toast.error('Failed to mark notification as read')
    }
  }

  const dismissNotification = async (id: string) => {
    try {
      // Optimistically remove
      setNotifications(prev => prev.filter(n => n.id !== id))

      // HARD DELETE
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
      
      if (error) {
        throw error
      }
      
      toast.success('Notification deleted')
    } catch (err) {
      // Revert if failed
      console.error('Failed to dismiss notification:', err)
      toast.error('Failed to delete notification')
      loadNotifications() // Reload to restore state
    }
  }
  
  // Helper for delete all button
  const deleteAllNotifications = async () => {
    try {
      if (!profile?.id) return
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', profile.id)

      if (error) throw error

      setNotifications([])
      toast.success('All notifications cleared')
    } catch {
      toast.error('Failed to clear notifications')
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'stream_live': return <Video className="w-5 h-5 text-red-500" />
      case 'join_approved': return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'moderation_alert': 
      case 'kick':
      case 'ban':
      case 'mute':
      case 'report':
      case 'stream.kick':
      case 'stream.ban':
        return <Gavel className="w-5 h-5 text-red-600" />
      case 'new_follower': return <User className="w-5 h-5 text-blue-500" />
      case 'gift_received': return <Gift className="w-5 h-5 text-purple-500" />
      case 'message': 
      case 'support_ticket':
        return <MessageCircle className="w-5 h-5 text-cyan-500" />
      case 'announcement': return <Bell className="w-5 h-5 text-orange-500" />
      case 'vehicle_auction': return <Car className="w-5 h-5 text-purple-400" />
      case 'officer_update': 
      case 'officer_clock_in':
      case 'officer_clock_out':
        return <Shield className="w-5 h-5 text-blue-400" />
      case 'application_submitted': return <FileText className="w-5 h-5 text-green-400" />
      case 'property_purchased':
      case 'item_purchased':
      case 'coins.fast_spend':
      case 'coins.manual_purchase':
        return <DollarSign className="w-5 h-5 text-green-400" />
      case 'security.alert':
        return <Shield className="w-5 h-5 text-red-500" />
      case 'system.warning':
        return <Bell className="w-5 h-5 text-orange-500" />
      default: return <Bell className="w-5 h-5 text-gray-400" />
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    // 1. Standardized routing (Staff & New System)
    if (notification.metadata?.route) {
      navigate(notification.metadata.route)
    }
    // 2. Legacy fallback
    else if (notification.metadata?.action_url) {
      navigate(notification.metadata.action_url)
    } else if (notification.type === 'new_follower' && notification.metadata?.follower_username) {
       // Fallback for old follower notifications
       navigate(`/profile/${notification.metadata.follower_username}`)
    }
    
    // Mark as read if not already
    if (!notification.is_read) {
      markAsRead(notification.id)
    }
  }

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => filter === 'all' || n.type === filter || (filter === 'moderation_alert' && ['kick', 'ban', 'mute', 'report'].includes(n.type)))
  }, [notifications, filter])

  const renderNotification = (index: number, notification: Notification) => (
    <div className="pb-3">
      <div
        onClick={() => handleNotificationClick(notification)}
        className={`relative group p-4 rounded-lg border transition-all cursor-pointer hover:scale-[1.01] ${
          notification.priority === 'high' || notification.priority === 'critical'
            ? 'bg-red-950/30 border-red-500/50 hover:border-red-500'
            : notification.is_read
            ? 'bg-troll-dark-card/50 border-gray-800 hover:border-gray-600'
            : 'bg-troll-dark-card border-troll-neon-blue/30 hover:border-troll-neon-blue'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-full shrink-0 ${
            notification.is_read ? 'bg-gray-800 text-gray-400' : 'bg-gray-800 text-white'
          }`}>
            {getNotificationIcon(notification.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className={`font-semibold ${notification.is_read ? 'text-gray-300' : 'text-white'}`}>
                {notification.title}
              </h3>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {new Date(notification.created_at).toLocaleDateString()}
              </span>
            </div>
            
            <p className={`mt-1 text-sm ${notification.is_read ? 'text-gray-500' : 'text-gray-300'}`}>
              {notification.type === 'gift_received' && notification.metadata?.sender_username ? (
                <>
                  You received {Number(notification.metadata.coins_spent || 0).toLocaleString()} coins from{' '}
                  <span 
                    style={getGlowingTextStyle(notification.metadata.sender_glowing_color)}
                    className={notification.metadata.sender_glowing_color ? 'font-bold' : ''}
                  >
                    @{notification.metadata.sender_username}
                  </span>
                </>
              ) : (
                notification.message
              )}
            </p>
            
            {notification.metadata?.action_url && (
                <div className="mt-2 text-xs text-troll-neon-blue flex items-center gap-1">
                  Click to view details →
                </div>
            )}
          </div>

          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            {!notification.is_read && (
              <button
                onClick={() => markAsRead(notification.id)}
                className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white"
                title="Mark as read"
              >
                <Dot className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => dismissNotification(notification.id)}
              className="p-1.5 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {!notification.is_read && (
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-troll-neon-blue shadow-[0_0_10px_rgba(0,212,255,0.5)]" />
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-troll-dark text-white p-4 md:p-8 pt-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-troll-neon-pink" />
            <h1 className="text-3xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-troll-neon-pink to-troll-neon-blue">
              Trollifications
            </h1>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-troll-dark-card border border-troll-neon-green/30 rounded hover:bg-troll-neon-green/10 transition-colors text-sm"
            >
              Mark all read
            </button>
            <button
              onClick={deleteAllNotifications}
              className="px-4 py-2 bg-troll-dark-card border border-red-500/30 rounded hover:bg-red-500/10 transition-colors text-sm text-red-400"
            >
              Clear all
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'stream_live', 'moderation_alert', 'new_follower', 'system'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                filter === f 
                  ? 'bg-troll-neon-blue text-black font-bold' 
                  : 'bg-troll-dark-card border border-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {f.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500 animate-pulse">Loading notifications...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12 bg-troll-dark-card rounded-lg border border-gray-800">
            <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3 opacity-50" />
            <p className="text-gray-400">No notifications yet</p>
          </div>
        ) : (
          <div className="h-[calc(100vh-280px)]">
            <Virtuoso
              style={{ height: '100%' }}
              data={filteredNotifications}
              itemContent={renderNotification}
              increaseViewportBy={200}
            />
          </div>
        )}
      </div>
    </div>
  )
}
