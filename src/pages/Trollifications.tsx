import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Bell, Check, Trash2, Gift, Trophy, AlertCircle, Shield, DollarSign, Sword, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Notification, NotificationType } from '../types/notifications'
import { useAdminVoiceNotifications } from '../hooks/useAdminVoiceNotifications'
import { Virtuoso } from 'react-virtuoso'

const MAX_NOTIFICATIONS = 100 // Memory cap for the frontend list

export default function Trollifications() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [latestNotification, setLatestNotification] = useState<Notification | null>(null)
  const { announceNotification, enabled } = useAdminVoiceNotifications()

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(MAX_NOTIFICATIONS)
      
      if (error) throw error
      setNotifications(data || [])
    } catch (err) {
      console.error('Error loading notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadNotifications()
    
    // Realtime subscription for notifications
    if (!user?.id) return
    
    const channel = supabase
      .channel(`notifications_page_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotif = payload.new as Notification
          setNotifications((prev) => {
            const next = [newNotif, ...prev]
            return next.slice(0, MAX_NOTIFICATIONS)
          })
          setLatestNotification(newNotif)
          setLoading(false)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
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
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const deletedId = (payload.old as any).id
          setNotifications((prev) => prev.filter(n => n.id !== deletedId))
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, loadNotifications])

  // Handle voice announcements for important admin notifications
  useEffect(() => {
    if (!latestNotification || !profile?.is_admin || !enabled) return

    // Announce priority notifications for admins
    const priorityTypes = [
      'moderation_alert',
      'officer_update',
      'support_ticket',
      'report_filed',
      'payout_request',
      'system_announcement',
      'pod_live',
      'stream_live',
    ]

    if (priorityTypes.includes(latestNotification.type)) {
      // Create proper VoiceNotification object
      const voiceNotification = {
        id: latestNotification.id || Date.now().toString(),
        message: `${latestNotification.title}: ${latestNotification.message}`,
        type: 'alert' as const,
        timestamp: new Date(),
      }
      announceNotification(voiceNotification)
    }
  }, [latestNotification, profile?.is_admin, enabled, announceNotification])

  // Refresh notifications periodically to catch any missed updates
  useEffect(() => {
    if (!user?.id) return
    
    const interval = setInterval(() => {
      loadNotifications()
    }, 30000) // Refresh every 30 seconds as backup
    
    return () => clearInterval(interval)
  }, [user?.id, loadNotifications])

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
      
      if (error) throw error
      
      // Optimistically update UI immediately (realtime will confirm)
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
    } catch (err) {
      console.error('Error marking notification as read:', err)
      // Reload on error to sync state
      loadNotifications()
    }
  }

  const markAllAsRead = async () => {
    if (!user?.id) return
    
    try {
      const { error } = await supabase
        .rpc('mark_all_notifications_read', { p_user_id: user.id })
      
      if (error) throw error
      
      // Optimistically update UI immediately (realtime will confirm)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.error('Error marking all as read:', err)
      // Reload on error to sync state
      loadNotifications()
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      // Optimistically update UI immediately
      setNotifications(prev => prev.filter(n => n.id !== id))

      // HARD DELETE
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
    } catch (err) {
      console.error('Error deleting notification:', err)
      toast.error('Failed to delete notification')
      // Reload on error to sync state
      loadNotifications()
    }
  }

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'gift_received': return <Gift className="w-5 h-5 text-pink-400" />
      case 'badge_unlocked': return <Trophy className="w-5 h-5 text-yellow-400" />
      case 'payout_status': return <DollarSign className="w-5 h-5 text-green-400" />
      case 'moderation_action': return <AlertCircle className="w-5 h-5 text-red-400" />
      case 'battle_result': return <Sword className="w-5 h-5 text-purple-400" />
      case 'officer_update': return <Shield className="w-5 h-5 text-blue-400" />
      case 'system_announcement': return <Zap className="w-5 h-5 text-cyan-400" />
      default: return <Bell className="w-5 h-5 text-purple-400" />
    }
  }

  const handleNotificationClick = (notif: Notification) => {
    // Mark as read when clicked
    if (!notif.is_read) {
      markAsRead(notif.id)
    }

    if (notif.metadata) {
      if (notif.metadata.stream_id) {
        navigate(`/stream/${notif.metadata.stream_id}`)
      } else if (notif.metadata.sender_id) {
        navigate(`/tcps?user=${notif.metadata.sender_id}`)
      } else if (notif.metadata.payout_id) {
        navigate('/my-earnings')
      } else if (notif.metadata.battle_id) {
        navigate('/battles')
      }
    }
  }

  const filteredNotifications = useMemo(() => {
    return filter === 'unread' 
      ? notifications.filter(n => !n.is_read) 
      : notifications
  }, [notifications, filter])

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.is_read).length
  }, [notifications])

  const renderNotification = (index: number, notif: Notification) => (
    <div className="pb-2 px-4">
      <div
        onClick={() => handleNotificationClick(notif)}
        className={`p-4 rounded-lg hover:bg-[#0D0D0D] transition-colors cursor-pointer ${
          !notif.is_read ? 'bg-purple-900/10 border-l-4 border-purple-500' : 'bg-[#222222]/50 border-l-4 border-transparent'
        } ${
          (notif as any).priority === 'high' || (notif as any).priority === 'critical'
            ? 'bg-red-900/10 border border-red-500/50 hover:bg-red-900/20'
            : ''
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            {getIcon(notif.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {((notif as any).priority === 'high' || (notif as any).priority === 'critical') && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white uppercase tracking-wider">
                  High Alert
                </span>
              )}
              <p className={`text-sm font-semibold ${!notif.is_read ? 'text-white' : 'text-gray-300'}`}>
                {notif.title}
              </p>
            </div>
            <p className={`text-sm mt-1 ${!notif.is_read ? 'text-gray-200' : 'text-gray-400'}`}>
              {notif.message}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {new Date(notif.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {!notif.is_read && (
              <button
                type="button"
                onClick={() => markAsRead(notif.id)}
                className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors"
                title="Mark as read"
              >
                <Check className="w-4 h-4 text-purple-400" />
              </button>
            )}
            <button
              type="button"
              onClick={() => deleteNotification(notif.id)}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8 pt-24">
      <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
              Trollifications
            </h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Check className="w-4 h-4" />
              Mark All Read
            </button>
          )}
        </div>

        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] overflow-hidden flex flex-col flex-1">
          <div className="flex border-b border-[#2C2C2C] shrink-0">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-[#2C2C2C]'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-[#2C2C2C]'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="p-8 text-center text-gray-400">
                Loading notifications...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </div>
            ) : (
              <Virtuoso
                style={{ height: '100%' }}
                data={filteredNotifications}
                itemContent={renderNotification}
                increaseViewportBy={200}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
