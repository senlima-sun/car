import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'
import { TRACK_EDGE_LINE_WIDTH } from '../../../../constants/dimensions'
import { TRACK_LAYER_Y_OFFSETS } from '../../../../constants/trackLayers'
import type { TrackRibbonPoint } from '../../../../types/trackObjects'

export interface RibbonFrames {
  leftPositions: Vector3[]
  rightPositions: Vector3[]
}

export interface AsphaltGeometryResult {
  geometry: BufferGeometry
  positions: Float32Array
  uvs: Float32Array
  normals: Float32Array
  mainIndices: number[]
  pitIndices: number[]
  frames: RibbonFrames
}

export interface PitGeometryResult {
  geometry: BufferGeometry
  indices: number[]
}

export interface RibbonLayers {
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

export function computeRibbonFrames(
  points: TrackRibbonPoint[],
  closed: boolean,
  width: number,
): RibbonFrames | null {
  const n = points.length
  if (n < 2) return null
  const halfWidth = width / 2
  const surfaceY = TRACK_LAYER_Y_OFFSETS.ASPHALT

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
    const offset = halfWidth

    leftPositions.push(new Vector3(p.x + nx * offset, p.y + surfaceY, p.z + nz * offset))
    rightPositions.push(new Vector3(p.x - nx * offset, p.y + surfaceY, p.z - nz * offset))
  }

  return { leftPositions, rightPositions }
}

function buildRibbonAttributes(frames: RibbonFrames) {
  const n = frames.leftPositions.length
  const totalVerts = n * 2
  const positions = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const normals = new Float32Array(totalVerts * 3)

  for (let i = 0; i < n; i++) {
    const L = frames.leftPositions[i]!
    const R = frames.rightPositions[i]!
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

  return { positions, uvs, normals }
}

function segmentRibbonIndices(points: TrackRibbonPoint[], closed: boolean) {
  const n = points.length
  const segmentCount = closed ? n : n - 1
  const mainIndices: number[] = []
  const pitIndices: number[] = []

  for (let i = 0; i < segmentCount; i++) {
    const a = i
    const b = (i + 1) % n
    const iA_L = a * 2
    const iA_R = a * 2 + 1
    const iB_L = b * 2
    const iB_R = b * 2 + 1
    const isPitSegment = points[a]!.isPitLane && points[b]!.isPitLane
    const target = isPitSegment ? pitIndices : mainIndices
    target.push(iA_L, iB_L, iA_R)
    target.push(iB_L, iB_R, iA_R)
  }

  return { mainIndices, pitIndices }
}

export function buildAsphaltGeometry(
  points: TrackRibbonPoint[],
  closed: boolean,
  width: number,
  precomputedFrames?: RibbonFrames,
): AsphaltGeometryResult | null {
  const frames = precomputedFrames ?? computeRibbonFrames(points, closed, width)
  if (!frames) return null

  const { positions, uvs, normals } = buildRibbonAttributes(frames)
  const { mainIndices, pitIndices } = segmentRibbonIndices(points, closed)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setIndex(mainIndices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  return { geometry, positions, uvs, normals, mainIndices, pitIndices, frames }
}

export function buildPitLaneGeometry(
  points: TrackRibbonPoint[],
  closed: boolean,
  width: number,
  shared?: { positions: Float32Array; uvs: Float32Array; normals: Float32Array; pitIndices?: number[] },
): PitGeometryResult | null {
  let positions: Float32Array
  let uvs: Float32Array
  let normals: Float32Array
  let pitIndices: number[]

  if (shared && shared.pitIndices) {
    if (shared.pitIndices.length === 0) return null
    positions = shared.positions
    uvs = shared.uvs
    normals = shared.normals
    pitIndices = shared.pitIndices
  } else {
    const frames = computeRibbonFrames(points, closed, width)
    if (!frames) return null
    const attrs = buildRibbonAttributes(frames)
    positions = attrs.positions
    uvs = attrs.uvs
    normals = attrs.normals
    pitIndices = segmentRibbonIndices(points, closed).pitIndices
    if (pitIndices.length === 0) return null
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setIndex(pitIndices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  return { geometry, indices: pitIndices }
}

const EDGE_LINE_Y_OVER_ASPHALT =
  TRACK_LAYER_Y_OFFSETS.EDGE_LINE - TRACK_LAYER_Y_OFFSETS.ASPHALT

export function buildEdgeLineGeometry(
  frames: RibbonFrames,
  side: 'left' | 'right',
  closed: boolean,
  inset: number = TRACK_EDGE_LINE_WIDTH,
): BufferGeometry {
  const n = frames.leftPositions.length
  const segmentCount = closed ? n : n - 1
  const vertices: number[] = []
  const indices: number[] = []

  for (let i = 0; i < n; i++) {
    const L = frames.leftPositions[i]!
    const R = frames.rightPositions[i]!
    const edgeDir = new Vector3().subVectors(L, R)
    const edgeDirLen = edgeDir.length()
    if (edgeDirLen > 0) edgeDir.divideScalar(edgeDirLen)
    const edgeY = Math.max(L.y, R.y) + EDGE_LINE_Y_OVER_ASPHALT

    if (side === 'left') {
      vertices.push(L.x, edgeY, L.z)
      vertices.push(L.x - edgeDir.x * inset, edgeY, L.z - edgeDir.z * inset)
    } else {
      vertices.push(R.x, edgeY, R.z)
      vertices.push(R.x + edgeDir.x * inset, edgeY, R.z + edgeDir.z * inset)
    }
  }

  for (let i = 0; i < segmentCount; i++) {
    const a = i
    const b = (i + 1) % n
    const iA_O = a * 2
    const iA_I = a * 2 + 1
    const iB_O = b * 2
    const iB_I = b * 2 + 1
    if (side === 'left') {
      indices.push(iA_O, iB_O, iA_I)
      indices.push(iB_O, iB_I, iA_I)
    } else {
      indices.push(iA_O, iA_I, iB_O)
      indices.push(iB_O, iA_I, iB_I)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export function buildRibbonLayers(
  points: TrackRibbonPoint[],
  closed: boolean,
  width: number,
): RibbonLayers | null {
  const asphalt = buildAsphaltGeometry(points, closed, width)
  if (!asphalt) return null

  const { positions, uvs, normals, mainIndices, pitIndices, frames, geometry: mainGeometry } = asphalt

  const pitGeometry =
    pitIndices.length > 0
      ? buildPitLaneGeometry(points, closed, width, { positions, uvs, normals, pitIndices })?.geometry ?? null
      : null

  const leftEdgeGeometry = buildEdgeLineGeometry(frames, 'left', closed)
  const rightEdgeGeometry = buildEdgeLineGeometry(frames, 'right', closed)

  const collisionIndicesArr = [...mainIndices, ...pitIndices]
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
    mainSensorIndices: new Uint32Array(mainIndices),
    pitSensorVertices: pitIndices.length > 0 ? new Float32Array(positions) : null,
    pitSensorIndices: pitIndices.length > 0 ? new Uint32Array(pitIndices) : null,
  }
}
