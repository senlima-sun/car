import { useEffect, useRef } from 'react'
import { useSessionStore } from '@/stores/useSessionStore'
import { useCarStore } from '@/stores/useCarStore'

/**
 * Emits a `jump_start` event when the car moves above a small speed
 * threshold during the countdown phase. Warning-only — no penalty.
 * The rules engine plan is responsible for converting this to a
 * penalty later.
 */
const SPEED_THRESHOLD_KMH = 3

export function useJumpStartDetector(): void {
  const phase = useSessionStore(s => s.phase)
  const recordEvent = useSessionStore(s => s.recordEvent)
  const reportedRef = useRef(false)

  useEffect(() => {
    if (phase !== 'countdown') {
      reportedRef.current = false
      return
    }

    const unsub = useCarStore.subscribe(state => {
      if (reportedRef.current) return
      const speed = state.speed ?? 0
      if (speed > SPEED_THRESHOLD_KMH) {
        reportedRef.current = true
        recordEvent({ type: 'jump_start', at: Date.now() })
      }
    })

    return unsub
  }, [phase, recordEvent])
}
