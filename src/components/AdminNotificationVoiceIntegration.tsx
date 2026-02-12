import { useEffect } from 'react'
import { useAuthStore } from '../lib/store'
import { useAdminVoiceNotifications } from '../hooks/useAdminVoiceNotifications'
import { Notification } from '../types/notifications'

interface AdminNotificationVoiceIntegrationProps {
  notification: Notification | null
}

/**
 * Integrates voice notifications with the notification system
 * Automatically announces important admin notifications using text-to-speech
 * Only activates for admin users
 */
export default function AdminNotificationVoiceIntegration({ notification }: AdminNotificationVoiceIntegrationProps) {
  const { profile } = useAuthStore()
  const { announceNotification, enabled } = useAdminVoiceNotifications()

  useEffect(() => {
    // Only process if user is admin and voice is enabled
    if (!profile?.is_admin || !enabled || !notification) return

    // Determine if this notification should trigger voice announcement
    const shouldAnnounce = (notif: Notification | null): boolean => {
      if (!notif) return false

      // Admin-priority notifications that should trigger voice
      const priorityTypes = [
        'moderation_alert',
        'officer_update',
        'system_announcement',
        'support_ticket',
        'report_filed',
        'payout_request',
        'pod_live',
        'stream_live',
      ]

      return priorityTypes.includes(notif.type)
    }

    // Check if this notification type should trigger voice
    if (shouldAnnounce(notification)) {
      // Create a voice notification object from the notification
      const voiceNotification = {
        id: notification.id || Date.now().toString(),
        message: `${notification.title}: ${notification.message}`,
        type: 'alert' as const,
        timestamp: new Date(),
      }
      announceNotification(voiceNotification)
    }
  }, [notification, profile?.is_admin, enabled, announceNotification])

  return null
}
