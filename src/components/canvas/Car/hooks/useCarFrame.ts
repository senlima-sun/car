import { useRef, MutableRefObject } from 'react'
import { Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import { RapierRigidBody } from '@react-three/rapier'
import { useCarStore } from '../../../../stores/useCarStore'
import { useGameStore } from '../../../../stores/useGameStore'
import { useTireStore } from '../../../../stores/useTireStore'
import { useTemperatureStore } from '../../../../stores/useTemperatureStore'
import { useCurbStore } from '../../../../stores/useCurbStore'
import { useTrackTemperatureStore } from '../../../../stores/useTrackTemperatureStore'
import { useThermalViewStore } from '../../../../stores/useThermalViewStore'
import { useHeatmapStore } from '../../../../stores/useHeatmapStore'
import { useDistanceGridStore } from '../../../../stores/useDistanceGridStore'
import { useWindStore } from '../../../../stores/useWindStore'
import { useWindViewStore } from '../../../../stores/useWindViewStore'
import { useAquaplaningStore } from '../../../../stores/useAquaplaningStore'
import { useErsStore } from '../../../../stores/useErsStore'
import { useActiveAeroStore } from '../../../../stores/useActiveAeroStore'
import { useBrakeStore } from '../../../../stores/useBrakeStore'
import { useLapTimeStore } from '../../../../stores/useLapTimeStore'
import { usePitStore } from '../../../../stores/usePitStore'

import { useControls } from '../../../../hooks/useControls'
import { type CarInput } from '../../../../wasm'
import { getLogger } from '../../../../debug/ActionLogger'
import { WHEEL_POSITIONS as DIM_WHEEL_POS, WHEEL_RADIUS as DIM_WHEEL_RADIUS } from '../../../../constants/dimensions'
import { useRaycastSuspension, type SuspensionOutput } from './useRaycastSuspension'

const WHEEL_OFFSETS: [number, number][] = [
  [DIM_WHEEL_POS.FL[0], DIM_WHEEL_POS.FL[2]],
  [DIM_WHEEL_POS.FR[0], DIM_WHEEL_POS.FR[2]],
  [DIM_WHEEL_POS.RL[0], DIM_WHEEL_POS.RL[2]],
  [DIM_WHEEL_POS.RR[0], DIM_WHEEL_POS.RR[2]],
]

// Minimum speed (km/h) to leave rubber marks
const MIN_SPEED_FOR_RUBBER = 7.2 // ~2 m/s

// Physics context value type
type PhysicsContext = ReturnType<typeof import('../../../../wasm').usePhysics>

export interface CarState {
  position: Vector3
  velocity: number
  rotation: number
}

interface UseCarFrameOptions {
  chassisRef: MutableRefObject<RapierRigidBody | null>
  physics: PhysicsContext
  windEnabled: boolean
  startPosition: [number, number, number]
}

/**
 * Hook that handles the main car physics frame loop
 * Manages input, physics stepping, and state synchronization
 */
export function useCarFrame({
  chassisRef,
  physics,
  windEnabled,
  startPosition,
}: UseCarFrameOptions) {
  // Store selectors
  const updateTelemetry = useCarStore(state => state.updateTelemetry)
  const toggleCameraMode = useGameStore(state => state.toggleCameraMode)
  const toggleFreeCamera = useGameStore(state => state.toggleFreeCamera)
  const cameraMode = useGameStore(state => state.cameraMode)
  const gameStatus = useGameStore(state => state.status)
  const isTestingMode = useGameStore(state => state.isTestingMode)

  // View toggles
  const toggleThermalView = useThermalViewStore(state => state.toggle)
  const toggleHeatmap = useHeatmapStore(state => state.toggleHeatmap)
  const toggleWindView = useWindViewStore(state => state.toggle)
  const toggleDistanceGrid = useDistanceGridStore(state => state.toggleGrid)

  // Wind sync
  const syncWindState = useWindStore(state => state.syncFromPhysics)

  // Tire/temperature sync (batched)
  const syncAllTire = useTireStore(state => state.syncAllFromWasm)
  const syncTemperature = useTemperatureStore(state => state.syncFromWasm)

  // Aquaplaning sync (batched)
  const syncAllAquaplaning = useAquaplaningStore(state => state.syncAll)

  // ERS sync (SemiAuto is default-only mode)
  const activateOvertake = useErsStore(state => state.activateOvertake)
  const cycleSemiAutoPreset = useErsStore(state => state.cycleSemiAutoPreset)
  const syncErsState = useErsStore(state => state.syncFromPhysics)

  // Active Aero mode toggle and sync
  const toggleAeroMode = useActiveAeroStore(state => state.toggleMode)
  // @ts-expect-error subscribed for reactivity, value unused
  const _aeroMode = useActiveAeroStore(state => state.mode)
  const syncAeroState = useActiveAeroStore(state => state.syncFromPhysics)

  // Brake mode sync (physics engine is source of truth)
  const syncBrakeState = useBrakeStore(state => state.syncFromPhysics)

  // Lap timer toggle
  const toggleLapRecording = useLapTimeStore(state => state.toggleRecording)

  // Pit stop
  const startPitStop = usePitStore(state => state.startPitStop)
  const checkPitLaneSpeed = usePitStore(state => state.checkPitLaneSpeed)

  // Curb state
  const isOnCurb = useCurbStore(state => state.isOnCurb)
  const curbSide = useCurbStore(state => state.curbSide)


  const updateCarPosition = useTrackTemperatureStore(state => state.updateCarPosition)

  // Controls
  const getKeys = useControls()

  // Visual state refs
  const wheelRotationsRef = useRef<[number, number, number, number]>([0, 0, 0, 0])
  const lastCameraToggle = useRef(0)
  const lastFreeCamToggle = useRef(0)
  const lastHeatmapToggle = useRef(0)
  const lastGridToggle = useRef(0)
  const lastErsPresetToggle = useRef(0)
  const lastOvertakeToggle = useRef(0)
  const lastAeroModeToggle = useRef(0)
  const lastAeroAutoToggle = useRef(0)
  const lastBrakeIncrToggle = useRef(0)
  const lastBrakeDecrToggle = useRef(0)
  const lastEngineBrakeToggle = useRef(0)
  const lastLapTimerToggle = useRef(0)
  const lastPitStopToggle = useRef(0)
  const tempCarPosRef = useRef(new Vector3())
  const prevCameraModeRef = useRef(cameraMode)

  // Spawn protection: count frames to stabilize car above ground
  const spawnFrameRef = useRef(0)
  const SPAWN_PROTECT_FRAMES = 30
  const prevGameStatusRef = useRef(gameStatus)

  // Pre-allocated arrays for rubber deposit updates (avoid GC)
  const wheelPositionsRef = useRef(new Float32Array(8))
  const wheelIntensitiesRef = useRef(new Float32Array(4))

  const prevSpeedRef = useRef(0)
  const prevGearRef = useRef(0)
  const prevDriftRef = useRef(false)
  const prevGripRef = useRef(1)
  const lastTelemetryTime = useRef(0)
  const windSyncCounter = useRef(0)

  // Raycast suspension
  const suspension = useRaycastSuspension(chassisRef)
  const suspensionOutputRef = useRef<SuspensionOutput | null>(null)
  const surfaceNormalRef = useRef<[number, number, number]>([0, 1, 0])

  // Spray effect state (ref to avoid re-renders)
  const carStateRef = useRef<CarState>({
    position: new Vector3(0, 0, 0),
    velocity: 0,
    rotation: 0,
  })

  useFrame((state, delta) => {
    if (!chassisRef.current) return

    if (prevGameStatusRef.current === 'customize' && gameStatus !== 'customize') {
      spawnFrameRef.current = 0
      chassisRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      chassisRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
    prevGameStatusRef.current = gameStatus

    const dt = Math.min(delta, 0.05)
    const {
      forward,
      backward,
      left,
      right,
      brake,
      handbrake,
      ersPreset,
      overtake,
      aero,
      aeroAuto,
      brakeIncr,
      brakeDecr,
      engineBrake,
      camera,
      heatmap,
      distanceGrid,
      freeCamera,
      lapTimer,
      pitStop,
    } = getKeys()
    const chassis = chassisRef.current

    const logger = import.meta.env.DEV ? getLogger() : null

    // Camera toggle with debounce
    if (camera && state.clock.elapsedTime - lastCameraToggle.current > 0.3) {
      toggleCameraMode()
      lastCameraToggle.current = state.clock.elapsedTime
      logger?.log('input', 'input.key.camera', 'useCarFrame', { key: 'C' }, { action: 'toggleCameraMode' })
    }

    // Temperature visualization toggle with debounce (H key) - testing mode only
    if (isTestingMode && heatmap && state.clock.elapsedTime - lastHeatmapToggle.current > 0.3) {
      toggleHeatmap()
      toggleThermalView()
      toggleWindView()
      lastHeatmapToggle.current = state.clock.elapsedTime
      logger?.log('input', 'input.key.heatmap', 'useCarFrame', { key: 'H' }, { action: 'toggleHeatmap' })
    }

    // Distance grid toggle with debounce (Option/Alt key) - testing mode only
    if (isTestingMode && distanceGrid && state.clock.elapsedTime - lastGridToggle.current > 0.3) {
      toggleDistanceGrid()
      lastGridToggle.current = state.clock.elapsedTime
      logger?.log('input', 'input.key.distanceGrid', 'useCarFrame', { key: 'Alt' }, { action: 'toggleDistanceGrid' })
    }

    // Free camera toggle with debounce (F key) - testing mode only
    if (isTestingMode && freeCamera && state.clock.elapsedTime - lastFreeCamToggle.current > 0.3) {
      toggleFreeCamera()
      lastFreeCamToggle.current = state.clock.elapsedTime
      logger?.log('input', 'input.key.freeCamera', 'useCarFrame', { key: 'F' }, { action: 'toggleFreeCamera' })
    }

    // ERS preset cycle with debounce (G key)
    if (ersPreset && state.clock.elapsedTime - lastErsPresetToggle.current > 0.3) {
      cycleSemiAutoPreset()
      const freshPreset = useErsStore.getState().semiAutoConfig.preset
      physics.setErsSemiAutoPreset(freshPreset)
      lastErsPresetToggle.current = state.clock.elapsedTime
      logger?.log('input', 'input.key.ersPreset', 'useCarFrame', { key: 'G' }, { preset: freshPreset })
    }

    // Overtake mode activation with debounce (O key) - testing mode only
    if (isTestingMode && overtake && state.clock.elapsedTime - lastOvertakeToggle.current > 0.3) {
      activateOvertake()
      lastOvertakeToggle.current = state.clock.elapsedTime
      logger?.log('input', 'input.key.overtake', 'useCarFrame', { key: 'O' }, { action: 'activateOvertake' })
    }

    // Active Aero mode toggle with debounce (K key)
    // In auto mode: switches to manual. In manual: toggles Corner/Straight.
    if (aero && state.clock.elapsedTime - lastAeroModeToggle.current > 0.3) {
      toggleAeroMode()
      lastAeroModeToggle.current = state.clock.elapsedTime
      logger?.log('input', 'input.key.aero', 'useCarFrame', { key: 'K' }, { action: 'toggleAeroMode' })
    }

    // Auto Aero toggle with debounce (E key)
    if (aeroAuto && state.clock.elapsedTime - lastAeroAutoToggle.current > 0.3) {
      physics.toggleAeroAuto()
      lastAeroAutoToggle.current = state.clock.elapsedTime
      logger?.log('input', 'input.key.aeroAuto', 'useCarFrame', { key: 'E' }, { action: 'toggleAeroAuto' })
    }

    // Brake bias increase with debounce (] key) - testing mode only
    if (isTestingMode && brakeIncr && state.clock.elapsedTime - lastBrakeIncrToggle.current > 0.3) {
      physics.increaseBrakeBias()
      lastBrakeIncrToggle.current = state.clock.elapsedTime
      logger?.log('input', 'input.key.brakeIncr', 'useCarFrame', { key: ']' }, { action: 'increaseBrakeBias' })
    }

    // Brake bias decrease with debounce ([ key) - testing mode only
    if (isTestingMode && brakeDecr && state.clock.elapsedTime - lastBrakeDecrToggle.current > 0.3) {
      physics.decreaseBrakeBias()
      lastBrakeDecrToggle.current = state.clock.elapsedTime
      logger?.log('input', 'input.key.brakeDecr', 'useCarFrame', { key: '[' }, { action: 'decreaseBrakeBias' })
    }

    // Engine braking cycle with debounce (N key) - call physics directly
    if (engineBrake && state.clock.elapsedTime - lastEngineBrakeToggle.current > 0.3) {
      physics.cycleEngineBrakingLevel()
      lastEngineBrakeToggle.current = state.clock.elapsedTime
      logger?.log('input', 'input.key.engineBrake', 'useCarFrame', { key: 'N' }, { action: 'cycleEngineBrakingLevel' })
    }

    // Lap timer toggle with debounce (L key)
    if (lapTimer && state.clock.elapsedTime - lastLapTimerToggle.current > 0.3) {
      toggleLapRecording()
      lastLapTimerToggle.current = state.clock.elapsedTime
      logger?.log('input', 'input.key.lapTimer', 'useCarFrame', { key: 'L' }, { action: 'toggleLapRecording' })
    }

    // Pit stop toggle with debounce (P key)
    if (pitStop && state.clock.elapsedTime - lastPitStopToggle.current > 0.3) {
      startPitStop()
      lastPitStopToggle.current = state.clock.elapsedTime
      logger?.log('input', 'input.key.pitStop', 'useCarFrame', { key: 'P' }, { action: 'startPitStop' })
    }

    // Skip physics when in free camera mode or customize mode (freeze car)
    if (cameraMode === 'free' || gameStatus === 'customize') {
      // Always disable gravity in free camera (handles initial-free-camera case)
      if (cameraMode === 'free') {
        chassis.setGravityScale(0, true)
        if (prevCameraModeRef.current !== 'free') {
          chassis.setLinvel({ x: 0, y: 0, z: 0 }, true)
          chassis.setAngvel({ x: 0, y: 0, z: 0 }, true)
        }
      }
      prevCameraModeRef.current = cameraMode
      return
    }

    // Restore rigid body when leaving free camera mode
    if (prevCameraModeRef.current === 'free' && cameraMode !== 'free') {
      chassis.setGravityScale(1, true)
    }
    prevCameraModeRef.current = cameraMode

    // Spawn protection: hold car above ground for initial frames while physics settles
    if (spawnFrameRef.current < SPAWN_PROTECT_FRAMES) {
      spawnFrameRef.current++
      const p = chassis.translation()
      const minY = startPosition[1]
      if (p.y < minY) {
        chassis.setTranslation({ x: p.x, y: minY, z: p.z }, true)
        chassis.setLinvel({ x: 0, y: 0, z: 0 }, true)
        chassis.setAngvel({ x: 0, y: 0, z: 0 }, true)
      }
      if (spawnFrameRef.current >= SPAWN_PROTECT_FRAMES - 1) {
        suspension.step(dt)
      }
      return
    }

    // Wind sync moved to batched stepAndSync below

    // Get current physics state from Rapier
    const pos = chassis.translation()
    const rot = chassis.rotation()
    const linvel = chassis.linvel()
    const angvel = chassis.angvel()

    // Detect and recover from invalid physics state
    const velocityIsInvalid =
      !Number.isFinite(linvel.x) || !Number.isFinite(linvel.y) || !Number.isFinite(linvel.z)
    const angVelIsInvalid =
      !Number.isFinite(angvel.x) || !Number.isFinite(angvel.y) || !Number.isFinite(angvel.z)
    const posIsInvalid =
      !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)

    if (velocityIsInvalid || angVelIsInvalid || posIsInvalid) {
      // Gradual recovery instead of hard freeze
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
      return
    }

    // Update curb state in WASM
    physics.setOnCurb(isOnCurb, curbSide || undefined)

    // Sync testing mode to ERS overtake availability
    physics.setErsOvertakeAvailable(useGameStore.getState().isTestingMode)

    // Sync ERS mode from UI to physics engine (get fresh state to avoid stale closure)
    physics.setErsMode(useErsStore.getState().mode)

    // Sync Active Aero mode to physics (only in manual mode)
    if (!useActiveAeroStore.getState().autoMode) {
      physics.setAeroMode(useActiveAeroStore.getState().mode)
    }

    // Build input for WASM physics
    const input: CarInput = {
      forward,
      backward,
      left,
      right,
      brake,
      handbrake,
    }

    // Batched WASM call: step + wind + aero + brake in one FFI round-trip
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

    // Sync wind (throttled to every 10 frames), aero, brake from batched result
    windSyncCounter.current++
    if (windEnabled && windSyncCounter.current % 10 === 0) {
      syncWindState(syncResult.wind_state)
    }
    syncAeroState(syncResult.aero_state)
    syncBrakeState(syncResult.brake_state)

    // WASM controls horizontal velocity directly (preserves Rapier gravity on Y)
    chassis.setLinvel(
      {
        x: output.linear_velocity[0],
        y: linvel.y,
        z: output.linear_velocity[2],
      },
      true,
    )

    // Raycast suspension: spring/damper impulses at wheel points
    suspensionOutputRef.current = suspension.step(dt)

    // WASM controls yaw, Rapier owns pitch/roll from contact + suspension
    const currentAngvel = chassis.angvel()
    chassis.setAngvel(
      {
        x: currentAngvel.x,
        y: output.angular_velocity[1],
        z: currentAngvel.z,
      },
      true,
    )

    // Compute surface normal from 4 wheel hit heights for next frame
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

    if (logger) {
      const speedDelta = Math.abs(output.speed_kmh - prevSpeedRef.current)
      const gearChanged = output.gear !== prevGearRef.current
      const driftChanged = output.is_drifting !== prevDriftRef.current
      const gripDelta = Math.abs(output.effective_grip - prevGripRef.current)

      if (speedDelta > 2 || gearChanged || driftChanged || gripDelta > 0.05) {
        logger.log('physics', 'physics.step.change', 'useCarFrame', {
          input: { forward, backward, left, right, brake, handbrake },
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

    // Batched tire sync (1 set() instead of 3)
    if (output.tire_wear) {
      syncAllTire(
        {
          frontLeft: output.tire_wear.front_left * 100,
          frontRight: output.tire_wear.front_right * 100,
          rearLeft: output.tire_wear.rear_left * 100,
          rearRight: output.tire_wear.rear_right * 100,
        },
        output.effective_grip,
        output.grip_breakdown ?? null,
        output.tire_material ?? null,
      )
    }

    if (output.temperature) {
      syncTemperature(output.temperature)
    }

    // Batched aquaplaning sync (1 set() instead of 2)
    if (output.aquaplaning && output.tire_thermal_shock) {
      syncAllAquaplaning(
        output.aquaplaning.is_aquaplaning,
        output.aquaplaning.intensity,
        output.aquaplaning.affected_wheels,
        output.tire_thermal_shock.is_shocked,
        output.tire_thermal_shock.grip_penalty,
        output.tire_thermal_shock.recovery_time,
      )
    }

    // Sync ERS state from WASM to UI store
    if (output.ers) {
      syncErsState(output.ers)
    }

    // Update wheel rotation (visual)
    const wheelRadius = DIM_WHEEL_RADIUS
    const wheelRotSpeed = output.speed_kmh / 3.6 / wheelRadius
    wheelRotationsRef.current = wheelRotationsRef.current.map(r => r + wheelRotSpeed * dt) as [
      number,
      number,
      number,
      number,
    ]

    const steerVal = left ? 0.3 : right ? -0.3 : 0
    const now = performance.now()
    const speedChanged = Math.abs(output.speed_kmh - prevSpeedRef.current) >= 1
    const gearChanged = output.gear !== prevGearRef.current

    // Throttle telemetry to ~10Hz (100ms), but always update steerAngle/wheelRotations for visuals
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
      // Always update visual-only fields via direct state mutation (no re-render)
      const store = useCarStore.getState()
      store.steerAngle = steerVal
      store.wheelRotations = wheelRotationsRef.current
    }

    // Update track temperature from normal driving
    if (output.speed_kmh > 3) {
      physics.updateCarDriving(pos.x, pos.z, output.speed_kmh / 3.6, dt)

      const drivingIntensity = Math.min(0.2 + (output.speed_kmh / 150) * 0.4, 0.6)
      updateCarPosition(pos.x, pos.z, dt, drivingIntensity)
    }

    // Check pit lane speed limit
    checkPitLaneSpeed(output.speed_kmh / 3.6)

    // Update track temperature visualization for skid marks
    if (output.skid_intensity > 0.01) {
      updateCarPosition(pos.x, pos.z, dt, output.skid_intensity)
    }

    // Compute yaw once for rubber deposits and spray effect
    const yaw = Math.atan2(
      2 * (rot.w * rot.y + rot.x * rot.z),
      1 - 2 * (rot.y * rot.y + rot.x * rot.x),
    )
    const cosYaw = Math.cos(yaw)
    const sinYaw = Math.sin(yaw)

    // Update rubber deposits for tire marks (per-wheel)
    if (output.speed_kmh > MIN_SPEED_FOR_RUBBER) {

      // Get physics parameters for rubber calculation
      const compoundMult = physics.getRubberDepositMultiplier()
      const trackWetness = physics.getTrackWetness(pos.x, pos.z)

      // Calculate base rubber intensity from physics output
      const slipAngleAbs = Math.abs(output.slip_angle)
      const isDrifting = output.is_drifting

      // Base intensity from slip angle
      const slipIntensity = isDrifting
        ? Math.min(slipAngleAbs / 30, 1) * 0.9 // Drifting: high intensity
        : Math.min(slipAngleAbs / 45, 0.5) // Normal: lower intensity

      // G-force contribution
      const gIntensity = Math.min(
        (Math.abs(output.lateral_g) + Math.abs(output.longitudinal_g)) / 2,
        0.6,
      )

      // Speed factor: ramps from 0 at 7.2 km/h to 1 at ~60 km/h
      const speedFactor = Math.min(Math.max((output.speed_kmh - MIN_SPEED_FOR_RUBBER) / 55, 0), 1)

      // Wetness reduces rubber transfer
      const wetnessFactor = 1 - trackWetness * 0.7

      // Braking/handbrake boosts
      const brakeBoost = brake ? 0.3 : 0
      const handbrakeBoost = handbrake ? 0.5 : 0

      // Calculate world positions and intensities for each wheel
      const wheelPositions = wheelPositionsRef.current
      const wheelIntensities = wheelIntensitiesRef.current

      for (let i = 0; i < 4; i++) {
        const [localX, localZ] = WHEEL_OFFSETS[i]

        // Rotate wheel offset by car yaw and add to car position
        wheelPositions[i * 2] = pos.x + localX * cosYaw - localZ * sinYaw
        wheelPositions[i * 2 + 1] = pos.z + localX * sinYaw + localZ * cosYaw

        // Per-wheel intensity adjustments
        const isFront = i < 2
        const isLeft = i === 0 || i === 2

        let intensity = slipIntensity + gIntensity

        // Front wheels: more rubber during braking
        if (isFront && brake) {
          intensity += brakeBoost * 1.3
        }

        // Rear wheels: more rubber during acceleration/handbrake
        if (!isFront) {
          if (forward && !brake) intensity += 0.2
          if (handbrake) intensity = Math.max(intensity, 0.7 + handbrakeBoost)
        }

        // Outer wheel loads more during cornering
        const turningLeft = output.steer_angle < -0.05
        const turningRight = output.steer_angle > 0.05
        if ((turningLeft && !isLeft) || (turningRight && isLeft)) {
          intensity *= 1 + Math.min(Math.abs(output.lateral_g) / 2, 0.5)
        }

        // Apply modifiers
        intensity *= speedFactor
        intensity *= wetnessFactor
        intensity *= compoundMult

        wheelIntensities[i] = Math.min(Math.max(intensity, 0), 1)
      }

      // Only update if any wheel has significant intensity
      if (wheelIntensities.some(v => v > 0.01)) {
        physics.updateRubberDeposits(wheelPositions, wheelIntensities, dt)
      }
    }

    carStateRef.current.position = tempCarPosRef.current.set(pos.x, pos.y, pos.z)
    carStateRef.current.velocity = output.speed_kmh / 3.6
    carStateRef.current.rotation = yaw
  })

  return { carStateRef, wheelRotations: wheelRotationsRef, suspensionOutputRef }
}
