import { useEffect, useState, useCallback } from 'react'

const MOBILE_BREAKPOINT_PX = 768

function getIsTouchDevice() {
  if (typeof window === 'undefined') return false
  return (navigator.maxTouchPoints ?? 0) > 0
}

function getIsMobileWidth() {
  if (typeof window === 'undefined') return true // Default to mobile for SSR
  // Use visual viewport if available for more accurate mobile sizing
  const width = window.visualViewport?.width ?? window.innerWidth
  return width < MOBILE_BREAKPOINT_PX
}

export function useIsMobile() {
  // Start with true (mobile-first) to avoid flash of desktop layout on mobile
  const [isMobileWidth, setIsMobileWidth] = useState(true)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)

  const updateDimensions = useCallback(() => {
    if (typeof window === 'undefined') return
    const width = window.visualViewport?.width ?? window.innerWidth
    setIsMobileWidth(width < MOBILE_BREAKPOINT_PX)
    setIsTouchDevice(getIsTouchDevice())
  }, [])

  useEffect(() => {
    // Set mounted flag
    setHasMounted(true)
    
    // Initial check
    updateDimensions()

    // Listen for resize events
    window.addEventListener('resize', updateDimensions, { passive: true })
    
    // Listen for orientation changes (important for mobile)
    window.addEventListener('orientationchange', updateDimensions, { passive: true })
    
    // Listen for visual viewport changes (handles mobile keyboard, etc)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateDimensions, { passive: true })
    }

    return () => {
      window.removeEventListener('resize', updateDimensions)
      window.removeEventListener('orientationchange', updateDimensions)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateDimensions)
      }
    }
  }, [updateDimensions])

  return {
    isMobile: isMobileWidth && isTouchDevice,
    isMobileWidth,
    isTouchDevice,
    hasMounted,
    breakpointPx: MOBILE_BREAKPOINT_PX,
  }
}
