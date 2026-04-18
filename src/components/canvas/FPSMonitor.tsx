import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useFPSStore } from '../../stores/useFPSStore'
import { usePerformanceStore } from '../../stores/usePerformanceStore'

const BUFFER_SIZE = 120

export default function FPSMonitor() {
  const updateFPS = useFPSStore(state => state.updateFPS)
  const sampleFrame = usePerformanceStore(state => state.sampleFrame)
  const bufferRef = useRef(new Float32Array(BUFFER_SIZE))
  const idxRef = useRef(0)
  const countRef = useRef(0)
  const lastUpdateRef = useRef(0)

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime

    if (delta > 0 && delta < 1) {
      bufferRef.current[idxRef.current] = delta
      idxRef.current = (idxRef.current + 1) % BUFFER_SIZE
      if (countRef.current < BUFFER_SIZE) countRef.current++
      sampleFrame(delta)
    }

    if (now - lastUpdateRef.current > 0.2 && countRef.current > 0) {
      let sum = 0
      for (let i = 0; i < countRef.current; i++) {
        sum += bufferRef.current[i]
      }
      const fps = countRef.current / sum
      updateFPS(fps)
      lastUpdateRef.current = now
    }
  })

  return null
}
