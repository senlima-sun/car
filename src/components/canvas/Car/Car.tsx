import { forwardRef, useRef, useEffect, useMemo, useState } from 'react'
import { Group, Vector3, Quaternion } from 'three'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { RigidBody, RapierRigidBody } from '@react-three/rapier'
import { useCarStore, calculateGear } from '../../../stores/useCarStore'
import { useGameStore } from '../../../stores/useGameStore'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useWeatherStore } from '../../../stores/useWeatherStore'
import { useTrackTemperatureStore } from '../../../stores/useTrackTemperatureStore'
import { useTireStore } from '../../../stores/useTireStore'
import { useCurbStore } from '../../../stores/useCurbStore'
import { MS_TO_KMH, DRIFT_CONFIG, DRS_CONFIG } from '../../../constants/physics'
import { CURB_PHYSICS } from '../../../constants/curb'
import CarBody from './CarBody'
import CarSprayEffect from './CarSprayEffect'

// ===========================================
// REALISTIC RACING CAR PHYSICS
// Inspired by GT7, Assetto Corsa, real F1 data
// ===========================================

// === VEHICLE SPECS (based on GT3/LMP style racing car) ===
const CAR_MASS = 600 // kg - light for arcade feel
const WHEELBASE = 2.7 // meters
const TRACK_WIDTH = 1.9 // meters (distance between left/right wheels)
const CG_HEIGHT = 0.35 // Center of gravity height (meters) - low for racing car
const WEIGHT_DIST_FRONT = 0.47 // 47% front weight bias (mid-engine)

// === SPEED LIMITS (BASE VALUES - modified by weather) ===
const BASE_MAX_SPEED = 310 / 3.6 // ~310 km/h = 86.1 m/s
const BASE_MAX_REVERSE_SPEED = 40 / 3.6 // 40 km/h reverse

// === ENGINE & POWER ===
// GT3 car ~550hp, we model as force curves
// Note: Peak power occurs around 180 km/h for this engine curve
const ENGINE_FORCE_LOW = 18000 // N at low speed (high torque) - punchy acceleration
const ENGINE_FORCE_MID = 12000 // N at mid speed
const ENGINE_FORCE_HIGH = 7000 // N at high speed (drag limited)

// === BRAKING (BASE VALUES - modified by weather) ===
const BASE_BRAKE_FORCE = 35000 // N - carbon ceramic brakes
const ENGINE_BRAKE = 2500 // N - engine braking when off throttle

// === AERODYNAMICS (BASE VALUES - modified by weather) ===
const BASE_DRAG_COEFFICIENT = 0.35
const FRONTAL_AREA = 2.0 // m²
const AIR_DENSITY = 1.225 // kg/m³
const BASE_DOWNFORCE_COEFFICIENT = 2.8 // High downforce setup

// === TIRE MODEL (BASE VALUES - modified by weather) ===
const BASE_TIRE_GRIP_COEFFICIENT = 1.7 // Racing slicks on dry asphalt
const OPTIMAL_SLIP_ANGLE = 8 // degrees - peak grip slip angle
const SLIP_ANGLE_FALLOFF = 0.03 // Grip reduction beyond optimal
const TIRE_LOAD_SENSITIVITY = 0.015 // Grip reduces as load increases

// === STEERING (BASE VALUES - modified by weather) ===
const BASE_MAX_STEER_ANGLE = 22 * (Math.PI / 180) // 22 degrees at low speed (reduced)
const BASE_MIN_STEER_ANGLE = 4 * (Math.PI / 180) // 4 degrees at top speed
const BASE_STEER_SPEED = 1.8 // rad/s - steering input speed (slower = less twitchy)
const STEER_RETURN_SPEED = 3.0 // rad/s - self-centering speed

// === WEIGHT TRANSFER ===
const WEIGHT_TRANSFER_LONG = 0.35 // Longitudinal weight transfer factor
const WEIGHT_TRANSFER_LAT = 0.4 // Lateral weight transfer factor

// Calculate engine force based on speed (power curve)
function getEngineForce(speedMs: number): number {
  const speedKmh = speedMs * 3.6
  if (speedKmh < 60) {
    // Low speed - maximum torque available immediately
    return ENGINE_FORCE_LOW
  }
  if (speedKmh < 150) {
    // Mid range - smooth transition
    const t = (speedKmh - 60) / 90
    return ENGINE_FORCE_LOW - t * (ENGINE_FORCE_LOW - ENGINE_FORCE_MID)
  }
  if (speedKmh < 250) {
    // High speed - power limited by drag
    const t = (speedKmh - 150) / 100
    return ENGINE_FORCE_MID - t * (ENGINE_FORCE_MID - ENGINE_FORCE_HIGH)
  }
  // Top speed - smooth continuous curve from 250 to 310 km/h
  // Starts at ENGINE_FORCE_HIGH (7000) and gradually reduces to 3500
  const remaining = Math.max(0, 1 - (speedKmh - 250) / 60)
  // Use squared falloff for smooth transition (no discontinuity at 250)
  const smoothRemaining = remaining * remaining
  return ENGINE_FORCE_HIGH * (0.5 + 0.5 * smoothRemaining)
}

// Calculate aerodynamic drag
function getDragForce(speedMs: number, dragCoeff: number): number {
  // F_drag = 0.5 * rho * Cd * A * v²
  return 0.5 * AIR_DENSITY * dragCoeff * FRONTAL_AREA * speedMs * speedMs
}

// Calculate downforce (increases grip at speed)
function getDownforce(speedMs: number, downforceCoeff: number): number {
  // F_downforce = 0.5 * rho * Cl * A * v²
  return 0.5 * AIR_DENSITY * downforceCoeff * FRONTAL_AREA * speedMs * speedMs
}

// Tire grip model - returns grip coefficient
// This is for LATERAL grip during cornering, not longitudinal traction
function getTireGrip(slipAngleDeg: number, normalLoad: number, gripCoeff: number): number {
  // Base grip is always available for acceleration/braking
  // Slip angle only affects cornering performance
  const absSlip = Math.abs(slipAngleDeg)

  // Pacejka-inspired curve for lateral grip efficiency
  let lateralEfficiency: number
  if (absSlip < OPTIMAL_SLIP_ANGLE) {
    // Building lateral grip - but always have base traction
    lateralEfficiency = 0.7 + 0.3 * (absSlip / OPTIMAL_SLIP_ANGLE)
  } else {
    // Past peak - gradual falloff
    const excess = absSlip - OPTIMAL_SLIP_ANGLE
    lateralEfficiency = 1 - excess * SLIP_ANGLE_FALLOFF
    lateralEfficiency = Math.max(0.5, lateralEfficiency)
  }

  // Load sensitivity - heavier load = slightly less grip per kg
  const loadFactor = 1 - ((normalLoad - CAR_MASS * 9.81 * 0.25) * TIRE_LOAD_SENSITIVITY) / 10000

  return gripCoeff * lateralEfficiency * Math.max(0.7, loadFactor)
}

// Calculate steering angle based on speed
function getMaxSteerAngle(speedKmh: number, maxAngle: number, minAngle: number): number {
  if (speedKmh < 40) return maxAngle
  if (speedKmh < 120) {
    // Smooth reduction 40-120 km/h
    const t = (speedKmh - 40) / 80
    const eased = t * t * (3 - 2 * t) // Smoothstep
    return maxAngle - eased * (maxAngle - maxAngle * 0.5)
  }
  if (speedKmh < 220) {
    // Further reduction 120-220 km/h
    const t = (speedKmh - 120) / 100
    const eased = t * t * (3 - 2 * t)
    return maxAngle * 0.5 - eased * (maxAngle * 0.5 - minAngle)
  }
  // Above 220 - minimal steering for stability
  return minAngle
}

// Calculate turn radius and angular velocity
function calculateTurnDynamics(
  speedMs: number,
  steerAngle: number,
  gripFactor: number,
  isDrifting: boolean,
): number {
  // More robust threshold check to prevent near-zero division
  if (Math.abs(steerAngle) < 0.005 || Math.abs(speedMs) < 0.3) return 0

  const tanSteer = Math.tan(Math.abs(steerAngle))

  // Guard against near-zero tan values that would cause huge turn radius
  if (Math.abs(tanSteer) < 0.001) return 0

  // Ackermann steering geometry
  const turnRadius = WHEELBASE / tanSteer

  // Guard against unreasonably large turn radius
  if (turnRadius > 1000) return 0

  // Base angular velocity from geometry
  let angularVel = speedMs / turnRadius

  // Validate result is finite
  if (!Number.isFinite(angularVel)) return 0

  // Grip affects how much of the theoretical turn rate is achieved
  // Low grip = understeer (less turn than expected)
  // During drift, allow more rotation
  const gripInfluence = isDrifting ? 0.5 + 0.35 * gripFactor : 0.4 + 0.25 * gripFactor
  angularVel *= gripInfluence

  // Cap angular velocity - higher during drift for aggressive rotation
  const maxAngVel = isDrifting
    ? DRIFT_CONFIG.driftMaxAngularVelocity
    : DRIFT_CONFIG.normalMaxAngularVelocity
  angularVel = Math.min(Math.abs(angularVel), maxAngVel)

  return angularVel * Math.sign(steerAngle) * Math.sign(speedMs)
}

// Smooth interpolation helper
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Sanitize number to prevent NaN/Infinity from corrupting physics
function sanitizeNumber(value: number, fallback: number = 0): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return value
}

const Car = forwardRef<Group>((_, ref) => {
  const chassisRef = useRef<RapierRigidBody>(null)
  const groupRef = useRef<Group>(null)
  const updateTelemetry = useCarStore(state => state.updateTelemetry)
  const toggleCameraMode = useGameStore(state => state.toggleCameraMode)
  const placedObjects = useCustomizationStore(state => state.placedObjects)

  // Weather system
  const weatherModifiers = useWeatherStore(state => state.currentModifiers)
  const updateWeatherTransition = useWeatherStore(state => state.updateTransition)
  const currentWeather = useWeatherStore(state => state.currentWeather)

  // Tire system
  const tireGripMultiplier = useTireStore(state => state.effectiveGripMultiplier)
  const updateTireWear = useTireStore(state => state.updateWear)
  const updateTireWeather = useTireStore(state => state.updateWeather)

  // Curb system
  const isOnCurb = useCurbStore(state => state.isOnCurb)
  const curbModifiers = useCurbStore(state => state.currentModifiers)

  // Track temperature system
  const updateCarPosition = useTrackTemperatureStore(state => state.updateCarPosition)

  // State for spray effect (position, velocity, rotation)
  const [carState, setCarState] = useState({
    position: new Vector3(0, 0, 0),
    velocity: 0,
    rotation: 0,
  })

  // Auto-calculate start position from checkpoint (5 units behind, facing toward it)
  const { startPosition, startRotation } = useMemo(() => {
    const checkpoint = placedObjects.find(obj => obj.type === 'checkpoint')
    if (checkpoint && checkpoint.startPoint && checkpoint.endPoint) {
      // Checkpoint direction (along the line from start to end)
      const dx = checkpoint.endPoint[0] - checkpoint.startPoint[0]
      const dz = checkpoint.endPoint[2] - checkpoint.startPoint[2]
      // Perpendicular direction (the way checkpoint faces - one of two directions)
      const perpX = -dz
      const perpZ = dx
      const len = Math.sqrt(perpX * perpX + perpZ * perpZ)
      if (len > 0) {
        const normX = perpX / len
        const normZ = perpZ / len

        // Position 5 units behind checkpoint (opposite to checkpoint's facing direction)
        const spawnX = checkpoint.position[0] - normX * 5
        const spawnZ = checkpoint.position[2] - normZ * 5

        // Rotation to face the checkpoint (toward the perpendicular direction)
        const rotation = Math.atan2(normX, normZ)

        return {
          startPosition: [spawnX, 1, spawnZ] as [number, number, number],
          startRotation: [0, rotation, 0] as [number, number, number],
        }
      }
    }
    // Default fallback
    return {
      startPosition: [0, 1, 0] as [number, number, number],
      startRotation: [0, 0, 0] as [number, number, number],
    }
  }, [placedObjects])

  const [, getKeys] = useKeyboardControls()

  // Physics state refs
  const currentSteerRef = useRef(0)
  const wheelRotationsRef = useRef<[number, number, number, number]>([0, 0, 0, 0])
  const lastCameraToggle = useRef(0)
  const smoothedSpeedRef = useRef(0) // For smoother physics calculations
  const lateralGRef = useRef(0) // Track lateral G for weight transfer
  const longitudinalGRef = useRef(0) // Track longitudinal G
  const isDriftingRef = useRef(false) // Drift state tracking
  const smoothedVelocityRef = useRef(new Vector3()) // Smoothed velocity output
  const smoothedAngVelRef = useRef(0) // Smoothed angular velocity
  const smoothedSlipAngleRef = useRef(0) // Smoothed slip angle

  // Pre-allocated vectors to avoid GC pressure (reused every frame)
  const tempVelocityRef = useRef(new Vector3())
  const tempQuatRef = useRef(new Quaternion())
  const tempForwardDirRef = useRef(new Vector3())
  const tempRightDirRef = useRef(new Vector3())
  const tempTargetVelRef = useRef(new Vector3())
  const tempLateralVelRef = useRef(new Vector3())
  const tempCarPosRef = useRef(new Vector3())

  useFrame((state, delta) => {
    if (!chassisRef.current || !groupRef.current) return

    // Clamp delta to prevent physics explosions on lag spikes
    const dt = Math.min(delta, 0.05)

    // Update weather transition
    updateWeatherTransition(dt)

    // Sync tire store with current weather
    updateTireWeather(currentWeather)

    // Calculate weather-modified physics values
    // Apply both weather modifier and tire compound modifier
    // Also apply curb grip modifier when on curb
    const curbGripBonus = isOnCurb ? curbModifiers.gripMultiplier : 1.0
    const TIRE_GRIP_COEFFICIENT =
      BASE_TIRE_GRIP_COEFFICIENT * weatherModifiers.frictionSlipMultiplier * tireGripMultiplier * curbGripBonus
    const DRAG_COEFFICIENT = BASE_DRAG_COEFFICIENT * weatherModifiers.dragMultiplier
    const DOWNFORCE_COEFFICIENT = BASE_DOWNFORCE_COEFFICIENT * weatherModifiers.downforceMultiplier
    const BRAKE_FORCE = BASE_BRAKE_FORCE * weatherModifiers.brakeEfficiencyMultiplier
    const MAX_SPEED = BASE_MAX_SPEED * weatherModifiers.maxSpeedMultiplier
    const MAX_REVERSE_SPEED = BASE_MAX_REVERSE_SPEED * weatherModifiers.maxSpeedMultiplier
    const MAX_STEER_ANGLE = BASE_MAX_STEER_ANGLE * weatherModifiers.maxSteerAngleMultiplier
    const MIN_STEER_ANGLE = BASE_MIN_STEER_ANGLE * weatherModifiers.maxSteerAngleMultiplier
    const STEER_SPEED = BASE_STEER_SPEED * weatherModifiers.steerResponseMultiplier

    const { forward, backward, left, right, brake, handbrake, drs, camera } = getKeys()
    const chassis = chassisRef.current

    // Camera toggle with debounce
    if (camera && state.clock.elapsedTime - lastCameraToggle.current > 0.3) {
      toggleCameraMode()
      lastCameraToggle.current = state.clock.elapsedTime
    }

    // Get current physics state
    const pos = chassis.translation()
    const rot = chassis.rotation()
    const linvel = chassis.linvel()
    const angvel = chassis.angvel()

    // RECOVERY: Detect and recover from invalid physics state (NaN corruption)
    const velocityIsInvalid =
      !Number.isFinite(linvel.x) || !Number.isFinite(linvel.y) || !Number.isFinite(linvel.z)
    const angVelIsInvalid =
      !Number.isFinite(angvel.x) || !Number.isFinite(angvel.y) || !Number.isFinite(angvel.z)
    const posIsInvalid =
      !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)

    if (velocityIsInvalid || angVelIsInvalid || posIsInvalid) {
      // Reset to safe state
      chassis.setLinvel({ x: 0, y: 0, z: 0 }, true)
      chassis.setAngvel({ x: 0, y: 0, z: 0 }, true)

      // Reset internal refs
      smoothedSpeedRef.current = 0
      smoothedVelocityRef.current.set(0, 0, 0)
      smoothedAngVelRef.current = 0
      smoothedSlipAngleRef.current = 0
      lateralGRef.current = 0
      longitudinalGRef.current = 0
      isDriftingRef.current = false

      // If position is also invalid, teleport to start
      if (posIsInvalid) {
        chassis.setTranslation(
          { x: startPosition[0], y: startPosition[1], z: startPosition[2] },
          true,
        )
        chassis.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
      }

      return // Skip this frame
    }

    // Calculate velocity components (using pre-allocated refs)
    const velocity = tempVelocityRef.current.set(linvel.x, linvel.y, linvel.z)
    const quat = tempQuatRef.current.set(rot.x, rot.y, rot.z, rot.w)
    const forwardDir = tempForwardDirRef.current.set(0, 0, 1).applyQuaternion(quat)
    const rightDir = tempRightDirRef.current.set(1, 0, 0).applyQuaternion(quat)

    // Forward speed (positive = forward, negative = reverse)
    const currentSpeed = velocity.dot(forwardDir)
    const absSpeed = Math.abs(currentSpeed)
    const speedKmh = absSpeed * 3.6

    // Lateral speed (for slip angle calculation)
    const lateralSpeed = velocity.dot(rightDir)

    // Smooth speed for physics calculations (prevents jitter)
    smoothedSpeedRef.current = lerp(smoothedSpeedRef.current, absSpeed, dt * 10)

    // ===========================================
    // AERODYNAMICS
    // ===========================================
    // DRS activation check - only above activation speed
    const drsActive = drs && speedKmh >= DRS_CONFIG.activationSpeed

    // Apply DRS modifiers to drag and downforce
    let dragForce = getDragForce(absSpeed, DRAG_COEFFICIENT)
    let downforce = getDownforce(absSpeed, DOWNFORCE_COEFFICIENT)

    if (drsActive) {
      dragForce *= DRS_CONFIG.dragMultiplier // Reduce drag significantly
      downforce *= DRS_CONFIG.downforceMultiplier // Reduce downforce (trade grip for speed)
    }

    // Total vertical load on tires (weight + downforce)
    const baseWeight = CAR_MASS * 9.81
    const totalLoad = baseWeight + downforce

    // ===========================================
    // WEIGHT TRANSFER
    // ===========================================
    // Longitudinal weight transfer (front/rear) during accel/brake
    const longG = longitudinalGRef.current
    const longTransfer = ((longG * CAR_MASS * CG_HEIGHT) / WHEELBASE) * WEIGHT_TRANSFER_LONG

    // Lateral weight transfer (left/right) during cornering
    const latG = lateralGRef.current
    const latTransfer =
      ((Math.abs(latG) * CAR_MASS * CG_HEIGHT) / TRACK_WIDTH) * WEIGHT_TRANSFER_LAT

    // Calculate load on each axle
    const frontBaseLoad = totalLoad * WEIGHT_DIST_FRONT
    const rearBaseLoad = totalLoad * (1 - WEIGHT_DIST_FRONT)

    // Braking shifts weight forward, acceleration shifts it backward
    const frontLoad = frontBaseLoad + longTransfer
    const rearLoad = rearBaseLoad - longTransfer

    // ===========================================
    // STEERING
    // ===========================================
    const maxSteer = getMaxSteerAngle(speedKmh, MAX_STEER_ANGLE, MIN_STEER_ANGLE)

    // Progressive steering input with smooth ramping
    if (left) {
      const steerDelta = STEER_SPEED * dt
      currentSteerRef.current = Math.min(currentSteerRef.current + steerDelta, maxSteer)
    } else if (right) {
      const steerDelta = STEER_SPEED * dt
      currentSteerRef.current = Math.max(currentSteerRef.current - steerDelta, -maxSteer)
    } else {
      // Self-centering - stronger at higher speeds (pneumatic trail effect)
      const centeringStrength = STEER_RETURN_SPEED * (1 + speedKmh / 100)
      const centeringDelta = centeringStrength * dt

      if (Math.abs(currentSteerRef.current) < centeringDelta) {
        currentSteerRef.current = 0
      } else {
        currentSteerRef.current -= Math.sign(currentSteerRef.current) * centeringDelta
      }
    }

    // Clamp to speed-dependent max
    currentSteerRef.current = Math.max(-maxSteer, Math.min(maxSteer, currentSteerRef.current))

    // ===========================================
    // TIRE PHYSICS & SLIP
    // ===========================================
    // Calculate slip angle (angle between car direction and velocity)
    let rawSlipAngle = 0
    if (absSpeed > 0.5) {
      rawSlipAngle = Math.atan2(lateralSpeed, absSpeed) * (180 / Math.PI)
    }
    // Light slip angle smoothing - responsive but stable
    smoothedSlipAngleRef.current = lerp(
      smoothedSlipAngleRef.current,
      rawSlipAngle,
      Math.min(1, dt * 25),
    )
    const slipAngle = smoothedSlipAngleRef.current

    // Separate front and rear grip calculations
    const frontGripCoefficient = getTireGrip(slipAngle, frontLoad, TIRE_GRIP_COEFFICIENT)
    let rearGripCoefficient = getTireGrip(slipAngle, rearLoad, TIRE_GRIP_COEFFICIENT)

    // === HANDBRAKE EFFECT ===
    // Handbrake drastically reduces rear grip to initiate drift
    if (handbrake && speedKmh > DRIFT_CONFIG.minDriftSpeed) {
      rearGripCoefficient *= DRIFT_CONFIG.handbrakeRearGripMultiplier
    }

    // === THROTTLE OVERSTEER ===
    // High throttle during turning breaks rear traction (power oversteer)
    const isTurning = Math.abs(currentSteerRef.current) > 0.05
    if (forward && isTurning && speedKmh > DRIFT_CONFIG.minDriftSpeed) {
      const throttleOversteer = 1 - DRIFT_CONFIG.throttleOversteerFactor
      rearGripCoefficient *= throttleOversteer
    }

    // Combined grip (weighted average favoring rear for oversteer behavior)
    const gripCoefficient = frontGripCoefficient * 0.4 + rearGripCoefficient * 0.6

    // Lateral weight transfer reduces overall grip slightly
    // (loaded outer tires gain less than unloaded inner tires lose)
    const latTransferPenalty = 1 - (latTransfer / baseWeight) * 0.15

    // Effective grip is boosted by downforce
    const downforceBonus = 1 + (downforce / baseWeight) * 0.3
    const effectiveGrip = sanitizeNumber(gripCoefficient * downforceBonus * latTransferPenalty, 1.0)

    // === DRIFT STATE MACHINE ===
    // Weather affects drift thresholds (slippery = easier to drift)
    const driftEntryAngle =
      DRIFT_CONFIG.driftEntrySlipAngle * weatherModifiers.driftEntrySlipAngleMultiplier
    const driftExitAngle =
      DRIFT_CONFIG.driftExitSlipAngle * weatherModifiers.driftEntrySlipAngleMultiplier

    const absSlipAngle = Math.abs(slipAngle)
    if (
      !isDriftingRef.current &&
      absSlipAngle > driftEntryAngle &&
      speedKmh > DRIFT_CONFIG.minDriftSpeed
    ) {
      isDriftingRef.current = true
    } else if (isDriftingRef.current && absSlipAngle < driftExitAngle) {
      isDriftingRef.current = false
    }

    // ===========================================
    // LONGITUDINAL FORCES (ACCEL/BRAKE/DRAG)
    // ===========================================
    let longitudinalForce = 0

    if (forward && currentSpeed < MAX_SPEED) {
      // Throttle - engine force minus drag
      let engineForce = getEngineForce(absSpeed)

      // === DRS ENGINE BOOST ===
      // Extra power in the 200-300 km/h range when DRS active
      if (drsActive && speedKmh >= DRS_CONFIG.boostStartSpeed) {
        const boostRange = DRS_CONFIG.boostEndSpeed - DRS_CONFIG.boostStartSpeed
        const boostProgress = Math.min(1, (speedKmh - DRS_CONFIG.boostStartSpeed) / boostRange)
        // Scale boost: more boost needed at higher speeds to overcome remaining drag
        const drsBoost = lerp(DRS_CONFIG.engineBoostLow, DRS_CONFIG.engineBoostHigh, boostProgress)
        engineForce += drsBoost
      }

      // Simplified traction - always allow good acceleration, even in turns
      // Only slightly reduce power when cornering hard
      const corneringPenalty = Math.max(0.7, 1 - Math.abs(currentSteerRef.current) * 0.5)
      const effectiveForce = engineForce * corneringPenalty

      longitudinalForce = effectiveForce - dragForce
    } else if (backward) {
      if (currentSpeed > 0.3) {
        // Braking when moving forward - strong consistent brakes
        longitudinalForce = -BRAKE_FORCE
      } else if (currentSpeed > -MAX_REVERSE_SPEED) {
        // Reversing - decent power for responsive feel
        longitudinalForce = -getEngineForce(0) * 0.5
      }
    } else {
      // Coasting - engine braking + drag
      if (absSpeed > 0.5) {
        longitudinalForce = -ENGINE_BRAKE - dragForce
        if (currentSpeed < 0) longitudinalForce = -longitudinalForce
      }
    }

    // Handbrake - strong braking
    if (brake && absSpeed > 0.3) {
      longitudinalForce = -BRAKE_FORCE * 1.2 * Math.sign(currentSpeed)
    }

    // === CURB SPEED REDUCTION ===
    // Apply light drag when on curb (5-10% speed reduction)
    if (isOnCurb && absSpeed > CURB_PHYSICS.minSpeedForEffect) {
      // Apply additional drag force proportional to speed
      const curbDrag = absSpeed * CAR_MASS * (1 - curbModifiers.speedMultiplier) * 0.5
      longitudinalForce -= curbDrag * Math.sign(currentSpeed)
    }

    // Calculate acceleration (F = ma)
    const longitudinalAccel = longitudinalForce / CAR_MASS

    // Update speed
    let newSpeed = currentSpeed + longitudinalAccel * dt

    // Speed limits
    newSpeed = Math.max(-MAX_REVERSE_SPEED, Math.min(MAX_SPEED, newSpeed))

    // Sanitize to prevent NaN propagation
    newSpeed = sanitizeNumber(newSpeed, currentSpeed)

    // Very low speed handling
    if (Math.abs(newSpeed) < 0.1 && !forward && !backward) {
      newSpeed = 0
    }

    // Stuck detection: prevent calculated speed from running away when car is stuck
    const actualSpeed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z)
    const speedDiscrepancy = Math.abs(newSpeed) - actualSpeed
    if (speedDiscrepancy > 10 && actualSpeed < 2) {
      // Car is stuck - blend toward actual speed to prevent runaway calculations
      newSpeed = lerp(newSpeed, actualSpeed * Math.sign(newSpeed), dt * 5)
    }

    // Update longitudinal G tracking
    longitudinalGRef.current = lerp(longitudinalGRef.current, longitudinalAccel / 9.81, dt * 8)

    // ===========================================
    // LATERAL FORCES (CORNERING)
    // ===========================================
    // Calculate target angular velocity from steering geometry
    let targetAngVel = 0
    if (absSpeed > 0.3) {
      targetAngVel = calculateTurnDynamics(
        currentSpeed,
        currentSteerRef.current,
        effectiveGrip,
        isDriftingRef.current,
      )
    }

    // === DRIFT ROTATION BOOST ===
    // During drift, add extra rotation based on slip angle and handbrake
    if (isDriftingRef.current || handbrake) {
      // Add rotational momentum from the slide itself
      const slideRotation = slipAngle * 0.015 // Convert slip to rotation
      targetAngVel += slideRotation
    }

    // Smooth angular velocity - fast response with slight smoothing
    const angVelSmoothing = isDriftingRef.current ? 25 : 18 // Higher = faster response
    smoothedAngVelRef.current = lerp(
      smoothedAngVelRef.current,
      targetAngVel,
      Math.min(1, dt * angVelSmoothing),
    )

    // Apply to physics with minimal additional smoothing
    const newAngVelY = lerp(angvel.y, smoothedAngVelRef.current, Math.min(1, dt * 30))

    // Dampen other rotations (roll/pitch stability)
    // Sanitize and cap angular velocity to prevent NaN corruption
    const safeAngVelX = sanitizeNumber(angvel.x * 0.85, 0)
    const safeAngVelY = sanitizeNumber(newAngVelY, 0)
    const safeAngVelZ = sanitizeNumber(angvel.z * 0.85, 0)
    const MAX_ANG_VEL = 5 // rad/s - reasonable cap
    const clampedAngVelY = Math.max(-MAX_ANG_VEL, Math.min(MAX_ANG_VEL, safeAngVelY))

    chassis.setAngvel(
      {
        x: safeAngVelX,
        y: clampedAngVelY,
        z: safeAngVelZ,
      },
      true,
    )

    // Calculate lateral G from angular velocity and speed
    const centrifugalAccel = Math.abs(newAngVelY) * absSpeed
    lateralGRef.current = lerp(lateralGRef.current, centrifugalAccel / 9.81, dt * 8)

    // ===========================================
    // LATERAL GRIP (TIRE SLIDING)
    // ===========================================
    // How much lateral velocity is maintained vs. corrected
    // Higher grip = more correction, lower = more slide

    // Use drift-aware lateral correction (weather affects slide behavior)
    let lateralCorrection: number
    if (isDriftingRef.current || handbrake) {
      // During drift: much less lateral correction = slides persist
      // Weather makes this even slipperier
      lateralCorrection =
        DRIFT_CONFIG.driftLateralCorrection * weatherModifiers.driftLateralCorrectionMultiplier
    } else {
      // Normal driving: high correction = grippy
      // Weather reduces lateral correction (more slide)
      const baseCorrection = Math.min(
        DRIFT_CONFIG.normalLateralCorrection,
        0.88 + effectiveGrip * 0.05,
      )
      lateralCorrection = baseCorrection * weatherModifiers.driftLateralCorrectionMultiplier
    }

    // === CURB LATERAL STABILITY ===
    // Increase lateral correction when on curb (more grip, less sliding)
    if (isOnCurb) {
      lateralCorrection = Math.min(1.0, lateralCorrection * curbModifiers.lateralStability)
    }

    // Sanitize to prevent NaN propagation
    lateralCorrection = sanitizeNumber(lateralCorrection, 0.9)

    // Build final velocity (using pre-allocated refs)
    const targetVel = tempTargetVelRef.current.copy(forwardDir).multiplyScalar(newSpeed)
    const remainingLateral = tempLateralVelRef.current
      .copy(rightDir)
      .multiplyScalar(lateralSpeed * (1 - lateralCorrection))
    const rawFinalVel = targetVel.add(remainingLateral)

    // Sanitize and cap velocity to prevent NaN corruption
    const MAX_VELOCITY = 100 // ~360 km/h - reasonable max
    const safeVelX = sanitizeNumber(rawFinalVel.x, linvel.x)
    const safeVelZ = sanitizeNumber(rawFinalVel.z, linvel.z)
    const clampedVelX = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, safeVelX))
    const clampedVelZ = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, safeVelZ))

    // Minimal velocity smoothing - only at very low speeds to prevent jitter
    // At higher speeds, use direct velocity for responsive feel
    const speedThreshold = 5 // m/s
    if (absSpeed < speedThreshold) {
      const velSmoothing = Math.min(1, dt * 30)
      smoothedVelocityRef.current.x = lerp(smoothedVelocityRef.current.x, clampedVelX, velSmoothing)
      smoothedVelocityRef.current.z = lerp(smoothedVelocityRef.current.z, clampedVelZ, velSmoothing)
      chassis.setLinvel(
        {
          x: smoothedVelocityRef.current.x,
          y: linvel.y,
          z: smoothedVelocityRef.current.z,
        },
        true,
      )
    } else {
      // Direct velocity at speed - more responsive
      smoothedVelocityRef.current.x = clampedVelX
      smoothedVelocityRef.current.z = clampedVelZ
      chassis.setLinvel(
        {
          x: clampedVelX,
          y: linvel.y,
          z: clampedVelZ,
        },
        true,
      )
    }

    // ===========================================
    // WHEEL ROTATION (VISUAL)
    // ===========================================
    const wheelRadius = 0.33 // meters
    const wheelRotSpeed = newSpeed / wheelRadius

    wheelRotationsRef.current = wheelRotationsRef.current.map(r => r + wheelRotSpeed * dt) as [
      number,
      number,
      number,
      number,
    ]

    // ===========================================
    // TELEMETRY UPDATE
    // ===========================================
    // Use actual velocity magnitude for accurate speedometer display
    const actualVelocityMagnitude = Math.sqrt(clampedVelX * clampedVelX + clampedVelZ * clampedVelZ)
    const telemetrySpeedKmh = actualVelocityMagnitude * MS_TO_KMH
    const gear = calculateGear(telemetrySpeedKmh)

    updateTelemetry({
      speed: telemetrySpeedKmh,
      gear: currentSpeed < -0.5 ? -1 : gear, // Use actual velocity for reverse detection
      position: [pos.x, pos.y, pos.z],
      rotation: [rot.x, rot.y, rot.z, rot.w],
      steerAngle: currentSteerRef.current,
      wheelRotations: wheelRotationsRef.current,
    })

    // ===========================================
    // TIRE WEAR UPDATE
    // ===========================================
    // Update tire wear based on speed and driving style
    updateTireWear(dt, absSpeed, isDriftingRef.current)

    // ===========================================
    // TRACK TEMPERATURE UPDATE (SKID MARKS)
    // ===========================================
    // Calculate skid intensity based on slip angle, lateral G, and drift state
    const slipThreshold = 3 // Start showing traces above 3 degrees slip
    const driftThreshold = 12 // Full intensity at 12+ degrees

    let skidIntensity = 0

    // Method 1: Slip angle based (tire sliding)
    if (absSlipAngle > slipThreshold && absSpeed > 3) {
      skidIntensity = Math.min(1, (absSlipAngle - slipThreshold) / (driftThreshold - slipThreshold))
    }

    // Method 2: Lateral G based (hard cornering at speed)
    // High lateral speed at high forward speed = hard cornering
    const lateralG = Math.abs(lateralSpeed) / 9.81 // Convert to G-force approximation
    const steeringIntensity = Math.abs(currentSteerRef.current) / 0.4 // Normalized steering (max ~0.4 rad)

    if (absSpeed > 15 && steeringIntensity > 0.3) {
      // Hard turn at speed - show traces even without full drift
      const turnIntensity = Math.min(1, steeringIntensity * (absSpeed / 30))
      skidIntensity = Math.max(skidIntensity, turnIntensity * 0.6)
    }

    // High lateral G always shows traces
    if (lateralG > 0.3 && absSpeed > 10) {
      const gIntensity = Math.min(1, (lateralG - 0.3) / 0.7)
      skidIntensity = Math.max(skidIntensity, gIntensity * 0.8)
    }

    // Boost intensity during active drift
    if (isDriftingRef.current) {
      skidIntensity = Math.max(skidIntensity, 0.9)
    }

    // Update track with skid intensity
    updateCarPosition(pos.x, pos.z, dt, skidIntensity)

    // Update car state for spray effect
    // Get yaw rotation from quaternion
    const yaw = Math.atan2(
      2 * (rot.w * rot.y + rot.x * rot.z),
      1 - 2 * (rot.y * rot.y + rot.x * rot.x),
    )

    setCarState({
      position: tempCarPosRef.current.set(pos.x, pos.y, pos.z),
      velocity: absSpeed,
      rotation: yaw,
    })
  })

  useEffect(() => {
    if (ref && typeof ref === 'object' && groupRef.current) {
      ref.current = groupRef.current
    }
  }, [ref])

  return (
    <>
      <RigidBody
        ref={chassisRef}
        position={startPosition}
        rotation={startRotation}
        colliders='cuboid'
        mass={600}
        linearDamping={0.01}
        angularDamping={0.6}
        type='dynamic'
        canSleep={false}
        enabledRotations={[false, true, false]} // Only yaw rotation
        ccd={true}
      >
        <group ref={groupRef}>
          <CarBody />
        </group>
      </RigidBody>

      {/* Spray effect for rain/cold weather */}
      <CarSprayEffect
        carPosition={carState.position}
        carVelocity={carState.velocity}
        carRotation={carState.rotation}
      />
    </>
  )
})

Car.displayName = 'Car'
export default Car
