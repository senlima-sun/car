import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWeatherStore } from '../../../stores/useWeatherStore'
import {
  useTrackTemperatureStore,
  TRACK_TEMP_CONFIG,
} from '../../../stores/useTrackTemperatureStore'

const MAX_PUDDLES = 100
const MAX_ICE_PATCHES = 100
const PUDDLE_THRESHOLD = 0.5 // Minimum wetness to show puddle
const ICE_THRESHOLD = 0.3 // Maximum temperature to show ice

// Puddle patches - appear in rain weather
function PuddlePatches() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummyRef = useRef(new THREE.Object3D())
  const currentWeather = useWeatherStore(s => s.currentWeather)
  const cells = useTrackTemperatureStore(s => s.cells)

  // Only render in rain
  const isRaining = currentWeather === 'rain'

  useFrame(() => {
    if (!meshRef.current || !isRaining) return

    const dummy = dummyRef.current
    const { gridSize } = TRACK_TEMP_CONFIG
    let instanceIndex = 0

    // Reset all instances to invisible first
    for (let i = 0; i < MAX_PUDDLES; i++) {
      dummy.position.set(0, -100, 0) // Move off-screen
      dummy.scale.setScalar(0)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }

    // Place puddles at wet cells
    cells.forEach((cell, key) => {
      if (instanceIndex >= MAX_PUDDLES) return
      if (cell.wetness < PUDDLE_THRESHOLD) return

      const [cellX, cellZ] = key.split(',').map(Number)
      const worldX = cellX * gridSize + gridSize / 2
      const worldZ = cellZ * gridSize + gridSize / 2

      dummy.position.set(worldX, 0.015, worldZ)
      // Scale based on wetness level
      const scale = gridSize * 0.4 * (0.5 + cell.wetness * 0.5)
      dummy.scale.setScalar(scale)
      // Use cell position for stable rotation
      dummy.rotation.set(-Math.PI / 2, 0, (cellX * 13 + cellZ * 29) % (Math.PI * 2))
      dummy.updateMatrix()

      meshRef.current!.setMatrixAt(instanceIndex, dummy.matrix)
      instanceIndex++
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.count = instanceIndex
  })

  if (!isRaining) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PUDDLES]}>
      <circleGeometry args={[1, 16]} />
      <meshStandardMaterial
        color='#3a5a7a'
        transparent
        opacity={0.5}
        metalness={0.9}
        roughness={0.1}
        depthWrite={false}
      />
    </instancedMesh>
  )
}

// Ice patches - appear in cold weather
function IcePatches() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummyRef = useRef(new THREE.Object3D())
  const currentWeather = useWeatherStore(s => s.currentWeather)
  const cells = useTrackTemperatureStore(s => s.cells)

  // Only render in cold
  const isCold = currentWeather === 'cold'

  useFrame(() => {
    if (!meshRef.current || !isCold) return

    const dummy = dummyRef.current
    const { gridSize } = TRACK_TEMP_CONFIG
    let instanceIndex = 0

    // Reset all instances to invisible first
    for (let i = 0; i < MAX_ICE_PATCHES; i++) {
      dummy.position.set(0, -100, 0)
      dummy.scale.setScalar(0)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }

    // Place ice at cold cells (low temperature = ice visible)
    cells.forEach((cell, key) => {
      if (instanceIndex >= MAX_ICE_PATCHES) return
      // Show ice where temperature is low (car hasn't driven recently)
      if (cell.temperature > ICE_THRESHOLD) return

      const [cellX, cellZ] = key.split(',').map(Number)
      const worldX = cellX * gridSize + gridSize / 2
      const worldZ = cellZ * gridSize + gridSize / 2

      dummy.position.set(worldX, 0.012, worldZ)
      // Ice is more visible where temperature is lower
      const iceStrength = 1 - cell.temperature / ICE_THRESHOLD
      const scale = gridSize * 0.5 * (0.6 + iceStrength * 0.4)
      dummy.scale.setScalar(scale)
      // Use cell position for stable rotation
      dummy.rotation.set(-Math.PI / 2, 0, (cellX * 17 + cellZ * 31) % (Math.PI * 2))
      dummy.updateMatrix()

      meshRef.current!.setMatrixAt(instanceIndex, dummy.matrix)
      instanceIndex++
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.count = instanceIndex
  })

  // Also generate some static ice patches for ambient effect in cold weather
  // Use seeded pseudo-random for stable positions
  const staticIcePositions = useMemo(() => {
    if (!isCold) return []

    const positions: { pos: [number, number, number]; scale: number; rotation: number }[] = []
    const { worldBounds } = TRACK_TEMP_CONFIG

    // Seeded random for stable positions
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453
      return x - Math.floor(x)
    }

    // Generate random ice patches across the world with stable positions
    for (let i = 0; i < 30; i++) {
      const x = worldBounds.minX + seededRandom(i * 3 + 1) * (worldBounds.maxX - worldBounds.minX)
      const z = worldBounds.minZ + seededRandom(i * 3 + 2) * (worldBounds.maxZ - worldBounds.minZ)
      const scale = 1 + seededRandom(i * 3 + 3) * 2
      const rotation = seededRandom(i * 7) * Math.PI
      positions.push({ pos: [x, 0.01, z], scale, rotation })
    }

    return positions
  }, [isCold])

  if (!isCold) return null

  return (
    <>
      {/* Dynamic ice patches based on temperature grid */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_ICE_PATCHES]}>
        <circleGeometry args={[1, 8]} />
        <meshStandardMaterial
          color='#d0e8f0'
          transparent
          opacity={0.6}
          metalness={0.7}
          roughness={0.2}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Static ambient ice patches */}
      {staticIcePositions.map((item, i) => (
        <mesh key={i} position={item.pos} rotation={[-Math.PI / 2, 0, item.rotation]}>
          <circleGeometry args={[item.scale, 6]} />
          <meshStandardMaterial
            color='#c8dce8'
            transparent
            opacity={0.35}
            metalness={0.6}
            roughness={0.3}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  )
}

// Snow accumulation overlay - white ground layer that builds up in cold weather
function SnowAccumulation() {
  const meshRef = useRef<THREE.Mesh>(null)
  const currentWeather = useWeatherStore(s => s.currentWeather)
  const transitionProgress = useWeatherStore(s => s.transitionProgress)
  const isTransitioning = useWeatherStore(s => s.isTransitioning)
  const previousWeather = useWeatherStore(s => s.previousWeather)

  const isCold = currentWeather === 'cold'
  const wasNotCold = previousWeather !== 'cold'

  // Calculate snow opacity based on weather state
  const snowOpacity = useMemo(() => {
    if (!isTransitioning) {
      return isCold ? 0.35 : 0
    }

    // Transitioning TO cold - fade in
    if (isCold && wasNotCold) {
      return transitionProgress * 0.35
    }

    // Transitioning FROM cold - fade out
    if (!isCold && previousWeather === 'cold') {
      return (1 - transitionProgress) * 0.35
    }

    return isCold ? 0.35 : 0
  }, [isCold, isTransitioning, transitionProgress, wasNotCold, previousWeather])

  // Create snow texture
  const snowTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!

    // White base with slight variation
    ctx.fillStyle = '#f8f8ff'
    ctx.fillRect(0, 0, 256, 256)

    // Add sparkle/crystal patterns
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * 256
      const y = Math.random() * 256
      const brightness = 240 + Math.floor(Math.random() * 15)
      ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness + 10})`
      ctx.fillRect(x, y, 2, 2)
    }

    // Add subtle shadows/depth
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 256
      const y = Math.random() * 256
      ctx.fillStyle = 'rgba(200, 210, 230, 0.2)'
      ctx.beginPath()
      ctx.arc(x, y, 3 + Math.random() * 5, 0, Math.PI * 2)
      ctx.fill()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(100, 100)
    return texture
  }, [])

  useEffect(() => {
    return () => snowTexture.dispose()
  }, [snowTexture])

  if (snowOpacity <= 0) return null

  return (
    <mesh ref={meshRef} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial
        map={snowTexture}
        transparent
        opacity={snowOpacity}
        depthWrite={false}
        roughness={0.9}
        metalness={0.1}
      />
    </mesh>
  )
}

// Main surface effects component
export default function SurfaceEffects() {
  return (
    <>
      <PuddlePatches />
      <IcePatches />
      <SnowAccumulation />
    </>
  )
}
