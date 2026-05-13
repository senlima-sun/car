import { useCallback, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { TRACK_LAYER_POLYGON_OFFSETS } from '../../../constants/trackLayers'
import { resolveParentDerivedLayer } from '../../../utils/parentDerivedLayer'
import { buildAsphaltGeometry } from './geometry/ribbonGeometry'
import type { PlacedObject } from '../../../types/trackObjects'

interface PaintedAreaProps {
  placed: PlacedObject
  parentRibbon: PlacedObject | undefined
  isGhost?: boolean
}

const PAINTED_COLOR = '#a8d89c'

interface PaintedAreaMesh {
  geometry: THREE.BufferGeometry
  sensorVertices: Float32Array
  sensorIndices: Uint32Array
}

export default function PaintedArea({ placed, parentRibbon, isGhost = false }: PaintedAreaProps) {
  const meshes = useMemo<PaintedAreaMesh[]>(() => {
    if (!placed.parentRibbonId) {
      if (import.meta.env.DEV) {
        console.warn(`[PaintedArea] ${placed.id} has no parentRibbonId; layer skipped.`)
      }
      return []
    }
    const segments = resolveParentDerivedLayer(placed, { parent: parentRibbon })
    const out: PaintedAreaMesh[] = []
    for (const seg of segments) {
      if (seg.points.length < 2) continue
      const result = buildAsphaltGeometry(seg.points, seg.closed, seg.width)
      if (!result || result.mainIndices.length === 0) continue
      out.push({
        geometry: result.geometry,
        sensorVertices: result.positions,
        sensorIndices: new Uint32Array(result.mainIndices),
      })
    }
    return out
  }, [placed, parentRibbon])

  const enterSurface = useSurfaceStore(s => s.enterSurface)
  const exitSurface = useSurfaceStore(s => s.exitSurface)

  const handleEnter = useCallback(() => {
    if (isGhost) return
    enterSurface('painted_area')
  }, [isGhost, enterSurface])

  const handleExit = useCallback(() => {
    if (isGhost) return
    exitSurface('painted_area')
  }, [isGhost, exitSurface])

  useEffect(() => {
    return () => {
      for (const m of meshes) m.geometry.dispose()
    }
  }, [meshes])

  if (meshes.length === 0) return null

  return (
    <group>
      {meshes.map((m, i) => (
        <group key={i}>
          <mesh geometry={m.geometry} receiveShadow>
            <meshStandardMaterial
              color={PAINTED_COLOR}
              roughness={0.7}
              metalness={0.0}
              side={THREE.DoubleSide}
              polygonOffset
              polygonOffsetFactor={TRACK_LAYER_POLYGON_OFFSETS.PAINTED_AREA.factor}
              polygonOffsetUnits={TRACK_LAYER_POLYGON_OFFSETS.PAINTED_AREA.units}
            />
          </mesh>
          {!isGhost && (
            <RigidBody type='fixed' colliders={false}>
              <TrimeshCollider
                args={[m.sensorVertices, m.sensorIndices]}
                sensor
                onIntersectionEnter={handleEnter}
                onIntersectionExit={handleExit}
              />
            </RigidBody>
          )}
        </group>
      ))}
    </group>
  )
}
