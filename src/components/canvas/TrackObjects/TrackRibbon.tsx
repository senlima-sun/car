import { useCallback, useMemo } from 'react'
import { Vector3, BufferGeometry, Float32BufferAttribute } from 'three'
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import { TRACK_COLLISION_GROUPS, TRACK_EDGE_LINE_WIDTH } from '../../../constants/dimensions'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import RoadSurfaceMaterial from './RoadSurfaceMaterial'
import { EdgeLines } from './components/EdgeLines'
import type { TrackRibbonPoint } from '../../../types/trackObjects'

interface TrackRibbonProps {
  points: TrackRibbonPoint[]
  closed: boolean
  width: number
  isGhost?: boolean
}

const SURFACE_Y_OFFSET = 0.05

type Ribbon = {
  mainGeometry: BufferGeometry
  pitGeometry: BufferGeometry | null
  leftEdgeGeometry: BufferGeometry | null
  rightEdgeGeometry: BufferGeometry | null
  collisionVertices: Float32Array
  collisionIndices: Uint32Array
  mainSensorVertices: Float32Array
  mainSensorIndices: Uint32Array
  pitSensorVertices: Float32Array | null
  pitSensorIndices: Uint32Array | null
}

export function buildRibbon(
  points: TrackRibbonPoint[],
  closed: boolean,
  width: number,
): Ribbon | null {
  const n = points.length
  if (n < 2) return null
  const halfWidth = width / 2

  const leftPositions: Vector3[] = []
  const rightPositions: Vector3[] = []

  for (let i = 0; i < n; i++) {
    const p = points[i]!
    const prevIdx = i === 0 ? (closed ? n - 1 : 0) : i - 1
    const nextIdx = i === n - 1 ? (closed ? 0 : n - 1) : i + 1
    const prev = points[prevIdx]!
    const next = points[nextIdx]!

    const tx = next.x - prev.x
    const tz = next.z - prev.z
    const len = Math.hypot(tx, tz) || 1
    const dirX = tx / len
    const dirZ = tz / len

    const nx = -dirZ
    const nz = dirX

    const cos = 1
    const miterScale = Math.min(4, 1 / Math.max(0.25, cos))
    const offset = halfWidth * miterScale

    leftPositions.push(new Vector3(p.x + nx * offset, p.y + SURFACE_Y_OFFSET, p.z + nz * offset))
    rightPositions.push(new Vector3(p.x - nx * offset, p.y + SURFACE_Y_OFFSET, p.z - nz * offset))
  }

  const totalVerts = n * 2
  const positions = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const normals = new Float32Array(totalVerts * 3)
  for (let i = 0; i < n; i++) {
    const L = leftPositions[i]!
    const R = rightPositions[i]!
    const baseL = i * 2 * 3
    const baseR = (i * 2 + 1) * 3
    positions[baseL] = L.x
    positions[baseL + 1] = L.y
    positions[baseL + 2] = L.z
    positions[baseR] = R.x
    positions[baseR + 1] = R.y
    positions[baseR + 2] = R.z
    uvs[i * 2 * 2] = 0
    uvs[i * 2 * 2 + 1] = i
    uvs[(i * 2 + 1) * 2] = 1
    uvs[(i * 2 + 1) * 2 + 1] = i
    normals[baseL] = 0
    normals[baseL + 1] = 1
    normals[baseL + 2] = 0
    normals[baseR] = 0
    normals[baseR + 1] = 1
    normals[baseR + 2] = 0
  }

  const segmentCount = closed ? n : n - 1
  const mainIndicesArr: number[] = []
  const pitIndicesArr: number[] = []
  const leftEdgeVertices: number[] = []
  const rightEdgeVertices: number[] = []
  const leftEdgeIndices: number[] = []
  const rightEdgeIndices: number[] = []

  for (let i = 0; i < n; i++) {
    const L = leftPositions[i]!
    const R = rightPositions[i]!
    const edgeDir = new Vector3().subVectors(L, R)
    const edgeDirLen = edgeDir.length()
    if (edgeDirLen > 0) edgeDir.divideScalar(edgeDirLen)
    const inset = TRACK_EDGE_LINE_WIDTH
    const edgeY = Math.max(L.y, R.y) + 0.002

    leftEdgeVertices.push(L.x, edgeY, L.z)
    leftEdgeVertices.push(L.x - edgeDir.x * inset, edgeY, L.z - edgeDir.z * inset)
    rightEdgeVertices.push(R.x, edgeY, R.z)
    rightEdgeVertices.push(R.x + edgeDir.x * inset, edgeY, R.z + edgeDir.z * inset)
  }

  for (let i = 0; i < segmentCount; i++) {
    const a = i
    const b = (i + 1) % n
    const iA_L = a * 2
    const iA_R = a * 2 + 1
    const iB_L = b * 2
    const iB_R = b * 2 + 1
    const isPitSegment = points[a]!.isPitLane && points[b]!.isPitLane
    const target = isPitSegment ? pitIndicesArr : mainIndicesArr
    target.push(iA_L, iB_L, iA_R)
    target.push(iB_L, iB_R, iA_R)

    const iA_LO = a * 2
    const iA_LI = a * 2 + 1
    const iB_LO = b * 2
    const iB_LI = b * 2 + 1
    leftEdgeIndices.push(iA_LO, iB_LO, iA_LI)
    leftEdgeIndices.push(iB_LO, iB_LI, iA_LI)

    const iA_RO = a * 2
    const iA_RI = a * 2 + 1
    const iB_RO = b * 2
    const iB_RI = b * 2 + 1
    rightEdgeIndices.push(iA_RO, iA_RI, iB_RO)
    rightEdgeIndices.push(iB_RO, iA_RI, iB_RI)
  }

  const mainGeometry = new BufferGeometry()
  mainGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  mainGeometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  mainGeometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  mainGeometry.setIndex(mainIndicesArr)
  mainGeometry.computeBoundingBox()
  mainGeometry.computeBoundingSphere()

  let pitGeometry: BufferGeometry | null = null
  if (pitIndicesArr.length > 0) {
    pitGeometry = new BufferGeometry()
    pitGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    pitGeometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    pitGeometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
    pitGeometry.setIndex(pitIndicesArr)
    pitGeometry.computeBoundingBox()
    pitGeometry.computeBoundingSphere()
  }

  const leftEdgeGeometry = new BufferGeometry()
  leftEdgeGeometry.setAttribute('position', new Float32BufferAttribute(leftEdgeVertices, 3))
  leftEdgeGeometry.setIndex(leftEdgeIndices)
  leftEdgeGeometry.computeVertexNormals()
  leftEdgeGeometry.computeBoundingBox()
  leftEdgeGeometry.computeBoundingSphere()

  const rightEdgeGeometry = new BufferGeometry()
  rightEdgeGeometry.setAttribute('position', new Float32BufferAttribute(rightEdgeVertices, 3))
  rightEdgeGeometry.setIndex(rightEdgeIndices)
  rightEdgeGeometry.computeVertexNormals()
  rightEdgeGeometry.computeBoundingBox()
  rightEdgeGeometry.computeBoundingSphere()

  const collisionIndicesArr = [...mainIndicesArr, ...pitIndicesArr]
  const collisionIndices = new Uint32Array(collisionIndicesArr)
  const collisionVertices = new Float32Array(positions)

  return {
    mainGeometry,
    pitGeometry,
    leftEdgeGeometry,
    rightEdgeGeometry,
    collisionVertices,
    collisionIndices,
    mainSensorVertices: new Float32Array(positions),
    mainSensorIndices: new Uint32Array(mainIndicesArr),
    pitSensorVertices: pitIndicesArr.length > 0 ? new Float32Array(positions) : null,
    pitSensorIndices: pitIndicesArr.length > 0 ? new Uint32Array(pitIndicesArr) : null,
  }
}

export default function TrackRibbon({ points, closed, width, isGhost = false }: TrackRibbonProps) {
  const ribbon = useMemo(() => buildRibbon(points, closed, width), [points, closed, width])
  const enterSurface = useSurfaceStore(s => s.enterSurface)
  const exitSurface = useSurfaceStore(s => s.exitSurface)

  const enterRoad = useCallback(() => enterSurface('road'), [enterSurface])
  const exitRoad = useCallback(() => exitSurface('road'), [exitSurface])
  const enterPit = useCallback(() => enterSurface('pitroad'), [enterSurface])
  const exitPit = useCallback(() => exitSurface('pitroad'), [exitSurface])

  if (!ribbon) return null
  if (ribbon.collisionIndices.length === 0) return null

  return (
    <group>
      <RigidBody type='fixed' colliders={false} friction={1.0}>
        <TrimeshCollider
          args={[ribbon.collisionVertices, ribbon.collisionIndices]}
          collisionGroups={TRACK_COLLISION_GROUPS}
        />
      </RigidBody>
      {!isGhost && (
        <RigidBody type='fixed' colliders={false}>
          {ribbon.mainSensorIndices.length > 0 && (
            <TrimeshCollider
              args={[ribbon.mainSensorVertices, ribbon.mainSensorIndices]}
              sensor
              onIntersectionEnter={enterRoad}
              onIntersectionExit={exitRoad}
            />
          )}
          {ribbon.pitSensorIndices && ribbon.pitSensorVertices && (
            <TrimeshCollider
              args={[ribbon.pitSensorVertices, ribbon.pitSensorIndices]}
              sensor
              onIntersectionEnter={enterPit}
              onIntersectionExit={exitPit}
            />
          )}
        </RigidBody>
      )}
      <mesh geometry={ribbon.mainGeometry} receiveShadow>
        <RoadSurfaceMaterial isGhost={isGhost} variant='road' />
      </mesh>
      <EdgeLines
        leftGeometry={ribbon.leftEdgeGeometry}
        rightGeometry={ribbon.rightEdgeGeometry}
        isGhost={isGhost}
      />
      {ribbon.pitGeometry && (
        <mesh geometry={ribbon.pitGeometry} receiveShadow>
          <RoadSurfaceMaterial isGhost={isGhost} variant='pitroad' />
        </mesh>
      )}
    </group>
  )
}
