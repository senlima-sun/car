import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useFPSStore } from '../../stores/useFPSStore'
import { usePerformanceStore } from '../../stores/usePerformanceStore'

export default function FPSMonitor() {
  const updateFPS = useFPSStore(state => state.updateFPS)
  const sampleFrame = usePerformanceStore(state => state.sampleFrame)
  const frameTimesRef = useRef<number[]>([])
  const lastUpdateRef = useRef(0)

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime

    if (delta > 0) {
      frameTimesRef.current.push(delta)
      sampleFrame(delta)
    }

    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift()
    }

    if (now - lastUpdateRef.current > 0.25 && frameTimesRef.current.length > 0) {
      const avgDelta =
        frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length
      const fps = Math.round(1 / avgDelta)
      updateFPS(fps)
      lastUpdateRef.current = now
    }
  })

  return null
}
