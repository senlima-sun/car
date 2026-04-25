import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { usePhysicsOptional } from '../../../wasm'

const MAX_PUDDLES = 150
const MAX_ICE_PATCHES = 100
const WATER_DEPTH_THRESHOLD = 0.2
const SURFACE_EFFECT_BOUNDS = { minX: -250, maxX: 250, minZ: -250, maxZ: 250 }

let _surfaceCellCache: Float32Array | null = null
let _surfaceCellFrame = -1

function getCachedSurfaceCells(
  physics: { getActiveSurfaceCells: () => Float32Array } | null,
  frameCount: number,
): Float32Array | null {
  if (!physics) return null
  if (frameCount === _surfaceCellFrame && _surfaceCellCache) return _surfaceCellCache
  _surfaceCellCache = physics.getActiveSurfaceCells()
  _surfaceCellFrame = frameCount
  return _surfaceCellCache
}

function PuddlePatches() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const colorRef = useRef<THREE.InstancedBufferAttribute | null>(null)
  const dummyRef = useRef(new THREE.Object3D())
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)
  const physics = usePhysicsOptional()
  const frameCounter = useRef(0)

  const isRaining = rainIntensity > 0.01

  const colorArray = useMemo(() => new Float32Array(MAX_PUDDLES * 3), [])

  useFrame(() => {
    if (!meshRef.current) return

    frameCounter.current++
    if (frameCounter.current % 3 !== 0) return

    const dummy = dummyRef.current
    let instanceIndex = 0

    for (let i = 0; i < MAX_PUDDLES; i++) {
      dummy.position.set(0, -100, 0)
      dummy.scale.setScalar(0)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }

    if (physics?.initialized) {
      const cellData = getCachedSurfaceCells(physics, frameCounter.current)
      if (cellData) {
        const stride = 5

        for (let c = 0; c < cellData.length && instanceIndex < MAX_PUDDLES; c += stride) {
          const worldX = cellData[c]
          const worldZ = cellData[c + 1]
          const waterDepth = cellData[c + 2]
          const wetness = cellData[c + 3]

          const effectiveWater = Math.max(waterDepth, wetness)
          if (effectiveWater < WATER_DEPTH_THRESHOLD) continue

          const yPos = 0.01 + effectiveWater * 0.03
          dummy.position.set(worldX, yPos, worldZ)

          const baseScale = 1.0
          const depthScale = 0.5 + effectiveWater * 0.8
          dummy.scale.setScalar(baseScale * depthScale)

          const seedA = Math.floor(worldX * 7) + Math.floor(worldZ * 13)
          dummy.rotation.set(-Math.PI / 2, 0, (seedA * 29) % (Math.PI * 2))
          dummy.updateMatrix()

          meshRef.current!.setMatrixAt(instanceIndex, dummy.matrix)

          const depthFactor = effectiveWater
          colorArray[instanceIndex * 3] = 0.31 - depthFactor * 0.19
          colorArray[instanceIndex * 3 + 1] = 0.5 - depthFactor * 0.28
          colorArray[instanceIndex * 3 + 2] = 0.63 - depthFactor * 0.31

          instanceIndex++
        }
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.count = instanceIndex

    if (colorRef.current) {
      colorRef.current.needsUpdate = true
    }
  })

  if (!isRaining) return null

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

function IcePatches() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummyRef = useRef(new THREE.Object3D())
  const temperature = useEnvironmentStore(s => s.temperature)
  const physics = usePhysicsOptional()
  const frameCounter = useRef(0)

  const isCold = temperature < 0

  useFrame(() => {
    if (!meshRef.current || !isCold) return

    frameCounter.current++
    if (frameCounter.current % 3 !== 0) return

    const dummy = dummyRef.current
    let instanceIndex = 0

    for (let i = 0; i < MAX_ICE_PATCHES; i++) {
      dummy.position.set(0, -100, 0)
      dummy.scale.setScalar(0)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }

    if (physics?.initialized) {
      const cellData = getCachedSurfaceCells(physics, frameCounter.current)
      if (cellData) {
        const stride = 5

        for (let c = 0; c < cellData.length && instanceIndex < MAX_ICE_PATCHES; c += stride) {
          const worldX = cellData[c]
          const worldZ = cellData[c + 1]
          const ice = cellData[c + 4]

          if (ice < 0.1) continue

          dummy.position.set(worldX, 0.012, worldZ)
          const iceStrength = ice
          const scale = 1.0 * (0.6 + iceStrength * 0.4)
          dummy.scale.setScalar(scale)
          const seedA = Math.floor(worldX * 7) + Math.floor(worldZ * 13)
          dummy.rotation.set(-Math.PI / 2, 0, (seedA * 31) % (Math.PI * 2))
          dummy.updateMatrix()

          meshRef.current!.setMatrixAt(instanceIndex, dummy.matrix)
          instanceIndex++
        }
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.count = instanceIndex
  })

  const staticIcePositions = useMemo(() => {
    if (!isCold) return []

    const positions: { pos: [number, number, number]; scale: number; rotation: number }[] = []
    const worldBounds = SURFACE_EFFECT_BOUNDS

    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453
      return x - Math.floor(x)
    }

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

function SnowAccumulation() {
  const meshRef = useRef<THREE.Mesh>(null)
  const temperature = useEnvironmentStore(s => s.temperature)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)

  const snowOpacity = useMemo(() => {
    if (temperature >= 0 || rainIntensity > 0.3) return 0
    const coldFactor = Math.min(1, Math.abs(temperature) / 5)
    return coldFactor * 0.35
  }, [temperature, rainIntensity])

  const snowTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = '#f8f8ff'
    ctx.fillRect(0, 0, 256, 256)

    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * 256
      const y = Math.random() * 256
      const brightness = 240 + Math.floor(Math.random() * 15)
      ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness + 10})`
      ctx.fillRect(x, y, 2, 2)
    }

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
      <planeGeometry args={[5000, 5000]} />
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

export default function SurfaceEffects() {
  return (
    <>
      <PuddlePatches />
      <IcePatches />
      <SnowAccumulation />
    </>
  )
}
