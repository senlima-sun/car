import { useState, useEffect } from 'react'

// Detect mobile viewport via multiple signals
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false

  // Check for touch capability
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // Check viewport width (typical mobile breakpoint)
  const isNarrowViewport = window.innerWidth <= 768

  return hasTouch && isNarrowViewport
}

// Hook for reactive mobile detection (handles resize/orientation change)
export function useMobileDetection(): boolean {
  const [isMobile, setIsMobile] = useState(() => isMobileDevice())

  useEffect(() => {
    const checkMobile = () => setIsMobile(isMobileDevice())

    window.addEventListener('resize', checkMobile)
    window.addEventListener('orientationchange', checkMobile)

    // Initial check in case SSR mismatch
    checkMobile()

    return () => {
      window.removeEventListener('resize', checkMobile)
      window.removeEventListener('orientationchange', checkMobile)
    }
  }, [])

  return isMobile
}
