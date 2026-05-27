import { useRef, MutableRefObject } from 'react'
import { Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import { RapierRigidBody } from '@react-three/rapier'
import { useControls } from '../../../../hooks/useControls'
import { type CarInput } from '../../../../wasm'
import { usePhysicsAccumulator } from '../../../../hooks/usePhysicsAccumulator'
import { useRaycastSuspension } from './useRaycastSuspension'
import { useCarInputControl } from './useCarInputControl'
import { useCarLifecycle } from './useCarLifecycle'
import { useCarPhysicsStep } from './useCarPhysicsStep'
import { useCarStateSync } from './useCarStateSync'
import { useCarTelemetryLogging } from './useCarTelemetryLogging'
import { useCarRubberAndTrails } from './useCarRubberAndTrails'
import { useTelemetryRecorder } from '../../../../telemetry/useTelemetryRecorder'
import { useSteeringDebugStore } from '../../../../stores/useSteeringDebugStore'
import { useStartLightsStore } from '../../../../stores/useStartLightsStore'
import { useSurfaceStore } from '../../../../stores/useSurfaceStore'
import { useTrackLimitsStore } from '../../../../stores/useTrackLimitsStore'
import { useCustomizationStore } from '../../../../stores/useCustomizationStore'
import {
  WHEEL_POSITIONS,
  WHEEL_WIDTH_FRONT,
  WHEEL_WIDTH_REAR,
} from '../../../../constants/dimensions'
import { captureTrackLimitSnapshot } from '../../../../utils/trackLimitSnapshot'
import { useTrackLimitSnapshotStore } from '../../../../stores/useTrackLimitSnapshotStore'
import { useDevToolsStore } from '../../../../stores/useDevToolsStore'
import { IS_DEV } from '../../../../utils/isDev'
import { type CarState } from './types'

const STEER_DEBUG_SYNC_EVERY = 4

const OFF_TRACK_COMPARE_ENABLED =
  IS_DEV &&
  typeof localStorage !== 'undefined' &&
  (() => {
    try {
      return localStorage.getItem('debug.offTrackCompare') === 'true'
    } catch {
      return false
    }
  })()

type PhysicsContext = ReturnType<typeof import('../../../../wasm').usePhysics>

interface UseCarFrameOptions {
  chassisRef: MutableRefObject<RapierRigidBody | null>
  physics: PhysicsContext
  windEnabled: boolean
  startPosition: [number, number, number]
}

export function useCarFrame({
  chassisRef,
  physics,
  windEnabled,
  startPosition,
}: UseCarFrameOptions) {
  const getKeys = useControls()
  const accumulator = usePhysicsAccumulator()

  const suspension = useRaycastSuspension(chassisRef)

  const inputControl = useCarInputControl({ physics })
  const lifecycle = useCarLifecycle({ chassisRef, startPosition })
  const physicsStep = useCarPhysicsStep({
    chassisRef,
    physics,
    windEnabled,
    startPosition,
    suspensionStep: suspension.step,
  })
  const stateSync = useCarStateSync()
  const telemetry = useCarTelemetryLogging()
  const telemetryRecorder = useTelemetryRecorder()
  const rubberTrails = useCarRubberAndTrails({ physics })

  const carStateRef = useRef<CarState>({
    position: new Vector3(0, 0, 0),
    velocity: 0,
    rotation: 0,
    skidIntensity: 0,
    isDrifting: false,
    isBraking: false,
    speedKmh: 0,
  })

  const steerDebugCounterRef = useRef(0)
  const maxSteerObservedRef = useRef(0)
  const prevOffTrackRef = useRef(false)

  useFrame((state, delta) => {
    if (!chassisRef.current) return

    if (lifecycle.handleTabResume()) {
      accumulator.reset()
      return
    }

    lifecycle.handleGameModeTransition()

    const dt = Math.min(delta, 0.05)
    const keys = getKeys()

    inputControl.handleInputs(state.clock.elapsedTime, keys)

    if (lifecycle.shouldPausePhysics()) return

    if (lifecycle.handleSpawnProtection()) {
      if (physicsStep.suspensionOutputRef.current === null) {
        physicsStep.step(accumulator.fixedTimeStep, {
          forward: false,
          backward: false,
          left: false,
          right: false,
          brake: false,
          handbrake: false,
          steer: 0,
          throttle: 0,
          brake_analog: 0,
        })
      }
      return
    }

    const inputLocked = useStartLightsStore.getState().isInputLocked()
    const input: CarInput = inputLocked
      ? {
          forward: false,
          backward: false,
          left: false,
          right: false,
          brake: true,
          handbrake: true,
          steer: 0,
          throttle: 0,
          brake_analog: 1,
        }
      : {
          forward: keys.forward,
          backward: keys.backward,
          left: keys.left,
          right: keys.right,
          brake: keys.brake,
          handbrake: keys.handbrake,
          steer: keys.steer,
          throttle: keys.throttle,
          brake_analog: keys.brakeAnalog,
        }

    const { steps } = accumulator.accumulate(dt)

    let result: ReturnType<typeof physicsStep.step> = null
    for (let i = 0; i < steps; i++) {
      result = physicsStep.step(accumulator.fixedTimeStep, input, {
        applyRapierForces: i === steps - 1,
      })
      if (!result) return
    }

    if (!result) return

    const { output, syncResult, windSyncNeeded, suspensionOutput } = result

    stateSync.syncAll(output, syncResult, windSyncNeeded)

    if (IS_DEV && steerDebugCounterRef.current++ % STEER_DEBUG_SYNC_EVERY === 0) {
      const steerAngleDeg = (output.steer_angle * 180) / Math.PI
      const absSteerDeg = Math.abs(steerAngleDeg)
      const steerInputAbs = Math.abs(keys.steer)
      const maxSteerDeg =
        steerInputAbs > 0.05 ? absSteerDeg / steerInputAbs : maxSteerObservedRef.current
      if (steerInputAbs > 0.05) maxSteerObservedRef.current = maxSteerDeg
      useSteeringDebugStore.getState().update({
        inputSteer: keys.steer,
        steerAngleDeg,
        maxSteerAngleDeg: maxSteerDeg,
        yawRate: output.angular_velocity[1],
        speedKmh: output.speed_kmh,
        slipAngleDeg: output.slip_angle,
        lateralG: output.lateral_g,
        isDrifting: output.is_drifting,
      })
    }

    const chassis = chassisRef.current
    const pos = chassis.translation()
    const rot = chassis.rotation()

    if (physics.hasTrackCenterline()) {
      const offTrackResult = physics.checkOffTrackByGeometry(
        pos.x,
        pos.z,
        rot.x,
        rot.y,
        rot.z,
        rot.w,
      )
      useTrackLimitsStore.getState().setOffTrack(offTrackResult.isOffTrack)

      // Edge-trigger debug snapshot on the false→true transition. Renders a
      // top-down PNG with car/wheel positions + centerline overlay so the
      // user can confirm whether off-track really fired correctly. Gated by
      // the dev panel `track-limit-snapshots` — opening it from the Dev menu
      // starts capture; closing it stops capture (existing thumbnails stay
      // until cleared).
      const snapshotsEnabled =
        useDevToolsStore.getState().panels['track-limit-snapshots'].isOpen
      if (
        snapshotsEnabled &&
        offTrackResult.isOffTrack &&
        !prevOffTrackRef.current
      ) {
        const placed = useCustomizationStore.getState().placedObjects
        const ribbon = placed.find(
          o => o.type === 'track_ribbon' && o.ribbonPoints && o.ribbonPoints.length >= 2,
        )
        const racing = ribbon?.ribbonPoints?.filter(p => !p.isPitLane) ?? []
        if (racing.length >= 2) {
          const dataUrl = captureTrackLimitSnapshot({
            carX: pos.x,
            carZ: pos.z,
            qx: rot.x,
            qy: rot.y,
            qz: rot.z,
            qw: rot.w,
            wheelOffsetsLocal: [
              WHEEL_POSITIONS.FL,
              WHEEL_POSITIONS.FR,
              WHEEL_POSITIONS.RL,
              WHEEL_POSITIONS.RR,
            ],
            centerline: racing,
            halfWidth: offTrackResult.halfWidthM,
            offTrackEnterThreshold: offTrackResult.enterThresholdM,
            wheelLateralDistances: offTrackResult.wheelLateralDistances,
            tireHalfWidths: [
              WHEEL_WIDTH_FRONT / 2,
              WHEEL_WIDTH_FRONT / 2,
              WHEEL_WIDTH_REAR / 2,
              WHEEL_WIDTH_REAR / 2,
            ],
            isOffTrack: offTrackResult.isOffTrack,
          })
          if (dataUrl) {
            useTrackLimitSnapshotStore.getState().pushSnapshot(dataUrl)
          }
        }
      }
      prevOffTrackRef.current = offTrackResult.isOffTrack

      if (OFF_TRACK_COMPARE_ENABLED) {
        const surfaceSaysGrass = useSurfaceStore.getState().currentSurface === 'grass'
        if (surfaceSaysGrass !== offTrackResult.isOffTrack) {
          console.warn(
            '[off-track-compare] geometry:',
            offTrackResult.isOffTrack,
            'surface(grass):',
            surfaceSaysGrass,
          )
        }
      }
    }

    telemetryRecorder.record(output, syncResult, pos, accumulator.fixedTimeStep)

    telemetry.update(
      output,
      pos,
      rot,
      keys.steer,
      dt,
      input.throttle ?? 0,
      input.brake_analog ?? 0,
      syncResult.brake_state.abs_enabled,
    )

    rubberTrails.update(
      output,
      pos,
      rot,
      keys.forward,
      keys.brake,
      keys.handbrake,
      dt,
      suspensionOutput,
    )

    const yaw = Math.atan2(
      2 * (rot.w * rot.y + rot.x * rot.z),
      1 - 2 * (rot.y * rot.y + rot.x * rot.x),
    )

    carStateRef.current.position = rubberTrails.carPosRef.current.set(pos.x, pos.y, pos.z)
    carStateRef.current.velocity = output.speed_kmh / 3.6
    carStateRef.current.rotation = yaw
    carStateRef.current.skidIntensity = output.skid_intensity
    carStateRef.current.isDrifting = output.is_drifting
    carStateRef.current.isBraking = keys.brake
    carStateRef.current.speedKmh = output.speed_kmh
  })

  return {
    carStateRef,
    wheelRotations: telemetry.wheelRotations,
    suspensionOutputRef: physicsStep.suspensionOutputRef,
    telemetryBufferRef: telemetryRecorder.bufferRef,
  }
}
