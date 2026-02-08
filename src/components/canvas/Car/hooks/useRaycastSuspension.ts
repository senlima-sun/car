import { MutableRefObject, useRef } from 'react'
import { RapierRigidBody, useRapier } from '@react-three/rapier'
import { WHEEL_POSITIONS, WHEEL_RADIUS, SUSPENSION_RAY_GROUPS } from '../../../../constants/dimensions'

const REST_LENGTH = 0.4
const MAX_TRAVEL = 0.2
const RAY_ORIGIN_LIFT = 0.6
const RAY_LENGTH = RAY_ORIGIN_LIFT + REST_LENGTH + MAX_TRAVEL

const SPRING_STIFFNESS = 8.0
const DAMPING_RATIO = 0.7

const CAR_MASS = 600
const GRAVITY = 9.81

const WHEEL_ANCHORS = [
  WHEEL_POSITIONS.FL,
  WHEEL_POSITIONS.FR,
  WHEEL_POSITIONS.RL,
  WHEEL_POSITIONS.RR,
] as const

export interface WheelSuspensionData {
  hitY: number
  compression: number
  isGrounded: boolean
  deflection: number
}

export interface SuspensionOutput {
  wheels: [WheelSuspensionData, WheelSuspensionData, WheelSuspensionData, WheelSuspensionData]
  anyGrounded: boolean
}

const DEFAULT_WHEEL: WheelSuspensionData = {
  hitY: 0,
  compression: 0,
  isGrounded: false,
  deflection: 0,
}

export function useRaycastSuspension(
  chassisRef: MutableRefObject<RapierRigidBody | null>,
) {
  const { world, rapier } = useRapier()
  const prevErrorRef = useRef([0, 0, 0, 0])

  function step(dt: number): SuspensionOutput {
    const chassis = chassisRef.current
    if (!chassis) {
      return {
        wheels: [DEFAULT_WHEEL, DEFAULT_WHEEL, DEFAULT_WHEEL, DEFAULT_WHEEL],
        anyGrounded: false,
      }
    }

    const pos = chassis.translation()
    const rot = chassis.rotation()

    const qx = rot.x, qy = rot.y, qz = rot.z, qw = rot.w
    const xx = qx * qx, yy = qy * qy, zz = qz * qz
    const xy = qx * qy, xz = qx * qz, yz = qy * qz
    const wx = qw * qx, wy = qw * qy, wz = qw * qz

    const r10 = 2 * (xy + wz)
    const r11 = 1 - 2 * (xx + zz)
    const r12 = 2 * (yz - wx)
    const r00 = 1 - 2 * (yy + zz)
    const r01 = 2 * (xy - wz)
    const r02 = 2 * (xz + wy)
    const r20 = 2 * (xz - wy)
    const r21 = 2 * (yz + wx)
    const r22 = 1 - 2 * (xx + yy)

    const downX = -r10
    const downY = -r11
    const downZ = -r12

    const wheels: WheelSuspensionData[] = []
    let totalForceY = 0
    let groundedCount = 0

    for (let i = 0; i < 4; i++) {
      const [lx, ly, lz] = WHEEL_ANCHORS[i]

      const worldX = pos.x + r00 * lx + r01 * ly + r02 * lz
      const worldY = pos.y + r10 * lx + r11 * ly + r12 * lz
      const worldZ = pos.z + r20 * lx + r21 * ly + r22 * lz

      const rayX = worldX - downX * RAY_ORIGIN_LIFT
      const rayY = worldY - downY * RAY_ORIGIN_LIFT
      const rayZ = worldZ - downZ * RAY_ORIGIN_LIFT

      const ray = new rapier.Ray(
        { x: rayX, y: rayY, z: rayZ },
        { x: downX, y: downY, z: downZ },
      )

      const hit = world.castRay(
        ray,
        RAY_LENGTH,
        true,
        undefined,
        SUSPENSION_RAY_GROUPS,
        undefined,
        chassis,
      )

      if (hit) {
        const hitDistance = hit.timeOfImpact
        const hitY = rayY + downY * hitDistance
        const distFromAnchor = hitDistance - RAY_ORIGIN_LIFT
        const compression = REST_LENGTH - distFromAnchor

        if (compression > 0) {
          groundedCount++
          const error = compression
          const errorVelocity = (error - prevErrorRef.current[i]) / Math.max(dt, 0.001)
          prevErrorRef.current[i] = error

          const springForce = SPRING_STIFFNESS * error * CAR_MASS * GRAVITY / 4
          const dampForce = DAMPING_RATIO * 2 * Math.sqrt(SPRING_STIFFNESS * CAR_MASS / 4) * errorVelocity
          const force = Math.max(springForce - dampForce, 0)
          totalForceY += force

          wheels.push({
            hitY,
            compression,
            isGrounded: true,
            deflection: compression - REST_LENGTH,
          })
        } else {
          prevErrorRef.current[i] *= 0.9
          wheels.push({ hitY, compression: 0, isGrounded: false, deflection: 0 })
        }
      } else {
        prevErrorRef.current[i] *= 0.9
        wheels.push({ hitY: worldY - RAY_LENGTH, compression: 0, isGrounded: false, deflection: 0 })
      }
    }

    if (groundedCount > 0) {
      const linvel = chassis.linvel()
      const gravityForce = CAR_MASS * GRAVITY
      const netForceY = totalForceY - gravityForce
      const accelY = netForceY / CAR_MASS
      const newVelY = linvel.y + accelY * dt

      chassis.setLinvel({ x: linvel.x, y: newVelY, z: linvel.z }, true)

      const minY = wheels.reduce((min, w) => w.isGrounded ? Math.max(min, w.hitY) : min, -Infinity)
      if (minY > -Infinity) {
        const wheelBottomY = pos.y + (WHEEL_POSITIONS.FL[1] - WHEEL_RADIUS)
        if (wheelBottomY < minY) {
          const correction = minY - wheelBottomY + 0.01
          chassis.setTranslation({ x: pos.x, y: pos.y + correction, z: pos.z }, true)
          if (linvel.y < 0) {
            chassis.setLinvel({ x: linvel.x, y: 0, z: linvel.z }, true)
          }
        }
      }
    }

    return {
      wheels: wheels as SuspensionOutput['wheels'],
      anyGrounded: wheels.some(w => w.isGrounded),
    }
  }

  return { step }
}
