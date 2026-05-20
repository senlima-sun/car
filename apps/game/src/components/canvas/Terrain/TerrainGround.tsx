import { useRef, useCallback, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RigidBody, CuboidCollider, HeightfieldCollider } from '@react-three/rapier'
import { useTexture } from '@react-three/drei'
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
  ultra: 191,
  high: 127,
  medium: 63,
  low: 31,
}

interface TerrainGroundProps {
  simplified?: boolean
  interactive?: boolean
}

interface GrassTextureSet {
  baseColor: THREE.Texture
  dryColor: THREE.Texture
  wornColor: THREE.Texture
  normal: THREE.Texture
  roughness: THREE.Texture
}

const GRASS_TILE_SIZE_METERS = 4
const INTERACTIVE_VISUAL_SUBDIVISIONS = 63

export function getTerrainVisualSubdivisions(
  tier: QualityTier,
  simplified: boolean | undefined,
  interactive: boolean | undefined,
): number {
  if (simplified) return 1
  const subdivisions = VISUAL_SUBDIVISIONS[tier]
  return interactive ? Math.min(subdivisions, INTERACTIVE_VISUAL_SUBDIVISIONS) : subdivisions
}

export default function TerrainGround({ simplified, interactive }: TerrainGroundProps) {
  const tier = usePerformanceStore(s => s.tier)
  const visualSubs = getTerrainVisualSubdivisions(tier, simplified, interactive)
  const resolution = useTerrainStore(s => s.resolution)
  const worldSize = useTerrainStore(s => s.worldSize)
  const generation = useTerrainStore(s => s.terrainGeneration)
  const grassTextures = useGrassTextures()

  return (
    <>
      <TerrainMeshVisual
        key={`terrain-visual-${visualSubs}`}
        grassTextures={grassTextures}
        simplified={simplified}
        subdivisions={visualSubs}
        resolution={resolution}
        worldSize={worldSize}
        version={generation}
      />
      <TerrainPhysics resolution={resolution} worldSize={worldSize} version={generation} />
      <OuterGround grassTextures={grassTextures} />
    </>
  )
}

function applyGrassShader(
  shader: THREE.WebGLProgramParametersWithUniforms,
  grassTextures: Pick<GrassTextureSet, 'dryColor' | 'wornColor'>,
  includeDisplacement: boolean,
) {
  shader.uniforms.uGrassDryMap = { value: grassTextures.dryColor }
  shader.uniforms.uGrassWornMap = { value: grassTextures.wornColor }
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>\n${GRASS_VERTEX_PREAMBLE}\n${GRASS_VERTEX_WORLDPOS_INJECT}`,
  )
  if (includeDisplacement) {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n${GRASS_VERTEX_DISPLACEMENT}`,
    )
  }
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
}

function useGrassTextures(): GrassTextureSet {
  const textures = useTexture([
    '/textures/grass_base_color.png',
    '/textures/grass_dry_color.png',
    '/textures/grass_worn_color.png',
    '/textures/grass_base_normal.png',
    '/textures/grass_base_roughness.png',
  ]) as THREE.Texture[]

  return useMemo(() => {
    const [baseColor, dryColor, wornColor, normal, roughness] = textures
    for (const texture of textures) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
    }
    baseColor.colorSpace = THREE.SRGBColorSpace
    dryColor.colorSpace = THREE.SRGBColorSpace
    wornColor.colorSpace = THREE.SRGBColorSpace
    return { baseColor, dryColor, wornColor, normal, roughness }
  }, [textures])
}

function useRepeatedGrassTextures(grassTextures: GrassTextureSet, worldSize: number) {
  const repeat = worldSize / GRASS_TILE_SIZE_METERS

  const repeatedTextures = useMemo(() => {
    const cloneTexture = (texture: THREE.Texture) => {
      const clone = texture.clone()
      clone.wrapS = THREE.RepeatWrapping
      clone.wrapT = THREE.RepeatWrapping
      clone.repeat.set(repeat, repeat)
      clone.colorSpace = texture.colorSpace
      clone.needsUpdate = true
      return clone
    }

    return {
      baseColor: cloneTexture(grassTextures.baseColor),
      dryColor: cloneTexture(grassTextures.dryColor),
      wornColor: cloneTexture(grassTextures.wornColor),
      normal: cloneTexture(grassTextures.normal),
      roughness: cloneTexture(grassTextures.roughness),
    }
  }, [grassTextures, repeat])

  useEffect(
    () => () => {
      repeatedTextures.baseColor.dispose()
      repeatedTextures.dryColor.dispose()
      repeatedTextures.wornColor.dispose()
      repeatedTextures.normal.dispose()
      repeatedTextures.roughness.dispose()
    },
    [repeatedTextures],
  )

  return repeatedTextures
}

function TerrainMeshVisual({
  grassTextures,
  simplified,
  subdivisions,
  resolution,
  worldSize,
  version,
}: {
  grassTextures: GrassTextureSet
  simplified?: boolean
  subdivisions: number
  resolution: number
  worldSize: number
  version: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const repeatedTextures = useRepeatedGrassTextures(grassTextures, worldSize)

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(worldSize, worldSize, subdivisions, subdivisions)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [worldSize, subdivisions])

  useEffect(() => {
    if (simplified || subdivisions <= 1) return
    const heightmap = useTerrainStore.getState().getComposedHeightsSnapshot()
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
      applyGrassShader(shader, repeatedTextures, true)
    },
    [repeatedTextures, simplified],
  )

  return (
    <mesh ref={meshRef} receiveShadow>
      <primitive object={geometry} attach='geometry' />
      {simplified ? (
        <meshStandardMaterial
          color='#ffffff'
          map={repeatedTextures.baseColor}
          normalMap={repeatedTextures.normal}
          normalScale={new THREE.Vector2(0.48, 0.48)}
          roughnessMap={repeatedTextures.roughness}
          roughness={0.92}
        />
      ) : (
        <meshStandardMaterial
          color='#ffffff'
          map={repeatedTextures.baseColor}
          normalMap={repeatedTextures.normal}
          normalScale={new THREE.Vector2(0.48, 0.48)}
          roughnessMap={repeatedTextures.roughness}
          roughness={0.92}
          onBeforeCompile={onBeforeCompile}
          ref={(mat: THREE.MeshStandardMaterial | null) => {
            if (mat) mat.customProgramCacheKey = () => 'grass-terrain-textured'
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
    const flat = useTerrainStore.getState().getComposedHeightsSnapshot()
    const transposed = new Array<number>(flat.length)
    for (let gz = 0; gz < resolution; gz++) {
      for (let gx = 0; gx < resolution; gx++) {
        transposed[gx * resolution + gz] = flat[gz * resolution + gx]!
      }
    }
    return transposed
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

function OuterGround({ grassTextures }: { grassTextures: GrassTextureSet }) {
  const repeatedTextures = useRepeatedGrassTextures(grassTextures, 5000)
  const onBeforeCompile = useCallback(
    (shader: THREE.WebGLProgramParametersWithUniforms) => {
      applyGrassShader(shader, repeatedTextures, false)
    },
    [repeatedTextures],
  )

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
        <meshStandardMaterial
          color='#ffffff'
          map={repeatedTextures.baseColor}
          normalMap={repeatedTextures.normal}
          normalScale={new THREE.Vector2(0.38, 0.38)}
          roughnessMap={repeatedTextures.roughness}
          roughness={0.9}
          onBeforeCompile={onBeforeCompile}
          ref={(mat: THREE.MeshStandardMaterial | null) => {
            if (mat) mat.customProgramCacheKey = () => 'grass-outer-textured'
          }}
        />
      </mesh>
    </>
  )
}
