import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useFPSStore } from '../../stores/useFPSStore'

// Component that runs inside Canvas to track FPS
export default function FPSMonitor() {
  const updateFPS = useFPSStore(state => state.updateFPS)
  const frameTimesRef = useRef<number[]>([])
  const lastUpdateRef = useRef(0)

  useFrame(state => {
    const now = state.clock.elapsedTime
    const delta = state.clock.getDelta()

    // Add frame time (avoid division by zero)
    if (delta > 0) {
      frameTimesRef.current.push(delta)
    }

    // Keep only last 60 frames
    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift()
    }

    // Update FPS every 0.25 seconds to avoid too frequent store updates
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
