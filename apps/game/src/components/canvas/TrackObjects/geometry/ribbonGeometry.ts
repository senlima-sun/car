import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'
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

export interface EdgeLineGeometryResult {
  geometry: BufferGeometry
  positions: Float32Array
  uvs: Float32Array
  normals: Float32Array
  indices: number[]
  frames: RibbonFrames
}

export type SideBandGeometryResult = EdgeLineGeometryResult

export interface RibbonLayers {
  mainGeometry: BufferGeometry
  pitGeometry: BufferGeometry | null
  collisionVertices: Float32Array
  collisionIndices: Uint32Array
  mainSensorVertices: Float32Array
  mainSensorIndices: Uint32Array
  pitSensorVertices: Float32Array | null
  pitSensorIndices: Uint32Array | null
}

export interface Tangent2D {
  x: number
  z: number
}

export function computeRibbonTangents(
  points: { x: number; z: number }[],
  closed: boolean,
): Tangent2D[] {
  const n = points.length
  const tangents: Tangent2D[] = []
  for (let i = 0; i < n; i++) {
    const prevIdx = i === 0 ? (closed ? n - 1 : 0) : i - 1
    const nextIdx = i === n - 1 ? (closed ? 0 : n - 1) : i + 1
    const prev = points[prevIdx]!
    const next = points[nextIdx]!
    const tx = next.x - prev.x
    const tz = next.z - prev.z
    const len = Math.hypot(tx, tz) || 1
    tangents.push({ x: tx / len, z: tz / len })
  }
  return tangents
}

const MAX_MITER_SCALE = 4

export function computeRibbonMiterScales(
  points: { x: number; z: number }[],
  closed: boolean,
  tangents: Tangent2D[],
): number[] {
  const n = points.length
  const scales = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const isStartOpen = !closed && i === 0
    const isEndOpen = !closed && i === n - 1
    if (isStartOpen || isEndOpen) {
      scales[i] = 1
      continue
    }
    const prevIdx = i === 0 ? n - 1 : i - 1
    const prev = points[prevIdx]!
    const curr = points[i]!
    const inDx = curr.x - prev.x
    const inDz = curr.z - prev.z
    const inLen = Math.hypot(inDx, inDz) || 1
    const inTx = inDx / inLen
    const inTz = inDz / inLen
    const bisTan = tangents[i]!
    const dot = bisTan.x * inTx + bisTan.z * inTz
    const safeDot = Math.max(Math.abs(dot), 1 / MAX_MITER_SCALE)
    scales[i] = 1 / safeDot
  }
  return scales
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
  const tangents = computeRibbonTangents(points, closed)
  const miters = computeRibbonMiterScales(points, closed, tangents)

  const leftPositions: Vector3[] = []
  const rightPositions: Vector3[] = []

  for (let i = 0; i < n; i++) {
    const p = points[i]!
    const tan = tangents[i]!
    const m = miters[i]!
    const nx = -tan.z * m
    const nz = tan.x * m

    leftPositions.push(new Vector3(p.x + nx * halfWidth, p.y + surfaceY, p.z + nz * halfWidth))
    rightPositions.push(new Vector3(p.x - nx * halfWidth, p.y + surfaceY, p.z - nz * halfWidth))
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

function segmentAllRibbonIndices(points: TrackRibbonPoint[], closed: boolean): number[] {
  const n = points.length
  const segmentCount = closed ? n : n - 1
  const indices: number[] = []

  for (let i = 0; i < segmentCount; i++) {
    const a = i
    const b = (i + 1) % n
    const iA_L = a * 2
    const iA_R = a * 2 + 1
    const iB_L = b * 2
    const iB_R = b * 2 + 1
    indices.push(iA_L, iB_L, iA_R)
    indices.push(iB_L, iB_R, iA_R)
  }

  return indices
}

export function buildEdgeLineGeometry(
  points: TrackRibbonPoint[],
  closed: boolean,
  parentWidth: number,
  side: 'left' | 'right',
  lineWidth: number,
): EdgeLineGeometryResult | null {
  return buildParentSideBandGeometry(
    points,
    closed,
    parentWidth,
    side,
    -lineWidth,
    lineWidth,
    TRACK_LAYER_Y_OFFSETS.EDGE_LINE,
  )
}

export function buildParentSideBandGeometry(
  points: TrackRibbonPoint[],
  closed: boolean,
  parentWidth: number,
  side: 'left' | 'right',
  innerOffset: number,
  bandWidth: number,
  yOffset = TRACK_LAYER_Y_OFFSETS.PAINTED_AREA,
): SideBandGeometryResult | null {
  const n = points.length
  if (n < 2 || parentWidth <= 0 || bandWidth <= 0) return null

  const halfParent = parentWidth / 2
  const innerDistance = halfParent + innerOffset
  const outerDistance = innerDistance + bandWidth
  const tangents = computeRibbonTangents(points, closed)
  const miters = computeRibbonMiterScales(points, closed, tangents)
  const leftPositions: Vector3[] = []
  const rightPositions: Vector3[] = []

  for (let i = 0; i < n; i++) {
    const p = points[i]!
    const tan = tangents[i]!
    const m = miters[i]!
    const nx = -tan.z * m
    const nz = tan.x * m
    const y = p.y + yOffset

    if (side === 'left') {
      leftPositions.push(new Vector3(p.x + nx * outerDistance, y, p.z + nz * outerDistance))
      rightPositions.push(new Vector3(p.x + nx * innerDistance, y, p.z + nz * innerDistance))
    } else {
      leftPositions.push(new Vector3(p.x - nx * innerDistance, y, p.z - nz * innerDistance))
      rightPositions.push(new Vector3(p.x - nx * outerDistance, y, p.z - nz * outerDistance))
    }
  }

  const frames = { leftPositions, rightPositions }
  const { positions, uvs, normals } = buildRibbonAttributes(frames)
  const indices = segmentAllRibbonIndices(points, closed)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  return { geometry, positions, uvs, normals, indices, frames }
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

export function buildRibbonLayers(
  points: TrackRibbonPoint[],
  closed: boolean,
  width: number,
): RibbonLayers | null {
  const asphalt = buildAsphaltGeometry(points, closed, width)
  if (!asphalt) return null

  const { positions, uvs, normals, mainIndices, pitIndices, geometry: mainGeometry } = asphalt

  const pitGeometry =
    pitIndices.length > 0
      ? buildPitLaneGeometry(points, closed, width, { positions, uvs, normals, pitIndices })?.geometry ?? null
      : null

  const collisionIndices = new Uint32Array(mainIndices.length + pitIndices.length)
  collisionIndices.set(mainIndices, 0)
  collisionIndices.set(pitIndices, mainIndices.length)

  return {
    mainGeometry,
    pitGeometry,
    collisionVertices: positions,
    collisionIndices,
    mainSensorVertices: positions,
    mainSensorIndices: new Uint32Array(mainIndices),
    pitSensorVertices: pitIndices.length > 0 ? positions : null,
    pitSensorIndices: pitIndices.length > 0 ? new Uint32Array(pitIndices) : null,
  }
}
