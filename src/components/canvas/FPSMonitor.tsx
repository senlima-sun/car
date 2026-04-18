import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useFPSStore } from '../../stores/useFPSStore'
import { usePerformanceStore } from '../../stores/usePerformanceStore'
import { readAndResetPerFrameCounters } from '../../debug/perfCounters'
import {
  PerfScenarioRecorder,
  type PerfMetricsBlob,
  type PerfScenarioId,
} from '../../debug/perfScenarios'

const BUFFER_SIZE = 120

declare global {
  interface Window {
    __perfRecorder?: PerfScenarioRecorder
    __startPerfScenario?: (id: PerfScenarioId) => void
    __stopPerfScenario?: () => PerfMetricsBlob | null
  }
}

export default function FPSMonitor() {
  const updateFPS = useFPSStore(state => state.updateFPS)
  const sampleFrame = usePerformanceStore(state => state.sampleFrame)
  const bufferRef = useRef(new Float32Array(BUFFER_SIZE))
  const idxRef = useRef(0)
  const countRef = useRef(0)
  const lastUpdateRef = useRef(0)
  const recorderRef = useRef<PerfScenarioRecorder | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.__startPerfScenario = (id: PerfScenarioId) => {
      const r = new PerfScenarioRecorder(id)
      r.start()
      recorderRef.current = r
      window.__perfRecorder = r
    }
    window.__stopPerfScenario = () => {
      const r = recorderRef.current
      if (!r) return null
      const metrics = r.stop()
      recorderRef.current = null
      window.__perfRecorder = undefined
      return metrics
    }
    return () => {
      window.__startPerfScenario = undefined
      window.__stopPerfScenario = undefined
    }
  }, [])

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime

    if (delta > 0 && delta < 1) {
      bufferRef.current[idxRef.current] = delta
      idxRef.current = (idxRef.current + 1) % BUFFER_SIZE
      if (countRef.current < BUFFER_SIZE) countRef.current++
      sampleFrame(delta)
      const { wasmCalls, gpuUploads } = readAndResetPerFrameCounters()
      if (recorderRef.current?.isRunning()) {
        recorderRef.current.record(delta, wasmCalls, gpuUploads)
      }
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
