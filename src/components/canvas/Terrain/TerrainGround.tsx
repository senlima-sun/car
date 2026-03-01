import { useRef, useCallback, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RigidBody, CuboidCollider, HeightfieldCollider } from '@react-three/rapier'
import { GROUND_COLLISION_GROUPS } from '@/constants/dimensions'
import {
  GRASS_VERTEX_PREAMBLE,
  GRASS_VERTEX_DISPLACEMENT,
  GRASS_VERTEX_WORLDPOS_INJECT,
  GRASS_FRAGMENT_PREAMBLE,
  GRASS_COLOR_INJECT,
  GRASS_ROUGHNESS_INJECT,
} from '@/shaders/grassSurface'
import { useTerrainStore } from '@/stores/useTerrainStore'
import { usePerformanceStore, type QualityTier } from '@/stores/usePerformanceStore'

const VISUAL_SUBDIVISIONS: Record<QualityTier, number> = {
  ultra: 255,
  high: 191,
  medium: 127,
  low: 63,
}

interface TerrainGroundProps {
  simplified?: boolean
}

export default function TerrainGround({ simplified }: TerrainGroundProps) {
  const tier = usePerformanceStore(s => s.tier)
  const visualSubs = simplified ? 1 : VISUAL_SUBDIVISIONS[tier]
  const resolution = useTerrainStore(s => s.resolution)
  const worldSize = useTerrainStore(s => s.worldSize)
  const version = useTerrainStore(s => s.version)
  const physicsVersion = useTerrainStore(s => s.physicsVersion)

  return (
    <>
      <TerrainMeshVisual
        key={`terrain-visual-${visualSubs}`}
        simplified={simplified}
        subdivisions={visualSubs}
        resolution={resolution}
        worldSize={worldSize}
        version={version}
      />
      <TerrainPhysics
        resolution={resolution}
        worldSize={worldSize}
        version={physicsVersion}
      />
      <OuterGround />
    </>
  )
}

function TerrainMeshVisual({
  simplified,
  subdivisions,
  resolution,
  worldSize,
  version,
}: {
  simplified?: boolean
  subdivisions: number
  resolution: number
  worldSize: number
  version: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(worldSize, worldSize, subdivisions, subdivisions)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [worldSize, subdivisions])

  useEffect(() => {
    if (simplified || subdivisions <= 1) return
    const heightmap = useTerrainStore.getState().heightmap
    const positions = geometry.attributes.position.array as Float32Array
    const vertCount = (subdivisions + 1) * (subdivisions + 1)
    const cellSize = worldSize / (resolution - 1)
    const halfSize = worldSize / 2

    for (let i = 0; i < vertCount; i++) {
      const wx = positions[i * 3]
      const wz = positions[i * 3 + 2]

      const fx = (wx + halfSize) / cellSize
      const fz = (wz + halfSize) / cellSize

      if (fx < 0 || fx >= resolution - 1 || fz < 0 || fz >= resolution - 1) {
        positions[i * 3 + 1] = 0
        continue
      }

      const gx = Math.floor(fx)
      const gz = Math.floor(fz)
      const tx = fx - gx
      const tz = fz - gz

      const h00 = heightmap[gz * resolution + gx]
      const h10 = heightmap[gz * resolution + gx + 1]
      const h01 = heightmap[(gz + 1) * resolution + gx]
      const h11 = heightmap[(gz + 1) * resolution + gx + 1]

      const h0 = h00 + (h10 - h00) * tx
      const h1 = h01 + (h11 - h01) * tx
      positions[i * 3 + 1] = h0 + (h1 - h0) * tz
    }

    geometry.attributes.position.needsUpdate = true
    geometry.computeVertexNormals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, version, simplified, subdivisions, resolution, worldSize])

  const onBeforeCompile = useCallback(
    (shader: THREE.WebGLProgramParametersWithUniforms) => {
      if (simplified) return
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>\n${GRASS_VERTEX_PREAMBLE}\n${GRASS_VERTEX_WORLDPOS_INJECT}`,
      )
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${GRASS_VERTEX_DISPLACEMENT}`,
      )
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>\nvGrassWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>\n${GRASS_FRAGMENT_PREAMBLE}`,
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>\n${GRASS_COLOR_INJECT}`,
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>\n${GRASS_ROUGHNESS_INJECT}`,
      )
    },
    [simplified],
  )

  return (
    <mesh ref={meshRef} receiveShadow>
      <primitive object={geometry} attach='geometry' />
      {simplified ? (
        <meshStandardMaterial roughness={0.9} color='#88aa66' />
      ) : (
        <meshStandardMaterial
          roughness={0.9}
          color='#88aa66'
          onBeforeCompile={onBeforeCompile}
          ref={(mat: THREE.MeshStandardMaterial | null) => {
            if (mat) mat.customProgramCacheKey = () => 'grass-terrain-procedural'
          }}
        />
      )}
    </mesh>
  )
}

function TerrainPhysics({
  resolution,
  worldSize,
  version,
}: {
  resolution: number
  worldSize: number
  version: number
}) {
  const heights = useMemo(() => {
    const heightmap = useTerrainStore.getState().heightmap
    const out = Array.from(heightmap)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution, version])

  return (
    <RigidBody type='fixed' colliders={false} key={`terrain-physics-${version}`}>
      <HeightfieldCollider
        args={[resolution - 1, resolution - 1, heights, { x: worldSize, y: 1, z: worldSize }]}
        friction={0.4}
        collisionGroups={GROUND_COLLISION_GROUPS}
      />
    </RigidBody>
  )
}

function OuterGround() {
  return (
    <>
      <RigidBody type='fixed' colliders={false}>
        <CuboidCollider
          args={[2500, 0.1, 2500]}
          position={[0, -0.12, 0]}
          friction={0.4}
          collisionGroups={GROUND_COLLISION_GROUPS}
        />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[5000, 5000, 1, 1]} />
        <meshStandardMaterial roughness={0.9} color='#88aa66' />
      </mesh>
    </>
  )
}
