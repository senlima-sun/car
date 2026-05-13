import { useCallback, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { RigidBody, CuboidCollider, TrimeshCollider } from '@react-three/rapier'
import { OBJECT_CONFIGS } from '../../../constants/trackObjects'
import {
  CURB_PEAK_HEIGHTS,
  CURB_WIDTH,
  getProfileForType,
  getSawtoothHeight,
} from '../../../constants/curb'
import { TRACK_COLLISION_GROUPS } from '../../../constants/dimensions'
import { useCurbStore } from '../../../stores/useCurbStore'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import type { CurbType, PlacedObject, TrackRibbonPoint } from '../../../types/trackObjects'
import { computeRibbonTangents } from './geometry/ribbonGeometry'
import { resolveParentDerivedLayer } from '../../../utils/parentDerivedLayer'
import CurbSurfaceMaterial from './CurbSurfaceMaterial'

const PROFILE_SUBDIVISIONS = 6

const curbConfig = OBJECT_CONFIGS.curb

interface RibbonCurbSegmentProps {
  curb: PlacedObject
  parentRibbon?: PlacedObject
  isGhost?: boolean
}

function getProfileHeight(normalizedX: number, curbType: CurbType): number {
  const profile = getProfileForType(curbType)
  const x = normalizedX * CURB_WIDTH
  for (let i = 0; i < profile.length - 1; i++) {
    const p1 = profile[i]
    const p2 = profile[i + 1]
    if (x >= p1.x && x <= p2.x) {
      const t = (x - p1.x) / (p2.x - p1.x)
      return p1.y + t * (p2.y - p1.y)
    }
  }
  return 0
}

interface BuildResult {
  geometry: BufferGeometry
  collisionVertices: Float32Array
  collisionIndices: Uint32Array
  sensor: { center: [number, number, number]; halfDepth: number } | null
}

function resolveCurbCenter(
  curb: PlacedObject,
  parentRibbon?: PlacedObject,
): TrackRibbonPoint[] | null {
  if (curb.parentRibbonId) {
    const resolved = resolveParentDerivedLayer(
      curb,
      { parent: parentRibbon },
      { resampleSpacing: 0.5 },
    )
    return resolved?.points ?? null
  }
  return curb.curbCenterline ?? null
}

function buildRibbonCurb(curb: PlacedObject, parentRibbon?: PlacedObject): BuildResult | null {
  const center = resolveCurbCenter(curb, parentRibbon)
  if (!center || center.length < 2) return null
  const curbType: CurbType = curb.curbType ?? 'apex'
  const sign = curb.edgeSide === 'right' ? -1 : 1
  const isExit = curbType === 'exit'

  const tangents = computeRibbonTangents(center, false)

  let arcLength = 0
  const arcAt: number[] = [0]
  for (let i = 1; i < center.length; i++) {
    const dx = center[i]!.x - center[i - 1]!.x
    const dz = center[i]!.z - center[i - 1]!.z
    arcLength += Math.hypot(dx, dz)
    arcAt.push(arcLength)
  }
  if (arcLength < 0.05) return null

  const vertsPerRow = PROFILE_SUBDIVISIONS + 1
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let i = 0; i < center.length; i++) {
    const c = center[i]!
    const tan = tangents[i]!
    const perpX = -tan.z * sign
    const perpZ = tan.x * sign
    const arcPos = arcAt[i]!
    const sawMod = isExit ? getSawtoothHeight(arcPos) : 1

    for (let p = 0; p <= PROFILE_SUBDIVISIONS; p++) {
      const normalizedWidth = p / PROFILE_SUBDIVISIONS
      const baseHeight = getProfileHeight(normalizedWidth, curbType)
      const height = isExit ? baseHeight * sawMod : baseHeight
      const widthOffset = (normalizedWidth - 0.5) * CURB_WIDTH
      const x = c.x + perpX * widthOffset
      const z = c.z + perpZ * widthOffset
      positions.push(x, c.y + height, z)
      uvs.push(normalizedWidth, arcPos)
    }
  }

  for (let i = 0; i < center.length - 1; i++) {
    for (let p = 0; p < PROFILE_SUBDIVISIONS; p++) {
      const a = i * vertsPerRow + p
      const b = i * vertsPerRow + p + 1
      const c = (i + 1) * vertsPerRow + p
      const d = (i + 1) * vertsPerRow + p + 1
      indices.push(a, c, b)
      indices.push(b, c, d)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const midIndex = Math.floor(center.length / 2)
  const midC = center[midIndex]!
  const peakHeight = CURB_PEAK_HEIGHTS[curbType]

  return {
    geometry,
    collisionVertices: new Float32Array(positions),
    collisionIndices: new Uint32Array(indices),
    sensor: {
      center: [midC.x, midC.y + peakHeight / 2, midC.z],
      halfDepth: arcLength / 2,
    },
  }
}

export default function RibbonCurbSegment({
  curb,
  parentRibbon,
  isGhost = false,
}: RibbonCurbSegmentProps) {
  const enterCurb = useCurbStore(state => state.enterCurb)
  const exitCurb = useCurbStore(state => state.exitCurb)
  const enterSurface = useSurfaceStore(s => s.enterSurface)
  const exitSurface = useSurfaceStore(s => s.exitSurface)

  const curbType: CurbType = curb.curbType ?? 'apex'
  const peakHeight = CURB_PEAK_HEIGHTS[curbType]
  const result = useMemo(() => buildRibbonCurb(curb, parentRibbon), [curb, parentRibbon])

  const handleEnter = useCallback(() => {
    if (isGhost || !curb.edgeSide) return
    enterCurb(curb.edgeSide, curbType)
    enterSurface('curb')
  }, [isGhost, curb.edgeSide, curbType, enterCurb, enterSurface])

  const handleExit = useCallback(() => {
    if (isGhost) return
    exitCurb()
    exitSurface('curb')
  }, [isGhost, exitCurb, exitSurface])

  if (!result) return null

  if (isGhost) {
    return (
      <mesh geometry={result.geometry}>
        <CurbSurfaceMaterial curbType={curbType} isGhost />
      </mesh>
    )
  }

  return (
    <RigidBody
      type='fixed'
      friction={curbConfig.friction}
      restitution={curbConfig.restitution}
      colliders={false}
    >
      {result.sensor && (
        <CuboidCollider
          position={result.sensor.center}
          args={[CURB_WIDTH / 2, peakHeight / 2, result.sensor.halfDepth]}
          sensor
          onIntersectionEnter={handleEnter}
          onIntersectionExit={handleExit}
        />
      )}
      {result.collisionVertices.length > 0 && (
        <TrimeshCollider
          args={[result.collisionVertices, result.collisionIndices]}
          friction={curbConfig.friction}
          collisionGroups={TRACK_COLLISION_GROUPS}
        />
      )}
      <mesh geometry={result.geometry} receiveShadow castShadow>
        <CurbSurfaceMaterial curbType={curbType} />
      </mesh>
    </RigidBody>
  )
}
