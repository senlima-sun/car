import { create } from 'zustand'

export type ObjectType = 'cone' | 'ramp' | 'checkpoint' | 'barrier' | 'road' | 'curb'
export type TrackMode = 'straight' | 'curve'

export interface PlacedObject {
  id: string
  type: ObjectType
  position: [number, number, number]
  rotation: number // Y-axis rotation in radians
  // For linear/curved objects (barrier, road)
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  controlPoint?: [number, number, number] // For curves
  trackMode?: TrackMode // 'straight' or 'curve'
  // Edge positions of connected road at start/end (for seamless curve connections)
  startLeftEdge?: [number, number, number]
  startRightEdge?: [number, number, number]
  endLeftEdge?: [number, number, number]
  endRightEdge?: [number, number, number]
  // For curbs - reference to parent road
  parentRoadId?: string
  edgeSide?: 'left' | 'right'
  startT?: number // Parametric start position (0-1) along road
  endT?: number // Parametric end position (0-1) along road
}

type PlacementState =
  | 'idle'
  | 'selecting'
  | 'placing'
  | 'dragging'
  | 'placingControlPoint'
  | 'curbDragging'

// Curb drag state for tracking ongoing curb placement
export interface CurbDragState {
  roadId: string
  road: PlacedObject
  edge: 'left' | 'right'
  startT: number
  startPosition: [number, number, number]
}

// Partial delete state for tracking road segment deletion
export interface PartialDeleteState {
  roadId: string
  road: PlacedObject
  startT: number // Parametric position 0-1 along road
  startPosition: [number, number, number]
}

interface CustomizationState {
  placementState: PlacementState
  selectedObjectType: ObjectType | null
  trackMode: TrackMode // 'straight' or 'curve' for linear objects
  placedObjects: PlacedObject[]
  previewPosition: [number, number, number] | null
  previewRotation: number
  dragStartPoint: [number, number, number] | null
  controlPoint: [number, number, number] | null // For curve mode
  selectedObjectId: string | null
  deleteMode: boolean // When true, clicking objects selects them for deletion
  // Snap edge positions for seamless curve connections
  startSnapEdges: { left: [number, number, number]; right: [number, number, number] } | null
  endSnapEdges: { left: [number, number, number]; right: [number, number, number] } | null
  // Curb placement state
  curbDragState: CurbDragState | null
  curbPreviewEndT: number | null
  curbPreviewEndPosition: [number, number, number] | null
  // Partial delete state
  partialDeleteMode: boolean
  partialDeleteState: PartialDeleteState | null
  partialDeletePreviewT: number | null
  partialDeletePreviewPosition: [number, number, number] | null
  // Auto curb generation state
  autoCurbMode: boolean
  selectedRoadIds: string[]

  // Actions
  selectObjectType: (type: ObjectType | null) => void
  setTrackMode: (mode: TrackMode) => void
  setDeleteMode: (enabled: boolean) => void
  setPreviewPosition: (pos: [number, number, number] | null) => void
  setPreviewRotation: (rot: number) => void
  rotatePreviewCW: () => void
  rotatePreviewCCW: () => void
  startDrag: (
    startPoint: [number, number, number],
    snapEdges?: { left: [number, number, number]; right: [number, number, number] },
  ) => void
  setControlPoint: (point: [number, number, number]) => void
  setEndSnapEdges: (
    edges: { left: [number, number, number]; right: [number, number, number] } | null,
  ) => void
  confirmPlacement: () => void
  confirmCheckpointPlacement: (
    startPoint: [number, number, number],
    endPoint: [number, number, number],
  ) => void
  cancelPlacement: () => void
  selectObject: (id: string | null) => void
  removeObject: (id: string) => void
  clearAll: () => void
  loadFromStorage: () => void
  saveToStorage: () => void
  setPlacedObjects: (objects: PlacedObject[]) => void
  // Curb placement actions
  startCurbDrag: (
    roadId: string,
    road: PlacedObject,
    edge: 'left' | 'right',
    t: number,
    position: [number, number, number],
  ) => void
  updateCurbDrag: (t: number, position: [number, number, number]) => void
  confirmCurbPlacement: () => void
  cancelCurbPlacement: () => void
  // Partial delete actions
  setPartialDeleteMode: (enabled: boolean) => void
  startPartialDelete: (
    roadId: string,
    road: PlacedObject,
    t: number,
    position: [number, number, number],
  ) => void
  updatePartialDeletePreview: (t: number, position: [number, number, number]) => void
  confirmPartialDelete: () => void
  cancelPartialDelete: () => void
  // Auto curb generation actions
  setAutoCurbMode: (enabled: boolean) => void
  toggleRoadSelection: (roadId: string) => void
  clearRoadSelection: () => void
  addGeneratedCurbs: (curbs: PlacedObject[]) => void
}

const STORAGE_KEY = 'car-racing-track'
const ROTATION_STEP = Math.PI / 8 // 22.5 degrees
const SNAP_THRESHOLD = 2 // Distance within which to snap to endpoints

// Helper to check if object type is linear (uses start/end points)
export const isLinearObject = (type: ObjectType): boolean => {
  return type === 'barrier' || type === 'road'
}

// Snap point with edge positions for seamless curve connections
export interface SnapPointWithDirection {
  position: [number, number, number]
  direction: [number, number, number] // normalized direction vector pointing outward from the road
  leftEdge: [number, number, number] // left edge corner position at this endpoint
  rightEdge: [number, number, number] // right edge corner position at this endpoint
}

// Road width constant (should match OBJECT_CONFIGS.road.defaultSize.width)
const ROAD_WIDTH = 16

// Helper to get all snap points (endpoints) from placed linear objects with edge info
export const getSnapPoints = (placedObjects: PlacedObject[]): SnapPointWithDirection[] => {
  const points: SnapPointWithDirection[] = []
  const halfWidth = ROAD_WIDTH / 2

  for (const obj of placedObjects) {
    if (isLinearObject(obj.type) && obj.startPoint && obj.endPoint) {
      // Calculate direction from start to end
      const dx = obj.endPoint[0] - obj.startPoint[0]
      const dz = obj.endPoint[2] - obj.startPoint[2]
      const len = Math.sqrt(dx * dx + dz * dz)
      const dir: [number, number, number] = len > 0 ? [dx / len, 0, dz / len] : [0, 0, 1]

      // Perpendicular direction (left side when looking from start to end)
      const perpX = -dir[2]
      const perpZ = dir[0]

      // At start point
      const startLeft: [number, number, number] = [
        obj.startPoint[0] + perpX * halfWidth,
        0,
        obj.startPoint[2] + perpZ * halfWidth,
      ]
      const startRight: [number, number, number] = [
        obj.startPoint[0] - perpX * halfWidth,
        0,
        obj.startPoint[2] - perpZ * halfWidth,
      ]
      points.push({
        position: obj.startPoint,
        direction: [-dir[0], 0, -dir[2]],
        leftEdge: startLeft,
        rightEdge: startRight,
      })

      // At end point
      const endLeft: [number, number, number] = [
        obj.endPoint[0] + perpX * halfWidth,
        0,
        obj.endPoint[2] + perpZ * halfWidth,
      ]
      const endRight: [number, number, number] = [
        obj.endPoint[0] - perpX * halfWidth,
        0,
        obj.endPoint[2] - perpZ * halfWidth,
      ]
      points.push({
        position: obj.endPoint,
        direction: dir,
        leftEdge: endLeft,
        rightEdge: endRight,
      })
    }
  }
  return points
}

// Helper to find nearest snap point within threshold
export const findNearestSnapPoint = (
  pos: [number, number, number],
  snapPoints: SnapPointWithDirection[],
): SnapPointWithDirection | null => {
  let nearest: SnapPointWithDirection | null = null
  let minDist = SNAP_THRESHOLD

  for (const point of snapPoints) {
    const dx = pos[0] - point.position[0]
    const dz = pos[2] - point.position[2]
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < minDist) {
      minDist = dist
      nearest = point
    }
  }

  return nearest
}

// Result type for road edge detection
export interface RoadEdgeResult {
  roadId: string
  leftEdge: [number, number, number]
  rightEdge: [number, number, number]
  centerPoint: [number, number, number]
}

// Helper to find a straight road at given position and calculate edge points
export const findRoadAtPosition = (
  pos: [number, number, number],
  placedObjects: PlacedObject[],
  roadWidth: number = 16,
): RoadEdgeResult | null => {
  const halfWidth = roadWidth / 2

  for (const obj of placedObjects) {
    // Only check straight roads (not curved for now)
    if (obj.type !== 'road' || !obj.startPoint || !obj.endPoint || obj.trackMode === 'curve') {
      continue
    }

    const start = obj.startPoint
    const end = obj.endPoint

    // Road direction vector
    const dx = end[0] - start[0]
    const dz = end[2] - start[2]
    const length = Math.sqrt(dx * dx + dz * dz)
    if (length === 0) continue

    // Normalize direction
    const dirX = dx / length
    const dirZ = dz / length

    // Vector from start to click position
    const toClickX = pos[0] - start[0]
    const toClickZ = pos[2] - start[2]

    // Project click onto road line (dot product)
    const projection = toClickX * dirX + toClickZ * dirZ

    // Check if projection is within road length
    if (projection < 0 || projection > length) continue

    // Find closest point on road center line
    const closestX = start[0] + dirX * projection
    const closestZ = start[2] + dirZ * projection

    // Perpendicular distance to road center
    const perpDist = Math.sqrt(Math.pow(pos[0] - closestX, 2) + Math.pow(pos[2] - closestZ, 2))

    // Check if within road width
    if (perpDist <= halfWidth) {
      // Calculate perpendicular vector (90 degrees from direction)
      const perpX = -dirZ
      const perpZ = dirX

      // Calculate edge points at click position (along road length)
      const leftEdge: [number, number, number] = [
        closestX + perpX * halfWidth,
        0,
        closestZ + perpZ * halfWidth,
      ]
      const rightEdge: [number, number, number] = [
        closestX - perpX * halfWidth,
        0,
        closestZ - perpZ * halfWidth,
      ]

      return {
        roadId: obj.id,
        leftEdge,
        rightEdge,
        centerPoint: [closestX, 0, closestZ],
      }
    }
  }

  return null
}

// Result type for road edge hit detection (for curb placement)
export interface RoadEdgeHitResult {
  roadId: string
  road: PlacedObject
  edge: 'left' | 'right'
  t: number // Parametric position 0-1 along road
  worldPosition: [number, number, number] // Position on the edge
}

// Helper to find road edge at position (for curb placement)
// Returns which road, which edge (left/right), and parametric position along edge
export const findRoadEdgeAtPosition = (
  pos: [number, number, number],
  placedObjects: PlacedObject[],
  roadWidth: number = 16,
  edgeThreshold: number = 3, // How close to edge to detect
): RoadEdgeHitResult | null => {
  const halfWidth = roadWidth / 2

  for (const obj of placedObjects) {
    if (obj.type !== 'road' || !obj.startPoint || !obj.endPoint) {
      continue
    }

    if (obj.trackMode === 'curve' && obj.controlPoint) {
      // Handle curved roads
      const result = findCurvedRoadEdge(obj, pos, halfWidth, edgeThreshold)
      if (result) return result
    } else {
      // Handle straight roads
      const start = obj.startPoint
      const end = obj.endPoint

      const dx = end[0] - start[0]
      const dz = end[2] - start[2]
      const length = Math.sqrt(dx * dx + dz * dz)
      if (length === 0) continue

      const dirX = dx / length
      const dirZ = dz / length

      // Vector from start to click position
      const toClickX = pos[0] - start[0]
      const toClickZ = pos[2] - start[2]

      // Project click onto road line (dot product)
      const projection = toClickX * dirX + toClickZ * dirZ

      // Check if projection is within road length
      if (projection < 0 || projection > length) continue

      // Find closest point on road center line
      const closestX = start[0] + dirX * projection
      const closestZ = start[2] + dirZ * projection

      // Perpendicular vector (left side when looking from start to end)
      const perpX = -dirZ
      const perpZ = dirX

      // Calculate distance to each edge
      const leftEdgeX = closestX + perpX * halfWidth
      const leftEdgeZ = closestZ + perpZ * halfWidth
      const rightEdgeX = closestX - perpX * halfWidth
      const rightEdgeZ = closestZ - perpZ * halfWidth

      const distToLeft = Math.sqrt(
        Math.pow(pos[0] - leftEdgeX, 2) + Math.pow(pos[2] - leftEdgeZ, 2),
      )
      const distToRight = Math.sqrt(
        Math.pow(pos[0] - rightEdgeX, 2) + Math.pow(pos[2] - rightEdgeZ, 2),
      )

      // Check if close enough to an edge
      if (distToLeft <= edgeThreshold) {
        return {
          roadId: obj.id,
          road: obj,
          edge: 'left',
          t: projection / length,
          worldPosition: [leftEdgeX, 0, leftEdgeZ],
        }
      }
      if (distToRight <= edgeThreshold) {
        return {
          roadId: obj.id,
          road: obj,
          edge: 'right',
          t: projection / length,
          worldPosition: [rightEdgeX, 0, rightEdgeZ],
        }
      }
    }
  }

  return null
}

// Helper for curved road edge detection
const findCurvedRoadEdge = (
  road: PlacedObject,
  pos: [number, number, number],
  halfWidth: number,
  edgeThreshold: number,
): RoadEdgeHitResult | null => {
  if (!road.startPoint || !road.endPoint || !road.controlPoint) return null

  const SAMPLES = 32
  let bestResult: RoadEdgeHitResult | null = null
  let bestDist = edgeThreshold

  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES

    // Quadratic bezier formula: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
    const t1 = 1 - t
    const curveX =
      t1 * t1 * road.startPoint[0] + 2 * t1 * t * road.controlPoint[0] + t * t * road.endPoint[0]
    const curveZ =
      t1 * t1 * road.startPoint[2] + 2 * t1 * t * road.controlPoint[2] + t * t * road.endPoint[2]

    // Calculate tangent: B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
    const tangentX =
      2 * t1 * (road.controlPoint[0] - road.startPoint[0]) +
      2 * t * (road.endPoint[0] - road.controlPoint[0])
    const tangentZ =
      2 * t1 * (road.controlPoint[2] - road.startPoint[2]) +
      2 * t * (road.endPoint[2] - road.controlPoint[2])
    const tangentLen = Math.sqrt(tangentX * tangentX + tangentZ * tangentZ)
    if (tangentLen === 0) continue

    // Perpendicular (left side)
    const perpX = -tangentZ / tangentLen
    const perpZ = tangentX / tangentLen

    // Edge positions
    const leftEdgeX = curveX + perpX * halfWidth
    const leftEdgeZ = curveZ + perpZ * halfWidth
    const rightEdgeX = curveX - perpX * halfWidth
    const rightEdgeZ = curveZ - perpZ * halfWidth

    const distToLeft = Math.sqrt(Math.pow(pos[0] - leftEdgeX, 2) + Math.pow(pos[2] - leftEdgeZ, 2))
    const distToRight = Math.sqrt(
      Math.pow(pos[0] - rightEdgeX, 2) + Math.pow(pos[2] - rightEdgeZ, 2),
    )

    if (distToLeft < bestDist) {
      bestDist = distToLeft
      bestResult = {
        roadId: road.id,
        road,
        edge: 'left',
        t,
        worldPosition: [leftEdgeX, 0, leftEdgeZ],
      }
    }
    if (distToRight < bestDist) {
      bestDist = distToRight
      bestResult = {
        roadId: road.id,
        road,
        edge: 'right',
        t,
        worldPosition: [rightEdgeX, 0, rightEdgeZ],
      }
    }
  }

  return bestResult
}

// Get edge position at parametric t for a road
export const getRoadEdgePositionAt = (
  road: PlacedObject,
  edge: 'left' | 'right',
  t: number,
  halfWidth: number = 8,
): [number, number, number] => {
  if (road.trackMode === 'curve' && road.controlPoint && road.startPoint && road.endPoint) {
    // Curved road - use bezier
    const t1 = 1 - t
    const curveX =
      t1 * t1 * road.startPoint[0] + 2 * t1 * t * road.controlPoint[0] + t * t * road.endPoint[0]
    const curveZ =
      t1 * t1 * road.startPoint[2] + 2 * t1 * t * road.controlPoint[2] + t * t * road.endPoint[2]

    const tangentX =
      2 * t1 * (road.controlPoint[0] - road.startPoint[0]) +
      2 * t * (road.endPoint[0] - road.controlPoint[0])
    const tangentZ =
      2 * t1 * (road.controlPoint[2] - road.startPoint[2]) +
      2 * t * (road.endPoint[2] - road.controlPoint[2])
    const tangentLen = Math.sqrt(tangentX * tangentX + tangentZ * tangentZ)

    if (tangentLen > 0) {
      const perpX = -tangentZ / tangentLen
      const perpZ = tangentX / tangentLen
      const sign = edge === 'left' ? 1 : -1
      return [curveX + perpX * halfWidth * sign, 0, curveZ + perpZ * halfWidth * sign]
    }
  }

  // Straight road
  if (road.startPoint && road.endPoint) {
    const dx = road.endPoint[0] - road.startPoint[0]
    const dz = road.endPoint[2] - road.startPoint[2]
    const length = Math.sqrt(dx * dx + dz * dz)

    if (length > 0) {
      const dirX = dx / length
      const dirZ = dz / length
      const perpX = -dirZ
      const perpZ = dirX

      const posX = road.startPoint[0] + dx * t
      const posZ = road.startPoint[2] + dz * t
      const sign = edge === 'left' ? 1 : -1

      return [posX + perpX * halfWidth * sign, 0, posZ + perpZ * halfWidth * sign]
    }
  }

  return [0, 0, 0]
}

// Result type for road surface hit detection (for partial delete)
export interface RoadSurfaceHitResult {
  roadId: string
  road: PlacedObject
  t: number // Parametric position 0-1 along road
  centerPosition: [number, number, number] // Position on the center line
}

// Helper to find road surface at position (anywhere on road, not just edges)
export const findRoadSurfaceAtPosition = (
  pos: [number, number, number],
  placedObjects: PlacedObject[],
  roadWidth: number = 16,
): RoadSurfaceHitResult | null => {
  const halfWidth = roadWidth / 2

  for (const obj of placedObjects) {
    if (obj.type !== 'road' || !obj.startPoint || !obj.endPoint) {
      continue
    }

    if (obj.trackMode === 'curve' && obj.controlPoint) {
      // Handle curved roads
      const result = findCurvedRoadSurface(obj, pos, halfWidth)
      if (result) return result
    } else {
      // Handle straight roads
      const start = obj.startPoint
      const end = obj.endPoint

      const dx = end[0] - start[0]
      const dz = end[2] - start[2]
      const length = Math.sqrt(dx * dx + dz * dz)
      if (length === 0) continue

      const dirX = dx / length
      const dirZ = dz / length

      // Vector from start to click position
      const toClickX = pos[0] - start[0]
      const toClickZ = pos[2] - start[2]

      // Project click onto road line (dot product)
      const projection = toClickX * dirX + toClickZ * dirZ

      // Check if projection is within road length
      if (projection < 0 || projection > length) continue

      // Find closest point on road center line
      const closestX = start[0] + dirX * projection
      const closestZ = start[2] + dirZ * projection

      // Perpendicular distance to road center
      const perpDist = Math.sqrt(Math.pow(pos[0] - closestX, 2) + Math.pow(pos[2] - closestZ, 2))

      // Check if within road width
      if (perpDist <= halfWidth) {
        return {
          roadId: obj.id,
          road: obj,
          t: projection / length,
          centerPosition: [closestX, 0, closestZ],
        }
      }
    }
  }

  return null
}

// Helper for curved road surface detection
const findCurvedRoadSurface = (
  road: PlacedObject,
  pos: [number, number, number],
  halfWidth: number,
): RoadSurfaceHitResult | null => {
  if (!road.startPoint || !road.endPoint || !road.controlPoint) return null

  const SAMPLES = 48
  let bestResult: RoadSurfaceHitResult | null = null
  let bestDist = halfWidth

  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES

    // Quadratic bezier formula: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
    const t1 = 1 - t
    const curveX =
      t1 * t1 * road.startPoint[0] + 2 * t1 * t * road.controlPoint[0] + t * t * road.endPoint[0]
    const curveZ =
      t1 * t1 * road.startPoint[2] + 2 * t1 * t * road.controlPoint[2] + t * t * road.endPoint[2]

    // Distance from click to this point on curve
    const dist = Math.sqrt(Math.pow(pos[0] - curveX, 2) + Math.pow(pos[2] - curveZ, 2))

    if (dist < bestDist) {
      bestDist = dist
      bestResult = {
        roadId: road.id,
        road,
        t,
        centerPosition: [curveX, 0, curveZ],
      }
    }
  }

  return bestResult
}

// Helper to get center position at parametric t for a road
export const getRoadCenterPositionAt = (
  road: PlacedObject,
  t: number,
): [number, number, number] => {
  if (!road.startPoint || !road.endPoint) return [0, 0, 0]

  if (road.trackMode === 'curve' && road.controlPoint) {
    // Curved road - use bezier
    const t1 = 1 - t
    return [
      t1 * t1 * road.startPoint[0] + 2 * t1 * t * road.controlPoint[0] + t * t * road.endPoint[0],
      0,
      t1 * t1 * road.startPoint[2] + 2 * t1 * t * road.controlPoint[2] + t * t * road.endPoint[2],
    ]
  }

  // Straight road - linear interpolation
  return [
    road.startPoint[0] + (road.endPoint[0] - road.startPoint[0]) * t,
    0,
    road.startPoint[2] + (road.endPoint[2] - road.startPoint[2]) * t,
  ]
}

// Helper to split a road at given t values, returning 0-2 new road segments
export const splitRoadAtSegment = (
  road: PlacedObject,
  deleteStartT: number,
  deleteEndT: number,
  generateIdFn: () => string,
): PlacedObject[] => {
  if (!road.startPoint || !road.endPoint) return []

  const results: PlacedObject[] = []
  const MIN_T_THRESHOLD = 0.05 // Minimum segment length as fraction of road

  // Ensure proper ordering
  const startT = Math.min(deleteStartT, deleteEndT)
  const endT = Math.max(deleteStartT, deleteEndT)

  if (road.trackMode === 'curve' && road.controlPoint) {
    // Split curved road using bezier subdivision
    if (startT > MIN_T_THRESHOLD) {
      const segment = subdivideBezier(road.startPoint, road.controlPoint, road.endPoint, 0, startT)
      results.push({
        id: generateIdFn(),
        type: 'road',
        position: [
          (segment.start[0] + segment.end[0]) / 2,
          0,
          (segment.start[2] + segment.end[2]) / 2,
        ],
        rotation: 0,
        startPoint: segment.start,
        endPoint: segment.end,
        controlPoint: segment.control,
        trackMode: 'curve',
      })
    }

    if (endT < 1 - MIN_T_THRESHOLD) {
      const segment = subdivideBezier(road.startPoint, road.controlPoint, road.endPoint, endT, 1)
      results.push({
        id: generateIdFn(),
        type: 'road',
        position: [
          (segment.start[0] + segment.end[0]) / 2,
          0,
          (segment.start[2] + segment.end[2]) / 2,
        ],
        rotation: 0,
        startPoint: segment.start,
        endPoint: segment.end,
        controlPoint: segment.control,
        trackMode: 'curve',
      })
    }
  } else {
    // Split straight road using linear interpolation
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    if (startT > MIN_T_THRESHOLD) {
      const newEnd: [number, number, number] = [
        lerp(road.startPoint[0], road.endPoint[0], startT),
        0,
        lerp(road.startPoint[2], road.endPoint[2], startT),
      ]
      const dx = newEnd[0] - road.startPoint[0]
      const dz = newEnd[2] - road.startPoint[2]
      results.push({
        id: generateIdFn(),
        type: 'road',
        position: [(road.startPoint[0] + newEnd[0]) / 2, 0, (road.startPoint[2] + newEnd[2]) / 2],
        rotation: Math.atan2(dx, dz),
        startPoint: road.startPoint,
        endPoint: newEnd,
        trackMode: 'straight',
      })
    }

    if (endT < 1 - MIN_T_THRESHOLD) {
      const newStart: [number, number, number] = [
        lerp(road.startPoint[0], road.endPoint[0], endT),
        0,
        lerp(road.startPoint[2], road.endPoint[2], endT),
      ]
      const dx = road.endPoint[0] - newStart[0]
      const dz = road.endPoint[2] - newStart[2]
      results.push({
        id: generateIdFn(),
        type: 'road',
        position: [(newStart[0] + road.endPoint[0]) / 2, 0, (newStart[2] + road.endPoint[2]) / 2],
        rotation: Math.atan2(dx, dz),
        startPoint: newStart,
        endPoint: road.endPoint,
        trackMode: 'straight',
      })
    }
  }

  return results
}

// De Casteljau subdivision for quadratic bezier curve
// Extracts the segment [t0, t1] from the original curve
const subdivideBezier = (
  P0: [number, number, number],
  P1: [number, number, number], // control point
  P2: [number, number, number],
  t0: number,
  t1: number,
): {
  start: [number, number, number]
  control: [number, number, number]
  end: [number, number, number]
} => {
  // Helper: linear interpolation between two points
  const lerp = (
    a: [number, number, number],
    b: [number, number, number],
    t: number,
  ): [number, number, number] => [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t]

  // De Casteljau split at parameter t returns left and right subcurves
  // For quadratic bezier: split at t gives:
  // Left curve: [P0, lerp(P0,P1,t), B(t)]
  // Right curve: [B(t), lerp(P1,P2,t), P2]
  const splitAt = (
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    t: number,
  ) => {
    const q0 = lerp(p0, p1, t)
    const q1 = lerp(p1, p2, t)
    const r0 = lerp(q0, q1, t) // This is B(t)
    return {
      left: { start: p0, control: q0, end: r0 },
      right: { start: r0, control: q1, end: p2 },
    }
  }

  // To extract segment [t0, t1]:
  // 1. Split at t1 to get [0, t1] (left part)
  // 2. Split that at t0/t1 to get [t0, t1]

  if (t0 === 0) {
    // Just need to split at t1 and take the left part
    const split = splitAt(P0, P1, P2, t1)
    return split.left
  }

  if (t1 === 1) {
    // Just need to split at t0 and take the right part
    const split = splitAt(P0, P1, P2, t0)
    return split.right
  }

  // General case: extract [t0, t1]
  // First split at t1 to get the curve [0, t1]
  const firstSplit = splitAt(P0, P1, P2, t1)
  const leftCurve = firstSplit.left

  // Now we need to extract [t0, t1] from [0, t1]
  // The parameter t0 in original curve maps to t0/t1 in the left curve
  const remappedT0 = t0 / t1
  const secondSplit = splitAt(leftCurve.start, leftCurve.control, leftCurve.end, remappedT0)

  // The right part of this split is our desired segment [t0, t1]
  return secondSplit.right
}

const generateId = (): string => {
  return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const useCustomizationStore = create<CustomizationState>((set, get) => ({
  placementState: 'idle',
  selectedObjectType: null,
  trackMode: 'straight',
  placedObjects: [],
  previewPosition: null,
  previewRotation: 0,
  dragStartPoint: null,
  controlPoint: null,
  selectedObjectId: null,
  deleteMode: false,
  startSnapEdges: null,
  endSnapEdges: null,
  curbDragState: null,
  curbPreviewEndT: null,
  curbPreviewEndPosition: null,
  partialDeleteMode: false,
  partialDeleteState: null,
  partialDeletePreviewT: null,
  partialDeletePreviewPosition: null,
  autoCurbMode: false,
  selectedRoadIds: [],

  selectObjectType: type => {
    if (type === null) {
      set({
        selectedObjectType: null,
        placementState: 'idle',
        previewPosition: null,
        dragStartPoint: null,
        controlPoint: null,
        startSnapEdges: null,
        endSnapEdges: null,
      })
    } else {
      set({
        selectedObjectType: type,
        placementState: 'selecting',
        previewRotation: 0,
        dragStartPoint: null,
        controlPoint: null,
        selectedObjectId: null,
        startSnapEdges: null,
        endSnapEdges: null,
      })
    }
  },

  setTrackMode: mode =>
    set({
      trackMode: mode,
      // Reset placement state when switching modes
      placementState: get().selectedObjectType ? 'selecting' : 'idle',
      dragStartPoint: null,
      controlPoint: null,
      startSnapEdges: null,
      endSnapEdges: null,
    }),

  setDeleteMode: enabled =>
    set({
      deleteMode: enabled,
      // Clear selection when exiting delete mode
      selectedObjectId: enabled ? get().selectedObjectId : null,
    }),

  setPreviewPosition: pos => set({ previewPosition: pos }),

  setPreviewRotation: rot => set({ previewRotation: rot }),

  rotatePreviewCW: () =>
    set(state => ({
      previewRotation: state.previewRotation + ROTATION_STEP,
    })),

  rotatePreviewCCW: () =>
    set(state => ({
      previewRotation: state.previewRotation - ROTATION_STEP,
    })),

  startDrag: (startPoint, snapEdges) =>
    set({
      dragStartPoint: startPoint,
      placementState: 'dragging',
      startSnapEdges: snapEdges || null,
    }),

  setControlPoint: point =>
    set({
      controlPoint: point,
      placementState: 'placingControlPoint',
    }),

  setEndSnapEdges: edges =>
    set({
      endSnapEdges: edges,
    }),

  confirmPlacement: () => {
    const state = get()
    const {
      selectedObjectType,
      previewPosition,
      previewRotation,
      dragStartPoint,
      controlPoint,
      trackMode,
      startSnapEdges,
      endSnapEdges,
    } = state

    if (!selectedObjectType || !previewPosition) return

    const newObject: PlacedObject = {
      id: generateId(),
      type: selectedObjectType,
      position: previewPosition,
      rotation: previewRotation,
    }

    // For linear/curved objects, include start/end points
    if (isLinearObject(selectedObjectType) && dragStartPoint) {
      newObject.startPoint = dragStartPoint
      newObject.endPoint = previewPosition
      newObject.trackMode = trackMode

      if (trackMode === 'curve' && controlPoint) {
        newObject.controlPoint = controlPoint
        // Store snap edge positions for seamless curve connections
        if (startSnapEdges) {
          newObject.startLeftEdge = startSnapEdges.left
          newObject.startRightEdge = startSnapEdges.right
        }
        if (endSnapEdges) {
          newObject.endLeftEdge = endSnapEdges.left
          newObject.endRightEdge = endSnapEdges.right
        }
        // For curves, position is still at midpoint for reference
        newObject.position = [
          (dragStartPoint[0] + previewPosition[0]) / 2,
          0,
          (dragStartPoint[2] + previewPosition[2]) / 2,
        ]
      } else {
        // Straight line - calculate position as midpoint
        newObject.position = [
          (dragStartPoint[0] + previewPosition[0]) / 2,
          0,
          (dragStartPoint[2] + previewPosition[2]) / 2,
        ]
        // Calculate rotation from direction
        const dx = previewPosition[0] - dragStartPoint[0]
        const dz = previewPosition[2] - dragStartPoint[2]
        newObject.rotation = Math.atan2(dx, dz)
      }
    }

    set(state => ({
      placedObjects: [...state.placedObjects, newObject],
      placementState: 'selecting',
      dragStartPoint: null,
      controlPoint: null,
      startSnapEdges: null,
      endSnapEdges: null,
    }))

    // Auto-save after placement
    setTimeout(() => get().saveToStorage(), 0)
  },

  confirmCheckpointPlacement: (startPoint, endPoint) => {
    const newObject: PlacedObject = {
      id: generateId(),
      type: 'checkpoint',
      position: [(startPoint[0] + endPoint[0]) / 2, 0, (startPoint[2] + endPoint[2]) / 2],
      rotation: Math.atan2(endPoint[0] - startPoint[0], endPoint[2] - startPoint[2]),
      startPoint,
      endPoint,
    }

    // Replace existing checkpoint (only one allowed per track)
    set(state => ({
      placedObjects: [...state.placedObjects.filter(obj => obj.type !== 'checkpoint'), newObject],
      placementState: 'selecting',
    }))

    // Auto-save after placement
    setTimeout(() => get().saveToStorage(), 0)
  },

  cancelPlacement: () =>
    set({
      placementState: get().selectedObjectType ? 'selecting' : 'idle',
      dragStartPoint: null,
      controlPoint: null,
      previewPosition: null,
      startSnapEdges: null,
      endSnapEdges: null,
    }),

  selectObject: id =>
    set({
      selectedObjectId: id,
      selectedObjectType: null,
      placementState: 'idle',
    }),

  removeObject: id => {
    set(state => {
      const objectToRemove = state.placedObjects.find(obj => obj.id === id)
      let idsToRemove = [id]

      // If removing a road, also remove attached curbs
      if (objectToRemove?.type === 'road') {
        const attachedCurbIds = state.placedObjects
          .filter(obj => obj.type === 'curb' && obj.parentRoadId === id)
          .map(obj => obj.id)
        idsToRemove = [...idsToRemove, ...attachedCurbIds]
      }

      return {
        placedObjects: state.placedObjects.filter(obj => !idsToRemove.includes(obj.id)),
        selectedObjectId: idsToRemove.includes(state.selectedObjectId || '')
          ? null
          : state.selectedObjectId,
      }
    })
    // Auto-save after removal
    setTimeout(() => get().saveToStorage(), 0)
  },

  clearAll: () => {
    set({
      placedObjects: [],
      selectedObjectId: null,
    })
    localStorage.removeItem(STORAGE_KEY)
  },

  loadFromStorage: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const objects = JSON.parse(data) as PlacedObject[]
        set({ placedObjects: objects })
      }
    } catch (e) {
      console.error('Failed to load track from storage:', e)
    }
  },

  saveToStorage: () => {
    try {
      const { placedObjects } = get()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(placedObjects))
    } catch (e) {
      console.error('Failed to save track to storage:', e)
    }
  },

  setPlacedObjects: (objects: PlacedObject[]) => {
    set({
      placedObjects: objects,
      selectedObjectId: null,
      placementState: 'idle',
      selectedObjectType: null,
    })
  },

  // Curb placement actions
  startCurbDrag: (roadId, road, edge, t, position) =>
    set({
      curbDragState: { roadId, road, edge, startT: t, startPosition: position },
      curbPreviewEndT: t,
      curbPreviewEndPosition: position,
      placementState: 'curbDragging',
    }),

  updateCurbDrag: (t, position) =>
    set({
      curbPreviewEndT: t,
      curbPreviewEndPosition: position,
    }),

  confirmCurbPlacement: () => {
    const state = get()
    const { curbDragState, curbPreviewEndT } = state

    if (!curbDragState || curbPreviewEndT === null) return

    // Ensure startT < endT for consistent ordering
    const startT = Math.min(curbDragState.startT, curbPreviewEndT)
    const endT = Math.max(curbDragState.startT, curbPreviewEndT)

    // Minimum curb length check (at least 5% of road length)
    if (Math.abs(endT - startT) < 0.05) return

    const newCurb: PlacedObject = {
      id: generateId(),
      type: 'curb',
      position: [0, 0, 0], // Will be calculated from parent road
      rotation: 0,
      parentRoadId: curbDragState.roadId,
      edgeSide: curbDragState.edge,
      startT,
      endT,
    }

    set(state => ({
      placedObjects: [...state.placedObjects, newCurb],
      placementState: 'selecting',
      curbDragState: null,
      curbPreviewEndT: null,
      curbPreviewEndPosition: null,
    }))

    // Auto-save after placement
    setTimeout(() => get().saveToStorage(), 0)
  },

  cancelCurbPlacement: () =>
    set({
      placementState: get().selectedObjectType ? 'selecting' : 'idle',
      curbDragState: null,
      curbPreviewEndT: null,
      curbPreviewEndPosition: null,
    }),

  // Partial delete actions
  setPartialDeleteMode: enabled =>
    set({
      partialDeleteMode: enabled,
      partialDeleteState: null,
      partialDeletePreviewT: null,
      partialDeletePreviewPosition: null,
      // Clear other modes when enabling partial delete
      ...(enabled
        ? {
            selectedObjectType: null,
            deleteMode: false,
            placementState: 'idle',
          }
        : {}),
    }),

  startPartialDelete: (roadId, road, t, position) =>
    set({
      partialDeleteState: { roadId, road, startT: t, startPosition: position },
      partialDeletePreviewT: t,
      partialDeletePreviewPosition: position,
    }),

  updatePartialDeletePreview: (t, position) =>
    set({
      partialDeletePreviewT: t,
      partialDeletePreviewPosition: position,
    }),

  confirmPartialDelete: () => {
    const state = get()
    const { partialDeleteState, partialDeletePreviewT, placedObjects } = state

    if (!partialDeleteState || partialDeletePreviewT === null) return

    const deleteStartT = Math.min(partialDeleteState.startT, partialDeletePreviewT)
    const deleteEndT = Math.max(partialDeleteState.startT, partialDeletePreviewT)

    // Minimum segment length check (at least 5% of road)
    if (Math.abs(deleteEndT - deleteStartT) < 0.05) return

    // Split the road into remaining segments
    const newRoads = splitRoadAtSegment(
      partialDeleteState.road,
      deleteStartT,
      deleteEndT,
      generateId,
    )

    // Handle attached curbs
    const attachedCurbs = placedObjects.filter(
      obj => obj.type === 'curb' && obj.parentRoadId === partialDeleteState.roadId,
    )

    const updatedCurbs: PlacedObject[] = []
    for (const curb of attachedCurbs) {
      const curbStart = curb.startT ?? 0
      const curbEnd = curb.endT ?? 1

      if (curbEnd <= deleteStartT && newRoads.length > 0) {
        // Curb is entirely before deletion - keep and remap to first new road
        // Remap t values: old range [0, deleteStartT] -> new range [0, 1]
        const remapT = (t: number) => t / deleteStartT
        updatedCurbs.push({
          ...curb,
          id: generateId(),
          parentRoadId: newRoads[0].id,
          startT: remapT(curbStart),
          endT: remapT(curbEnd),
        })
      } else if (curbStart >= deleteEndT && newRoads.length > (deleteStartT > 0.05 ? 1 : 0)) {
        // Curb is entirely after deletion - remap to second (or first if no first segment) new road
        const targetRoadIndex = deleteStartT > 0.05 ? 1 : 0
        if (newRoads[targetRoadIndex]) {
          // Remap t values: old range [deleteEndT, 1] -> new range [0, 1]
          const remapT = (t: number) => (t - deleteEndT) / (1 - deleteEndT)
          updatedCurbs.push({
            ...curb,
            id: generateId(),
            parentRoadId: newRoads[targetRoadIndex].id,
            startT: remapT(curbStart),
            endT: remapT(curbEnd),
          })
        }
      }
      // Curbs that overlap the deletion zone are removed (not added to updatedCurbs)
    }

    // Update state: remove original road and curbs, add new roads and remapped curbs
    set(state => ({
      placedObjects: [
        ...state.placedObjects.filter(
          obj => obj.id !== partialDeleteState.roadId && !attachedCurbs.some(c => c.id === obj.id),
        ),
        ...newRoads,
        ...updatedCurbs,
      ],
      partialDeleteState: null,
      partialDeletePreviewT: null,
      partialDeletePreviewPosition: null,
      // Stay in partial delete mode for more deletions
    }))

    // Auto-save after partial delete
    setTimeout(() => get().saveToStorage(), 0)
  },

  cancelPartialDelete: () =>
    set({
      partialDeleteState: null,
      partialDeletePreviewT: null,
      partialDeletePreviewPosition: null,
    }),

  // Auto curb generation actions
  setAutoCurbMode: enabled =>
    set({
      autoCurbMode: enabled,
      selectedRoadIds: enabled ? get().selectedRoadIds : [],
      // Clear other modes when enabling auto curb mode
      deleteMode: false,
      partialDeleteMode: false,
      selectedObjectType: null,
      placementState: 'idle',
    }),

  toggleRoadSelection: roadId =>
    set(state => ({
      selectedRoadIds: state.selectedRoadIds.includes(roadId)
        ? state.selectedRoadIds.filter(id => id !== roadId)
        : [...state.selectedRoadIds, roadId],
    })),

  clearRoadSelection: () => set({ selectedRoadIds: [] }),

  addGeneratedCurbs: curbs => {
    set(state => ({
      placedObjects: [...state.placedObjects, ...curbs],
    }))
    setTimeout(() => get().saveToStorage(), 0)
  },
}))
