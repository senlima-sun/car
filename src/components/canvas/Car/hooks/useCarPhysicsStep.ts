import { useRef, MutableRefObject } from 'react'
import { RapierRigidBody } from '@react-three/rapier'
import { useCurbStore } from '../../../../stores/useCurbStore'
import { useSessionStore } from '../../../../stores/useSessionStore'
import { useErsStore } from '../../../../stores/useErsStore'
import { useActiveAeroStore } from '../../../../stores/useActiveAeroStore'
import { type CarInput } from '../../../../wasm'
import { type SuspensionOutput } from './useRaycastSuspension'
import { WHEEL_POSITIONS as DIM_WHEEL_POS } from '../../../../constants/dimensions'

type PhysicsContext = ReturnType<typeof import('../../../../wasm').usePhysics>

interface PhysicsStepOptions {
  chassisRef: MutableRefObject<RapierRigidBody | null>
  physics: PhysicsContext
  windEnabled: boolean
  startPosition: [number, number, number]
  suspensionStep: (dt: number) => SuspensionOutput | null
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

  const step = (dt: number, input: CarInput) => {
    const chassis = chassisRef.current
    if (!chassis) return null

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
      const safeLinvel = velocityIsInvalid
        ? { x: 0, y: -1, z: 0 }
        : {
            x: Math.sign(linvel.x) * Math.min(Math.abs(linvel.x) * 0.5, 20),
            y: linvel.y,
            z: Math.sign(linvel.z) * Math.min(Math.abs(linvel.z) * 0.5, 20),
          }

      chassis.setLinvel(safeLinvel, true)
      chassis.setAngvel({ x: 0, y: 0, z: 0 }, true)

      if (posIsInvalid) {
        chassis.setTranslation(
          { x: startPosition[0], y: startPosition[1], z: startPosition[2] },
          true,
        )
        chassis.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
      }
      return null
    }

    const { isOnCurb, curbSide, curbType } = getCurbState()
    physics.setOnCurb(isOnCurb, curbSide || undefined, curbType || undefined)
    physics.setErsOvertakeAvailable(useSessionStore.getState().config?.testingMode ?? false)

    const ersState = useErsStore.getState()
    physics.setErsMode(ersState.mode)

    const aeroState = useActiveAeroStore.getState()
    if (!aeroState.autoMode) {
      physics.setAeroMode(aeroState.mode)
    }

    if (input.brake || (input.brake_analog ?? 0) > 0.05) {
      physics.disableDrsOnBrake()
    }

    const syncResult = physics.stepAndSync(
      dt,
      input,
      [pos.x, pos.y, pos.z],
      [rot.x, rot.y, rot.z, rot.w],
      [linvel.x, linvel.y, linvel.z],
      [angvel.x, angvel.y, angvel.z],
      surfaceNormalRef.current,
    )
    const output = syncResult.physics

    windSyncCounter.current++

    chassis.setLinvel(
      {
        x: output.linear_velocity[0],
        y: linvel.y,
        z: output.linear_velocity[2],
      },
      true,
    )

    chassis.setAngvel(
      {
        x: output.angular_velocity[0],
        y: output.angular_velocity[1],
        z: output.angular_velocity[2],
      },
      true,
    )

    const wdf = syncResult.world_downforce
    if (wdf && (wdf[0] !== 0 || wdf[1] !== 0 || wdf[2] !== 0)) {
      chassis.applyImpulse({ x: wdf[0] * dt, y: wdf[1] * dt, z: wdf[2] * dt }, true)
    }

    suspensionOutputRef.current = suspensionStep(dt)

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
      surfaceNormalRef.current = len > 0.01 ? [nx / len, ny / len, nz / len] : [0, 1, 0]
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
