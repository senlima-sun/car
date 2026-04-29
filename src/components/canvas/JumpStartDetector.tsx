import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { isCountdownSessionPhase, useSessionStore } from '@/stores/useSessionStore'
import { useCarStore } from '@/stores/useCarStore'

const SPEED_THRESHOLD_KMH = 3

export default function JumpStartDetector() {
  const reportedRef = useRef(false)

  useFrame(() => {
    const phase = useSessionStore.getState().phase
    if (!isCountdownSessionPhase(phase)) {
      reportedRef.current = false
      return
    }
    if (reportedRef.current) return
    const speed = useCarStore.getState().speed ?? 0
    if (speed <= SPEED_THRESHOLD_KMH) return
    reportedRef.current = true
    useSessionStore.getState().recordEvent({ type: 'jump_start', at: Date.now() })
  })

  return null
}
