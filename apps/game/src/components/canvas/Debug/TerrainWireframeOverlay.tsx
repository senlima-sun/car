import { useEffect, useMemo, type ReactElement } from 'react'
import * as THREE from 'three'
import { useTerrainStore } from '../../../stores/useTerrainStore'
import { useTerrainDebugStore } from '../../../stores/useTerrainDebugStore'
import { usePerformanceStore } from '../../../stores/usePerformanceStore'
import { getTerrainVisualSubdivisions } from '../Terrain/TerrainGround'

const FACE_COLOR = '#22d3ee'
const EDGE_COLOR = '#67e8f9'
const VERTEX_COLOR = '#fde047'
const VERTEX_SIZE = 0.45

export function TerrainWireframeOverlay(): ReactElement | null {
  const enabled = useTerrainDebugStore(s => s.enabled && s.showWireframe)
  const tier = usePerformanceStore(s => s.tier)
  const resolution = useTerrainStore(s => s.resolution)
  const worldSize = useTerrainStore(s => s.worldSize)
  const generation = useTerrainStore(s => s.terrainGeneration)

  const subdivisions = useMemo(
    () => getTerrainVisualSubdivisions(tier, false, false),
    [tier],
  )

  const surface = useMemo(() => {
    const geo = new THREE.PlaneGeometry(worldSize, worldSize, subdivisions, subdivisions)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [worldSize, subdivisions])

  const vertexPoints = useMemo(() => new THREE.BufferGeometry(), [])
  const wireframe = useMemo(() => new THREE.WireframeGeometry(surface), [surface])

  useEffect(() => {
    if (!enabled) return
    const heightmap = useTerrainStore.getState().getComposedHeightsSnapshot()
    const positions = surface.attributes.position.array as Float32Array
    const vertCount = (subdivisions + 1) * (subdivisions + 1)
    const cellSize = worldSize / (resolution - 1)
    const halfSize = worldSize / 2

    for (let i = 0; i < vertCount; i++) {
      const wx = positions[i * 3]!
      const wz = positions[i * 3 + 2]!
      const fxRaw = (wx + halfSize) / cellSize
      const fzRaw = (wz + halfSize) / cellSize
      const maxIdx = resolution - 1.0001
      const fx = fxRaw < 0 ? 0 : fxRaw > maxIdx ? maxIdx : fxRaw
      const fz = fzRaw < 0 ? 0 : fzRaw > maxIdx ? maxIdx : fzRaw
      const gx = Math.floor(fx)
      const gz = Math.floor(fz)
      const tx = fx - gx
      const tz = fz - gz
      const h00 = heightmap[gz * resolution + gx]!
      const h10 = heightmap[gz * resolution + gx + 1]!
      const h01 = heightmap[(gz + 1) * resolution + gx]!
      const h11 = heightmap[(gz + 1) * resolution + gx + 1]!
      const h0 = h00 + (h10 - h00) * tx
      const h1 = h01 + (h11 - h01) * tx
      positions[i * 3 + 1] = h0 + (h1 - h0) * tz
    }
    surface.attributes.position.needsUpdate = true
    surface.computeVertexNormals()

    const refreshed = new THREE.WireframeGeometry(surface)
    wireframe.copy(refreshed)
    refreshed.dispose()

    const vertexPositions = new Float32Array(vertCount * 3)
    for (let i = 0; i < vertCount; i++) {
      vertexPositions[i * 3] = positions[i * 3]!
      vertexPositions[i * 3 + 1] = positions[i * 3 + 1]! + 0.05
      vertexPositions[i * 3 + 2] = positions[i * 3 + 2]!
    }
    vertexPoints.setAttribute('position', new THREE.BufferAttribute(vertexPositions, 3))
    vertexPoints.attributes.position.needsUpdate = true
  }, [enabled, surface, wireframe, vertexPoints, generation, resolution, worldSize, subdivisions])

  useEffect(
    () => () => {
      surface.dispose()
      wireframe.dispose()
      vertexPoints.dispose()
    },
    [surface, wireframe, vertexPoints],
  )

  if (!enabled) return null

  return (
    <group renderOrder={999}>
      <mesh geometry={surface}>
        <meshBasicMaterial
          color={FACE_COLOR}
          transparent
          opacity={0.12}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments geometry={wireframe}>
        <lineBasicMaterial color={EDGE_COLOR} transparent opacity={0.85} depthTest />
      </lineSegments>
      <points geometry={vertexPoints}>
        <pointsMaterial
          color={VERTEX_COLOR}
          size={VERTEX_SIZE}
          sizeAttenuation
          transparent
          opacity={0.95}
          depthTest
        />
      </points>
    </group>
  )
}
