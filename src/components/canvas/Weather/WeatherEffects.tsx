import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { ATMOSPHERE_CONFIG } from '../../../constants/weather'
import SurfaceEffects from './SurfaceEffects'

// Realistic rain using line segments for proper streaks
function RainEffect() {
  const linesRef = useRef<THREE.LineSegments>(null)
  const { camera } = useThree()

  const dropCount = 1500
  const areaSize = 150
  const streakLength = 1.2 // Length of each rain streak
  const windX = 0.2 // Wind pushing rain sideways
  const windZ = 0.1

  // Each drop needs 2 vertices (start and end of line)
  const { geometry, velocities } = useMemo(() => {
    const positions = new Float32Array(dropCount * 6) // 2 vertices * 3 coords
    const velocities = new Float32Array(dropCount)
    const basePositions = new Float32Array(dropCount * 3) // Store base position for each drop

    for (let i = 0; i < dropCount; i++) {
      const x = (Math.random() - 0.5) * areaSize
      const y = Math.random() * 80
      const z = (Math.random() - 0.5) * areaSize

      // Fall speed varies for depth effect
      const speed = 35 + Math.random() * 25
      velocities[i] = speed

      // Store base position
      basePositions[i * 3] = x
      basePositions[i * 3 + 1] = y
      basePositions[i * 3 + 2] = z

      // Calculate streak direction based on velocity
      const streakY = streakLength * (speed / 40)
      const streakX = windX * streakY
      const streakZ = windZ * streakY

      // Line start (top of streak)
      positions[i * 6] = x
      positions[i * 6 + 1] = y
      positions[i * 6 + 2] = z

      // Line end (bottom of streak - in direction of fall)
      positions[i * 6 + 3] = x + streakX
      positions[i * 6 + 4] = y - streakY
      positions[i * 6 + 5] = z + streakZ
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    return { geometry, velocities, basePositions }
  }, [])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  useFrame((_, delta) => {
    if (!linesRef.current) return

    const pos = linesRef.current.geometry.attributes.position.array as Float32Array

    for (let i = 0; i < dropCount; i++) {
      const speed = velocities[i]
      const moveY = speed * delta
      const moveX = windX * speed * delta
      const moveZ = windZ * speed * delta

      // Move both vertices of the line
      pos[i * 6] += moveX
      pos[i * 6 + 1] -= moveY
      pos[i * 6 + 2] += moveZ

      pos[i * 6 + 3] += moveX
      pos[i * 6 + 4] -= moveY
      pos[i * 6 + 5] += moveZ

      // Reset when below ground
      if (pos[i * 6 + 4] < -2) {
        const newX = camera.position.x + (Math.random() - 0.5) * areaSize
        const newY = 70 + Math.random() * 20
        const newZ = camera.position.z + (Math.random() - 0.5) * areaSize

        const streakY = streakLength * (speed / 40)
        const streakX = windX * streakY
        const streakZ = windZ * streakY

        pos[i * 6] = newX
        pos[i * 6 + 1] = newY
        pos[i * 6 + 2] = newZ

        pos[i * 6 + 3] = newX + streakX
        pos[i * 6 + 4] = newY - streakY
        pos[i * 6 + 5] = newZ + streakZ
      }
    }

    linesRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <lineSegments ref={linesRef} geometry={geometry}>
      <lineBasicMaterial
        color='#aaccff'
        transparent
        opacity={0.4}
        linewidth={1}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  )
}

// Rain ground splash effect - spawns at raindrop ground collision points
function RainSplashEffect() {
  const pointsRef = useRef<THREE.Points>(null)
  const { camera } = useThree()

  const splashCount = 300
  const areaSize = 120

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
    const spawnRate = 100
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
        color='#aaccee'
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

// Dynamic fog adjustments based on temperature and rain
function DynamicFog() {
  const temperature = useEnvironmentStore(s => s.temperature)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)

  const fogConfig = useMemo(() => {
    // Determine base atmosphere from temperature
    let baseConfig = ATMOSPHERE_CONFIG.dry
    if (temperature < 0) {
      baseConfig = ATMOSPHERE_CONFIG.cold
    } else if (temperature > 35) {
      baseConfig = ATMOSPHERE_CONFIG.hot
    }

    // Blend with rain atmosphere if raining
    if (rainIntensity > 0.01) {
      const rainConfig = ATMOSPHERE_CONFIG.rain
      const t = rainIntensity
      return {
        color: rainConfig.fogColor,
        near: baseConfig.fogNear + (rainConfig.fogNear - baseConfig.fogNear) * t,
        far: baseConfig.fogFar + (rainConfig.fogFar - baseConfig.fogFar) * t,
      }
    }

    return { color: baseConfig.fogColor, near: baseConfig.fogNear, far: baseConfig.fogFar }
  }, [temperature, rainIntensity])

  return <fog attach='fog' args={[fogConfig.color, fogConfig.near, fogConfig.far]} />
}

// Overcast sky overlay - darkens the sky based on rain intensity
function OvercastSkyOverlay() {
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)

  // Calculate overlay opacity from rain intensity
  const overlayOpacity = useMemo(() => {
    if (rainIntensity > 0.01) {
      return rainIntensity * 0.7
    }
    return 0
  }, [rainIntensity])

  if (overlayOpacity <= 0) return null

  return (
    <mesh>
      <sphereGeometry args={[400, 32, 16]} />
      <meshBasicMaterial
        color='#3a4550'
        side={THREE.BackSide}
        transparent
        opacity={overlayOpacity}
        depthWrite={false}
      />
    </mesh>
  )
}

// Main weather effects component - uses dynamic temperature and rain
export default function WeatherEffects() {
  const temperature = useEnvironmentStore(state => state.temperature)
  const rainIntensity = useEnvironmentStore(state => state.rainIntensity)

  // Dynamic weather conditions based on temperature and rain
  const showRain = rainIntensity > 0.01
  const showSnow = temperature < 0 && !showRain // Snow when cold and not raining
  const showHeat = temperature > 35 && !showRain // Heat shimmer when hot and not raining

  return (
    <>
      {/* Overcast sky overlay for rain */}
      <OvercastSkyOverlay />

      {/* Dynamic fog based on conditions */}
      <DynamicFog />

      {/* Rain particles + ground splashes */}
      {showRain && (
        <>
          <RainEffect />
          <RainSplashEffect />
        </>
      )}

      {/* Snow particles + ground effects */}
      {showSnow && (
        <>
          <SnowEffect />
          <SnowSplashEffect />
        </>
      )}

      {/* Heat shimmer effect */}
      {showHeat && <HeatEffect />}

      {/* Surface effects (puddles, ice patches) */}
      <SurfaceEffects />
    </>
  )
}
