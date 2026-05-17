import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'
import { TRACK_LAYER_Y_OFFSETS } from '../../../../constants/trackLayers'
import type { TrackRibbonPoint } from '../../../../types/trackObjects'
import type { RibbonBoundary } from './ribbonBoundary'
import { buildRibbonBoundary } from './ribbonBoundary'
import { computeRibbonTangents, computeRibbonMiterScales } from './ribbonMath'

export { computeRibbonTangents, computeRibbonMiterScales, type Tangent2D } from './ribbonMath'

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

export function computeRibbonFramesFromBoundary(boundary: RibbonBoundary): RibbonFrames {
  return { leftPositions: boundary.left, rightPositions: boundary.right }
}

export function computeRibbonFrames(
  points: TrackRibbonPoint[],
  closed: boolean,
  width: number,
): RibbonFrames | null {
  const boundary = buildRibbonBoundary(points, closed, width)
  if (!boundary) return null
  return computeRibbonFramesFromBoundary(boundary)
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

export function buildEdgeLineFromBoundary(
  boundary: RibbonBoundary,
  side: 'left' | 'right',
  lineWidth: number,
  yOffset = TRACK_LAYER_Y_OFFSETS.EDGE_LINE,
): EdgeLineGeometryResult | null {
  return buildSideBandFromBoundary(boundary, side, -lineWidth, lineWidth, yOffset)
}

export function buildSideBandFromBoundary(
  boundary: RibbonBoundary,
  side: 'left' | 'right',
  innerOffset: number,
  bandWidth: number,
  yOffset = TRACK_LAYER_Y_OFFSETS.PAINTED_AREA,
): SideBandGeometryResult | null {
  if (bandWidth <= 0) return null

  const n = boundary.centerline.length
  const halfWidth = boundary.width / 2
  const leftPositions: Vector3[] = []
  const rightPositions: Vector3[] = []

  for (let i = 0; i < n; i++) {
    const p = boundary.centerline[i]!
    const boundaryVec = side === 'left' ? boundary.left[i]! : boundary.right[i]!
    const miterNx = boundaryVec.x - p.x
    const miterNz = boundaryVec.z - p.z
    const innerFactor = (halfWidth + innerOffset) / halfWidth
    const outerFactor = (halfWidth + innerOffset + bandWidth) / halfWidth
    const y = p.y + yOffset

    if (side === 'left') {
      leftPositions.push(new Vector3(p.x + miterNx * outerFactor, y, p.z + miterNz * outerFactor))
      rightPositions.push(new Vector3(p.x + miterNx * innerFactor, y, p.z + miterNz * innerFactor))
    } else {
      leftPositions.push(new Vector3(p.x + miterNx * innerFactor, y, p.z + miterNz * innerFactor))
      rightPositions.push(new Vector3(p.x + miterNx * outerFactor, y, p.z + miterNz * outerFactor))
    }
  }

  const frames = { leftPositions, rightPositions }
  const { positions, uvs, normals } = buildRibbonAttributes(frames)
  const indices = segmentAllRibbonIndices(boundary.centerline, boundary.closed)
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

const DEGENERATE_TRIANGLE_AREA_EPSILON = 1e-10

function filterDegenerateTriangles(positions: Float32Array, indices: number[]): Uint32Array {
  const kept: number[] = []
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i]! * 3
    const i1 = indices[i + 1]! * 3
    const i2 = indices[i + 2]! * 3
    const ax = positions[i1]! - positions[i0]!
    const az = positions[i1 + 2]! - positions[i0 + 2]!
    const bx = positions[i2]! - positions[i0]!
    const bz = positions[i2 + 2]! - positions[i0 + 2]!
    if (Math.abs(ax * bz - az * bx) > DEGENERATE_TRIANGLE_AREA_EPSILON) {
      kept.push(indices[i]!, indices[i + 1]!, indices[i + 2]!)
    }
  }
  return new Uint32Array(kept)
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

  const filteredMain = filterDegenerateTriangles(positions, mainIndices)
  const filteredPit = pitIndices.length > 0 ? filterDegenerateTriangles(positions, pitIndices) : null

  const collisionIndices = new Uint32Array(filteredMain.length + (filteredPit?.length ?? 0))
  collisionIndices.set(filteredMain, 0)
  if (filteredPit) collisionIndices.set(filteredPit, filteredMain.length)

  return {
    mainGeometry,
    pitGeometry,
    collisionVertices: positions,
    collisionIndices,
    mainSensorVertices: positions,
    mainSensorIndices: filteredMain,
    pitSensorVertices: pitIndices.length > 0 ? positions : null,
    pitSensorIndices: filteredPit,
  }
}
