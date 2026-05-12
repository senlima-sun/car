import { useEffect, useRef } from 'react'
import { useValidationDriveStore } from '@/stores/useValidationDriveStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { useCarStore } from '@/stores/useCarStore'
import { useTrackStore } from '@/stores/useTrackStore'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { buildValidationCenterline } from '@/utils/validationCenterline'
import { TRACK_WIDTH } from '@/constants/dimensions'
import { IS_DEV } from '@/utils/isDev'

export const MAX_VALIDATION_DRIVE_SECONDS = 600
export const MAX_OFF_TRACK_SECONDS = 10
const STUCK_SPEED_THRESHOLD_MS = 5
const STUCK_TIMEOUT_SECONDS = 5
const START_GRID_RADIUS_M = 50
const TRACK_RIBBON_MARGIN_M = 4
const TRACK_HALF_WIDTH_M = TRACK_WIDTH / 2 + TRACK_RIBBON_MARGIN_M

declare global {
  interface Window {
    __VALIDATION_DRIVE_RESULT__?: ReturnType<typeof useValidationDriveStore.getState>['summary']
    __VALIDATION_DRIVE_START__?: () => 'started' | 'no_centerline' | 'no_active_track'
  }
}

function distanceToNearestSampleSq(
  x: number,
  z: number,
  samples: { x: number; z: number }[],
): number {
  let best = Number.POSITIVE_INFINITY
  for (const s of samples) {
    const dx = s.x - x
    const dz = s.z - z
    const d = dx * dx + dz * dz
    if (d < best) best = d
  }
  return best
}

const TICK_INTERVAL_MS = 100

function useValidationDriveTicker() {
  const stuckTimerRef = useRef(0)
  const lastStartedAtRef = useRef<number | null>(null)
  const lastTickAtRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const id = setInterval(() => {
      if (cancelled) return
      const state = useValidationDriveStore.getState()
      if (state.phase !== 'driving' || !state.centerlineSamples || state.startedAt === null) {
        stuckTimerRef.current = 0
        lastTickAtRef.current = null
        return
      }

      const now = performance.now()
      const dt =
        lastTickAtRef.current === null
          ? TICK_INTERVAL_MS / 1000
          : (now - lastTickAtRef.current) / 1000
      lastTickAtRef.current = now

      if (lastStartedAtRef.current !== state.startedAt) {
        lastStartedAtRef.current = state.startedAt
        stuckTimerRef.current = 0
      }

      const car = useCarStore.getState()
      const speedMS = car.speed / 3.6
      const pos = car.position

      const samples = state.centerlineSamples
      const halfWidthSq = TRACK_HALF_WIDTH_M * TRACK_HALF_WIDTH_M
      const nearestSq = distanceToNearestSampleSq(pos[0], pos[2], samples)
      const isOffTrack = nearestSq > halfWidthSq
      if (isOffTrack) {
        useValidationDriveStore.getState().tickOffTrack(dt)
      }

      const updatedState = useValidationDriveStore.getState()

      if (updatedState.offTrackSeconds > MAX_OFF_TRACK_SECONDS) {
        useValidationDriveStore.getState().abort('off_track_budget_exceeded')
        return
      }

      const elapsedMs = now - (updatedState.startedAt ?? now)
      if (elapsedMs > MAX_VALIDATION_DRIVE_SECONDS * 1000) {
        useValidationDriveStore.getState().abort('timeout')
        return
      }

      if (speedMS < STUCK_SPEED_THRESHOLD_MS) {
        stuckTimerRef.current += dt
      } else {
        stuckTimerRef.current = 0
      }

      if (stuckTimerRef.current > STUCK_TIMEOUT_SECONDS) {
        const startSample = samples[0]!
        const dx = pos[0] - startSample.x
        const dz = pos[2] - startSample.z
        const distFromStartGridSq = dx * dx + dz * dz
        if (distFromStartGridSq > START_GRID_RADIUS_M * START_GRID_RADIUS_M) {
          useValidationDriveStore.getState().abort(
            `stuck_at_${pos[0].toFixed(1)}_${pos[2].toFixed(1)}`,
          )
        }
      }
    }, TICK_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])
}

function useLapCompletionBridge() {
  useEffect(() => {
    const unsubscribe = useLapTimeStore.subscribe((state, prev) => {
      if (state.lapCount <= prev.lapCount) return
      const validation = useValidationDriveStore.getState()
      if (validation.phase !== 'driving') return
      if (validation.startedAt === null) return
      if (state.lastLapTime === null) return
      const lapStartedAt = performance.now() - state.lastLapTime
      if (lapStartedAt < validation.startedAt) return
      const lapTimeSeconds = state.lastLapTime / 1000
      const replayId =
        validation.trackId !== null
          ? `${validation.trackId}__validation_${Date.now()}`
          : null
      useValidationDriveStore.getState().complete(lapTimeSeconds, replayId)
    })
    return unsubscribe
  }, [])
}

function useLapStoreTeardown() {
  useEffect(() => {
    return useValidationDriveStore.subscribe((state, prev) => {
      if (prev.phase !== 'driving') return
      if (state.phase !== 'completed' && state.phase !== 'failed') return
      useLapTimeStore.getState().setActive(false)
    })
  }, [])
}

export function ValidationDriveBridge() {
  useValidationDriveTicker()
  useLapCompletionBridge()
  useLapStoreTeardown()

  const summary = useValidationDriveStore(s => s.summary)

  useEffect(() => {
    if (!IS_DEV) return
    window.__VALIDATION_DRIVE_RESULT__ = summary
    return () => {
      window.__VALIDATION_DRIVE_RESULT__ = undefined
    }
  }, [summary])

  useEffect(() => {
    if (!IS_DEV) return
    window.__VALIDATION_DRIVE_START__ = () => {
      const activeTrackId = useTrackStore.getState().trackLibrary.activeTrackId
      if (!activeTrackId) return 'no_active_track'
      const objects = useCustomizationStore.getState().placedObjects
      const centerline = buildValidationCenterline(objects)
      if (centerline.length < 2) return 'no_centerline'
      const sectorCheckpointCount = objects.filter(
        o => o.type === 'checkpoint' && o.checkpointType === 'sector',
      ).length
      useLapTimeStore.getState().reset()
      useLapTimeStore.getState().setActive(true, sectorCheckpointCount)
      if (!useLapTimeStore.getState().isRecording) {
        useLapTimeStore.getState().toggleRecording()
      }
      useValidationDriveStore.getState().start(activeTrackId, centerline)
      return 'started'
    }
    return () => {
      window.__VALIDATION_DRIVE_START__ = undefined
    }
  }, [])

  return null
}

export default function ValidationDriveHud() {
  const enabled = useValidationDriveStore(s => s.enabled)
  const phase = useValidationDriveStore(s => s.phase)
  const startedAt = useValidationDriveStore(s => s.startedAt)
  const completedAt = useValidationDriveStore(s => s.completedAt)
  const lapTimeSeconds = useValidationDriveStore(s => s.lapTimeSeconds)
  const offTrackSeconds = useValidationDriveStore(s => s.offTrackSeconds)
  const failureReason = useValidationDriveStore(s => s.failureReason)
  const summary = useValidationDriveStore(s => s.summary)

  if (!enabled) return null

  const elapsedSeconds =
    startedAt === null
      ? 0
      : ((completedAt ?? performance.now()) - startedAt) / 1000

  return (
    <div
      className='fixed top-4 right-4 z-[2000] pointer-events-none'
      data-testid='validation-drive-hud'
    >
      <div className='border border-emerald-400/60 bg-black/80 px-4 py-3 backdrop-blur-md text-white font-mono text-xs space-y-1 min-w-[260px]'>
        <div className='uppercase tracking-widest text-emerald-300 font-bold'>
          Validation Drive
        </div>
        <div>
          phase: <span data-testid='validation-drive-phase'>{phase}</span>
        </div>
        <div>elapsed: {elapsedSeconds.toFixed(1)}s</div>
        <div>off-track: {offTrackSeconds.toFixed(2)}s</div>
        {lapTimeSeconds !== null && (
          <div>lap: {lapTimeSeconds.toFixed(3)}s</div>
        )}
        {failureReason !== null && (
          <div className='text-red-400'>fail: {failureReason}</div>
        )}
        <pre
          className='hidden'
          data-testid='validation-drive-summary'
        >{JSON.stringify(summary)}</pre>
      </div>
    </div>
  )
}
