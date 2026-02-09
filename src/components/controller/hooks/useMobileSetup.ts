import { useEffect, useRef } from 'react'

export function useMobileSetup() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    const lockOrientation = async () => {
      try {
        await screen.orientation?.lock?.('landscape')
      } catch {}
    }

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
        }
      } catch {}
    }

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        await requestWakeLock()
      }
    }

    lockOrientation()
    requestWakeLock()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      wakeLockRef.current?.release()
      wakeLockRef.current = null
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const requestFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen()
    } catch {}
  }

  return { requestFullscreen }
}
