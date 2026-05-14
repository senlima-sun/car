import { useMemo } from 'react'
import { Vector3, BufferGeometry, Float32BufferAttribute } from 'three'
import { RigidBody, CuboidCollider, TrimeshCollider } from '@react-three/rapier'
import { OBJECT_CONFIGS } from '../../../constants/trackObjects'
import RoadSurfaceMaterial from './RoadSurfaceMaterial'
import { TRACK_COLLISION_GROUPS } from '../../../constants/dimensions'
import { smootherstep } from '../../../utils/roadGeometry'
import { useRoadSurfaces } from './hooks/useRoadSurfaces'
import { useTemperatureRegistration } from './hooks/useTemperatureRegistration'
import { EdgeLines } from './components/EdgeLines'
import { RoadSelectionHighlight } from './components/RoadSelectionHighlight'

interface RoadSegmentProps {
  position: [number, number, number]
  rotation?: number
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  isGhost?: boolean
  isSelectedForCurb?: boolean
  width?: number
  startElevation?: number
  endElevation?: number
  startLeftEdge?: [number, number, number]
  startRightEdge?: [number, number, number]
  endLeftEdge?: [number, number, number]
  endRightEdge?: [number, number, number]
}

const config = OBJECT_CONFIGS.road

export default function RoadSegment({
  position,
  rotation = 0,
  startPoint,
  endPoint,
  isGhost = false,
  isSelectedForCurb = false,
  width: widthProp,
  startElevation,
  endElevation,
  startLeftEdge,
  startRightEdge,
  endLeftEdge,
  endRightEdge,
}: RoadSegmentProps) {
  const width = widthProp ?? config.defaultSize.width
  const halfWidth = width / 2

  const hasEdgeOverrides = !!((startLeftEdge && startRightEdge) || (endLeftEdge && endRightEdge))

  const { length, calculatedRotation, midpoint, startElev, endElev, midElev, roadBounds } =
    useMemo(() => {
      const startElevValue = startElevation ?? 0
      const endElevValue = endElevation ?? 0
      const midElevValue = (startElevValue + endElevValue) / 2

      if (startPoint && endPoint) {
        const start = new Vector3(...startPoint)
        const end = new Vector3(...endPoint)
        const direction = end.clone().sub(start)
        const len = direction.length()
        const rot = Math.atan2(direction.x, direction.z)
        const mid: [number, number, number] = [
          (start.x + end.x) / 2,
          midElevValue,
          (start.z + end.z) / 2,
        ]
        const cos = Math.cos(rot)
        const sin = Math.sin(rot)
        const halfLength = len / 2
        const hw = (widthProp ?? config.defaultSize.width) / 2

        const corners = [
          { x: -hw, z: -halfLength },
          { x: hw, z: -halfLength },
          { x: -hw, z: halfLength },
          { x: hw, z: halfLength },
        ].map(c => ({
          x: mid[0] + c.x * cos - c.z * sin,
          z: mid[2] + c.x * sin + c.z * cos,
        }))

        const xs = corners.map(c => c.x)
        const zs = corners.map(c => c.z)

        return {
          length: len,
          calculatedRotation: rot,
          midpoint: mid,
          startElev: startElevValue,
          endElev: endElevValue,
          midElev: midElevValue,
          roadBounds: {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minZ: Math.min(...zs),
            maxZ: Math.max(...zs),
          },
        }
      }

      const len = 10
      const hw = (widthProp ?? config.defaultSize.width) / 2
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      const halfLength = len / 2

      const corners = [
        { x: -hw, z: -halfLength },
        { x: hw, z: -halfLength },
        { x: -hw, z: halfLength },
        { x: hw, z: halfLength },
      ].map(c => ({
        x: position[0] + c.x * cos - c.z * sin,
        z: position[2] + c.x * sin + c.z * cos,
      }))

      const xs = corners.map(c => c.x)
      const zs = corners.map(c => c.z)

      return {
        length: len,
        calculatedRotation: rotation,
        midpoint: position,
        startElev: startElevValue,
        endElev: endElevValue,
        midElev: midElevValue,
        roadBounds: {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minZ: Math.min(...zs),
          maxZ: Math.max(...zs),
        },
      }
    }, [startPoint, endPoint, rotation, position, startElevation, endElevation])

  const finalRotation = startPoint && endPoint ? calculatedRotation : rotation
  const finalPosition = startPoint && endPoint ? midpoint : position

  const { handleEnterRoad, handleExitRoad } = useRoadSurfaces({
    startElevation: startElevation ?? 0,
    endElevation: endElevation ?? 0,
    length,
  })

  useTemperatureRegistration(isGhost, roadBounds)

  const blendedGeometries = useMemo(() => {
    if (!hasEdgeOverrides || !startPoint || !endPoint) return null

    const segmentCount = Math.max(8, Math.ceil(length / 3))
    const startElv = startElevation ?? 0
    const endElv = endElevation ?? 0

    const dx = endPoint[0] - startPoint[0]
    const dz = endPoint[2] - startPoint[2]
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len < 0.001) return null

    const dirX = dx / len
    const dirZ = dz / len
    const perpX = -dirZ
    const perpZ = dirX

    const hasStartSnap = !!(startLeftEdge && startRightEdge)
    const hasEndSnap = !!(endLeftEdge && endRightEdge)

    const CROSS_SEGS = 8
    const roadVertices: number[] = []
    const roadIndices: number[] = []
    const roadUvs: number[] = []
    const leftEdgeVertices: number[] = []
    const leftEdgeIndices: number[] = []
    const rightEdgeVertices: number[] = []
    const rightEdgeIndices: number[] = []
    const edgeWidth = 0.2

    const naturalLeftAtStartX = startPoint[0] + perpX * halfWidth
    const naturalLeftAtStartZ = startPoint[2] + perpZ * halfWidth
    const naturalRightAtStartX = startPoint[0] - perpX * halfWidth
    const naturalRightAtStartZ = startPoint[2] - perpZ * halfWidth
    const naturalLeftAtEndX = endPoint[0] + perpX * halfWidth
    const naturalLeftAtEndZ = endPoint[2] + perpZ * halfWidth
    const naturalRightAtEndX = endPoint[0] - perpX * halfWidth
    const naturalRightAtEndZ = endPoint[2] - perpZ * halfWidth

    const startLeftOffX = hasStartSnap ? startLeftEdge![0] - naturalLeftAtStartX : 0
    const startLeftOffZ = hasStartSnap ? startLeftEdge![2] - naturalLeftAtStartZ : 0
    const startRightOffX = hasStartSnap ? startRightEdge![0] - naturalRightAtStartX : 0
    const startRightOffZ = hasStartSnap ? startRightEdge![2] - naturalRightAtStartZ : 0
    const endLeftOffX = hasEndSnap ? endLeftEdge![0] - naturalLeftAtEndX : 0
    const endLeftOffZ = hasEndSnap ? endLeftEdge![2] - naturalLeftAtEndZ : 0
    const endRightOffX = hasEndSnap ? endRightEdge![0] - naturalRightAtEndX : 0
    const endRightOffZ = hasEndSnap ? endRightEdge![2] - naturalRightAtEndZ : 0

    for (let i = 0; i <= segmentCount; i++) {
      const t = i / segmentCount
      const elevY = startElv + (endElv - startElv) * t + 0.01

      const cx = startPoint[0] + dx * t
      const cz = startPoint[2] + dz * t

      const naturalLeftX = cx + perpX * halfWidth
      const naturalLeftZ = cz + perpZ * halfWidth
      const naturalRightX = cx - perpX * halfWidth
      const naturalRightZ = cz - perpZ * halfWidth

      let leftX: number
      let leftZ: number
      let rightX: number
      let rightZ: number

      if (i === 0 && hasStartSnap) {
        leftX = startLeftEdge![0]
        leftZ = startLeftEdge![2]
        rightX = startRightEdge![0]
        rightZ = startRightEdge![2]
      } else if (i === segmentCount && hasEndSnap) {
        leftX = endLeftEdge![0]
        leftZ = endLeftEdge![2]
        rightX = endRightEdge![0]
        rightZ = endRightEdge![2]
      } else {
        const startInfluence = hasStartSnap ? smootherstep(1 - t) : 0
        const endInfluence = hasEndSnap ? smootherstep(t) : 0

        leftX = naturalLeftX + startLeftOffX * startInfluence + endLeftOffX * endInfluence
        leftZ = naturalLeftZ + startLeftOffZ * startInfluence + endLeftOffZ * endInfluence
        rightX = naturalRightX + startRightOffX * startInfluence + endRightOffX * endInfluence
        rightZ = naturalRightZ + startRightOffZ * startInfluence + endRightOffZ * endInfluence
      }

      for (let k = 0; k <= CROSS_SEGS; k++) {
        const tW = k / CROSS_SEGS
        roadVertices.push(leftX + (rightX - leftX) * tW, elevY, leftZ + (rightZ - leftZ) * tW)
        roadUvs.push(tW, t)
      }

      if (i > 0) {
        const row = i * (CROSS_SEGS + 1)
        const prevRow = (i - 1) * (CROSS_SEGS + 1)
        for (let k = 0; k < CROSS_SEGS; k++) {
          const a = prevRow + k
          const b = a + 1
          const c = row + k
          const d = c + 1
          roadIndices.push(a, b, c, b, d, c)
        }
      }

      const edgeY = elevY + 0.002
      const edgeDirX = leftX - rightX
      const edgeDirZ = leftZ - rightZ
      const edgeDirLen = Math.sqrt(edgeDirX * edgeDirX + edgeDirZ * edgeDirZ)
      const enX = edgeDirLen > 0 ? edgeDirX / edgeDirLen : perpX
      const enZ = edgeDirLen > 0 ? edgeDirZ / edgeDirLen : perpZ
      const inset = edgeWidth / 2

      leftEdgeVertices.push(leftX + enX * inset, edgeY, leftZ + enZ * inset)
      leftEdgeVertices.push(leftX - enX * inset, edgeY, leftZ - enZ * inset)
      rightEdgeVertices.push(rightX + enX * inset, edgeY, rightZ + enZ * inset)
      rightEdgeVertices.push(rightX - enX * inset, edgeY, rightZ - enZ * inset)

      if (i > 0) {
        const baseIdx = (i - 1) * 2
        leftEdgeIndices.push(baseIdx, baseIdx + 1, baseIdx + 2)
        leftEdgeIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
        rightEdgeIndices.push(baseIdx, baseIdx + 1, baseIdx + 2)
        rightEdgeIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
      }
    }

    const roadGeo = new BufferGeometry()
    roadGeo.setAttribute('position', new Float32BufferAttribute(roadVertices, 3))
    roadGeo.setAttribute('uv', new Float32BufferAttribute(roadUvs, 2))
    roadGeo.setIndex(roadIndices)
    roadGeo.computeVertexNormals()

    const leftGeo = new BufferGeometry()
    leftGeo.setAttribute('position', new Float32BufferAttribute(leftEdgeVertices, 3))
    leftGeo.setIndex(leftEdgeIndices)
    leftGeo.computeVertexNormals()

    const rightGeo = new BufferGeometry()
    rightGeo.setAttribute('position', new Float32BufferAttribute(rightEdgeVertices, 3))
    rightGeo.setIndex(rightEdgeIndices)
    rightGeo.computeVertexNormals()

    const overlap = 0.15
    const collVerts: number[] = []
    const collInds: number[] = []
    const collSteps = Math.max(2, Math.ceil(segmentCount / 2))
    for (let i = 0; i <= collSteps; i++) {
      const ct = i / collSteps
      const cElev = startElv + (endElv - startElv) * ct + 0.01
      const cpx = startPoint[0] + dx * ct
      const cpz = startPoint[2] + dz * ct
      const lx = cpx + perpX * halfWidth
      const lz = cpz + perpZ * halfWidth
      const rx = cpx - perpX * halfWidth
      const rz = cpz - perpZ * halfWidth

      const extX = dirX * (i === 0 ? -overlap : i === collSteps ? overlap : 0)
      const extZ = dirZ * (i === 0 ? -overlap : i === collSteps ? overlap : 0)

      collVerts.push(lx + extX, cElev, lz + extZ)
      collVerts.push(rx + extX, cElev, rz + extZ)
      collVerts.push(lx + extX, -0.15, lz + extZ)
      collVerts.push(rx + extX, -0.15, rz + extZ)

      if (i > 0) {
        const b = (i - 1) * 4
        collInds.push(b, b + 1, b + 4, b + 1, b + 5, b + 4)
        collInds.push(b + 2, b + 6, b + 3, b + 3, b + 6, b + 7)
        collInds.push(b, b + 4, b + 2, b + 2, b + 4, b + 6)
        collInds.push(b + 1, b + 3, b + 5, b + 3, b + 7, b + 5)
      }
    }

    return {
      roadGeo,
      leftGeo,
      rightGeo,
      collisionData: {
        vertices: new Float32Array(collVerts),
        indices: new Uint32Array(collInds),
      },
    }
  }, [
    hasEdgeOverrides,
    startPoint,
    endPoint,
    length,
    halfWidth,
    startElevation,
    endElevation,
    startLeftEdge,
    startRightEdge,
    endLeftEdge,
    endRightEdge,
  ])

  const { leftEdgeGeometry, rightEdgeGeometry } = useMemo(() => {
    if (hasEdgeOverrides) return { leftEdgeGeometry: null, rightEdgeGeometry: null }
    const halfW = width / 2
    const edgeWidth = 0.2
    const edgeOffset = halfW - edgeWidth / 2
    const hl = length / 2
    const startY = startElev - midElev + 0.012
    const endY = endElev - midElev + 0.012

    const createEdgeGeo = (sign: number) => {
      const geo = new BufferGeometry()
      const inner = sign * (edgeOffset - edgeWidth / 2)
      const outer = sign * (edgeOffset + edgeWidth / 2)
      const vertices = new Float32Array([
        inner,
        startY,
        -hl,
        outer,
        startY,
        -hl,
        inner,
        endY,
        hl,
        outer,
        endY,
        hl,
      ])
      geo.setAttribute('position', new Float32BufferAttribute(vertices, 3))
      geo.setIndex([0, 2, 1, 1, 2, 3])
      geo.computeVertexNormals()
      return geo
    }

    return {
      leftEdgeGeometry: createEdgeGeo(-1),
      rightEdgeGeometry: createEdgeGeo(1),
    }
  }, [hasEdgeOverrides, width, length, startElev, endElev, midElev])

  const slopeGeometry = useMemo(() => {
    if (hasEdgeOverrides) return null
    const geo = new BufferGeometry()
    const hw = width / 2
    const hl = length / 2
    const startY = startElev - midElev + 0.01
    const endY = endElev - midElev + 0.01

    const widthSegs = 8
    const lengthSegs = Math.max(2, Math.ceil(length / 3))
    const verts: number[] = []
    const uvs: number[] = []
    const idx: number[] = []

    for (let j = 0; j <= lengthSegs; j++) {
      const tLen = j / lengthSegs
      const z = -hl + tLen * length
      const y = startY + (endY - startY) * tLen
      for (let i = 0; i <= widthSegs; i++) {
        const tW = i / widthSegs
        const x = -hw + tW * width
        verts.push(x, y, z)
        uvs.push(tW, tLen)
      }
    }

    for (let j = 0; j < lengthSegs; j++) {
      for (let i = 0; i < widthSegs; i++) {
        const a = j * (widthSegs + 1) + i
        const b = a + 1
        const c = a + (widthSegs + 1)
        const d = c + 1
        idx.push(a, b, c, b, d, c)
      }
    }

    geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(verts), 3))
    geo.setAttribute('uv', new Float32BufferAttribute(new Float32Array(uvs), 2))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    return geo
  }, [hasEdgeOverrides, width, length, startElev, endElev, midElev])

  const rampColliderData = useMemo(() => {
    if (hasEdgeOverrides) return null
    const hw = width / 2
    const hl = length / 2
    const overlap = 0.15
    const topStartY = startElev - midElev + 0.01
    const topEndY = endElev - midElev + 0.01
    const botY = -0.15

    const vertices = new Float32Array([
      -hw,
      topStartY,
      -(hl + overlap),
      hw,
      topStartY,
      -(hl + overlap),
      -hw,
      topEndY,
      hl + overlap,
      hw,
      topEndY,
      hl + overlap,
      -hw,
      botY,
      -(hl + overlap),
      hw,
      botY,
      -(hl + overlap),
      -hw,
      botY,
      hl + overlap,
      hw,
      botY,
      hl + overlap,
    ])

    const indices = new Uint32Array([
      0, 1, 2, 2, 1, 3, 4, 6, 5, 5, 6, 7, 0, 4, 1, 1, 4, 5, 2, 3, 6, 6, 3, 7, 0, 2, 4, 4, 2, 6, 1,
      5, 3, 3, 5, 7,
    ])

    return { vertices, indices }
  }, [hasEdgeOverrides, width, length, startElev, endElev, midElev])

  if (hasEdgeOverrides && blendedGeometries) {
    const { roadGeo, leftGeo, rightGeo, collisionData } = blendedGeometries

    const roadVisuals = (
      <>
        <mesh geometry={roadGeo} receiveShadow={!isGhost}>
          <RoadSurfaceMaterial isGhost={isGhost} variant='road' side={2} />
        </mesh>
        <EdgeLines leftGeometry={leftGeo} rightGeometry={rightGeo} isGhost={isGhost} />
        <RoadSelectionHighlight
          isSelected={isSelectedForCurb}
          position={[finalPosition[0], (startElev + endElev) / 2 + 0.05, finalPosition[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
          width={width}
          length={length}
        />
      </>
    )

    if (isGhost) {
      return <group>{roadVisuals}</group>
    }

    return (
      <RigidBody type='fixed' colliders={false}>
        <CuboidCollider
          args={[halfWidth, midElev > 0.1 ? midElev + 1 : 0.5, length / 2]}
          position={finalPosition}
          rotation={[0, finalRotation, 0]}
          sensor
          onIntersectionEnter={handleEnterRoad}
          onIntersectionExit={handleExitRoad}
        />
        <TrimeshCollider
          args={[collisionData.vertices, collisionData.indices]}
          friction={config.friction}
          collisionGroups={TRACK_COLLISION_GROUPS}
        />
        {roadVisuals}
      </RigidBody>
    )
  }

  const roadVisuals = (
    <>
      {slopeGeometry && (
        <mesh geometry={slopeGeometry} receiveShadow={!isGhost}>
          <RoadSurfaceMaterial isGhost={isGhost} variant='road' side={2} />
        </mesh>
      )}

      <EdgeLines
        leftGeometry={leftEdgeGeometry}
        rightGeometry={rightEdgeGeometry}
        isGhost={isGhost}
      />

      <RoadSelectionHighlight
        isSelected={isSelectedForCurb}
        position={[0, (startElev + endElev) / 2 - midElev + 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={width}
        length={length}
      />
    </>
  )

  if (isGhost) {
    return (
      <group position={finalPosition} rotation={[0, finalRotation, 0]}>
        {roadVisuals}
      </group>
    )
  }

  return (
    <RigidBody
      type='fixed'
      position={finalPosition}
      rotation={[0, finalRotation, 0]}
      colliders={false}
    >
      <CuboidCollider
        args={[width / 2, midElev > 0.1 ? midElev + 1 : 0.5, length / 2]}
        position={[0, midElev > 0.1 ? 1 - midElev : 0.5, 0]}
        sensor
        onIntersectionEnter={handleEnterRoad}
        onIntersectionExit={handleExitRoad}
      />

      {rampColliderData && (
        <TrimeshCollider
          args={[rampColliderData.vertices, rampColliderData.indices]}
          friction={config.friction}
          collisionGroups={TRACK_COLLISION_GROUPS}
        />
      )}

      {roadVisuals}
    </RigidBody>
  )
}
