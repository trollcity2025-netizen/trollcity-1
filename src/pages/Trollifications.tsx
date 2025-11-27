import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Bell, Check, Trash2, Gift, Trophy, AlertCircle, MessageSquare, Heart } from 'lucide-react'

type Notification = {
  id: string
  user_id: string
  type: string
  content: string
  read: boolean
  created_at: string
  metadata?: any
}

export default function Trollifications() {
  const { profile } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    loadNotifications()
    
    // Realtime subscription for new notifications
    if (!profile?.id) return
    
    const channel = supabase
      .channel(`notifications_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
        },
        () => {
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

  const loadNotifications = async () => {
    if (!profile?.id) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) throw error
      setNotifications(data || [])
    } catch (err) {
      console.error('Error loading notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const markAllAsRead = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', profile?.id)
        .eq('read', false)
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
      
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.error('Error deleting notification:', err)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'gift': return <Gift className="w-5 h-5 text-pink-400" />
      case 'achievement': return <Trophy className="w-5 h-5 text-yellow-400" />
      case 'alert': return <AlertCircle className="w-5 h-5 text-red-400" />
      case 'message': return <MessageSquare className="w-5 h-5 text-blue-400" />
      case 'like': return <Heart className="w-5 h-5 text-pink-400" />
      default: return <Bell className="w-5 h-5 text-purple-400" />
    }
  }

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read) 
    : notifications

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
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

        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] overflow-hidden">
          <div className="flex border-b border-[#2C2C2C]">
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

          <div className="divide-y divide-[#2C2C2C]">
            {loading ? (
              <div className="p-8 text-center text-gray-400">
                Loading notifications...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 hover:bg-[#0D0D0D] transition-colors ${
                    !notif.read ? 'bg-purple-900/10 border-l-4 border-purple-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.read ? 'font-semibold text-white' : 'text-gray-300'}`}>
                        {notif.content}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notif.read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4 text-purple-400" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
