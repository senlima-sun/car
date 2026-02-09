import { MutableRefObject, useRef } from 'react'
import { RapierRigidBody, useRapier } from '@react-three/rapier'
import { WHEEL_POSITIONS, WHEEL_RADIUS, SUSPENSION_RAY_GROUPS } from '../../../../constants/dimensions'
import { usePhysicsDebugStore } from '../../../../stores/usePhysicsDebugStore'

const REST_LENGTH = 0.4
const MAX_TRAVEL = 0.2
const RAY_ORIGIN_LIFT = 0.6
const RAY_LENGTH = RAY_ORIGIN_LIFT + REST_LENGTH + MAX_TRAVEL

const SPRING_STIFFNESS = 8.0
const DAMPING_RATIO = 0.85

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
  const prevHitYRef = useRef([0, 0, 0, 0])
  const HIT_Y_MAX_DROP = 0.08
  const HIT_Y_MAX_RISE = 0.06

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
        0x08, // EXCLUDE_SENSORS — prevent hitting road sensor CuboidColliders
        SUSPENSION_RAY_GROUPS,
        undefined,
        chassis,
      )

      if (hit) {
        const hitDistance = hit.timeOfImpact
        let hitY = rayY + downY * hitDistance
        const prevHitY = prevHitYRef.current[i]
        if (prevHitY !== 0) {
          if (hitY < prevHitY - HIT_Y_MAX_DROP) {
            hitY = prevHitY - HIT_Y_MAX_DROP
          } else if (hitY > prevHitY + HIT_Y_MAX_RISE) {
            hitY = prevHitY + HIT_Y_MAX_RISE
          }
        }
        prevHitYRef.current[i] = hitY
        const effectiveDistance = (hitY - rayY) / downY
        const distFromAnchor = effectiveDistance - RAY_ORIGIN_LIFT
        const compression = REST_LENGTH - distFromAnchor

        if (compression > 0) {
          groundedCount++
          const error = compression
          const errorVelocity = (error - prevErrorRef.current[i]) / Math.max(dt, 0.001)
          prevErrorRef.current[i] = error

          const springForce = SPRING_STIFFNESS * error * CAR_MASS * GRAVITY / 4
          // Critical damping: c = ζ * 2 * sqrt(k_wheel * m_wheel)
          const dampForce = DAMPING_RATIO * (CAR_MASS / 2) * Math.sqrt(SPRING_STIFFNESS * GRAVITY) * errorVelocity
          const force = springForce + dampForce
          totalForceY += force

          wheels.push({
            hitY,
            compression,
            isGrounded: true,
            deflection: compression,
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
      // Apply spring-damper as impulse (additive, works with Rapier gravity)
      chassis.applyImpulse({ x: 0, y: totalForceY * dt, z: 0 }, true)

      // Safety: prevent wheel from sinking below ground surface
      const minY = wheels.reduce((min, w) => w.isGrounded ? Math.max(min, w.hitY) : min, -Infinity)
      if (minY > -Infinity) {
        const wheelBottomY = pos.y + (WHEEL_POSITIONS.FL[1] - WHEEL_RADIUS)
        if (wheelBottomY < minY) {
          const correction = (minY - wheelBottomY) * 0.6
          chassis.setTranslation({ x: pos.x, y: pos.y + correction, z: pos.z }, true)
          const freshLinvel = chassis.linvel()
          if (freshLinvel.y < -1) {
            chassis.setLinvel({ x: freshLinvel.x, y: freshLinvel.y * 0.3, z: freshLinvel.z }, true)
          }
        }
      }
    }

    // Emit debug telemetry (throttled — only when debug panel is open)
    if (usePhysicsDebugStore.getState().enabled) {
      const vel = chassis.linvel()
      usePhysicsDebugStore.getState().update({
        posY: pos.y,
        velY: vel.y,
        totalForceY,
        groundedCount,
        wheels: wheels.map((w, i) => ({
          compression: w.compression,
          hitY: w.hitY,
          isGrounded: w.isGrounded,
          rayOriginY: pos.y + r10 * WHEEL_ANCHORS[i][0] + r11 * WHEEL_ANCHORS[i][1] + r12 * WHEEL_ANCHORS[i][2],
        })) as [any, any, any, any],
      })
    }

    return {
      wheels: wheels as SuspensionOutput['wheels'],
      anyGrounded: wheels.some(w => w.isGrounded),
    }
  }

  return { step }
}
