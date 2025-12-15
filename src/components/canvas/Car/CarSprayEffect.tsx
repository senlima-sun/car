import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWeatherStore } from '../../../stores/useWeatherStore'
import { useTrackTemperatureStore } from '../../../stores/useTrackTemperatureStore'

const PARTICLE_COUNT = 200
const MIN_SPEED_FOR_SPRAY = 8 // m/s

interface CarSprayEffectProps {
  carPosition: THREE.Vector3
  carVelocity: number
  carRotation: number
}

export default function CarSprayEffect({
  carPosition,
  carVelocity,
  carRotation,
}: CarSprayEffectProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const currentWeather = useWeatherStore(s => s.currentWeather)
  const getCell = useTrackTemperatureStore(s => s.getCell)

  // Create particle geometry
  const { geometry, velocities, lifetimes, initialLifetimes } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const velocities = new Float32Array(PARTICLE_COUNT * 3)
    const lifetimes = new Float32Array(PARTICLE_COUNT)
    const initialLifetimes = new Float32Array(PARTICLE_COUNT)

    // Initialize all particles below ground (hidden)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = -10 // Hidden
      positions[i * 3 + 2] = 0

      velocities[i * 3] = 0
      velocities[i * 3 + 1] = 0
      velocities[i * 3 + 2] = 0

      lifetimes[i] = 0
      initialLifetimes[i] = 0.5 + Math.random() * 0.5
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    return { geometry, velocities, lifetimes, initialLifetimes }
  }, [])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  // Check if car is on wet/icy surface
  const getSurfaceCondition = () => {
    const cell = getCell(carPosition.x, carPosition.z)

    if (currentWeather === 'rain') {
      // Need wetness > 0.3 for spray
      return cell && cell.wetness > 0.3 ? 'wet' : null
    }
    if (currentWeather === 'cold') {
      // Need low temperature (icy) for spray
      return cell && cell.temperature < 0.5 ? 'icy' : null
    }
    return null
  }

  useFrame((_, delta) => {
    if (!pointsRef.current) return

    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array
    const surfaceCondition = getSurfaceCondition()
    const shouldEmit = surfaceCondition && carVelocity > MIN_SPEED_FOR_SPRAY

    // Spawn rate based on speed
    const spawnRate = shouldEmit ? Math.min(30, carVelocity * 2) : 0
    let particlesToSpawn = Math.floor(spawnRate * delta * 60)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Update lifetime
      lifetimes[i] -= delta

      if (lifetimes[i] <= 0) {
        // Particle is dead - try to respawn if we should emit
        if (particlesToSpawn > 0 && shouldEmit) {
          particlesToSpawn--

          // Spawn behind rear wheels
          const wheelOffsetX = (Math.random() - 0.5) * 1.8 // Spread across rear axle
          const wheelOffsetZ = -1.5 + Math.random() * 0.3 // Behind car

          // Rotate offset by car rotation
          const cos = Math.cos(carRotation)
          const sin = Math.sin(carRotation)

          const worldOffsetX = wheelOffsetX * cos - wheelOffsetZ * sin
          const worldOffsetZ = wheelOffsetX * sin + wheelOffsetZ * cos

          positions[i * 3] = carPosition.x + worldOffsetX
          positions[i * 3 + 1] = 0.1
          positions[i * 3 + 2] = carPosition.z + worldOffsetZ

          // Set velocity - spray up and back
          const baseUpVel = 3 + Math.random() * 4
          const baseSideVel = (Math.random() - 0.5) * 3
          const baseBackVel = -2 - Math.random() * 2 // Negative = behind car

          // Rotate velocity by car rotation
          velocities[i * 3] = baseSideVel * cos - baseBackVel * sin
          velocities[i * 3 + 1] = baseUpVel
          velocities[i * 3 + 2] = baseSideVel * sin + baseBackVel * cos

          lifetimes[i] = initialLifetimes[i]
        } else {
          // Hide particle
          positions[i * 3 + 1] = -10
        }
      } else {
        // Update particle position
        positions[i * 3] += velocities[i * 3] * delta
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta

        // Apply gravity
        velocities[i * 3 + 1] -= 15 * delta

        // Add some drag/spread
        velocities[i * 3] *= 0.98
        velocities[i * 3 + 2] *= 0.98

        // Kill particles that hit ground
        if (positions[i * 3 + 1] < 0) {
          lifetimes[i] = 0
          positions[i * 3 + 1] = -10
        }
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  // Determine spray color based on weather
  const sprayColor = useMemo(() => {
    if (currentWeather === 'cold') return '#e8f4ff' // White-ish for snow/ice
    if (currentWeather === 'rain') return '#88aacc' // Blue-gray for water
    return '#888888' // Default gray
  }, [currentWeather])

  // Only render if weather could produce spray
  if (currentWeather !== 'rain' && currentWeather !== 'cold') {
    return null
  }

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color={sprayColor}
        size={0.25}
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
