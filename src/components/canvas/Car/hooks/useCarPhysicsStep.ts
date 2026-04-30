import { useRef, MutableRefObject } from 'react'
import { RapierRigidBody } from '@react-three/rapier'
import { useCurbStore } from '../../../../stores/useCurbStore'
import { useSessionStore } from '../../../../stores/useSessionStore'
import { useErsStore } from '../../../../stores/useErsStore'
import { useActiveAeroStore } from '../../../../stores/useActiveAeroStore'
import { type CarInput } from '../../../../wasm'
import { type SuspensionOutput } from './useRaycastSuspension'
import {
  WHEEL_POSITIONS as DIM_WHEEL_POS,
  WHEEL_RADIUS,
} from '../../../../constants/dimensions'
import type { CurbType } from '../../../../types/trackObjects'

type PhysicsContext = ReturnType<typeof import('../../../../wasm').usePhysics>

interface PhysicsStepOptions {
  chassisRef: MutableRefObject<RapierRigidBody | null>
  physics: PhysicsContext
  windEnabled: boolean
  startPosition: [number, number, number]
  suspensionStep: (dt: number) => SuspensionOutput | null
}

interface StepOptions {
  applyRapierForces?: boolean
}

export function useCarPhysicsStep({
  chassisRef,
  physics,
  windEnabled,
  startPosition,
  suspensionStep,
}: PhysicsStepOptions) {
  const getCurbState = useCurbStore.getState

  const suspensionOutputRef = useRef<SuspensionOutput | null>(null)
  const surfaceNormalRef = useRef<[number, number, number]>([0, 1, 0])
  const validationCounter = useRef(0)
  const windSyncCounter = useRef(0)
  const syncedCurbIsOnRef = useRef<boolean | null>(null)
  const syncedCurbSideRef = useRef<'left' | 'right' | null>(null)
  const syncedCurbTypeRef = useRef<CurbType | null>(null)
  const syncedErsModeRef = useRef<string | null>(null)
  const syncedAeroModeRef = useRef<string | null>(null)
  const syncedOvertakeRef = useRef<boolean | null>(null)
  const posArrRef = useRef<[number, number, number]>([0, 0, 0])
  const rotArrRef = useRef<[number, number, number, number]>([0, 0, 0, 0])
  const linvelArrRef = useRef<[number, number, number]>([0, 0, 0])
  const angvelArrRef = useRef<[number, number, number]>([0, 0, 0])
  const brakeAppliedRef = useRef(false)
  const linvelVecRef = useRef({ x: 0, y: 0, z: 0 })
  const angvelVecRef = useRef({ x: 0, y: 0, z: 0 })
  const safeLinvelRef = useRef({ x: 0, y: 0, z: 0 })
  const zeroAngvelRef = useRef({ x: 0, y: 0, z: 0 })
  const safeTranslationRef = useRef({ x: 0, y: 0, z: 0 })
  const safeRotationRef = useRef({ x: 0, y: 0, z: 0, w: 1 })
  const downforceVecRef = useRef({ x: 0, y: 0, z: 0 })

  const step = (dt: number, input: CarInput, options?: StepOptions) => {
    const chassis = chassisRef.current
    if (!chassis) return null
    const applyRapierForces = options?.applyRapierForces ?? true

    const pos = chassis.translation()
    const rot = chassis.rotation()
    const linvel = chassis.linvel()
    const angvel = chassis.angvel()

    validationCounter.current++
    const shouldValidate = validationCounter.current % 30 === 0

    const velocityIsInvalid =
      shouldValidate &&
      (!Number.isFinite(linvel.x) || !Number.isFinite(linvel.y) || !Number.isFinite(linvel.z))
    const angVelIsInvalid =
      shouldValidate &&
      (!Number.isFinite(angvel.x) || !Number.isFinite(angvel.y) || !Number.isFinite(angvel.z))
    const posIsInvalid =
      shouldValidate &&
      (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z))

    if (velocityIsInvalid || angVelIsInvalid || posIsInvalid) {
      const safeLinvel = safeLinvelRef.current
      if (velocityIsInvalid) {
        safeLinvel.x = 0
        safeLinvel.y = -1
        safeLinvel.z = 0
      } else {
        safeLinvel.x = Math.sign(linvel.x) * Math.min(Math.abs(linvel.x) * 0.5, 20)
        safeLinvel.y = linvel.y
        safeLinvel.z = Math.sign(linvel.z) * Math.min(Math.abs(linvel.z) * 0.5, 20)
      }

      chassis.setLinvel(safeLinvel, true)
      chassis.setAngvel(zeroAngvelRef.current, true)

      if (posIsInvalid) {
        const tv = safeTranslationRef.current
        tv.x = startPosition[0]
        tv.y = startPosition[1]
        tv.z = startPosition[2]
        chassis.setTranslation(tv, true)
        chassis.setRotation(safeRotationRef.current, true)
      }
      return null
    }

    const { isOnCurb, curbSide, curbType } = getCurbState()
    if (
      isOnCurb !== syncedCurbIsOnRef.current ||
      curbSide !== syncedCurbSideRef.current ||
      curbType !== syncedCurbTypeRef.current
    ) {
      physics.setOnCurb(isOnCurb, curbSide || undefined, curbType || undefined)
      syncedCurbIsOnRef.current = isOnCurb
      syncedCurbSideRef.current = curbSide
      syncedCurbTypeRef.current = curbType
    }

    const overtakeAvailable = useSessionStore.getState().config?.testingMode ?? false
    if (overtakeAvailable !== syncedOvertakeRef.current) {
      physics.setErsOvertakeAvailable(overtakeAvailable)
      syncedOvertakeRef.current = overtakeAvailable
    }

    const ersState = useErsStore.getState()
    if (ersState.mode !== syncedErsModeRef.current) {
      physics.setErsMode(ersState.mode)
      syncedErsModeRef.current = ersState.mode
    }

    const aeroState = useActiveAeroStore.getState()
    if (!aeroState.autoMode && aeroState.mode !== syncedAeroModeRef.current) {
      physics.setAeroMode(aeroState.mode)
      syncedAeroModeRef.current = aeroState.mode
    } else if (aeroState.autoMode) {
      syncedAeroModeRef.current = null
    }

    const brakeApplied = input.brake || (input.brake_analog ?? 0) > 0.05
    if (brakeApplied && !brakeAppliedRef.current) {
      physics.disableDrsOnBrake()
    }
    brakeAppliedRef.current = brakeApplied

    const posArr = posArrRef.current
    posArr[0] = pos.x; posArr[1] = pos.y; posArr[2] = pos.z
    const rotArr = rotArrRef.current
    rotArr[0] = rot.x; rotArr[1] = rot.y; rotArr[2] = rot.z; rotArr[3] = rot.w
    const linvelArr = linvelArrRef.current
    linvelArr[0] = linvel.x; linvelArr[1] = linvel.y; linvelArr[2] = linvel.z
    const angvelArr = angvelArrRef.current
    angvelArr[0] = angvel.x; angvelArr[1] = angvel.y; angvelArr[2] = angvel.z
    // 1-frame lag: suspension runs after this physics step, so we feed
    // frame N-1's per-wheel Fz. ~8.3 ms at 120Hz; reorder is Wave 2+ work.
    const rawWheelForces = suspensionOutputRef.current?.wheelForces
    const prevWheelForces =
      rawWheelForces && (!shouldValidate || rawWheelForces.every(Number.isFinite))
        ? rawWheelForces
        : undefined
    // Wave 4 Phase 7: per-axle ride heights derived from true
    // chassis-bottom-to-ground clearance. For each wheel:
    //
    //   ride_height = chassis_bottom_y - hit_y
    //               = (pos.y + WHEEL_POS_Y - WHEEL_RADIUS) - hit_y
    //               = (pos.y - WHEEL_RADIUS) - hit_y   (WHEEL_POS_Y ≈ 0)
    //
    // Replaces the Wave 3 proxy that used spring compression (which was
    // in suspension-travel units, not ground-clearance units; the proxy
    // worked at the operating point but misrepresented the curve's
    // intent at the boundaries). Same 1-frame lag — Rust EMA smooths.
    const prevWheels = suspensionOutputRef.current?.wheels
    const chassisY = pos.y
    const axleRideHeights: [number, number] | undefined = prevWheels
      ? [
          // Front axle: average of FL/FR ground clearances
          Math.max(
            0,
            chassisY -
              WHEEL_RADIUS -
              (prevWheels[0].hitY + prevWheels[1].hitY) * 0.5,
          ),
          // Rear axle: average of RL/RR ground clearances
          Math.max(
            0,
            chassisY -
              WHEEL_RADIUS -
              (prevWheels[2].hitY + prevWheels[3].hitY) * 0.5,
          ),
        ]
      : undefined
    const syncResult = physics.stepAndSync(
      dt,
      input,
      posArr,
      rotArr,
      linvelArr,
      angvelArr,
      surfaceNormalRef.current,
      prevWheelForces,
      axleRideHeights,
    )
    const output = syncResult.physics

    windSyncCounter.current++

    const lv = linvelVecRef.current
    lv.x = output.linear_velocity[0]
    lv.y = linvel.y
    lv.z = output.linear_velocity[2]
    chassis.setLinvel(lv, true)

    const av = angvelVecRef.current
    av.x = output.angular_velocity[0]
    av.y = output.angular_velocity[1]
    av.z = output.angular_velocity[2]
    chassis.setAngvel(av, true)

    const wdf = syncResult.world_downforce
    if (applyRapierForces && wdf && (wdf[0] !== 0 || wdf[1] !== 0 || wdf[2] !== 0)) {
      const dv = downforceVecRef.current
      dv.x = wdf[0] * dt
      dv.y = wdf[1] * dt
      dv.z = wdf[2] * dt
      chassis.applyImpulse(dv, true)
    }

    if (applyRapierForces) {
      suspensionOutputRef.current = suspensionStep(dt)
    }

    if (suspensionOutputRef.current) {
      const w = suspensionOutputRef.current.wheels
      const frontY = (w[0].hitY + w[1].hitY) / 2
      const rearY = (w[2].hitY + w[3].hitY) / 2
      const leftY = (w[0].hitY + w[2].hitY) / 2
      const rightY = (w[1].hitY + w[3].hitY) / 2
      const wb = DIM_WHEEL_POS.FL[2] - DIM_WHEEL_POS.RL[2]
      const tg = DIM_WHEEL_POS.FR[0] - DIM_WHEEL_POS.FL[0]
      const pitch = Math.atan2(frontY - rearY, wb)
      const roll = Math.atan2(rightY - leftY, tg)
      const nx = -Math.sin(pitch)
      const ny = Math.cos(pitch) * Math.cos(roll)
      const nz = -Math.sin(roll)
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      const n = surfaceNormalRef.current
      if (len > 0.01) {
        n[0] = nx / len; n[1] = ny / len; n[2] = nz / len
      } else {
        n[0] = 0; n[1] = 1; n[2] = 0
      }
    }

    return {
      output,
      syncResult,
      windSyncNeeded: windEnabled && windSyncCounter.current % 10 === 0,
      suspensionOutput: suspensionOutputRef.current,
    }
  }

  return { step, suspensionOutputRef, surfaceNormalRef }
}
