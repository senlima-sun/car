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
import { type CarState } from './types'

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

    const input: CarInput = {
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

    const { steps, alpha } = accumulator.accumulate(dt)

    let result = null
    for (let i = 0; i < steps; i++) {
      result = physicsStep.step(accumulator.fixedTimeStep, input)
      if (!result) return
    }

    if (!result && steps === 0) return

    const { output, syncResult, windSyncNeeded, suspensionOutput } = result

    stateSync.syncAll(output, syncResult, windSyncNeeded)

    const chassis = chassisRef.current
    const pos = chassis.translation()
    const rot = chassis.rotation()

    telemetry.update(output, pos, rot, keys.steer, dt)

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
  }
}
