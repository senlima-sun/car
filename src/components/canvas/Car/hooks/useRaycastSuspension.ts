import { MutableRefObject, useRef } from 'react'
import { RapierRigidBody, useRapier } from '@react-three/rapier'
import {
  WHEEL_POSITIONS,
  WHEEL_RADIUS,
  SUSPENSION_RAY_GROUPS,
} from '../../../../constants/dimensions'
import { usePhysicsDebugStore } from '../../../../stores/usePhysicsDebugStore'

const REST_LENGTH = 0.4
const MAX_TRAVEL = 0.2
const RAY_ORIGIN_LIFT = 0.6
const RAY_LENGTH = RAY_ORIGIN_LIFT + REST_LENGTH + MAX_TRAVEL

const SPRING_STIFFNESS = 7.0
const DAMPING_RATIO = 1.4
const REBOUND_DAMPING_RATIO = 0.85
const BUMP_STOP_STIFFNESS = 6.0
const MAX_COMPRESSION_VEL = 8.0

const CAR_MASS = 798
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

function softClamp(value: number, limit: number): number {
  return limit * Math.tanh(value / limit)
}

export function useRaycastSuspension(chassisRef: MutableRefObject<RapierRigidBody | null>) {
  const { world, rapier } = useRapier()
  const prevHitYRef = useRef([0, 0, 0, 0])
  const prevCompressionRef = useRef([0, 0, 0, 0])
  const lastGroundedYRef = useRef<number | null>(null)
  const airborneFramesRef = useRef(0)

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

    const qx = rot.x,
      qy = rot.y,
      qz = rot.z,
      qw = rot.w
    const xx = qx * qx,
      yy = qy * qy,
      zz = qz * qz
    const xy = qx * qy,
      xz = qx * qz,
      yz = qy * qz
    const wx = qw * qx,
      wy = qw * qy,
      wz = qw * qz

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
    const wheelForces: number[] = []
    const wheelWorldPos: { x: number; y: number; z: number }[] = []
    let groundedCount = 0

    for (let i = 0; i < 4; i++) {
      const [lx, ly, lz] = WHEEL_ANCHORS[i]

      const worldX = pos.x + r00 * lx + r01 * ly + r02 * lz
      const worldY = pos.y + r10 * lx + r11 * ly + r12 * lz
      const worldZ = pos.z + r20 * lx + r21 * ly + r22 * lz
      wheelWorldPos.push({ x: worldX, y: worldY, z: worldZ })

      const rayX = worldX - downX * RAY_ORIGIN_LIFT
      const rayY = worldY - downY * RAY_ORIGIN_LIFT
      const rayZ = worldZ - downZ * RAY_ORIGIN_LIFT

      const ray = new rapier.Ray({ x: rayX, y: rayY, z: rayZ }, { x: downX, y: downY, z: downZ })

      const hit = world.castRay(
        ray,
        RAY_LENGTH,
        true,
        0x08,
        SUSPENSION_RAY_GROUPS,
        undefined,
        chassis,
      )

      if (hit) {
        const hitDistance = hit.timeOfImpact
        let hitY = rayY + downY * hitDistance
        const prevHitY = prevHitYRef.current[i]
        if (prevHitY !== 0 && airborneFramesRef.current <= 10) {
          const smoothRate = 40.0
          hitY = prevHitY + (hitY - prevHitY) * Math.min(dt * smoothRate, 1)
        }
        prevHitYRef.current[i] = hitY
        const effectiveDistance = (hitY - rayY) / downY
        const distFromAnchor = effectiveDistance - RAY_ORIGIN_LIFT
        const compression = REST_LENGTH - distFromAnchor

        if (compression > 0) {
          groundedCount++
          const wheelMass = CAR_MASS / 4
          const kWheel = SPRING_STIFFNESS * wheelMass * GRAVITY

          let springForce = kWheel * Math.min(compression, MAX_TRAVEL)
          if (compression > MAX_TRAVEL) {
            const overTravel = compression - MAX_TRAVEL
            springForce += kWheel * BUMP_STOP_STIFFNESS * overTravel
          }

          const rawCompVel = (compression - prevCompressionRef.current[i]) / dt
          const compressionVelocity = softClamp(rawCompVel, MAX_COMPRESSION_VEL)
          prevCompressionRef.current[i] = compression
          const dampRatio = compressionVelocity >= 0 ? DAMPING_RATIO : REBOUND_DAMPING_RATIO
          const criticalDamping = dampRatio * 2 * Math.sqrt(kWheel * wheelMass)
          const dampForce = criticalDamping * compressionVelocity
          const force = springForce + dampForce
          wheelForces.push(compression > 0 ? force : 0)

          wheels.push({
            hitY,
            compression,
            isGrounded: true,
            deflection: compression,
          })
        } else {
          prevCompressionRef.current[i] = 0
          wheelForces.push(0)
          wheels.push({ hitY, compression: 0, isGrounded: false, deflection: 0 })
        }
      } else {
        prevCompressionRef.current[i] = 0
        wheelForces.push(0)
        wheels.push({ hitY: worldY - RAY_LENGTH, compression: 0, isGrounded: false, deflection: 0 })
      }
    }

    if (groundedCount > 0) {
      if (airborneFramesRef.current > 10) {
        for (let i = 0; i < 4; i++) {
          prevHitYRef.current[i] = 0
          prevCompressionRef.current[i] = 0
        }
      }
      airborneFramesRef.current = 0

      for (let i = 0; i < 4; i++) {
        if (wheelForces[i] > 0) {
          const impulseMag = wheelForces[i] * dt
          chassis.applyImpulseAtPoint(
            { x: -downX * impulseMag, y: -downY * impulseMag, z: -downZ * impulseMag },
            wheelWorldPos[i],
            true,
          )
        }
      }

      const minY = wheels.reduce(
        (min, w) => (w.isGrounded ? Math.max(min, w.hitY) : min),
        -Infinity,
      )
      if (minY > -Infinity) {
        lastGroundedYRef.current = minY
        const wheelBottomY = pos.y + (WHEEL_POSITIONS.FL[1] - WHEEL_RADIUS)
        const penetration = minY - wheelBottomY
        if (penetration > 0.08) {
          chassis.setTranslation({ x: pos.x, y: pos.y + penetration * 0.5, z: pos.z }, true)
          const freshLinvel = chassis.linvel()
          if (freshLinvel.y < -2) {
            chassis.setLinvel({ x: freshLinvel.x, y: freshLinvel.y * 0.5, z: freshLinvel.z }, true)
          }
        }
      }
    } else {
      airborneFramesRef.current++
      const lastY = lastGroundedYRef.current
      if (lastY !== null) {
        const wheelBottomY = pos.y + (WHEEL_POSITIONS.FL[1] - WHEEL_RADIUS)
        const tolerance = 0.05
        if (wheelBottomY < lastY - tolerance) {
          chassis.setTranslation(
            { x: pos.x, y: lastY - (WHEEL_POSITIONS.FL[1] - WHEEL_RADIUS), z: pos.z },
            true,
          )
          const freshLinvel = chassis.linvel()
          if (freshLinvel.y < -1) {
            chassis.setLinvel({ x: freshLinvel.x, y: freshLinvel.y * 0.7, z: freshLinvel.z }, true)
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
        totalForceY: wheelForces[0] + wheelForces[1] + wheelForces[2] + wheelForces[3],
        groundedCount,
        wheels: wheels.map((w, i) => ({
          compression: w.compression,
          hitY: w.hitY,
          isGrounded: w.isGrounded,
          rayOriginY:
            pos.y +
            r10 * WHEEL_ANCHORS[i][0] +
            r11 * WHEEL_ANCHORS[i][1] +
            r12 * WHEEL_ANCHORS[i][2],
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
