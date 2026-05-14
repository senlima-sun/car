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
const FPS_LOG_CAPACITY = 60 * 60
const LONG_TASK_LOG_CAPACITY = 200

interface FpsLogSample {
  t: number
  dt: number
  perfNow: number
  wasmCalls: number
  gpuUploads: number
}

interface LongTaskRecord {
  startTime: number
  duration: number
  attribution: string
  inFrame: boolean
  gapBeforeMs: number
  gapAfterMs: number
}

declare global {
  interface Window {
    __perfRecorder?: PerfScenarioRecorder
    __startPerfScenario?: (id: PerfScenarioId) => void
    __stopPerfScenario?: () => PerfMetricsBlob | null
    __exportFpsLog?: () => void
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
  const logBufferRef = useRef<FpsLogSample[]>(
    Array.from({ length: FPS_LOG_CAPACITY }, () => ({
      t: 0,
      dt: 0,
      perfNow: 0,
      wasmCalls: 0,
      gpuUploads: 0,
    })),
  )
  const logHeadRef = useRef(0)
  const logFilledRef = useRef(false)
  const logStartRef = useRef(0)
  const longTasksRef = useRef<LongTaskRecord[]>([])
  const observerRef = useRef<PerformanceObserver | null>(null)
  const lastFrameStartRef = useRef(0)
  const lastFrameEndRef = useRef(0)

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

    if ('PerformanceObserver' in window) {
      try {
        const obs = new PerformanceObserver(list => {
          const buf = longTasksRef.current
          for (const entry of list.getEntries()) {
            const attr =
              (entry as PerformanceEntry & { attribution?: { name?: string }[] }).attribution
                ?.map(a => a.name ?? '')
                .filter(Boolean)
                .join(',') ?? ''
            const taskStart = entry.startTime
            const taskEnd = taskStart + entry.duration
            const frameStart = lastFrameStartRef.current
            const frameEnd = lastFrameEndRef.current
            const inFrame = taskStart >= frameStart && taskEnd <= frameEnd + 1
            const gapBeforeMs = frameEnd > 0 ? taskStart - frameEnd : 0
            const gapAfterMs = frameStart > taskEnd ? frameStart - taskEnd : 0
            buf.push({
              startTime: taskStart,
              duration: entry.duration,
              attribution: attr || entry.name || 'unknown',
              inFrame,
              gapBeforeMs,
              gapAfterMs,
            })
            if (buf.length > LONG_TASK_LOG_CAPACITY) buf.shift()
          }
        })
        obs.observe({ entryTypes: ['longtask'] })
        observerRef.current = obs
      } catch {
        // longtask API unavailable — skip
      }
    }

    const exportFpsLog = () => {
      const buf = logBufferRef.current
      const head = logHeadRef.current
      const filled = logFilledRef.current
      const count = filled ? FPS_LOG_CAPACITY : head
      const samples: FpsLogSample[] = []
      for (let i = 0; i < count; i++) {
        const idx = filled ? (head + i) % FPS_LOG_CAPACITY : i
        const s = buf[idx]
        samples.push({
          t: s.t,
          dt: s.dt,
          perfNow: s.perfNow,
          wasmCalls: s.wasmCalls,
          gpuUploads: s.gpuUploads,
        })
      }

      let sum = 0
      let min = Infinity
      let max = 0
      for (const s of samples) {
        sum += s.dt
        if (s.dt < min) min = s.dt
        if (s.dt > max) max = s.dt
      }
      const meanDt = samples.length > 0 ? sum / samples.length : 0
      const summary = {
        capturedAt: new Date().toISOString(),
        durationSeconds: samples.length > 0 ? samples[samples.length - 1].t - samples[0].t : 0,
        frameCount: samples.length,
        averageFps: meanDt > 0 ? 1 / meanDt : 0,
        averageFrameMs: meanDt * 1000,
        minFrameMs: min === Infinity ? 0 : min * 1000,
        maxFrameMs: max * 1000,
      }
      const payload = { summary, samples, longTasks: longTasksRef.current.slice() }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `fps-log-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
    window.__exportFpsLog = exportFpsLog

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault()
        exportFpsLog()
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      window.__startPerfScenario = undefined
      window.__stopPerfScenario = undefined
      window.__exportFpsLog = undefined
      window.removeEventListener('keydown', onKey)
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [])

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime
    const perfNow = performance.now()
    lastFrameStartRef.current = perfNow

    if (delta > 0 && delta < 1) {
      bufferRef.current[idxRef.current] = delta
      idxRef.current = (idxRef.current + 1) % BUFFER_SIZE
      if (countRef.current < BUFFER_SIZE) countRef.current++
      sampleFrame(delta)
      const { wasmCalls, gpuUploads } = readAndResetPerFrameCounters()
      if (recorderRef.current?.isRunning()) {
        recorderRef.current.record(delta, wasmCalls, gpuUploads)
      }

      if (logStartRef.current === 0) logStartRef.current = now
      const sample = logBufferRef.current[logHeadRef.current]
      sample.t = now - logStartRef.current
      sample.dt = delta
      sample.perfNow = perfNow
      sample.wasmCalls = wasmCalls
      sample.gpuUploads = gpuUploads
      logHeadRef.current = (logHeadRef.current + 1) % FPS_LOG_CAPACITY
      if (logHeadRef.current === 0) logFilledRef.current = true
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

    lastFrameEndRef.current = performance.now()
  })

  return null
}
