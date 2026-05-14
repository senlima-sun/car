import { useRef, useCallback, useEffect } from 'react'
import { TelemetryRingBuffer } from './TelemetryRingBuffer'
import { CH, TELEMETRY_STRIDE } from './channels'
import { useTelemetryStore } from '../stores/useTelemetryStore'
import { useLapTimeStore } from '../stores/useLapTimeStore'
import type { CarPhysicsOutput, StepAndSyncOutput } from '../wasm/PhysicsBridge'

interface RecorderPosition {
  x: number
  y: number
  z: number
}

export function useTelemetryRecorder() {
  const bufferRef = useRef(new TelemetryRingBuffer())
  const frameRef = useRef(new Float32Array(TELEMETRY_STRIDE))

  useEffect(() => {
    useTelemetryStore.getState().setBufferRef(bufferRef)
  }, [])
  const distanceRef = useRef(0)
  const startTimeRef = useRef(0)
  const lapActiveRef = useRef(false)
  const prevLapCountRef = useRef(0)
  const prevLapStartRef = useRef<number | null>(null)
  const trackIdRef = useRef('unknown')

  const record = useCallback(
    (
      output: CarPhysicsOutput,
      syncResult: StepAndSyncOutput,
      pos: RecorderPosition,
      dt: number,
    ) => {
      if (!useTelemetryStore.getState().isRecording) return

      const f = frameRef.current
      const forwardSpeedMs = output.forward_speed_ms ?? output.speed_kmh / 3.6
      distanceRef.current += Math.abs(forwardSpeedMs) * dt

      const now = performance.now()
      f[CH.TIMESTAMP] = now - startTimeRef.current
      f[CH.DISTANCE] = distanceRef.current
      f[CH.SPEED_KMH] = output.speed_kmh
      f[CH.THROTTLE] = syncResult.input_throttle
      f[CH.BRAKE] = syncResult.input_brake
      f[CH.STEER] = syncResult.input_steer
      f[CH.GEAR] = output.gear
      f[CH.RPM] = output.rpm
      f[CH.LATERAL_G] = output.lateral_g
      f[CH.LONGITUDINAL_G] = output.longitudinal_g
      f[CH.SLIP_ANGLE] = output.slip_angle
      f[CH.STEER_ANGLE_DEG] = (output.steer_angle * 180) / Math.PI
      f[CH.YAW_RATE] = output.angular_velocity?.[1] ?? 0
      f[CH.EFFECTIVE_GRIP] = output.effective_grip
      f[CH.DOWNFORCE_N] = output.downforce_newtons
      f[CH.ERS_BATTERY] = output.ers?.battery_charge != null ? output.ers.battery_charge * 100 : 0
      f[CH.ERS_POWER_FLOW] = output.ers?.power_flow ?? 0
      f[CH.POS_X] = pos.x
      f[CH.POS_Y] = pos.y
      f[CH.POS_Z] = pos.z
      f[CH.FORWARD_SPEED_MS] = forwardSpeedMs
      f[CH.IS_DRIFTING] = output.is_drifting ? 1 : 0
      f[CH.SKID_INTENSITY] = output.skid_intensity

      const w = output.tire_wear
      f[CH.TIRE_WEAR_FL] = w?.front_left ?? 0
      f[CH.TIRE_WEAR_FR] = w?.front_right ?? 0
      f[CH.TIRE_WEAR_RL] = w?.rear_left ?? 0
      f[CH.TIRE_WEAR_RR] = w?.rear_right ?? 0

      const bt = syncResult.brake_disc_temps_celsius
      f[CH.BRAKE_TEMP_FL] = bt?.[0] ?? 0
      f[CH.BRAKE_TEMP_FR] = bt?.[1] ?? 0
      f[CH.BRAKE_TEMP_RL] = bt?.[2] ?? 0
      f[CH.BRAKE_TEMP_RR] = bt?.[3] ?? 0
      f[CH.BRAKE_FADE] = syncResult.brake_fade ?? 0

      const aero = syncResult.aero_state
      f[CH.AERO_MODE] = aero?.mode === 'Straight' ? 1 : 0
      f[CH.WING_FRONT] = aero?.front_wing_angle ?? 0
      f[CH.WING_REAR] = aero?.rear_wing_angle ?? 0

      f[CH.ENGINE_TEMP] = output.temperature?.engine?.temperature ?? 0

      const temps = output.temperature?.tires
      if (temps) {
        f[CH.TIRE_TEMP_FL] = (temps.front_left_inner + temps.front_left_outer) / 2
        f[CH.TIRE_TEMP_FR] = (temps.front_right_inner + temps.front_right_outer) / 2
        f[CH.TIRE_TEMP_RL] = (temps.rear_left_inner + temps.rear_left_outer) / 2
        f[CH.TIRE_TEMP_RR] = (temps.rear_right_inner + temps.rear_right_outer) / 2
      }

      bufferRef.current.write(f)

      const lapState = useLapTimeStore.getState()
      const lapCount = lapState.lapCount
      const lapStart = lapState.currentLapStart

      if (lapStart !== null && prevLapStartRef.current !== lapStart) {
        if (lapActiveRef.current && lapCount > prevLapCountRef.current) {
          const lapTime = lapState.lastLapTime
          if (lapTime != null) {
            const lap = bufferRef.current.extractCurrentLap(lapTime, trackIdRef.current)
            if (lap) {
              useTelemetryStore.getState().addCompletedLap(lap)
            }
          }
        }
        bufferRef.current.markLapStart()
        distanceRef.current = 0
        startTimeRef.current = now
        lapActiveRef.current = true
        prevLapCountRef.current = lapCount
        prevLapStartRef.current = lapStart
      }
    },
    [],
  )

  const setTrackId = useCallback((id: string) => {
    trackIdRef.current = id
  }, [])

  const reset = useCallback(() => {
    bufferRef.current.reset()
    distanceRef.current = 0
    startTimeRef.current = performance.now()
    lapActiveRef.current = false
    prevLapCountRef.current = 0
    prevLapStartRef.current = null
  }, [])

  return { record, bufferRef, setTrackId, reset }
}
