import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Bell, X, Dot, CheckCircle, Video, Gift, User, MessageCircle, Shield, Car, DollarSign, FileText, Gavel } from 'lucide-react'
import { toast } from 'sonner'

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
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })

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
        (payload) => setNotifications((prev) => [payload.new as Notification, ...prev])
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
      await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      toast.success('Notification deleted')
    } catch {
      toast.error('Failed to delete notification')
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
        return <DollarSign className="w-5 h-5 text-green-400" />
      default: return <Bell className="w-5 h-5 text-gray-400" />
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      void markAsRead(notification.id)
    }

    const metadata: any = notification.metadata || {}
    const link: string | undefined = metadata.link

    if (link) {
      navigate(link)
      return
    }

    if (metadata.stream_id) {
      navigate(`/live/${metadata.stream_id}`)
    }
  }

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true
    if (filter === 'unread') return !notification.is_read
    return notification.type === filter
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (!profile) return null

  const filters = [
    { key: 'all', label: 'all', icon: null },
    { key: 'unread', label: 'unread', icon: null },
    { key: 'stream_live', label: 'stream live', icon: <Video className="w-4 h-4" /> },
    { key: 'new_follower', label: 'new follower', icon: <User className="w-4 h-4" /> },
    { key: 'gift_received', label: 'gift received', icon: <Gift className="w-4 h-4" /> },
    { key: 'message', label: 'message', icon: <MessageCircle className="w-4 h-4" /> }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Notifications</h1>
              <p className="text-gray-400">Stay updated with the latest activity</p>
              <p className="text-gray-500 text-sm mt-1">Times shown in America/Denver</p>
            </div>
            <div className="ml-auto flex gap-2">
              <button 
                onClick={deleteAllNotifications}
                className="px-4 py-2 border border-red-500 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors text-sm font-medium"
              >
                Delete All
              </button>
              <button 
                onClick={markAllAsRead}
                className="px-4 py-2 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500 hover:text-white transition-colors text-sm font-medium"
              >
                Mark all read
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {filters.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  filter === key
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#2C2C2C] text-gray-300 hover:bg-[#3C3C3C]'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading notifications...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center text-gray-400 py-8">No notifications</div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`rounded-xl p-4 border relative cursor-pointer transition-colors ${
                  notification.priority === 'high' || notification.priority === 'critical'
                    ? 'bg-red-900/10 border-red-500/50 hover:bg-red-900/20'
                    : 'bg-[#1A1A1A] border-[#2C2C2C] hover:bg-[#222]'
                } ${
                  !notification.is_read ? 'border-purple-500/30' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold">
                        {notification.title}
                      </h3>
                      {!notification.is_read && <Dot className="w-4 h-4 text-purple-500 fill-current" />}
                    </div>
                    <p className="text-gray-300 text-sm mb-2">{notification.message}</p>
                    <p className="text-gray-500 text-xs">{formatDate(notification.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!notification.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          void markAsRead(notification.id)
                        }}
                        className="text-purple-400 hover:text-purple-300 transition-colors text-xs"
                        title="Mark as read"
                      >
                        Mark read
                      </button>
                    )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          void dismissNotification(notification.id)
                        }}
                        className="text-gray-500 hover:text-white transition-colors"
                        title="Dismiss"
                      >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
