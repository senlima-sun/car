import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import {
  useTrackTemperatureStore,
  TRACK_TEMP_CONFIG,
} from '../../../stores/useTrackTemperatureStore'

const MAX_PUDDLES = 150
const MAX_ICE_PATCHES = 100
const WATER_DEPTH_THRESHOLD = 0.2 // Minimum water depth to show puddle
const ICE_THRESHOLD = 0.3 // Maximum temperature to show ice

// Puddle patches - appear when rain intensity > 0 based on water depth
function PuddlePatches() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const colorRef = useRef<THREE.InstancedBufferAttribute | null>(null)
  const dummyRef = useRef(new THREE.Object3D())
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)
  const cells = useTrackTemperatureStore(s => s.cells)

  // Only render when raining or shortly after (puddles persist)
  const isRaining = rainIntensity > 0.01

  // Create color attribute for per-instance colors
  const colorArray = useMemo(() => new Float32Array(MAX_PUDDLES * 3), [])

  useFrame(() => {
    if (!meshRef.current) return

    const dummy = dummyRef.current
    const { gridSize } = TRACK_TEMP_CONFIG
    let instanceIndex = 0

    // Reset all instances to invisible first
    for (let i = 0; i < MAX_PUDDLES; i++) {
      dummy.position.set(0, -100, 0)
      dummy.scale.setScalar(0)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }

    // Place puddles at cells with water depth
    cells.forEach((cell, key) => {
      if (instanceIndex >= MAX_PUDDLES) return

      // Use water_depth if available, fallback to wetness for compatibility
      const waterDepth = cell.waterDepth ?? cell.wetness
      if (waterDepth < WATER_DEPTH_THRESHOLD) return

      const [cellX, cellZ] = key.split(',').map(Number)
      const worldX = cellX * gridSize + gridSize / 2
      const worldZ = cellZ * gridSize + gridSize / 2

      // Y position rises slightly with water depth (deeper = higher water level)
      const yPos = 0.01 + waterDepth * 0.03
      dummy.position.set(worldX, yPos, worldZ)

      // Scale based on water depth (deeper puddles are larger)
      const baseScale = gridSize * 0.5
      const depthScale = 0.5 + waterDepth * 0.8 // 0.5 to 1.3 multiplier
      dummy.scale.setScalar(baseScale * depthScale)

      // Use cell position for stable rotation
      dummy.rotation.set(-Math.PI / 2, 0, (cellX * 13 + cellZ * 29) % (Math.PI * 2))
      dummy.updateMatrix()

      meshRef.current!.setMatrixAt(instanceIndex, dummy.matrix)

      // Color varies by depth - deeper puddles are darker
      // Shallow: light blue (#5080a0), Deep: dark blue (#203850)
      const depthFactor = waterDepth
      colorArray[instanceIndex * 3] = 0.31 - depthFactor * 0.19 // R: 0.31 -> 0.12
      colorArray[instanceIndex * 3 + 1] = 0.5 - depthFactor * 0.28 // G: 0.5 -> 0.22
      colorArray[instanceIndex * 3 + 2] = 0.63 - depthFactor * 0.31 // B: 0.63 -> 0.31

      instanceIndex++
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.count = instanceIndex

    // Update instance colors
    if (colorRef.current) {
      colorRef.current.needsUpdate = true
    }
  })

  // Don't render if no rain and no cells have water
  const hasWater = useMemo(() => {
    for (const cell of cells.values()) {
      const waterDepth = cell.waterDepth ?? cell.wetness
      if (waterDepth >= WATER_DEPTH_THRESHOLD) return true
    }
    return false
  }, [cells])

  if (!isRaining && !hasWater) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PUDDLES]}>
      <circleGeometry args={[1, 16]}>
        <instancedBufferAttribute ref={colorRef} attach='attributes-color' args={[colorArray, 3]} />
      </circleGeometry>
      <meshStandardMaterial
        vertexColors
        transparent
        opacity={0.7}
        metalness={0.95}
        roughness={0.02}
        envMapIntensity={2.5}
        depthWrite={false}
      />
    </instancedMesh>
  )
}

// Ice patches - appear when temperature < 0°C
function IcePatches() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummyRef = useRef(new THREE.Object3D())
  const temperature = useEnvironmentStore(s => s.temperature)
  const cells = useTrackTemperatureStore(s => s.cells)

  // Only render when cold (temp < 0°C)
  const isCold = temperature < 0

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

// Snow accumulation overlay - white ground layer that builds up when temp < 0°C
function SnowAccumulation() {
  const meshRef = useRef<THREE.Mesh>(null)
  const temperature = useEnvironmentStore(s => s.temperature)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)

  // Snow appears when temp < 0°C and increases as it gets colder
  // No snow during rain (it turns to sleet/rain at those temps)
  const snowOpacity = useMemo(() => {
    if (temperature >= 0 || rainIntensity > 0.3) return 0
    // Fade in snow from 0°C to -5°C (max at -5°C or below)
    const coldFactor = Math.min(1, Math.abs(temperature) / 5)
    return coldFactor * 0.35
  }, [temperature, rainIntensity])

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

// Wet road overlay - large reflective plane during rain for water layer effect
function WetRoadOverlay() {
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)

  // Calculate opacity based on rain intensity
  const waterOpacity = useMemo(() => {
    if (rainIntensity <= 0.01) return 0
    return rainIntensity * 0.25
  }, [rainIntensity])

  if (waterOpacity <= 0) return null

  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial
        color='#2a4050'
        transparent
        opacity={waterOpacity}
        metalness={0.95}
        roughness={0.05}
        envMapIntensity={1.5}
        depthWrite={false}
      />
    </mesh>
  )
}

// Main surface effects component
export default function SurfaceEffects() {
  return (
    <>
      <WetRoadOverlay />
      <PuddlePatches />
      <IcePatches />
      <SnowAccumulation />
    </>
  )
}
