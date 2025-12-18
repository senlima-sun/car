import { useRef, useState, MutableRefObject } from 'react'
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
import { useControls } from '../../../../hooks/useControls'
import { type CarInput } from '../../../../wasm'

// Wheel offset positions relative to car center [x, z]
// FL, FR, RL, RR
const WHEEL_OFFSETS: [number, number][] = [
  [-0.95, 1.6], // Front Left
  [0.95, 1.6], // Front Right
  [-0.95, -1.2], // Rear Left
  [0.95, -1.2], // Rear Right
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

  // Tire/temperature sync
  const syncTireWear = useTireStore(state => state.syncFromWasm)
  const syncTemperature = useTemperatureStore(state => state.syncFromWasm)

  // Aquaplaning sync
  const setAquaplaning = useAquaplaningStore(state => state.setAquaplaning)
  const setThermalShock = useAquaplaningStore(state => state.setThermalShock)

  // ERS mode cycling and sync
  const cycleErsMode = useErsStore(state => state.cycleMode)
  const ersMode = useErsStore(state => state.mode)
  const syncErsState = useErsStore(state => state.syncFromPhysics)

  // Active Aero mode toggle and sync
  const toggleAeroMode = useActiveAeroStore(state => state.toggleMode)
  const aeroMode = useActiveAeroStore(state => state.mode)
  const syncAeroState = useActiveAeroStore(state => state.syncFromPhysics)

  // Brake mode sync (physics engine is source of truth)
  const syncBrakeState = useBrakeStore(state => state.syncFromPhysics)

  // Curb state
  const isOnCurb = useCurbStore(state => state.isOnCurb)
  const curbSide = useCurbStore(state => state.curbSide)

  // Track temperature update
  const updateCarPosition = useTrackTemperatureStore(state => state.updateCarPosition)

  // Controls
  const getKeys = useControls()

  // Visual state refs
  const wheelRotationsRef = useRef<[number, number, number, number]>([0, 0, 0, 0])
  const lastCameraToggle = useRef(0)
  const lastFreeCamToggle = useRef(0)
  const lastHeatmapToggle = useRef(0)
  const lastGridToggle = useRef(0)
  const lastErsModeToggle = useRef(0)
  const lastAeroModeToggle = useRef(0)
  const lastBrakeIncrToggle = useRef(0)
  const lastBrakeDecrToggle = useRef(0)
  const lastEngineBrakeToggle = useRef(0)
  const tempCarPosRef = useRef(new Vector3())

  // Pre-allocated arrays for rubber deposit updates (avoid GC)
  const wheelPositionsRef = useRef(new Float32Array(8))
  const wheelIntensitiesRef = useRef(new Float32Array(4))

  // State for spray effect
  const [carState, setCarState] = useState<CarState>({
    position: new Vector3(0, 0, 0),
    velocity: 0,
    rotation: 0,
  })

  useFrame((state, delta) => {
    if (!chassisRef.current) return

    const dt = Math.min(delta, 0.05)
    const {
      forward,
      backward,
      left,
      right,
      brake,
      handbrake,
      ers,
      aero,
      brakeIncr,
      brakeDecr,
      engineBrake,
      camera,
      heatmap,
      distanceGrid,
      freeCamera,
    } = getKeys()
    const chassis = chassisRef.current

    // Camera toggle with debounce
    if (camera && state.clock.elapsedTime - lastCameraToggle.current > 0.3) {
      toggleCameraMode()
      lastCameraToggle.current = state.clock.elapsedTime
    }

    // Temperature visualization toggle with debounce (H key) - testing mode only
    if (isTestingMode && heatmap && state.clock.elapsedTime - lastHeatmapToggle.current > 0.3) {
      toggleHeatmap()
      toggleThermalView()
      toggleWindView()
      lastHeatmapToggle.current = state.clock.elapsedTime
    }

    // Distance grid toggle with debounce (Option/Alt key) - testing mode only
    if (isTestingMode && distanceGrid && state.clock.elapsedTime - lastGridToggle.current > 0.3) {
      toggleDistanceGrid()
      lastGridToggle.current = state.clock.elapsedTime
    }

    // Free camera toggle with debounce (F key) - testing mode only
    if (isTestingMode && freeCamera && state.clock.elapsedTime - lastFreeCamToggle.current > 0.3) {
      toggleFreeCamera()
      lastFreeCamToggle.current = state.clock.elapsedTime
    }

    // ERS mode cycle with debounce (B key)
    if (ers && state.clock.elapsedTime - lastErsModeToggle.current > 0.3) {
      cycleErsMode()
      lastErsModeToggle.current = state.clock.elapsedTime
    }

    // Active Aero mode toggle with debounce (V key)
    if (aero && state.clock.elapsedTime - lastAeroModeToggle.current > 0.3) {
      toggleAeroMode()
      lastAeroModeToggle.current = state.clock.elapsedTime
    }

    // Brake bias increase with debounce (] key) - call physics directly
    if (brakeIncr && state.clock.elapsedTime - lastBrakeIncrToggle.current > 0.3) {
      physics.increaseBrakeBias()
      lastBrakeIncrToggle.current = state.clock.elapsedTime
    }

    // Brake bias decrease with debounce ([ key) - call physics directly
    if (brakeDecr && state.clock.elapsedTime - lastBrakeDecrToggle.current > 0.3) {
      physics.decreaseBrakeBias()
      lastBrakeDecrToggle.current = state.clock.elapsedTime
    }

    // Engine braking cycle with debounce (N key) - call physics directly
    if (engineBrake && state.clock.elapsedTime - lastEngineBrakeToggle.current > 0.3) {
      physics.cycleEngineBrakingLevel()
      lastEngineBrakeToggle.current = state.clock.elapsedTime
    }

    // Skip physics when in free camera mode or customize mode (freeze car)
    if (cameraMode === 'free' || gameStatus === 'customize') return

    // Sync wind state from physics (for gust updates)
    if (windEnabled) {
      const windState = physics.getWindState()
      syncWindState(windState)
    }

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

    // Sync ERS mode from UI to physics engine (get fresh state to avoid stale closure)
    physics.setErsMode(useErsStore.getState().mode)

    // Sync Active Aero mode to physics and get current state (get fresh state to avoid stale closure)
    physics.setAeroMode(useActiveAeroStore.getState().mode)
    const aeroState = physics.getActiveAeroState()
    syncAeroState(aeroState)

    // Get brake state from physics (physics is source of truth)
    const brakeState = physics.getBrakeState()
    syncBrakeState(brakeState)

    // Build input for WASM physics
    const input: CarInput = {
      forward,
      backward,
      left,
      right,
      brake,
      handbrake,
    }

    // Run WASM physics step
    const output = physics.stepPhysics(
      dt,
      input,
      [pos.x, pos.y, pos.z],
      [rot.x, rot.y, rot.z, rot.w],
      [linvel.x, linvel.y, linvel.z],
      [angvel.x, angvel.y, angvel.z],
    )

    // Apply velocities to Rapier
    chassis.setLinvel(
      {
        x: output.linear_velocity[0],
        y: output.linear_velocity[1],
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

    // Sync tire wear from WASM to UI store
    if (output.tire_wear) {
      syncTireWear({
        frontLeft: output.tire_wear.front_left * 100,
        frontRight: output.tire_wear.front_right * 100,
        rearLeft: output.tire_wear.rear_left * 100,
        rearRight: output.tire_wear.rear_right * 100,
      })
    }

    // Sync temperature from WASM to UI store
    if (output.temperature) {
      syncTemperature(output.temperature)
    }

    // Sync aquaplaning state from WASM to UI store
    if (output.aquaplaning) {
      setAquaplaning(
        output.aquaplaning.is_aquaplaning,
        output.aquaplaning.intensity,
        output.aquaplaning.affected_wheels,
      )
    }

    // Sync thermal shock state from WASM to UI store
    if (output.tire_thermal_shock) {
      setThermalShock(
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
    const wheelRadius = 0.33
    const wheelRotSpeed = output.speed_kmh / 3.6 / wheelRadius
    wheelRotationsRef.current = wheelRotationsRef.current.map(r => r + wheelRotSpeed * dt) as [
      number,
      number,
      number,
      number,
    ]

    // Update telemetry
    updateTelemetry({
      speed: output.speed_kmh,
      gear: output.gear,
      position: [pos.x, pos.y, pos.z],
      rotation: [rot.x, rot.y, rot.z, rot.w],
      steerAngle: left ? 0.3 : right ? -0.3 : 0,
      wheelRotations: wheelRotationsRef.current,
    })

    // Update track temperature from normal driving
    if (output.speed_kmh > 3) {
      physics.updateCarDriving(pos.x, pos.z, output.speed_kmh / 3.6, dt)

      const drivingIntensity = Math.min(0.2 + (output.speed_kmh / 150) * 0.4, 0.6)
      updateCarPosition(pos.x, pos.z, dt, drivingIntensity)
    }

    // Update track temperature visualization for skid marks
    if (output.skid_intensity > 0.01) {
      updateCarPosition(pos.x, pos.z, dt, output.skid_intensity)
    }

    // Update rubber deposits for tire marks (per-wheel)
    if (output.speed_kmh > MIN_SPEED_FOR_RUBBER) {
      // Calculate car yaw for wheel position rotation
      const yawForRubber = Math.atan2(
        2 * (rot.w * rot.y + rot.x * rot.z),
        1 - 2 * (rot.y * rot.y + rot.x * rot.x),
      )
      const cosYaw = Math.cos(yawForRubber)
      const sinYaw = Math.sin(yawForRubber)

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

    // Update car state for spray effect
    const yaw = Math.atan2(
      2 * (rot.w * rot.y + rot.x * rot.z),
      1 - 2 * (rot.y * rot.y + rot.x * rot.x),
    )

    setCarState({
      position: tempCarPosRef.current.set(pos.x, pos.y, pos.z),
      velocity: output.speed_kmh / 3.6,
      rotation: yaw,
    })
  })

  return { carState, wheelRotations: wheelRotationsRef }
}
