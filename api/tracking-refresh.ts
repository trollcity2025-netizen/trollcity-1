// Manual tracking refresh API
// Allows sellers/buyers to manually refresh tracking from carrier

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(url, key)

interface CarrierTrackingResponse {
  status: string
  description?: string
  location?: string
  estimatedDelivery?: string
  events: Array<{
    status: string
    description: string
    location?: string
    timestamp: string
  }>
}

// Fetch tracking from carrier API
async function fetchCarrierTracking(carrier: string, trackingNumber: string): Promise<CarrierTrackingResponse | null> {
  try {
    switch (carrier.toLowerCase()) {
      case 'usps':
        return await fetchUSPSTracking(trackingNumber)
      case 'ups':
        return await fetchUPSTracking(trackingNumber)
      case 'fedex':
        return await fetchFedExTracking(trackingNumber)
      default:
        console.warn(`Unknown carrier: ${carrier}`)
        return null
    }
  } catch (err) {
    console.error(`Error fetching ${carrier} tracking:`, err)
    return null
  }
}

async function fetchUSPSTracking(trackingNumber: string): Promise<CarrierTrackingResponse | null> {
  const apiKey = process.env.USPS_API_KEY
  if (!apiKey) {
    console.warn('USPS API key not configured')
    return null
  }
  
  try {
    // USPS API implementation would go here
    // This is a placeholder - implement actual API call
    const response = await fetch(`https://api.usps.com/tracking/v1/tracks/${trackingNumber}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })
    
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

async function fetchUPSTracking(trackingNumber: string): Promise<CarrierTrackingResponse | null> {
  const apiKey = process.env.UPS_API_KEY
  const accountNumber = process.env.UPS_ACCOUNT_NUMBER
  if (!apiKey || !accountNumber) {
    console.warn('UPS API credentials not configured')
    return null
  }
  
  try {
    // UPS API implementation would go here
    const response = await fetch('https://onlinetools.ups.com/api/track/v1/details/' + trackingNumber, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

async function fetchFedExTracking(trackingNumber: string): Promise<CarrierTrackingResponse | null> {
  const apiKey = process.env.FEDEX_API_KEY
  if (!apiKey) {
    console.warn('FedEx API key not configured')
    return null
  }
  
  try {
    // FedEx API implementation would go here
    const response = await fetch('https://apis.fedex.com/track/v1/trackingnumbers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        includeDetailedScans: true,
        trackingInfo: [{ trackingNumberInfo: { trackingNumber } }]
      })
    })
    
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export default async function handler(req: any, res: any) {
  // Support both GET (query params) and POST (body)
  const orderId = req.query?.order_id || req.body?.order_id
  
  if (!orderId) {
    return res.status(400).json({ success: false, error: 'Missing order_id' })
  }

  try {
    // Get order and shipment info
    const { data: order, error: orderError } = await supabase
      .from('marketplace_purchases')
      .select('id, status, shipping_carrier, tracking_number, order_shipments(*)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    const trackingNumber = order.tracking_number || order.order_shipments?.[0]?.tracking_number
    const carrier = order.shipping_carrier || order.order_shipments?.[0]?.carrier

    if (!trackingNumber || !carrier) {
      return res.status(400).json({ success: false, error: 'No tracking information available' })
    }

    // Fetch latest tracking from carrier
    const trackingData = await fetchCarrierTracking(carrier, trackingNumber)
    
    if (!trackingData) {
      return res.status(200).json({ 
        success: true, 
        message: 'Could not fetch tracking from carrier. Webhook updates may be delayed.',
        lastUpdated: order.order_shipments?.[0]?.tracking_last_updated_at
      })
    }

    // Map carrier status to our normalized status
    const status = mapCarrierStatus(trackingData.status, carrier)
    
    // Update tracking in database
    const { error: updateError } = await supabase.rpc('update_tracking_status', {
      p_carrier: carrier,
      p_tracking_number: trackingNumber,
      p_status: trackingData.status,
      p_description: trackingData.description || null,
      p_location: trackingData.location || null,
      p_event_time: trackingData.events?.[0]?.timestamp || new Date().toISOString()
    })

    // Insert tracking events
    if (trackingData.events && trackingData.events.length > 0) {
      const shipmentId = order.order_shipments?.[0]?.id
      
      if (shipmentId) {
        // Clear old events and insert new ones
        await supabase
          .from('tracking_events')
          .delete()
          .eq('shipment_id', shipmentId)

        for (const event of trackingData.events) {
          await supabase.from('tracking_events').insert({
            shipment_id: shipmentId,
            status: mapCarrierStatus(event.status, carrier),
            description: event.description,
            location: event.location,
            event_time: event.timestamp
          })
        }
      }
    }

    // Update estimated delivery if available
    if (trackingData.estimatedDelivery) {
      await supabase
        .from('marketplace_purchases')
        .update({ estimated_delivery_date: trackingData.estimatedDelivery })
        .eq('id', orderId)
    }

    return res.status(200).json({ 
      success: true, 
      status,
      lastUpdated: new Date().toISOString()
    })

  } catch (err: any) {
    console.error('Error refreshing tracking:', err)
    return res.status(500).json({ success: false, error: err.message || 'Internal error' })
  }
}

function mapCarrierStatus(status: string, carrier: string): string {
  const statusLower = status.toLowerCase()
  
  if (carrier === 'usps') {
    if (statusLower.includes('delivered')) return 'delivered'
    if (statusLower.includes('out for delivery')) return 'out_for_delivery'
    if (statusLower.includes('in transit') || statusLower.includes('departed') || statusLower.includes('arrived')) return 'in_transit'
    if (statusLower.includes('label')) return 'label_created'
    if (statusLower.includes('exception') || statusLower.includes('failed')) return 'exception'
    if (statusLower.includes('return')) return 'returned'
  }
  
  if (carrier === 'ups') {
    if (statusLower.includes('delivered')) return 'delivered'
    if (statusLower.includes('out for delivery')) return 'out_for_delivery'
    if (statusLower.includes('in transit') || statusLower.includes('pickup')) return 'in_transit'
    if (statusLower.includes('label')) return 'label_created'
    if (statusLower.includes('exception')) return 'exception'
    if (statusLower.includes('return')) return 'returned'
  }
  
  if (carrier === 'fedex') {
    if (statusLower.includes('delivered')) return 'delivered'
    if (statusLower.includes('out for delivery')) return 'out_for_delivery'
    if (statusLower.includes('in transit') || statusLower.includes('picked up')) return 'in_transit'
    if (statusLower.includes('label') || statusLower.includes('information sent')) return 'label_created'
    if (statusLower.includes('exception')) return 'exception'
    if (statusLower.includes('return')) return 'returned'
  }
  
  return 'in_transit'
}