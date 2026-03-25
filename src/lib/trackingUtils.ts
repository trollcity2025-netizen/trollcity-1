// Tracking number utilities

type ShippingCarrier = 'usps' | 'fedex' | 'ups' | 'dhl' | 'other';

interface CarrierInfo {
  id: ShippingCarrier;
  name: string;
  trackingUrlPattern: string;
  patterns: RegExp[];
}

const CARRIERS: CarrierInfo[] = [
  {
    id: 'usps',
    name: 'USPS',
    trackingUrlPattern: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=',
    patterns: [
      /^[0-9]{20}$/, // Standard USPS (20 digits)
      /^[0-9]{22}$/, // USPS (22 digits)
      /^[A-Z]{2}[0-9]{9}US$/i, // International USPS
      /^94[0-9]{20}$/, // USPS Priority Mail
      /^92[0-9]{20}$/, // USPS Certified
      /^93[0-9]{20}$/, // USPS Registered
    ],
  },
  {
    id: 'ups',
    name: 'UPS',
    trackingUrlPattern: 'https://www.ups.com/track?tracknum=',
    patterns: [
      /^1Z[A-Z0-9]{16}$/i, // UPS standard
      /^1Z[A-Z0-9]{15}$/i, // UPS (15 chars)
    ],
  },
  {
    id: 'fedex',
    name: 'FedEx',
    trackingUrlPattern: 'https://www.fedex.com/fedextrack/?trknbr=',
    patterns: [
      /^[0-9]{12}$/, // FedEx standard (12 digits)
      /^[0-9]{15}$/, // FedEx (15 digits)
      /^[0-9]{20}$/, // FedEx (20 digits)
      /^[0-9]{22}$/, // FedEx (22 digits)
    ],
  },
  {
    id: 'dhl',
    name: 'DHL',
    trackingUrlPattern: 'https://www.dhl.com/en/express/tracking.html?AWB=',
    patterns: [
      /^[0-9]{10}$/, // DHL (10 digits)
      /^[0-9]{11}$/, // DHL (11 digits)
      /^[0-9]{5}[0-9]{5}[0-9]{1}$/, // DHL format
    ],
  },
];

export function detectCarrier(trackingNumber: string): CarrierInfo | null {
  const cleanNumber = trackingNumber.replace(/\s/g, '');
  
  for (const carrier of CARRIERS) {
    for (const pattern of carrier.patterns) {
      if (pattern.test(cleanNumber)) {
        return carrier;
      }
    }
  }
  
  return null;
}

export function generateTrackingUrl(trackingNumber: string, carrier?: ShippingCarrier): string {
  const cleanNumber = trackingNumber.replace(/\s/g, '');
  
  if (carrier) {
    const carrierInfo = CARRIERS.find(c => c.id === carrier);
    if (carrierInfo) {
      return carrierInfo.trackingUrlPattern + cleanNumber;
    }
  }
  
  // Try to auto-detect carrier
  const detectedCarrier = detectCarrier(cleanNumber);
  if (detectedCarrier) {
    return detectedCarrier.trackingUrlPattern + cleanNumber;
  }
  
  // Default to generic URL
  return '';
}

export function formatTrackingNumber(trackingNumber: string): string {
  const cleanNumber = trackingNumber.replace(/\s/g, '');
  const carrier = detectCarrier(cleanNumber);
  
  if (carrier) {
    return cleanNumber;
  }
  
  return cleanNumber;
}

export { CARRIERS };
export type { ShippingCarrier, CarrierInfo };