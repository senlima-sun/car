import { useRef } from 'react'
import { Vector3 } from 'three'
import { useTireTrailStore } from '../../../../stores/useTireTrailStore'
import { WHEEL_POSITIONS as DIM_WHEEL_POS } from '../../../../constants/dimensions'
import { type SuspensionOutput } from './useRaycastSuspension'

type PhysicsContext = ReturnType<typeof import('../../../../wasm').usePhysics>

const WHEEL_OFFSETS: [number, number][] = [
  [DIM_WHEEL_POS.FL[0], DIM_WHEEL_POS.FL[2]],
  [DIM_WHEEL_POS.FR[0], DIM_WHEEL_POS.FR[2]],
  [DIM_WHEEL_POS.RL[0], DIM_WHEEL_POS.RL[2]],
  [DIM_WHEEL_POS.RR[0], DIM_WHEEL_POS.RR[2]],
]

const MIN_SPEED_FOR_RUBBER = 7.2

interface RubberAndTrailsOptions {
  physics: PhysicsContext
}

export function useCarRubberAndTrails({ physics }: RubberAndTrailsOptions) {
  const addTrailPoint = useTireTrailStore(state => state.addPoint)

  const wheelPositionsRef = useRef(new Float32Array(8))
  const wheelIntensitiesRef = useRef(new Float32Array(4))
  const prevWheelWorldRef = useRef(new Float32Array(8))
  const tempCarPosRef = useRef(new Vector3())

  const update = (
    output: any,
    pos: any,
    rot: any,
    forward: boolean,
    brake: boolean,
    handbrake: boolean,
    dt: number,
    suspensionOutput: SuspensionOutput | null,
  ) => {
    if (output.speed_kmh <= MIN_SPEED_FOR_RUBBER) {
      if (output.speed_kmh > 3) {
        physics.updateCarDriving(pos.x, pos.z, output.speed_kmh / 3.6, dt)
      }
      return
    }

    const yaw = Math.atan2(
      2 * (rot.w * rot.y + rot.x * rot.z),
      1 - 2 * (rot.y * rot.y + rot.x * rot.x),
    )
    const cosYaw = Math.cos(yaw)
    const sinYaw = Math.sin(yaw)

    const slipAngleAbs = Math.abs(output.slip_angle)
    const isDrifting = output.is_drifting

    const slipIntensity = isDrifting
      ? Math.min(slipAngleAbs / 30, 1) * 0.9
      : Math.min(slipAngleAbs / 45, 0.5)

    const gIntensity = Math.min(
      (Math.abs(output.lateral_g) + Math.abs(output.longitudinal_g)) / 2,
      0.6,
    )

    const speedFactor = Math.min(Math.max((output.speed_kmh - MIN_SPEED_FOR_RUBBER) / 55, 0), 1)
    const brakeBoost = brake ? 0.3 : 0
    const handbrakeBoost = handbrake ? 0.5 : 0

    const wheelPositions = wheelPositionsRef.current
    const wheelIntensities = wheelIntensitiesRef.current

    for (let i = 0; i < 4; i++) {
      const [localX, localZ] = WHEEL_OFFSETS[i]

      wheelPositions[i * 2] = pos.x + localX * cosYaw - localZ * sinYaw
      wheelPositions[i * 2 + 1] = pos.z + localX * sinYaw + localZ * cosYaw

      const isFront = i < 2
      const isLeft = i === 0 || i === 2

      let intensity = slipIntensity + gIntensity

      if (isFront && brake) {
        intensity += brakeBoost * 1.3
      }

      if (!isFront) {
        if (forward && !brake) intensity += 0.2
        if (handbrake) intensity = Math.max(intensity, 0.7 + handbrakeBoost)
      }

      const turningLeft = output.steer_angle < -0.05
      const turningRight = output.steer_angle > 0.05
      if ((turningLeft && !isLeft) || (turningRight && isLeft)) {
        intensity *= 1 + Math.min(Math.abs(output.lateral_g) / 2, 0.5)
      }

      intensity *= speedFactor

      wheelIntensities[i] = Math.min(Math.max(intensity, 0), 1)
    }

    const { compoundMult, wetness } = physics.updateRubberFrame(
      pos.x,
      pos.z,
      output.speed_kmh / 3.6,
      dt,
      wheelPositions,
      wheelIntensities,
    )

    const wetnessFactor = 1 - wetness * 0.7
    for (let i = 0; i < 4; i++) {
      wheelIntensities[i] = Math.min(wheelIntensities[i] * wetnessFactor * compoundMult, 1)
    }

    const prevWW = prevWheelWorldRef.current
    const susOut = suspensionOutput
    const isWet = wetness > 0.3

    const minDistanceThreshold = dt > 0.012 ? 0.003 : 0.001

    for (let i = 0; i < 4; i++) {
      if (wheelIntensities[i] < 0.05) continue
      const wx = wheelPositions[i * 2]
      const wz = wheelPositions[i * 2 + 1]
      const dx = wx - prevWW[i * 2]
      const dz = wz - prevWW[i * 2 + 1]
      const dirLen = Math.sqrt(dx * dx + dz * dz)
      if (dirLen < minDistanceThreshold) continue
      const hitY = susOut ? susOut.wheels[i].hitY : pos.y
      const baseWidth = 0.3
      const slipWidthMult = 1 + Math.min(slipAngleAbs / 30, 0.5)
      addTrailPoint(
        i,
        wx,
        wz,
        hitY,
        dx / dirLen,
        dz / dirLen,
        wheelIntensities[i],
        baseWidth * slipWidthMult,
        isWet,
      )
    }
    for (let i = 0; i < 8; i++) {
      prevWheelWorldRef.current[i] = wheelPositions[i]
    }
  }

  return { update, carPosRef: tempCarPosRef }
}
