import { useRef } from 'react'
import { type Vector, type Rotation } from '@dimforge/rapier3d-compat'
import { useCarStore } from '../../../../stores/useCarStore'
import { useLapTimeStore } from '../../../../stores/useLapTimeStore'
import { useGhostCarStore } from '../../../../stores/useGhostCarStore'
import { usePitStore } from '../../../../stores/usePitStore'
import { getLogger } from '../../../../debug/ActionLogger'
import { IS_DEV } from '../../../../utils/isDev'
import { WHEEL_RADIUS as DIM_WHEEL_RADIUS } from '../../../../constants/dimensions'
import { type CarPhysicsOutput } from '../../../../wasm'

const DEV_PHYSICS_LOG_INTERVAL_MS = 500

export function useCarTelemetryLogging() {
  const updateTelemetry = useCarStore(state => state.updateTelemetry)
  const recordPosition = useLapTimeStore(state => state.recordPosition)
  const recordGhostFrame = useGhostCarStore(state => state.recordGhostFrame)
  const checkPitLaneSpeed = usePitStore(state => state.checkPitLaneSpeed)

  const wheelRotationsRef = useRef<[number, number, number, number]>([0, 0, 0, 0])
  const lastTelemetryTime = useRef(0)
  const lastDevLogTime = useRef(0)
  const prevSpeedRef = useRef(0)
  const prevGearRef = useRef(0)
  const prevLoggedSpeedRef = useRef(0)
  const prevLoggedGearRef = useRef(0)
  const prevLoggedDriftRef = useRef(false)
  const prevLoggedGripRef = useRef(1)

  const update = (
    output: CarPhysicsOutput,
    pos: Vector,
    rot: Rotation,
    steer: number,
    dt: number,
    throttle: number,
    brakeAnalog: number,
  ) => {
    const now = performance.now()
    const logger = IS_DEV ? getLogger() : null

    if (logger && now - lastDevLogTime.current >= DEV_PHYSICS_LOG_INTERVAL_MS) {
      lastDevLogTime.current = now
      const speedDelta = Math.abs(output.speed_kmh - prevLoggedSpeedRef.current)
      const gearChanged = output.gear !== prevLoggedGearRef.current
      const driftChanged = output.is_drifting !== prevLoggedDriftRef.current
      const gripDelta = Math.abs(output.effective_grip - prevLoggedGripRef.current)

      if (speedDelta > 2 || gearChanged || driftChanged || gripDelta > 0.05) {
        logger.log(
          'physics',
          'physics.step.change',
          'useCarTelemetryLogging',
          {
            input: {},
            speed_before: prevLoggedSpeedRef.current,
          },
          {
            speed: output.speed_kmh,
            gear: output.gear,
            drift: output.is_drifting,
            grip: output.effective_grip,
            slip_angle: output.slip_angle,
            lateral_g: output.lateral_g,
          },
        )
      }
      prevLoggedSpeedRef.current = output.speed_kmh
      prevLoggedGearRef.current = output.gear
      prevLoggedDriftRef.current = output.is_drifting
      prevLoggedGripRef.current = output.effective_grip
    }

    const wheelRadius = DIM_WHEEL_RADIUS
    const forwardSpeedMs = output.forward_speed_ms ?? output.speed_kmh / 3.6
    const wheelRotSpeed = forwardSpeedMs / wheelRadius
    const wheelRotationDelta = wheelRotSpeed * dt
    const wheelRotations = wheelRotationsRef.current
    wheelRotations[0] += wheelRotationDelta
    wheelRotations[1] += wheelRotationDelta
    wheelRotations[2] += wheelRotationDelta
    wheelRotations[3] += wheelRotationDelta

    const steerVal = -steer * 0.3
    const speedChanged = Math.abs(output.speed_kmh - prevSpeedRef.current) >= 5
    const gearChanged = output.gear !== prevGearRef.current

    if (now - lastTelemetryTime.current > 100 || speedChanged || gearChanged) {
      updateTelemetry({
        speed: output.speed_kmh,
        gear: output.gear,
        rpm: output.rpm ?? 0,
        position: [pos.x, pos.y, pos.z],
        rotation: [rot.x, rot.y, rot.z, rot.w],
        steerAngle: steerVal,
        wheelRotations,
        lateralG: output.lateral_g ?? 0,
        longitudinalG: output.longitudinal_g ?? 0,
        skidIntensity: output.skid_intensity ?? 0,
      })
      lastTelemetryTime.current = now
      prevSpeedRef.current = output.speed_kmh
      prevGearRef.current = output.gear
    } else {
      useCarStore.setState({
        steerAngle: steerVal,
        wheelRotations,
        lateralG: output.lateral_g ?? 0,
        longitudinalG: output.longitudinal_g ?? 0,
        skidIntensity: output.skid_intensity ?? 0,
      })
    }

    recordPosition(pos.x, pos.y, pos.z, output.speed_kmh)
    recordGhostFrame(
      pos.x,
      pos.y,
      pos.z,
      rot.x,
      rot.y,
      rot.z,
      rot.w,
      steerVal,
      wheelRotationsRef.current,
      throttle,
      brakeAnalog,
    )
    checkPitLaneSpeed(output.speed_kmh / 3.6)
  }

  return { update, wheelRotations: wheelRotationsRef }
}
