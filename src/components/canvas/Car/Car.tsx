import { forwardRef, useRef, useEffect, useMemo, useState } from 'react'
import { Group, Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import { useControls } from '../../../hooks/useControls'
import { RigidBody, RapierRigidBody } from '@react-three/rapier'
import { useCarStore } from '../../../stores/useCarStore'
import { useGameStore } from '../../../stores/useGameStore'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useWeatherStore } from '../../../stores/useWeatherStore'
import { useTrackTemperatureStore } from '../../../stores/useTrackTemperatureStore'
import { useTireStore } from '../../../stores/useTireStore'
import { useCurbStore } from '../../../stores/useCurbStore'
import CarBody from './CarBody'
import CarSprayEffect from './CarSprayEffect'
import {
  usePhysics,
  WeatherCondition,
  TireCompound,
  type CarInput,
} from '../../../wasm'

// ===========================================
// CAR COMPONENT WITH WASM PHYSICS ENGINE
// ===========================================

// Map JS weather to WASM WeatherCondition
function mapWeatherToWasm(weather: string): WeatherCondition {
  switch (weather) {
    case 'hot':
      return WeatherCondition.Hot
    case 'rain':
      return WeatherCondition.Rain
    case 'cold':
      return WeatherCondition.Cold
    default:
      return WeatherCondition.Dry
  }
}

// Map JS tire compound to WASM TireCompound
function mapTireToWasm(compound: string): TireCompound {
  switch (compound) {
    case 'soft':
      return TireCompound.Soft
    case 'hard':
      return TireCompound.Hard
    case 'wet':
      return TireCompound.Wet
    case 'intermediate':
      return TireCompound.Intermediate
    default:
      return TireCompound.Medium
  }
}

const Car = forwardRef<Group>((_, ref) => {
  const chassisRef = useRef<RapierRigidBody>(null)
  const groupRef = useRef<Group>(null)
  const updateTelemetry = useCarStore(state => state.updateTelemetry)
  const toggleCameraMode = useGameStore(state => state.toggleCameraMode)
  const placedObjects = useCustomizationStore(state => state.placedObjects)

  // WASM Physics Engine
  const physics = usePhysics()

  // Weather system (JS store for visual effects)
  const currentWeather = useWeatherStore(state => state.currentWeather)

  // Tire system (JS store for UI)
  const currentCompound = useTireStore(state => state.currentCompound)

  // Curb system
  const isOnCurb = useCurbStore(state => state.isOnCurb)
  const curbSide = useCurbStore(state => state.curbSide)

  // Track temperature system
  const updateCarPosition = useTrackTemperatureStore(state => state.updateCarPosition)

  // State for spray effect
  const [carState, setCarState] = useState({
    position: new Vector3(0, 0, 0),
    velocity: 0,
    rotation: 0,
  })

  // Sync weather with WASM engine
  const lastWeatherRef = useRef<string>('')
  useEffect(() => {
    if (currentWeather !== lastWeatherRef.current) {
      physics.setWeather(mapWeatherToWasm(currentWeather))
      lastWeatherRef.current = currentWeather
    }
  }, [currentWeather, physics])

  // Sync tire compound with WASM engine
  const lastCompoundRef = useRef<string>('')
  useEffect(() => {
    if (currentCompound !== lastCompoundRef.current) {
      physics.setTireCompound(mapTireToWasm(currentCompound))
      lastCompoundRef.current = currentCompound
    }
  }, [currentCompound, physics])

  // Auto-calculate start position from checkpoint
  const { startPosition, startRotation } = useMemo(() => {
    const checkpoint = placedObjects.find(obj => obj.type === 'checkpoint')
    if (checkpoint && checkpoint.startPoint && checkpoint.endPoint) {
      const dx = checkpoint.endPoint[0] - checkpoint.startPoint[0]
      const dz = checkpoint.endPoint[2] - checkpoint.startPoint[2]
      const perpX = -dz
      const perpZ = dx
      const len = Math.sqrt(perpX * perpX + perpZ * perpZ)
      if (len > 0) {
        const normX = perpX / len
        const normZ = perpZ / len
        const spawnX = checkpoint.position[0] - normX * 5
        const spawnZ = checkpoint.position[2] - normZ * 5
        const rotation = Math.atan2(normX, normZ)
        return {
          startPosition: [spawnX, 1, spawnZ] as [number, number, number],
          startRotation: [0, rotation, 0] as [number, number, number],
        }
      }
    }
    return {
      startPosition: [0, 1, 0] as [number, number, number],
      startRotation: [0, 0, 0] as [number, number, number],
    }
  }, [placedObjects])

  const getKeys = useControls()

  // Visual state refs
  const wheelRotationsRef = useRef<[number, number, number, number]>([0, 0, 0, 0])
  const lastCameraToggle = useRef(0)
  const tempCarPosRef = useRef(new Vector3())

  useFrame((state, delta) => {
    if (!chassisRef.current || !groupRef.current) return

    const dt = Math.min(delta, 0.05)
    const { forward, backward, left, right, brake, handbrake, drs, camera } = getKeys()
    const chassis = chassisRef.current

    // Camera toggle with debounce
    if (camera && state.clock.elapsedTime - lastCameraToggle.current > 0.3) {
      toggleCameraMode()
      lastCameraToggle.current = state.clock.elapsedTime
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
      chassis.setLinvel({ x: 0, y: 0, z: 0 }, true)
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

    // Build input for WASM physics
    const input: CarInput = {
      forward,
      backward,
      left,
      right,
      brake,
      handbrake,
      drs,
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

    // Update wheel rotation (visual)
    const wheelRadius = 0.33
    const wheelRotSpeed = (output.speed_kmh / 3.6) / wheelRadius
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
      steerAngle: left ? 0.3 : right ? -0.3 : 0, // Simplified for display
      wheelRotations: wheelRotationsRef.current,
    })

    // Update track temperature (skid marks)
    if (output.skid_intensity > 0.01) {
      updateCarPosition(pos.x, pos.z, dt, output.skid_intensity)
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
        angularDamping={1.5}
        type='dynamic'
        canSleep={false}
        enabledRotations={[true, true, true]}
        ccd={true}
      >
        <group ref={groupRef}>
          <CarBody />
        </group>
      </RigidBody>

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
