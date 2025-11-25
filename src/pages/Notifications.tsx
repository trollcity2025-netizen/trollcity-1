import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Bell, X, Dot, AlertTriangle, CheckCircle, Video, Gift, User, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Notification {
  id: string
  type: 'stream_live' | 'join_approved' | 'moderation_alert' | 'new_follower' | 'gift_received' | 'message'
  title: string
  message: string
  created_at: string
  read: boolean
  metadata?: any
}

export default function Notifications() {
  const { profile } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifications()
  }, [profile?.id])

  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel(`notifications_${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => setNotifications((prev) => [payload.new as any, ...prev])
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => setNotifications((prev) => prev.filter((n) => n.id !== (payload.old as any).id))
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [profile?.id])

  const loadNotifications = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (error) {
        setNotifications([])
      } else {
        setNotifications((data || []) as Notification[])
      }
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  const markAllAsRead = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', profile?.id)

      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      toast.success('All notifications marked as read')
    } catch {
      toast.error('Error marking all as read')
    }
  }

  const dismissNotification = async (id: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch {
      toast.error('Failed to delete notification')
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'stream_live': return <Video className="w-5 h-5 text-red-500" />
      case 'join_approved': return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'moderation_alert': return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'new_follower': return <User className="w-5 h-5 text-blue-500" />
      case 'gift_received': return <Gift className="w-5 h-5 text-purple-500" />
      case 'message': return <MessageCircle className="w-5 h-5 text-cyan-500" />
      default: return <Bell className="w-5 h-5 text-gray-400" />
    }
  }

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true
    if (filter === 'unread') return !notification.read
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
            <div className="ml-auto">
              <button 
                onClick={markAllAsRead}
                className="px-4 py-2 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500 hover:text-white transition-colors"
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
                className={`bg-[#1A1A1A] rounded-xl p-4 border border-[#2C2C2C] relative ${
                  !notification.read ? 'border-purple-500/30' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
src/pages/Profile.tsx                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold">{notification.title}</h3>
                      {!notification.read && <Dot className="w-4 h-4 text-purple-500 fill-current" />}
                    </div>
                    <p className="text-gray-300 text-sm mb-2">{notification.message}</p>
                    <p className="text-gray-500 text-xs">{formatDate(notification.created_at)}</p>
                  </div>
                  <button
                    onClick={() => dismissNotification(notification.id)}
                    className="text-gray-500 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
