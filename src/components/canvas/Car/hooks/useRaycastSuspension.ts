import { MutableRefObject, useRef } from 'react'
import { RapierRigidBody, useRapier } from '@react-three/rapier'
import { WHEEL_POSITIONS, WHEEL_RADIUS, SUSPENSION_RAY_GROUPS } from '../../../../constants/dimensions'

const SPRING_K = 25000
const DAMPER_C = 3000
const REST_LENGTH = 0.35
const MAX_TRAVEL = 0.15
const RAY_ORIGIN_LIFT = 0.5
const RAY_LENGTH = RAY_ORIGIN_LIFT + REST_LENGTH + MAX_TRAVEL
const MAX_SPRING_FORCE = 12000

const FRONT_ANTI_ROLL_K = 8000
const REAR_ANTI_ROLL_K = 6000


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
  const prevCompressionRef = useRef([0, 0, 0, 0])

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

    const r00 = 1 - 2 * (yy + zz)
    const r01 = 2 * (xy - wz)
    const r02 = 2 * (xz + wy)
    const r10 = 2 * (xy + wz)
    const r11 = 1 - 2 * (xx + zz)
    const r12 = 2 * (yz - wx)
    const r20 = 2 * (xz - wy)
    const r21 = 2 * (yz + wx)
    const r22 = 1 - 2 * (xx + yy)

    const downX = -r10
    const downY = -r11
    const downZ = -r12

    const wheels: WheelSuspensionData[] = []
    const forces: { x: number; y: number; z: number; anchorX: number; anchorY: number; anchorZ: number }[] = []

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
          const compressionVelocity = (compression - prevCompressionRef.current[i]) / Math.max(dt, 0.001)
          prevCompressionRef.current[i] = compression

          const springForce = SPRING_K * compression - DAMPER_C * compressionVelocity
          const clampedForce = Math.min(Math.max(springForce, 0), MAX_SPRING_FORCE)

          forces.push({
            x: -downX * clampedForce,
            y: -downY * clampedForce,
            z: -downZ * clampedForce,
            anchorX: lx,
            anchorY: ly,
            anchorZ: lz,
          })

          wheels.push({
            hitY,
            compression,
            isGrounded: true,
            deflection: compression - REST_LENGTH,
          })
        } else {
          prevCompressionRef.current[i] *= 0.9
          wheels.push({ hitY, compression: 0, isGrounded: false, deflection: 0 })
          forces.push({ x: 0, y: 0, z: 0, anchorX: lx, anchorY: ly, anchorZ: lz })
        }
      } else {
        prevCompressionRef.current[i] *= 0.9
        wheels.push({ hitY: worldY - RAY_LENGTH, compression: 0, isGrounded: false, deflection: 0 })
        forces.push({ x: 0, y: 0, z: 0, anchorX: lx, anchorY: ly, anchorZ: lz })
      }
    }

    // Anti-roll bar: front axle
    const frontDiff = wheels[0].compression - wheels[1].compression
    const frontAntiRoll = FRONT_ANTI_ROLL_K * frontDiff
    forces[0].x += -downX * (-frontAntiRoll)
    forces[0].y += -downY * (-frontAntiRoll)
    forces[0].z += -downZ * (-frontAntiRoll)
    forces[1].x += -downX * frontAntiRoll
    forces[1].y += -downY * frontAntiRoll
    forces[1].z += -downZ * frontAntiRoll

    // Anti-roll bar: rear axle
    const rearDiff = wheels[2].compression - wheels[3].compression
    const rearAntiRoll = REAR_ANTI_ROLL_K * rearDiff
    forces[2].x += -downX * (-rearAntiRoll)
    forces[2].y += -downY * (-rearAntiRoll)
    forces[2].z += -downZ * (-rearAntiRoll)
    forces[3].x += -downX * rearAntiRoll
    forces[3].y += -downY * rearAntiRoll
    forces[3].z += -downZ * rearAntiRoll

    // Apply all forces as impulses at wheel anchor points
    for (let i = 0; i < 4; i++) {
      const f = forces[i]
      if (f.x === 0 && f.y === 0 && f.z === 0) continue

      chassis.applyImpulseAtPoint(
        { x: f.x * dt, y: f.y * dt, z: f.z * dt },
        {
          x: pos.x + r00 * f.anchorX + r01 * f.anchorY + r02 * f.anchorZ,
          y: pos.y + r10 * f.anchorX + r11 * f.anchorY + r12 * f.anchorZ,
          z: pos.z + r20 * f.anchorX + r21 * f.anchorY + r22 * f.anchorZ,
        },
        true,
      )
    }

    return {
      wheels: wheels as SuspensionOutput['wheels'],
      anyGrounded: wheels.some(w => w.isGrounded),
    }
  }

  return { step }
}
