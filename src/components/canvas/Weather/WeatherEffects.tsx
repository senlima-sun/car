import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useWeatherStore } from '../../../stores/useWeatherStore'
import { WeatherCondition, ATMOSPHERE_CONFIG } from '../../../constants/weather'
import SurfaceEffects from './SurfaceEffects'

// Rain particle system (optimized: reduced from 2000 to 1200 particles)
function RainEffect() {
  const pointsRef = useRef<THREE.Points>(null)
  const { camera } = useThree()

  const particleCount = 1200
  const areaSize = 100

  const { geometry, velocities } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const velocities = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * areaSize
      positions[i * 3 + 1] = Math.random() * 50
      positions[i * 3 + 2] = (Math.random() - 0.5) * areaSize
      velocities[i] = 20 + Math.random() * 10 // Fall speed
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    return { geometry, velocities }
  }, [])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  useFrame((_, delta) => {
    if (!pointsRef.current) return

    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array

    for (let i = 0; i < particleCount; i++) {
      // Move rain down
      pos[i * 3 + 1] -= velocities[i] * delta

      // Reset position when below ground, centered on camera
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3] = camera.position.x + (Math.random() - 0.5) * areaSize
        pos[i * 3 + 1] = 50
        pos[i * 3 + 2] = camera.position.z + (Math.random() - 0.5) * areaSize
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true
    // Keep particles centered around camera
    pointsRef.current.position.set(0, 0, 0)
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color='#aaddff'
        size={0.3}
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

// Rain ground splash effect - spawns at raindrop ground collision points
function RainSplashEffect() {
  const pointsRef = useRef<THREE.Points>(null)
  const { camera } = useThree()

  const splashCount = 400
  const areaSize = 100

  const { geometry, velocities, lifetimes, initialLifetimes } = useMemo(() => {
    const positions = new Float32Array(splashCount * 3)
    const velocities = new Float32Array(splashCount * 3)
    const lifetimes = new Float32Array(splashCount)
    const initialLifetimes = new Float32Array(splashCount)

    for (let i = 0; i < splashCount; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = -10
      positions[i * 3 + 2] = 0

      velocities[i * 3] = 0
      velocities[i * 3 + 1] = 0
      velocities[i * 3 + 2] = 0

      lifetimes[i] = 0
      initialLifetimes[i] = 0.15 + Math.random() * 0.2
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    return { geometry, velocities, lifetimes, initialLifetimes }
  }, [])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  useFrame((_, delta) => {
    if (!pointsRef.current) return

    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array
    const spawnRate = 60
    let toSpawn = Math.floor(spawnRate * delta)

    for (let i = 0; i < splashCount; i++) {
      lifetimes[i] -= delta

      if (lifetimes[i] <= 0) {
        if (toSpawn > 0) {
          toSpawn--

          positions[i * 3] = camera.position.x + (Math.random() - 0.5) * areaSize
          positions[i * 3 + 1] = 0.05
          positions[i * 3 + 2] = camera.position.z + (Math.random() - 0.5) * areaSize

          const angle = Math.random() * Math.PI * 2
          const speed = 1.5 + Math.random() * 2
          velocities[i * 3] = Math.cos(angle) * speed * 0.5
          velocities[i * 3 + 1] = speed
          velocities[i * 3 + 2] = Math.sin(angle) * speed * 0.5

          lifetimes[i] = initialLifetimes[i]
        } else {
          positions[i * 3 + 1] = -10
        }
      } else {
        positions[i * 3] += velocities[i * 3] * delta
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta

        velocities[i * 3 + 1] -= 12 * delta

        if (positions[i * 3 + 1] < 0) {
          lifetimes[i] = 0
        }
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color='#99bbdd'
        size={0.15}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// Snow/Ice particle system (optimized: reduced from 1500 to 800 particles)
function SnowEffect() {
  const pointsRef = useRef<THREE.Points>(null)
  const { camera } = useThree()

  const particleCount = 800
  const areaSize = 120

  const { geometry, velocities, drifts } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const velocities = new Float32Array(particleCount)
    const drifts = new Float32Array(particleCount * 2)

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * areaSize
      positions[i * 3 + 1] = Math.random() * 60
      positions[i * 3 + 2] = (Math.random() - 0.5) * areaSize
      velocities[i] = 3 + Math.random() * 4 // Slower fall speed
      drifts[i * 2] = (Math.random() - 0.5) * 2 // X drift
      drifts[i * 2 + 1] = (Math.random() - 0.5) * 2 // Z drift
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    return { geometry, velocities, drifts }
  }, [])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  useFrame((state, delta) => {
    if (!pointsRef.current) return

    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array
    const time = state.clock.elapsedTime

    for (let i = 0; i < particleCount; i++) {
      // Gentle falling with drift
      pos[i * 3] += Math.sin(time + i) * drifts[i * 2] * delta
      pos[i * 3 + 1] -= velocities[i] * delta
      pos[i * 3 + 2] += Math.cos(time + i) * drifts[i * 2 + 1] * delta

      // Reset position when below ground
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3] = camera.position.x + (Math.random() - 0.5) * areaSize
        pos[i * 3 + 1] = 60
        pos[i * 3 + 2] = camera.position.z + (Math.random() - 0.5) * areaSize
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color='#e8f0ff'
        size={0.4}
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
        depthTest={true}
      />
    </points>
  )
}

// Snow ground impact effect - puff particles when snow hits ground
function SnowSplashEffect() {
  const pointsRef = useRef<THREE.Points>(null)
  const { camera } = useThree()

  const puffCount = 200
  const areaSize = 120

  const { geometry, velocities, lifetimes, initialLifetimes } = useMemo(() => {
    const positions = new Float32Array(puffCount * 3)
    const velocities = new Float32Array(puffCount * 3)
    const lifetimes = new Float32Array(puffCount)
    const initialLifetimes = new Float32Array(puffCount)

    for (let i = 0; i < puffCount; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = -10
      positions[i * 3 + 2] = 0

      velocities[i * 3] = 0
      velocities[i * 3 + 1] = 0
      velocities[i * 3 + 2] = 0

      lifetimes[i] = 0
      initialLifetimes[i] = 0.4 + Math.random() * 0.4
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    return { geometry, velocities, lifetimes, initialLifetimes }
  }, [])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  useFrame((state, delta) => {
    if (!pointsRef.current) return

    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array
    const time = state.clock.elapsedTime

    const spawnRate = 25
    let toSpawn = Math.floor(spawnRate * delta)

    for (let i = 0; i < puffCount; i++) {
      lifetimes[i] -= delta

      if (lifetimes[i] <= 0) {
        if (toSpawn > 0) {
          toSpawn--

          positions[i * 3] = camera.position.x + (Math.random() - 0.5) * areaSize
          positions[i * 3 + 1] = 0.1
          positions[i * 3 + 2] = camera.position.z + (Math.random() - 0.5) * areaSize

          const angle = Math.random() * Math.PI * 2
          const speed = 0.3 + Math.random() * 0.5
          velocities[i * 3] = Math.cos(angle) * speed
          velocities[i * 3 + 1] = 0.2 + Math.random() * 0.3
          velocities[i * 3 + 2] = Math.sin(angle) * speed

          lifetimes[i] = initialLifetimes[i]
        } else {
          positions[i * 3 + 1] = -10
        }
      } else {
        const drift = Math.sin(time * 2 + i) * 0.3
        positions[i * 3] += (velocities[i * 3] + drift) * delta
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta

        velocities[i * 3 + 1] -= 0.5 * delta
        velocities[i * 3] *= 0.98
        velocities[i * 3 + 2] *= 0.98

        if (positions[i * 3 + 1] < 0) {
          lifetimes[i] = 0
        }
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color='#e8f4ff'
        size={0.5}
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

// Heat shimmer effect (floating particles, exported for future use)
export function HeatEffect() {
  const pointsRef = useRef<THREE.Points>(null)
  const { camera } = useThree()

  const particleCount = 500
  const areaSize = 80

  const geometry = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * areaSize
      positions[i * 3 + 1] = Math.random() * 5 + 0.5 // Close to ground
      positions[i * 3 + 2] = (Math.random() - 0.5) * areaSize
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    return geometry
  }, [])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  useFrame((state, delta) => {
    if (!pointsRef.current) return

    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array
    const time = state.clock.elapsedTime

    for (let i = 0; i < particleCount; i++) {
      // Shimmer effect - particles rise and drift
      pos[i * 3] += Math.sin(time * 2 + i * 0.1) * delta * 2
      pos[i * 3 + 1] += delta * (1 + Math.sin(time + i) * 0.5)
      pos[i * 3 + 2] += Math.cos(time * 2 + i * 0.1) * delta * 2

      // Reset position when too high
      if (pos[i * 3 + 1] > 8) {
        pos[i * 3] = camera.position.x + (Math.random() - 0.5) * areaSize
        pos[i * 3 + 1] = Math.random() * 2 + 0.5
        pos[i * 3 + 2] = camera.position.z + (Math.random() - 0.5) * areaSize
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color='#ffcc88'
        size={0.8}
        transparent
        opacity={0.15}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

// Weather-specific fog adjustments - now uses atmosphere config
function WeatherFog({ weather }: { weather: WeatherCondition }) {
  const previousWeather = useWeatherStore(s => s.previousWeather)
  const transitionProgress = useWeatherStore(s => s.transitionProgress)
  const isTransitioning = useWeatherStore(s => s.isTransitioning)

  const fogConfig = useMemo(() => {
    const current = ATMOSPHERE_CONFIG[weather]

    if (!isTransitioning) {
      return { color: current.fogColor, near: current.fogNear, far: current.fogFar }
    }

    // Interpolate fog during transitions
    const prev = ATMOSPHERE_CONFIG[previousWeather]
    const t = transitionProgress * transitionProgress * (3 - 2 * transitionProgress) // smoothstep

    return {
      color: current.fogColor, // Use target color
      near: prev.fogNear + (current.fogNear - prev.fogNear) * t,
      far: prev.fogFar + (current.fogFar - prev.fogFar) * t,
    }
  }, [weather, previousWeather, transitionProgress, isTransitioning])

  return <fog attach='fog' args={[fogConfig.color, fogConfig.near, fogConfig.far]} />
}

// Main weather effects component
export default function WeatherEffects() {
  const currentWeather = useWeatherStore(state => state.currentWeather)
  const isTransitioning = useWeatherStore(state => state.isTransitioning)

  // Only render effects when not transitioning for cleaner visuals
  const showEffects = !isTransitioning

  return (
    <>
      {/* Weather-specific fog */}
      <WeatherFog weather={currentWeather} />

      {/* Rain particles + ground splashes */}
      {showEffects && currentWeather === 'rain' && (
        <>
          <RainEffect />
          <RainSplashEffect />
        </>
      )}

      {/* Snow particles + ground effects */}
      {showEffects && currentWeather === 'cold' && (
        <>
          <SnowEffect />
          <SnowSplashEffect />
        </>
      )}

      {/* Surface effects (puddles, ice patches) */}
      <SurfaceEffects />
    </>
  )
}
