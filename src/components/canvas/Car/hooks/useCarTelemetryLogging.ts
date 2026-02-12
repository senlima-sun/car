import { useRef } from 'react'
import { useCarStore } from '../../../../stores/useCarStore'
import { useLapTimeStore } from '../../../../stores/useLapTimeStore'
import { usePitStore } from '../../../../stores/usePitStore'
import { getLogger } from '../../../../debug/ActionLogger'
import { WHEEL_RADIUS as DIM_WHEEL_RADIUS } from '../../../../constants/dimensions'

export function useCarTelemetryLogging() {
  const updateTelemetry = useCarStore(state => state.updateTelemetry)
  const recordPosition = useLapTimeStore(state => state.recordPosition)
  const checkPitLaneSpeed = usePitStore(state => state.checkPitLaneSpeed)

  const wheelRotationsRef = useRef<[number, number, number, number]>([0, 0, 0, 0])
  const lastTelemetryTime = useRef(0)
  const prevSpeedRef = useRef(0)
  const prevGearRef = useRef(0)
  const prevDriftRef = useRef(false)
  const prevGripRef = useRef(1)

  const update = (output: any, pos: any, rot: any, steer: number, dt: number) => {
    const logger = import.meta.env.DEV ? getLogger() : null

    if (logger) {
      const speedDelta = Math.abs(output.speed_kmh - prevSpeedRef.current)
      const gearChanged = output.gear !== prevGearRef.current
      const driftChanged = output.is_drifting !== prevDriftRef.current
      const gripDelta = Math.abs(output.effective_grip - prevGripRef.current)

      if (speedDelta > 2 || gearChanged || driftChanged || gripDelta > 0.05) {
        logger.log('physics', 'physics.step.change', 'useCarTelemetryLogging', {
          input: {},
          speed_before: prevSpeedRef.current,
        }, {
          speed: output.speed_kmh,
          gear: output.gear,
          drift: output.is_drifting,
          grip: output.effective_grip,
          slip_angle: output.slip_angle,
          lateral_g: output.lateral_g,
        })
      }

      prevSpeedRef.current = output.speed_kmh
      prevGearRef.current = output.gear
      prevDriftRef.current = output.is_drifting
      prevGripRef.current = output.effective_grip
    }

    const wheelRadius = DIM_WHEEL_RADIUS
    const wheelRotSpeed = output.speed_kmh / 3.6 / wheelRadius
    wheelRotationsRef.current = wheelRotationsRef.current.map(r => r + wheelRotSpeed * dt) as [
      number,
      number,
      number,
      number,
    ]

    const steerVal = -steer * 0.3
    const now = performance.now()
    const speedChanged = Math.abs(output.speed_kmh - prevSpeedRef.current) >= 1
    const gearChanged = output.gear !== prevGearRef.current

    if (now - lastTelemetryTime.current > 100 || speedChanged || gearChanged) {
      updateTelemetry({
        speed: output.speed_kmh,
        gear: output.gear,
        rpm: output.rpm ?? 0,
        position: [pos.x, pos.y, pos.z],
        rotation: [rot.x, rot.y, rot.z, rot.w],
        steerAngle: steerVal,
        wheelRotations: wheelRotationsRef.current,
      })
      lastTelemetryTime.current = now
    } else {
      const store = useCarStore.getState()
      store.steerAngle = steerVal
      store.wheelRotations = wheelRotationsRef.current
    }

    recordPosition(pos.x, pos.y, pos.z, output.speed_kmh)
    checkPitLaneSpeed(output.speed_kmh / 3.6)
  }

  return { update, wheelRotations: wheelRotationsRef }
}
