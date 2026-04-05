// Tracking webhook handler for carrier updates
// This API receives webhook events from shipping carriers (USPS, UPS, FedEx)

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(url, key)

interface TrackingWebhookPayload {
  carrier: string
  tracking_number: string
  status: string
  description?: string
  location?: string
  event_time?: string
  signature?: string
}

// Verify webhook signature (carrier-specific implementation)
async function verifyWebhookSignature(payload: string, signature: string | undefined, carrier: string): Promise<boolean> {
  if (!signature) return false
  
  // For production, implement actual signature verification
  // This is a placeholder - carriers have different signature methods
  const secret = process.env[`${carrier.toUpperCase()}_WEBHOOK_SECRET`]
  if (!secret) {
    console.warn(`No webhook secret configured for ${carrier}`)
    return false
  }
  
  // In production: use crypto to verify HMAC signature
  // const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  // return signature === expectedSignature
  
  return true // Simplified for now - implement in production
}

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const payload = req.body as TrackingWebhookPayload
    const signature = req.headers['x-webhook-signature'] || req.headers['x-signature']
    
    // Validate required fields
    if (!payload.carrier || !payload.tracking_number || !payload.status) {
      return res.status(400).json({ success: false, error: 'Missing required fields' })
    }

    // Verify webhook signature (skip for development)
    const isDev = process.env.NODE_ENV === 'development'
    if (!isDev) {
      const signatureValid = await verifyWebhookSignature(JSON.stringify(payload), signature, payload.carrier)
      if (!signatureValid) {
        return res.status(401).json({ success: false, error: 'Invalid signature' })
      }
    }

    // Normalize carrier name
    const carrier = payload.carrier.toLowerCase()
    
    // Normalize status
    const normalizedStatus = normalizeTrackingStatus(payload.status, carrier)
    
    // Parse event time
    const eventTime = payload.event_time ? new Date(payload.event_time) : new Date()

    // Call the database function to update tracking
    const { data, error } = await supabase.rpc('update_tracking_status', {
      p_carrier: carrier,
      p_tracking_number: payload.tracking_number,
      p_status: payload.status,
      p_description: payload.description || null,
      p_location: payload.location || null,
      p_event_time: eventTime.toISOString()
    })

    if (error) {
      console.error('Error updating tracking status:', error)
      return res.status(500).json({ success: false, error: error.message })
    }

    // Log the webhook event for debugging
    console.log(`Tracking update received: ${carrier} ${payload.tracking_number} -> ${normalizedStatus}`)

    // Send notifications based on status
    await sendTrackingNotifications(payload, normalizedStatus)

    return res.status(200).json({ 
      success: true, 
      status: data,
      message: 'Tracking status updated'
    })

  } catch (err: any) {
    console.error('Webhook error:', err)
    return res.status(500).json({ success: false, error: err.message || 'Internal error' })
  }
}

function normalizeTrackingStatus(status: string, carrier: string): string {
  const statusLower = status.toLowerCase()
  
  // USPS status mapping
  if (carrier === 'usps') {
    const uspsMap: Record<string, string> = {
      'pre-shipment': 'label_created',
      'label created': 'label_created',
      'accepted': 'accepted',
      'in transit': 'in_transit',
      'in transit to destination': 'in_transit',
      'arrived at facility': 'in_transit',
      'departed facility': 'in_transit',
      'out for delivery': 'out_for_delivery',
      'delivered': 'delivered',
      'delivery attempted': 'exception',
      'delivery exception': 'exception',
      'addressee not available': 'exception',
      'refused': 'exception',
      'returned to sender': 'returned',
      'return to sender': 'returned'
    }
    return uspsMap[statusLower] || 'in_transit'
  }
  
  // UPS status mapping
  if (carrier === 'ups') {
    const upsMap: Record<string, string> = {
      'label created': 'label_created',
      'pickup': 'accepted',
      'in transit': 'in_transit',
      'arrived at': 'in_transit',
      'departed': 'in_transit',
      'out for delivery': 'out_for_delivery',
      'delivered': 'delivered',
      'delivery failed': 'exception',
      'exception': 'exception',
      'refused': 'exception',
      'returned': 'returned'
    }
    return upsMap[statusLower] || 'in_transit'
  }
  
  // FedEx status mapping
  if (carrier === 'fedex') {
    const fedexMap: Record<string, string> = {
      'shipment information sent to fedex': 'label_created',
      'picked up': 'accepted',
      'in transit': 'in_transit',
      'at fedex facility': 'in_transit',
      'departed fedex facility': 'in_transit',
      'out for delivery': 'out_for_delivery',
      'delivered': 'delivered',
      'delivery exception': 'exception',
      'exception': 'exception',
      'refused': 'exception',
      'returned to sender': 'returned'
    }
    return fedexMap[statusLower] || 'in_transit'
  }
  
  // Default mapping
  return 'in_transit'
}

async function sendTrackingNotifications(payload: TrackingWebhookPayload, normalizedStatus: string) {
  try {
    // Get the order info
    const { data: shipment } = await supabase
      .from('order_shipments')
      .select('order_id, carrier, tracking_number')
      .eq('carrier', payload.carrier.toLowerCase())
      .eq('tracking_number', payload.tracking_number)
      .single()

    if (!shipment) return

    const { data: order } = await supabase
      .from('marketplace_purchases')
      .select('id, buyer_id, seller_id, marketplace_item(title)')
      .eq('id', shipment.order_id)
      .single()

    if (!order) return

    const itemTitle = order.marketplace_item?.title || 'Your item'

    // Determine notification content based on status
    let title = ''
    let message = ''
    let type = ''

    switch (normalizedStatus) {
      case 'delivered':
        title = 'Package Delivered! 🎉'
        message = `Your package "${itemTitle}" has been delivered.`
        type = 'order_delivered'
        break
      case 'out_for_delivery':
        title = 'Out for Delivery'
        message = `Your package "${itemTitle}" is out for delivery today!`
        type = 'shipping_update'
        break
      case 'in_transit':
        title = 'Package in Transit'
        message = `Your package "${itemTitle}" is on its way.`
        type = 'shipping_update'
        break
      case 'exception':
        title = 'Delivery Issue'
        message = `There was an issue delivering your package "${itemTitle}". ${payload.description || 'Please check tracking for details.'}`
        type = 'shipping_exception'
        break
      case 'returned':
        title = 'Package Returned'
        message = `Your package "${itemTitle}" is being returned to sender.`
        type = 'shipping_exception'
        break
      default:
        return // Don't notify for minor status changes
    }

    // Send notification to buyer
    await supabase.from('notifications').insert({
      user_id: order.buyer_id,
      type,
      title,
      message,
      link: '/marketplace/orders'
    })

    // For delivered status, also notify seller
    if (normalizedStatus === 'delivered') {
      await supabase.from('notifications').insert({
        user_id: order.seller_id,
        type: 'payout_released',
        title: 'Payout Released! 💰',
        message: `Your payout for "${itemTitle}" has been released to your wallet.`,
        link: '/marketplace/sales'
      })
    }

    // For exceptions, notify seller
    if (normalizedStatus === 'exception') {
      await supabase.from('notifications').insert({
        user_id: order.seller_id,
        type: 'shipping_exception',
        title: 'Shipping Issue',
        message: `There is a delivery issue with order "${itemTitle}". ${payload.description || ''}`,
        link: '/marketplace/sales'
      })
    }

  } catch (err) {
    console.error('Error sending tracking notifications:', err)
  }
}