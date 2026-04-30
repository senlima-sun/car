import { MutableRefObject, useRef } from 'react'
import { RapierRigidBody, useRapier } from '@react-three/rapier'
import {
  SUSPENSION,
  TRACK_GAUGE_FRONT,
  TRACK_GAUGE_REAR,
  WHEELBASE,
  WHEEL_POSITIONS,
  WHEEL_RADIUS,
  SUSPENSION_RAY_GROUPS,
} from '../../../../constants/dimensions'
import { usePhysicsDebugStore, type WheelDebug } from '../../../../stores/usePhysicsDebugStore'
import { useSuspensionStore } from '../../../../stores/useSuspensionStore'
import { useTerrainStore } from '../../../../stores/useTerrainStore'

const SPRING_STIFFNESS = 7.0
const DAMPING_RATIO = 1.4
const REBOUND_DAMPING_RATIO = 0.85
const BUMP_STOP_STIFFNESS = 6.0
const MAX_COMPRESSION_VEL = 8.0

const STATIC_COMPRESSION = 1 / SPRING_STIFFNESS
const REST_LENGTH = WHEEL_RADIUS + STATIC_COMPRESSION
const MAX_TRAVEL = 0.2
const RAY_ORIGIN_LIFT = 0.6
const SUSPENSION_ENVELOPE = RAY_ORIGIN_LIFT + REST_LENGTH + MAX_TRAVEL
const SEEK_RAY_LENGTH = 50

// Wave 4 Phase 2: 2026 F1 minimum mass (down from 798 in 2025).
const CAR_MASS = 768
const GRAVITY = 9.81
const BODY_TERRAIN_CLEARANCE = 0.03
const TERRAIN_LOOKAHEAD_MIN = 0.25
const TERRAIN_LOOKAHEAD_MAX = 1.1
const TERRAIN_LOOKAHEAD_SPEED_FACTOR = 0.03
const AIRBORNE_SUPPORT_TOLERANCE = 0.05
const MAX_AIRBORNE_STALE_GROUND_CORRECTION = 0.015
const DEBUG_UPDATE_INTERVAL_MS = 100

const WHEEL_ANCHORS = [
  WHEEL_POSITIONS.FL,
  WHEEL_POSITIONS.FR,
  WHEEL_POSITIONS.RL,
  WHEEL_POSITIONS.RR,
] as const

const BASE_BODY_SAMPLE_POINTS = [
  [0, SUSPENSION.LOWER_CHASSIS_Y, WHEELBASE * 0.45],
  [0, SUSPENSION.LOWER_CHASSIS_Y, -WHEELBASE * 0.45],
  [-TRACK_GAUGE_FRONT * 0.35, SUSPENSION.LOWER_CHASSIS_Y, WHEELBASE * 0.15],
  [TRACK_GAUGE_FRONT * 0.35, SUSPENSION.LOWER_CHASSIS_Y, WHEELBASE * 0.15],
  [-TRACK_GAUGE_REAR * 0.35, SUSPENSION.LOWER_CHASSIS_Y, -WHEELBASE * 0.15],
  [TRACK_GAUGE_REAR * 0.35, SUSPENSION.LOWER_CHASSIS_Y, -WHEELBASE * 0.15],
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
  wheelForces: [number, number, number, number]
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

export function getTerrainLookaheadDistance(forwardSpeed: number): number {
  const speed = Math.abs(forwardSpeed)
  if (speed < 1) return 0
  return Math.min(
    TERRAIN_LOOKAHEAD_MAX,
    TERRAIN_LOOKAHEAD_MIN + speed * TERRAIN_LOOKAHEAD_SPEED_FACTOR,
  )
}

export function resolveTerrainSupportHitY(
  rayY: number,
  downY: number,
  seekRayLength: number,
  suspensionEnvelope: number,
  terrainHeight: number,
  rapierHitY: number | null,
): number | null {
  if (Math.abs(downY) < 1e-5) return rapierHitY

  const terrainDistance = (terrainHeight - rayY) / downY
  const terrainWithinRay = terrainDistance >= 0 && terrainDistance <= seekRayLength

  if (rapierHitY !== null) {
    const rapierDistance = (rapierHitY - rayY) / downY
    if (rapierDistance >= 0 && rapierDistance <= suspensionEnvelope) {
      return rapierHitY
    }
  }

  if (!terrainWithinRay) return rapierHitY
  if (rapierHitY === null) return terrainHeight
  return terrainDistance <= suspensionEnvelope ? terrainHeight : rapierHitY
}

export function resolveAirborneVerticalCorrection({
  currentGroundY,
  wheelBottomY,
  maxBodyPenetration,
  verticalVelocity,
  tolerance = AIRBORNE_SUPPORT_TOLERANCE,
  maxStaleGroundCorrection = MAX_AIRBORNE_STALE_GROUND_CORRECTION,
}: {
  currentGroundY: number | null
  wheelBottomY: number
  maxBodyPenetration: number
  verticalVelocity: number
  tolerance?: number
  maxStaleGroundCorrection?: number
}): number {
  if (maxBodyPenetration > tolerance) return maxBodyPenetration
  if (currentGroundY === null || verticalVelocity >= 0) return 0

  const staleGroundCorrection = currentGroundY - wheelBottomY
  if (staleGroundCorrection <= tolerance) return 0

  return Math.min(staleGroundCorrection, maxStaleGroundCorrection)
}

const SAMPLE_POINTS_BASE_LEN = BASE_BODY_SAMPLE_POINTS.length

function makeSamplePointsBuffer(): Array<[number, number, number]> {
  const buf: Array<[number, number, number]> = Array.from(
    { length: SAMPLE_POINTS_BASE_LEN + 3 },
    () => [0, 0, 0],
  )
  for (let i = 0; i < SAMPLE_POINTS_BASE_LEN; i++) {
    const src = BASE_BODY_SAMPLE_POINTS[i]
    buf[i][0] = src[0]
    buf[i][1] = src[1]
    buf[i][2] = src[2]
  }
  return buf
}

export function useRaycastSuspension(chassisRef: MutableRefObject<RapierRigidBody | null>) {
  const { world, rapier } = useRapier()
  const prevHitYRef = useRef([0, 0, 0, 0])
  const prevCompressionRef = useRef([0, 0, 0, 0])
  const lastGroundedYRef = useRef<number | null>(null)
  const airborneFramesRef = useRef(0)
  const lastGroundedCountRef = useRef(-1)
  const lastDebugUpdateRef = useRef(0)
  const debugWheelsRef = useRef<[WheelDebug, WheelDebug, WheelDebug, WheelDebug]>([
    { compression: 0, hitY: 0, isGrounded: false, rayOriginY: 0 },
    { compression: 0, hitY: 0, isGrounded: false, rayOriginY: 0 },
    { compression: 0, hitY: 0, isGrounded: false, rayOriginY: 0 },
    { compression: 0, hitY: 0, isGrounded: false, rayOriginY: 0 },
  ])

  const wheelsRef = useRef<WheelSuspensionData[]>([
    { hitY: 0, compression: 0, isGrounded: false, deflection: 0 },
    { hitY: 0, compression: 0, isGrounded: false, deflection: 0 },
    { hitY: 0, compression: 0, isGrounded: false, deflection: 0 },
    { hitY: 0, compression: 0, isGrounded: false, deflection: 0 },
  ])
  const wheelForcesRef = useRef<[number, number, number, number]>([0, 0, 0, 0])
  // Per-hook scratch so a future ghost-replay or multiplayer instance
  // doesn't share state with the player car (Wave 2 Phase 5).
  const samplePointsBufferRef = useRef(makeSamplePointsBuffer())

  function fillBodySamplePoints(forwardSpeed: number): number {
    const buf = samplePointsBufferRef.current
    const lookahead = getTerrainLookaheadDistance(forwardSpeed)
    if (lookahead === 0) return SAMPLE_POINTS_BASE_LEN

    const frontSign = forwardSpeed >= 0 ? 1 : -1
    const probeZ = frontSign * (WHEELBASE * 0.5 + lookahead)
    const trackGauge = frontSign >= 0 ? TRACK_GAUGE_FRONT : TRACK_GAUGE_REAR

    const a = buf[SAMPLE_POINTS_BASE_LEN]
    a[0] = 0
    a[1] = SUSPENSION.LOWER_CHASSIS_Y
    a[2] = probeZ
    const b = buf[SAMPLE_POINTS_BASE_LEN + 1]
    b[0] = -trackGauge * 0.42
    b[1] = SUSPENSION.LOWER_CHASSIS_Y
    b[2] = probeZ
    const c = buf[SAMPLE_POINTS_BASE_LEN + 2]
    c[0] = trackGauge * 0.42
    c[1] = SUSPENSION.LOWER_CHASSIS_Y
    c[2] = probeZ

    return SAMPLE_POINTS_BASE_LEN + 3
  }

  const wheelWorldPosRef = useRef<{ x: number; y: number; z: number }[]>([
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ])
  const rayOriginRef = useRef({ x: 0, y: 0, z: 0 })
  const rayDirRef = useRef({ x: 0, y: -1, z: 0 })
  const impulseVecRef = useRef({ x: 0, y: 0, z: 0 })
  const translationVecRef = useRef({ x: 0, y: 0, z: 0 })
  const linvelVecRef = useRef({ x: 0, y: 0, z: 0 })
  const reusableRayRef = useRef<InstanceType<typeof rapier.Ray> | null>(null)
  if (reusableRayRef.current === null) {
    reusableRayRef.current = new rapier.Ray(rayOriginRef.current, rayDirRef.current)
  }
  const outputRef = useRef<SuspensionOutput>({
    wheels: wheelsRef.current as SuspensionOutput['wheels'],
    anyGrounded: false,
    wheelForces: wheelForcesRef.current,
  })
  const defaultOutputRef = useRef<SuspensionOutput>({
    wheels: [DEFAULT_WHEEL, DEFAULT_WHEEL, DEFAULT_WHEEL, DEFAULT_WHEEL],
    anyGrounded: false,
    wheelForces: [0, 0, 0, 0],
  })

  function step(dt: number): SuspensionOutput {
    const chassis = chassisRef.current
    if (!chassis) {
      useSuspensionStore.getState().reset()
      lastGroundedCountRef.current = 0
      return defaultOutputRef.current
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
    const getTerrainHeightAt = useTerrainStore.getState().getHeightAt
    const linvel = chassis.linvel()
    const forwardSpeed = linvel.x * r02 + linvel.z * r22
    const bodySampleCount = fillBodySamplePoints(forwardSpeed)

    const wheels = wheelsRef.current
    const wheelForces = wheelForcesRef.current
    const wheelWorldPos = wheelWorldPosRef.current
    const ray = reusableRayRef.current!
    const rayOrigin = rayOriginRef.current
    const rayDir = rayDirRef.current
    rayDir.x = downX
    rayDir.y = downY
    rayDir.z = downZ
    let groundedCount = 0
    let anyGrounded = false

    for (let i = 0; i < 4; i++) {
      const [lx, ly, lz] = WHEEL_ANCHORS[i]

      const worldX = pos.x + r00 * lx + r01 * ly + r02 * lz
      const worldY = pos.y + r10 * lx + r11 * ly + r12 * lz
      const worldZ = pos.z + r20 * lx + r21 * ly + r22 * lz
      const wp = wheelWorldPos[i]
      wp.x = worldX
      wp.y = worldY
      wp.z = worldZ

      const rayX = worldX - downX * RAY_ORIGIN_LIFT
      const rayY = worldY - downY * RAY_ORIGIN_LIFT
      const rayZ = worldZ - downZ * RAY_ORIGIN_LIFT
      rayOrigin.x = rayX
      rayOrigin.y = rayY
      rayOrigin.z = rayZ

      const hit = world.castRay(
        ray,
        SEEK_RAY_LENGTH,
        true,
        0x08,
        SUSPENSION_RAY_GROUPS,
        undefined,
        chassis,
      )

      const terrainHeight = getTerrainHeightAt(worldX, worldZ)
      const rapierHitY = hit ? rayY + downY * hit.timeOfImpact : null
      const resolvedHitY = resolveTerrainSupportHitY(
        rayY,
        downY,
        SEEK_RAY_LENGTH,
        SUSPENSION_ENVELOPE,
        terrainHeight,
        rapierHitY,
      )

      const wheel = wheels[i]
      if (resolvedHitY !== null) {
        let hitY = resolvedHitY
        const prevHitY = prevHitYRef.current[i]
        if (prevHitY !== 0 && airborneFramesRef.current <= 10) {
          const smoothRate = 40.0
          hitY = prevHitY + (hitY - prevHitY) * Math.min(dt * smoothRate, 1)
        }
        prevHitYRef.current[i] = hitY
        const effectiveDistance = (hitY - rayY) / downY
        const distFromAnchor = effectiveDistance - RAY_ORIGIN_LIFT
        const compression = REST_LENGTH - distFromAnchor
        const withinSuspensionEnvelope = effectiveDistance <= SUSPENSION_ENVELOPE

        if (compression > 0 && withinSuspensionEnvelope) {
          groundedCount++
          anyGrounded = true
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
          wheelForces[i] = compression > 0 ? force : 0

          wheel.hitY = hitY
          wheel.compression = compression
          wheel.isGrounded = true
          wheel.deflection = compression
        } else {
          prevCompressionRef.current[i] = 0
          wheelForces[i] = 0
          wheel.hitY = hitY
          wheel.compression = 0
          wheel.isGrounded = false
          wheel.deflection = 0
        }
      } else {
        prevCompressionRef.current[i] = 0
        wheelForces[i] = 0
        wheel.hitY = worldY - SUSPENSION_ENVELOPE
        wheel.compression = 0
        wheel.isGrounded = false
        wheel.deflection = 0
      }
    }

    let maxBodyPenetration = 0
    const samplePointsBuffer = samplePointsBufferRef.current
    for (let i = 0; i < bodySampleCount; i++) {
      const sp = samplePointsBuffer[i]
      const lx = sp[0]
      const ly = sp[1]
      const lz = sp[2]
      const sampleX = pos.x + r00 * lx + r01 * ly + r02 * lz
      const sampleY = pos.y + r10 * lx + r11 * ly + r12 * lz
      const sampleZ = pos.z + r20 * lx + r21 * ly + r22 * lz
      const terrainHeight = getTerrainHeightAt(sampleX, sampleZ)
      const penetration = terrainHeight + BODY_TERRAIN_CLEARANCE - sampleY
      if (penetration > maxBodyPenetration) {
        maxBodyPenetration = penetration
      }
    }

    if (groundedCount !== lastGroundedCountRef.current) {
      useSuspensionStore.getState().setGroundedCount(groundedCount)
      lastGroundedCountRef.current = groundedCount
    }

    if (groundedCount > 0) {
      if (airborneFramesRef.current > 10) {
        for (let i = 0; i < 4; i++) {
          prevHitYRef.current[i] = 0
          prevCompressionRef.current[i] = 0
        }
      }
      airborneFramesRef.current = 0

      const impulseVec = impulseVecRef.current
      for (let i = 0; i < 4; i++) {
        if (wheelForces[i] > 0) {
          const impulseMag = wheelForces[i] * dt
          impulseVec.x = -downX * impulseMag
          impulseVec.y = -downY * impulseMag
          impulseVec.z = -downZ * impulseMag
          chassis.applyImpulseAtPoint(impulseVec, wheelWorldPos[i], true)
        }
      }

      let minY = -Infinity
      for (let i = 0; i < 4; i++) {
        const w = wheels[i]
        if (w.isGrounded && w.hitY > minY) minY = w.hitY
      }
      if (minY > -Infinity) {
        lastGroundedYRef.current = minY
        const wheelBottomY = pos.y + (WHEEL_POSITIONS.FL[1] - WHEEL_RADIUS)
        const penetration = Math.max(minY - wheelBottomY, maxBodyPenetration)
        if (penetration > 0.02) {
          const tv = translationVecRef.current
          tv.x = pos.x
          tv.y = pos.y + penetration * 0.5
          tv.z = pos.z
          chassis.setTranslation(tv, true)
          const freshLinvel = chassis.linvel()
          if (freshLinvel.y < -2) {
            const lv = linvelVecRef.current
            lv.x = freshLinvel.x
            lv.y = freshLinvel.y * 0.5
            lv.z = freshLinvel.z
            chassis.setLinvel(lv, true)
          }
        }
      }
    } else {
      airborneFramesRef.current++
      const currentGroundY = lastGroundedYRef.current
      const freshLinvel = chassis.linvel()
      const verticalAdjustment = resolveAirborneVerticalCorrection({
        currentGroundY,
        wheelBottomY: pos.y + (WHEEL_POSITIONS.FL[1] - WHEEL_RADIUS),
        maxBodyPenetration,
        verticalVelocity: freshLinvel.y,
      })

      if (verticalAdjustment > 0) {
        const tv = translationVecRef.current
        tv.x = pos.x
        tv.y = pos.y + verticalAdjustment
        tv.z = pos.z
        chassis.setTranslation(tv, true)
        const adjustedLinvel = chassis.linvel()
        if (adjustedLinvel.y < -1) {
          const lv = linvelVecRef.current
          lv.x = adjustedLinvel.x
          lv.y = adjustedLinvel.y * 0.7
          lv.z = adjustedLinvel.z
          chassis.setLinvel(lv, true)
        }
      }
    }

    const debugState = usePhysicsDebugStore.getState()
    if (debugState.enabled) {
      const now = performance.now()
      if (now - lastDebugUpdateRef.current >= DEBUG_UPDATE_INTERVAL_MS) {
        lastDebugUpdateRef.current = now
        const debugWheels = debugWheelsRef.current
        for (let i = 0; i < 4; i++) {
          const source = wheels[i]
          const target = debugWheels[i]
          target.compression = source.compression
          target.hitY = source.hitY
          target.isGrounded = source.isGrounded
          target.rayOriginY =
            pos.y +
            r10 * WHEEL_ANCHORS[i][0] +
            r11 * WHEEL_ANCHORS[i][1] +
            r12 * WHEEL_ANCHORS[i][2]
        }
        debugState.update({
          posY: pos.y,
          velY: linvel.y,
          totalForceY: wheelForces[0] + wheelForces[1] + wheelForces[2] + wheelForces[3],
          groundedCount,
          wheels: [debugWheels[0], debugWheels[1], debugWheels[2], debugWheels[3]],
        })
      }
    }

    const out = outputRef.current
    out.anyGrounded = anyGrounded
    return out
  }

  return { step }
}
