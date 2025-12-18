import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useWindStore } from '../../../stores/useWindStore'
import { useWindViewStore } from '../../../stores/useWindViewStore'

/**
 * Wind visualization using animated line segments
 * Shows wind direction and intensity with flowing particles
 */
export default function WindVisualization() {
  const linesRef = useRef<THREE.LineSegments>(null)
  const { camera } = useThree()

  // Get wind state
  const windDirection = useWindStore(state => state.direction)
  const windSpeed = useWindStore(state => state.speed)
  const currentSpeed = useWindStore(state => state.currentSpeed)
  const windEnabled = useWindStore(state => state.enabled)
  const isVisible = useWindViewStore(state => state.isEnabled)

  // Particle count scales with wind speed
  const baseParticleCount = 400
  const particleCount = useMemo(() => {
    if (!windEnabled || windSpeed < 0.5) return 0
    return Math.floor(baseParticleCount * Math.min(windSpeed / 10, 1.5))
  }, [windEnabled, windSpeed])

  const areaSize = 120
  const lineLength = 2.0 // Length of wind streak

  // Create geometry
  const { geometry, velocities } = useMemo(() => {
    const count = Math.max(particleCount, 1) // At least 1 to avoid empty buffer
    const positions = new Float32Array(count * 6) // 2 vertices * 3 coords per line
    const velocities = new Float32Array(count)
    const basePositions = new Float32Array(count * 3)
    const opacities = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * areaSize
      const y = 1 + Math.random() * 15 // Between 1m and 16m height
      const z = (Math.random() - 0.5) * areaSize

      // Speed varies slightly for natural look
      const speed = 0.8 + Math.random() * 0.4
      velocities[i] = speed

      // Random opacity for depth
      opacities[i] = 0.3 + Math.random() * 0.5

      // Store base position
      basePositions[i * 3] = x
      basePositions[i * 3 + 1] = y
      basePositions[i * 3 + 2] = z

      // Initialize positions (will be updated in useFrame)
      positions[i * 6] = x
      positions[i * 6 + 1] = y
      positions[i * 6 + 2] = z
      positions[i * 6 + 3] = x
      positions[i * 6 + 4] = y
      positions[i * 6 + 5] = z
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    return { geometry, velocities, basePositions, opacities }
  }, [particleCount])

  // Cleanup geometry on unmount
  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  // Animation
  useFrame((_, delta) => {
    if (!linesRef.current || particleCount === 0 || !windEnabled || !isVisible) return

    const pos = linesRef.current.geometry.attributes.position.array as Float32Array

    // Calculate wind vector
    const windMagnitude = currentSpeed || windSpeed
    const windX = Math.cos(windDirection) * windMagnitude
    const windZ = Math.sin(windDirection) * windMagnitude

    // Normalize for line direction
    const windLen = Math.sqrt(windX * windX + windZ * windZ)
    const dirX = windLen > 0 ? windX / windLen : 1
    const dirZ = windLen > 0 ? windZ / windLen : 0

    for (let i = 0; i < particleCount; i++) {
      const speed = velocities[i] * windMagnitude
      const moveX = dirX * speed * delta
      const moveZ = dirZ * speed * delta

      // Move both vertices
      pos[i * 6] += moveX
      pos[i * 6 + 2] += moveZ
      pos[i * 6 + 3] += moveX
      pos[i * 6 + 5] += moveZ

      // Update line end to show direction
      const len = lineLength * (windMagnitude / 15) // Scale line length with wind
      pos[i * 6 + 3] = pos[i * 6] + dirX * len
      pos[i * 6 + 5] = pos[i * 6 + 2] + dirZ * len

      // Reset when out of area
      const distX = pos[i * 6] - camera.position.x
      const distZ = pos[i * 6 + 2] - camera.position.z

      if (Math.abs(distX) > areaSize / 2 || Math.abs(distZ) > areaSize / 2) {
        // Spawn on upwind side
        const spawnX = camera.position.x - dirX * (areaSize / 2) + (Math.random() - 0.5) * areaSize * 0.8
        const spawnY = 1 + Math.random() * 15
        const spawnZ = camera.position.z - dirZ * (areaSize / 2) + (Math.random() - 0.5) * areaSize * 0.8

        pos[i * 6] = spawnX
        pos[i * 6 + 1] = spawnY
        pos[i * 6 + 2] = spawnZ
        pos[i * 6 + 3] = spawnX + dirX * len
        pos[i * 6 + 4] = spawnY
        pos[i * 6 + 5] = spawnZ + dirZ * len
      }
    }

    linesRef.current.geometry.attributes.position.needsUpdate = true
  })

  // Don't render if wind is disabled or visualization is off
  if (!windEnabled || !isVisible || particleCount === 0) {
    return null
  }

  // Color intensity based on wind speed
  const intensity = Math.min(windSpeed / 20, 1)
  const color = new THREE.Color().setHSL(0.55, 0.6, 0.4 + intensity * 0.3) // Cyan-ish

  return (
    <lineSegments ref={linesRef} geometry={geometry}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.4 + intensity * 0.3}
        linewidth={1}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  )
}
